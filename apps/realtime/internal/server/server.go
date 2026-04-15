// Package server ties auth, the WS hub, and the room store together
// behind an HTTP listener.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/majlis/realtime/internal/auth"
	"github.com/majlis/realtime/internal/config"
	"github.com/majlis/realtime/internal/hub"
	"github.com/majlis/realtime/internal/ludo"
	"github.com/majlis/realtime/internal/rooms"
)

// Server holds wiring that the handlers need.
type Server struct {
	cfg      config.Config
	store    *rooms.Store
	hub      *hub.Hub
	ludo     *ludo.Manager
	upgrader websocket.Upgrader
}

func New(cfg config.Config, store *rooms.Store, h *hub.Hub, lm *ludo.Manager) *Server {
	return &Server{
		cfg:   cfg,
		store: store,
		hub:   h,
		ludo:  lm,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(_ *http.Request) bool {
				// For Phase 2 we trust the NestJS-issued JWT for auth and
				// allow any origin. A strict allow-list lands in Phase 6.
				return true
			},
		},
	}
}

// Routes builds the mux. Keep the paths flat — this service is private.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ws", s.handleWebSocket)

	// Internal HTTP surface. NestJS hits these over the cluster network.
	// Every request must carry `X-Internal-Token` matching REALTIME_INTERNAL_TOKEN.
	mux.Handle("/internal/rooms", s.internalMW(http.HandlerFunc(s.handleInternalRoomCreate)))
	mux.Handle("/internal/rooms/", s.internalMW(http.HandlerFunc(s.handleInternalRoomAction)))

	// Ludo game surface.
	mux.Handle("/internal/games/ludo/match", s.internalMW(http.HandlerFunc(s.handleLudoMatch)))
	mux.Handle("/internal/games/ludo/", s.internalMW(http.HandlerFunc(s.handleLudoAction)))

	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "ok",
		"service":   "majlis-realtime",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ---------- WebSocket upgrade ----------

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "token required", http.StatusUnauthorized)
		return
	}
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		http.Error(w, "room required", http.StatusBadRequest)
		return
	}

	userID, err := auth.ParseAccessToken(tokenStr, s.cfg.JWTSecret)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	room, err := s.store.Get(r.Context(), roomID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return // Upgrader already wrote the error.
	}

	client := hub.NewClient(conn, roomID, userID)
	s.hub.Register(client)

	// Add to audience and tell this user (and siblings) the fresh state.
	updated, err := s.store.AddListener(r.Context(), roomID, userID)
	if err != nil {
		_ = conn.Close()
		return
	}
	s.hub.BroadcastState(roomID, updated)
	_ = room // handshake snapshot already covered by the broadcast

	go client.WritePump()
	go client.ReadPump(context.Background())
}

// ---------- Internal HTTP (called by NestJS) ----------

func (s *Server) internalMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected := s.cfg.InternalToken
		if expected == "" {
			http.Error(w, "internal endpoints disabled (set REALTIME_INTERNAL_TOKEN)", http.StatusForbidden)
			return
		}
		if r.Header.Get("X-Internal-Token") != expected {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type createRoomReq struct {
	ID       string `json:"id"`
	OwnerID  string `json:"ownerId"`
	MaxSeats int    `json:"maxSeats"`
}

func (s *Server) handleInternalRoomCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req createRoomReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.MaxSeats <= 0 {
		req.MaxSeats = 8
	}
	room, err := s.store.EnsureRoom(r.Context(), req.ID, req.OwnerID, req.MaxSeats)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, room)
}

// handleInternalRoomAction routes /internal/rooms/{id}/{action}.
func (s *Server) handleInternalRoomAction(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/internal/rooms/")
	parts := strings.Split(rest, "/")
	if len(parts) < 2 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	roomID, action := parts[0], parts[1]

	switch action {
	case "seats":
		s.handleSeat(w, r, roomID)
	case "kick":
		s.handleKick(w, r, roomID)
	case "lock":
		s.handleLock(w, r, roomID)
	case "mute":
		s.handleMute(w, r, roomID)
	default:
		http.Error(w, "unknown action", http.StatusNotFound)
	}
}

