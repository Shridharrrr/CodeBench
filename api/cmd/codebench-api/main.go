package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/codebench/codebench/api/internal/config"
	"github.com/codebench/codebench/api/internal/database"
	"github.com/codebench/codebench/api/internal/events"
	"github.com/codebench/codebench/api/internal/fakejudge"
	"github.com/codebench/codebench/api/internal/handlers"
	"github.com/codebench/codebench/api/internal/outbox"
	"github.com/codebench/codebench/api/internal/queue"
	"github.com/codebench/codebench/api/internal/seed"
	"github.com/codebench/codebench/api/internal/verdict"
)

func main() {
	// Initialize structured logger
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slog.SetDefault(slog.New(handler))

	slog.Info("Starting Codebench API Modular Monolith...")

	cfg := config.Load()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 1. Connect to PostgreSQL and apply migrations
	db, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("Database initialization failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// 2. Start Embedded NATS JetStream & Queue Manager
	queueMgr, err := queue.New(ctx, cfg)
	if err != nil {
		slog.Error("Queue initialization failed", "error", err)
		os.Exit(1)
	}
	defer queueMgr.Close()

	// 3. Initialize SSE Event Broker
	eventBroker := events.NewBroker()

	// 4. Start Transactional Outbox Relay
	outboxRelay := outbox.NewRelay(db, queueMgr, 50*time.Millisecond)
	go outboxRelay.Start(ctx)

	// 5. Start Verdict Consumer
	verdictConsumer := verdict.NewConsumer(db, queueMgr, eventBroker)
	if err := verdictConsumer.Start(ctx); err != nil {
		slog.Error("Failed to start verdict consumer", "error", err)
		os.Exit(1)
	}

	// 6. Start Fake Judge if configured (development/testing)
	if cfg.UseFakeJudge {
		slog.Info("Starting internal Fake Judge worker for testing...")
		fakeJudge := fakejudge.NewFakeJudge(queueMgr, eventBroker)
		if err := fakeJudge.Start(ctx); err != nil {
			slog.Error("Failed to start fake judge", "error", err)
		}
	}

	// 7. Seed initial admin and demo problem
	if err := seed.SeedDatabase(ctx, db, cfg.ProblemsDir, cfg.AdminDefaultPassword); err != nil {
		slog.Warn("Database seeding reported note", "error", err)
	}

	// 8. Start HTTP Server
	server := handlers.NewServer(db, queueMgr, eventBroker)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Codebench HTTP Server listening", "addr", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server failed", "error", err)
			cancel()
		}
	}()

	<-ctx.Done()
	slog.Info("Shutdown signal received, shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server graceful shutdown error", "error", err)
	}

	slog.Info("Codebench API stopped cleanly.")
}
