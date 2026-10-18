package queue

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/codebench/codebench/api/internal/config"
)

func TestEmbeddedNATS(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "codebench-nats-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cfg := &config.Config{
		NATSEmbedded: true,
		NATSPort:     -1, // random free port
		NATSStoreDir: filepath.Join(tempDir, "store"),
		NATSToken:    "test-token",
		NATSURL:      "",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mgr, err := New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to initialize embedded NATS manager: %v", err)
	}
	defer mgr.Close()

	if !mgr.Ping() {
		t.Errorf("Expected NATS ping to be true")
	}

	// Test publishing to JetStream
	js := mgr.JetStream()
	_, err = js.Publish("jobs.test", []byte(`{"test":"hello"}`))
	if err != nil {
		t.Errorf("Failed to publish to jobs.test: %v", err)
	}
}
