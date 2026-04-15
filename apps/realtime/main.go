// Package main is the entrypoint for the Majlis realtime service.
//
// Scope of this service (progressively implemented across phases):
//   - Phase 2: voice rooms (WebSocket signaling, presence, seats)
//   - Phase 3: matchmaking + authoritative Ludo game state
//
// For Phase 0 this binary only exposes /health so the scaffold is runnable
// under docker-compose and CI.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"
)

var startedAt = time.Now()

// healthPayload is the JSON response shape for GET /health.
type healthPayload struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	UptimeSeconds int64  `json:"uptimeSeconds"`
	Timestamp     string `json:"timestamp"`
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthPayload{
		Status:        "ok",
		Service:       "majlis-realtime",
		UptimeSeconds: int64(time.Since(startedAt).Seconds()),
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
	})
}

// connectionCount is incremented per active WebSocket (wired up in Phase 2).
var connectionCount atomic.Int64

func wsPlaceholder(w http.ResponseWriter, _ *http.Request) {
	// TODO(phase-2): upgrade to WebSocket, handle presence + room signaling.
	http.Error(w, "websocket endpoint not implemented yet", http.StatusNotImplemented)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ws", wsPlaceholder)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	idleClosed := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutdown signal received")

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
		close(idleClosed)
	}()

	log.Printf("majlis-realtime listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("listen error: %v", err)
	}
	<-idleClosed
	log.Println("majlis-realtime stopped")

	// Silence unused lint on the counter until Phase 2 wires it up.
	_ = connectionCount.Load()
}
