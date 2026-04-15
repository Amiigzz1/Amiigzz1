// Package main is the entrypoint for the Majlis realtime service.
//
// Responsibilities (Phase 2b):
//   - WebSocket fan-out for voice rooms (/ws)
//   - Authoritative seat / listener state in Redis (rooms.Store)
//   - Internal HTTP endpoints called by the NestJS API
//
// Phase 3 will extend this service with matchmaking + authoritative Ludo.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/majlis/realtime/internal/config"
	"github.com/majlis/realtime/internal/hub"
	"github.com/majlis/realtime/internal/ludo"
	"github.com/majlis/realtime/internal/rooms"
	"github.com/majlis/realtime/internal/server"
)

func main() {
	cfg := config.Load()

	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(redisOpts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("warning: redis ping failed: %v (continuing)", err)
	}
	cancel()

	store := rooms.NewStore(rdb, 6*time.Hour)
	h := hub.New(store)
	ludoMgr := ludo.NewManager()
	srv := server.New(cfg, store, h, ludoMgr)

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	idleClosed := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutdown signal received")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
		_ = rdb.Close()
		close(idleClosed)
	}()

	log.Printf("majlis-realtime listening on :%s", cfg.Port)
	if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("listen error: %v", err)
	}
	<-idleClosed
	log.Println("majlis-realtime stopped")
}
