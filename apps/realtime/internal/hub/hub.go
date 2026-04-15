// Package hub owns WebSocket connection lifecycle per room.
//
// Invariants
// ----------
//   - Each user has at most one active WebSocket per room. Reconnecting
//     replaces the previous connection and closes it with 4002.
//   - All mutations go through the rooms.Store (authoritative state lives
//     in Redis). The hub only relays events.
//   - Broadcasts are versioned; clients discard events whose Room.Version
//     is older than the last one they processed.
package hub

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/majlis/realtime/internal/rooms"
)

// Event is the envelope every outbound WS message uses.
type Event struct {
	Type    string          `json:"type"`    // "room.state" | "room.seat.taken" | …
	Version int64           `json:"version"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Inbound is the envelope of incoming client → server messages.
type Inbound struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Client is a single WebSocket connection bound to (roomID, userID).
type Client struct {
	RoomID string
	UserID string
	conn   *websocket.Conn
	send   chan []byte
	hub    *Hub
}

// Hub fans events out to all connected clients of a room.
type Hub struct {
	mu      sync.RWMutex
	rooms   map[string]map[*Client]struct{} // roomID → set of clients
	byUser  map[string]*Client              // roomID+"|"+userID → client
	store   *rooms.Store
	writeTO time.Duration
}

// New creates a hub backed by `store` for all room state lookups.
func New(store *rooms.Store) *Hub {
	return &Hub{
		rooms:   map[string]map[*Client]struct{}{},
		byUser:  map[string]*Client{},
		store:   store,
		writeTO: 5 * time.Second,
	}
}

// Register attaches a client. If the same user was already connected to the
// same room, the prior socket is evicted.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	key := c.RoomID + "|" + c.UserID
	if prev, ok := h.byUser[key]; ok {
		close(prev.send)
		delete(h.rooms[prev.RoomID], prev)
	}

	if _, ok := h.rooms[c.RoomID]; !ok {
		h.rooms[c.RoomID] = map[*Client]struct{}{}
	}
	h.rooms[c.RoomID][c] = struct{}{}
	h.byUser[key] = c
	c.hub = h
}

// Unregister removes the client and, if this was the canonical entry, clears
// the per-user index. Best-effort evicts the user from room state.
func (h *Hub) Unregister(ctx context.Context, c *Client) {
	h.mu.Lock()
	key := c.RoomID + "|" + c.UserID
	if entry, ok := h.byUser[key]; ok && entry == c {
		delete(h.byUser, key)
	}
	if set, ok := h.rooms[c.RoomID]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, c.RoomID)
		}
	}
	h.mu.Unlock()

	updated, err := h.store.RemoveParticipant(ctx, c.RoomID, c.UserID)
	if err == nil {
		h.BroadcastState(c.RoomID, updated)
	}
}

// BroadcastState sends a typed `room.state` event to every subscriber of the
// room. Errors on individual writes just drop the offending connection.
func (h *Hub) BroadcastState(roomID string, r *rooms.Room) {
	if r == nil {
		return
	}
	payload, err := json.Marshal(r)
	if err != nil {
		log.Printf("marshal room state: %v", err)
		return
	}
	evt := Event{Type: "room.state", Version: r.Version, Payload: payload}
	h.broadcast(roomID, evt)
}

func (h *Hub) broadcast(roomID string, evt Event) {
	body, err := json.Marshal(evt)
	if err != nil {
		log.Printf("marshal event: %v", err)
		return
	}
	h.mu.RLock()
	clients := h.rooms[roomID]
	snapshot := make([]*Client, 0, len(clients))
	for c := range clients {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	for _, c := range snapshot {
		select {
		case c.send <- body:
		default:
			// Slow consumer — drop the connection; they'll reconnect and resync.
			go func(cl *Client) { _ = cl.conn.Close() }(c)
		}
	}
}

// NewClient wraps a WebSocket connection and starts its I/O pumps.
// Caller must call Register before the pumps start.
func NewClient(conn *websocket.Conn, roomID, userID string) *Client {
	return &Client{
		RoomID: roomID,
		UserID: userID,
		conn:   conn,
		send:   make(chan []byte, 64),
	}
}

// WritePump drains `send` into the socket. Exits on channel close.
func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump blocks until the connection closes. Inbound messages are
// parsed as Inbound envelopes but — in Phase 2b — the only meaningful
// client→server action is a pong; real mutations happen via HTTP.
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.hub.Unregister(ctx, c)
	}()
	c.conn.SetReadLimit(4 * 1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var in Inbound
		if err := json.Unmarshal(raw, &in); err != nil {
			continue
		}
		// Reserved for Phase 2c: chat messages + seat requests.
		// TODO(phase-2c): route `chat.send` and `seat.request` here.
		_ = in.Type
	}
}