type seatReq struct {
	RequesterID string `json:"requesterId"`
	SeatIndex   int    `json:"seatIndex"` // -1 for "any free seat"
}

func (s *Server) handleSeat(w http.ResponseWriter, r *http.Request, roomID string) {
	var req seatReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	var (
		updated *rooms.Room
		err     error
	)
	switch r.Method {
	case http.MethodPost:
		if req.SeatIndex == 0 && r.URL.Query().Get("any") == "1" {
			req.SeatIndex = -1
		}
		updated, err = s.store.TakeSeat(r.Context(), roomID, req.RequesterID, req.SeatIndex)
	case http.MethodDelete:
		updated, err = s.store.LeaveSeat(r.Context(), roomID, req.RequesterID)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.hub.BroadcastState(roomID, updated)
	writeJSON(w, http.StatusOK, updated)
}

type kickReq struct {
	RequesterID string `json:"requesterId"`
	TargetID    string `json:"targetId"`
}

func (s *Server) handleKick(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req kickReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	updated, err := s.store.Kick(r.Context(), roomID, req.RequesterID, req.TargetID)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.hub.BroadcastState(roomID, updated)
	writeJSON(w, http.StatusOK, updated)
}

type lockReq struct {
	RequesterID string `json:"requesterId"`
	Locked      bool   `json:"locked"`
}

func (s *Server) handleLock(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req lockReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	updated, err := s.store.Lock(r.Context(), roomID, req.RequesterID, req.Locked)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.hub.BroadcastState(roomID, updated)
	writeJSON(w, http.StatusOK, updated)
}

type muteReq struct {
	RequesterID string `json:"requesterId"`
	TargetID    string `json:"targetId"`
	Muted       bool   `json:"muted"`
}

func (s *Server) handleMute(w http.ResponseWriter, r *http.Request, roomID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req muteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	updated, err := s.store.MuteSeat(r.Context(), roomID, req.RequesterID, req.TargetID, req.Muted)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	s.hub.BroadcastState(roomID, updated)
	writeJSON(w, http.StatusOK, updated)
}

// ---------- Ludo ----------

type ludoMatchReq struct {
	UserID       string `json:"userId"`
	TimeoutMs    int    `json:"timeoutMs"`
	FillWithBots bool   `json:"fillWithBots"`
}

type ludoMatchResp struct {
	GameID string         `json:"gameId"`
	State  *ludo.GameState `json:"state"`
}

func (s *Server) handleLudoMatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ludoMatchReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	timeout := time.Duration(req.TimeoutMs) * time.Millisecond
	if timeout == 0 {
		timeout = 3 * time.Second
	}
	gameID, err := s.ludo.Enqueue(req.UserID, timeout, req.FillWithBots)
	if err != nil {
		http.Error(w, err.Error(), http.StatusGatewayTimeout)
		return
	}
	state, _ := s.ludo.State(gameID)
	writeJSON(w, http.StatusOK, ludoMatchResp{GameID: gameID, State: state})
}

// /internal/games/ludo/{id}/{action}
func (s *Server) handleLudoAction(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/internal/games/ludo/")
	parts := strings.Split(rest, "/")
	if len(parts) < 2 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	gameID, action := parts[0], parts[1]

	switch action {
	case "state":
		state, err := s.ludo.State(gameID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, state)
	case "roll":
		var body struct {
			UserID string `json:"userId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		state, roll, err := s.ludo.Roll(gameID, body.UserID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"state": state, "roll": roll})
	case "move":
		var body struct {
			UserID   string `json:"userId"`
			TokenIdx int    `json:"tokenIdx"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		state, move, err := s.ludo.Move(gameID, body.UserID, body.TokenIdx)
		if err != nil {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"state": state, "move": move})
	default:
		http.Error(w, "unknown action", http.StatusNotFound)
	}
}

// ---------- helpers ----------

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, rooms.ErrRoomNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, rooms.ErrNotOwner):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, rooms.ErrRoomLocked):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, rooms.ErrRoomFull),
		errors.Is(err, rooms.ErrSeatTaken),
		errors.Is(err, rooms.ErrNotOnSeat):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
