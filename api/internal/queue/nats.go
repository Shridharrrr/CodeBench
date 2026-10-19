package queue

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/codebench/codebench/api/internal/config"
	"github.com/nats-io/nats-server/v2/server"
	"github.com/nats-io/nats.go"
)

type NATSManager struct {
	server *server.Server
	conn   *nats.Conn
	js     nats.JetStreamContext
}

func New(ctx context.Context, cfg *config.Config) (*NATSManager, error) {
	mgr := &NATSManager{}

	if cfg.NATSEmbedded {
		slog.Info("Starting embedded NATS JetStream server...", "port", cfg.NATSPort, "storeDir", cfg.NATSStoreDir)
		_ = os.MkdirAll(cfg.NATSStoreDir, 0755)

		opts := &server.Options{
			ServerName: "codebench-embedded",
			Host:       "0.0.0.0",
			Port:       cfg.NATSPort,
			JetStream:  true,
			StoreDir:   cfg.NATSStoreDir,
			NoLog:      false,
			NoSigs:     true,
		}

		if cfg.NATSToken != "" {
			opts.Authorization = cfg.NATSToken
			opts.Users = []*server.User{
				{
					Username: cfg.NATSToken,
					Permissions: &server.Permissions{
						Publish:   &server.SubjectPermission{Allow: []string{">"}},
						Subscribe: &server.SubjectPermission{Allow: []string{">"}},
					},
				},
			}
		}

		ns, err := server.NewServer(opts)
		if err != nil {
			return nil, fmt.Errorf("failed to create embedded NATS server: %w", err)
		}

		go ns.Start()

		if !ns.ReadyForConnections(10 * time.Second) {
			return nil, fmt.Errorf("embedded NATS server failed to become ready in 10s")
		}

		mgr.server = ns
		slog.Info("Embedded NATS server is ready and listening", "addr", ns.ClientURL())
	}

	// Connect NATS client
	targetURL := cfg.NATSURL
	if cfg.NATSEmbedded && mgr.server != nil {
		targetURL = mgr.server.ClientURL()
	}

	var natsOpts []nats.Option
	if cfg.NATSToken != "" {
		natsOpts = append(natsOpts, nats.Token(cfg.NATSToken))
	}
	natsOpts = append(natsOpts, nats.Name("codebench-api"))
	natsOpts = append(natsOpts, nats.MaxReconnects(-1))
	natsOpts = append(natsOpts, nats.ReconnectWait(1*time.Second))

	nc, err := nats.Connect(targetURL, natsOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS at %s: %w", targetURL, err)
	}
	mgr.conn = nc

	// Create JetStream Context
	js, err := nc.JetStream()
	if err != nil {
		return nil, fmt.Errorf("failed to get JetStream context: %w", err)
	}
	mgr.js = js

	// Initialize streams
	if err := mgr.initStreams(); err != nil {
		return nil, fmt.Errorf("failed to initialize JetStream streams: %w", err)
	}

	return mgr, nil
}

func (m *NATSManager) initStreams() error {
	// Jobs stream: support priority lanes (jobs.submissions.priority, jobs.submissions.standard, jobs.submissions.rejudge)
	cfg := &nats.StreamConfig{
		Name:      "CODEBENCH_JOBS",
		Subjects:  []string{"jobs.>"},
		Storage:   nats.MemoryStorage, // memory storage for fast local testing or file for persistence
		Retention: nats.WorkQueuePolicy,
		MaxAge:    24 * time.Hour,
	}
	_, err := m.js.AddStream(cfg)
	if err != nil {
		slog.Debug("Stream CODEBENCH_JOBS might already exist, updating configuration...", "err", err)
		_, _ = m.js.UpdateStream(cfg)
	}

	// Verdicts stream
	vcfg := &nats.StreamConfig{
		Name:      "CODEBENCH_VERDICTS",
		Subjects:  []string{"verdicts.>"},
		Storage:   nats.MemoryStorage,
		Retention: nats.InterestPolicy,
		MaxAge:    24 * time.Hour,
	}
	_, err = m.js.AddStream(vcfg)
	if err != nil {
		slog.Debug("Stream CODEBENCH_VERDICTS might already exist, updating configuration...", "err", err)
		_, _ = m.js.UpdateStream(vcfg)
	}

	return nil
}

func (m *NATSManager) JetStream() nats.JetStreamContext {
	return m.js
}

func (m *NATSManager) Conn() *nats.Conn {
	return m.conn
}

func (m *NATSManager) Close() {
	if m.conn != nil {
		m.conn.Close()
	}
	if m.server != nil {
		m.server.Shutdown()
		m.server.WaitForShutdown()
	}
}

func (m *NATSManager) Ping() bool {
	return m.conn != nil && m.conn.Status() == nats.CONNECTED
}
