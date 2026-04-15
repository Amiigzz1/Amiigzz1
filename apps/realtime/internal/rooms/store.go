// Package rooms owns the authoritative live state of voice rooms.
//
// Design
// ------
// Each room's state is a JSON blob under Redis key `room:{id}`. This keeps
// cross-node visibility (another realtime pod can pick up where we left off
// if we scale horizontally) and survives a WS server restart.
//
// Mutations use WATCH/MULTI/EXEC to stay atomic under concurrent seat
// changes. Each mutation bumps a monotonic `version` that the hub attaches
// to broadcast events so clients can drop stale deltas.
package rooms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Errors surfaced to HTTP callers.
var (
	ErrRoomNotFound = errors.New("room not found")
	ErrRoomFull     = errors.New("room is full")
	ErrSeatTaken    = errors.New("seat already taken")
	ErrNotOnSeat    = errors.New("user is not on a seat")
	ErrNotOwner     = errors.New("only the owner can perform this action")
	ErrRoomLocked   = errors.New("room is locked")
)

// Room is the full live state. Stored as JSON under `room:{id}`.
type Room struct {
	ID        string          `json:"id"`
	OwnerID   string          `json:"ownerId"`
	MaxSeats  int             `json:"maxSeats"`
	Seats     map[int]string  `json:"seats"`     // seat index → userId
	Muted     map[string]bool `json:"muted"`     // userId → true when host-muted
	Listeners map[string]bool `json:"listeners"` // userId set (audience)
	Locked    bool            `json:"locked"`
	Version   int64           `json:"version"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

// Store reads and mutates room state in Redis.
type Store struct {
	rdb *redis.Client
	ttl time.Duration
}

// NewStore wires the Redis client. `ttl` is how long an inactive room key
// lingers before Redis GCs it (usually a few hours).
func NewStore(rdb *redis.Client, ttl time.Duration) *Store {
	if ttl == 0 {
		ttl = 6 * time.Hour
	}
	return &Store{rdb: rdb, ttl: ttl}
}

func roomKey(id string) string { return "room:" + id }

// EnsureRoom creates the room hash if it doesn't exist and returns the state.
// Called when NestJS creates a room so the live layer is ready immediately.
func (s *Store) EnsureRoom(ctx context.Context, id, ownerID string, maxSeats int) (*Room, error) {
	key := roomKey(id)
	current, err := s.rdb.Get(ctx, key).Bytes()
	if err == nil {
		var existing Room
		if err := json.Unmarshal(current, &existing); err == nil {
			return &existing, nil
		}
	} else if !errors.Is(err, redis.Nil) {
		return nil, err
	}

	room := Room{
		ID:        id,
		OwnerID:   ownerID,
		MaxSeats:  maxSeats,
		Seats:     map[int]string{},
		Muted:     map[string]bool{},
		Listeners: map[string]bool{},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := s.write(ctx, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

// Get returns a snapshot of the room.
func (s *Store) Get(ctx context.Context, id string) (*Room, error) {
	b, err := s.rdb.Get(ctx, roomKey(id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}
	var r Room
	if err := json.Unmarshal(b, &r); err != nil {
		return nil, fmt.Errorf("corrupt room state: %w", err)
	}
	return &r, nil
}

// Update runs `mutate` under a WATCH/MULTI/EXEC loop. On contention the
// callback is retried (up to 5 times) with fresh state.
func (s *Store) Update(
	ctx context.Context,
	id string,
	mutate func(*Room) error,
) (*Room, error) {
	key := roomKey(id)
	const retries = 5

	for i := 0; i < retries; i++ {
		var updated *Room
		err := s.rdb.Watch(ctx, func(tx *redis.Tx) error {
			b, err := tx.Get(ctx, key).Bytes()
			if errors.Is(err, redis.Nil) {
				return ErrRoomNotFound
			}
			if err != nil {
				return err
			}
			var r Room
			if err := json.Unmarshal(b, &r); err != nil {
				return err
			}
			if err := mutate(&r); err != nil {
				return err
			}
			r.Version++
			r.UpdatedAt = time.Now().UTC()
			payload, err := json.Marshal(r)
			if err != nil {
				return err
			}
			_, err = tx.TxPipelined(ctx, func(p redis.Pipeliner) error {
				p.Set(ctx, key, payload, s.ttl)
				return nil
			})
			if err != nil {
				return err
			}
			updated = &r
			return nil
		}, key)

		if errors.Is(err, redis.TxFailedErr) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return updated, nil
	}
	return nil, errors.New("room update contention; try again")
}

// AddListener adds a user to the audience set.
func (s *Store) AddListener(ctx context.Context, roomID, userID string) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		if r.Locked && userID != r.OwnerID && !r.Listeners[userID] && !containsValue(r.Seats, userID) {
			return ErrRoomLocked
		}
		r.Listeners[userID] = true
		return nil
	})
}

// RemoveParticipant evicts a user from the room entirely.
func (s *Store) RemoveParticipant(ctx context.Context, roomID, userID string) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		delete(r.Listeners, userID)
		delete(r.Muted, userID)
		for idx, uid := range r.Seats {
			if uid == userID {
				delete(r.Seats, idx)
			}
		}
		return nil
	})
}

// TakeSeat moves the user from audience onto a numbered seat.
// If `seatIdx < 0`, the lowest free seat is chosen.
func (s *Store) TakeSeat(ctx context.Context, roomID, userID string, seatIdx int) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		// Prevent double-seating.
		for idx, uid := range r.Seats {
			if uid == userID {
				// Already on that seat? No-op. Different seat? Move.
				if idx == seatIdx || seatIdx < 0 {
					return nil
				}
				delete(r.Seats, idx)
				break
			}
		}

		if seatIdx < 0 {
			// Find lowest free index.
			for i := 0; i < r.MaxSeats; i++ {
				if _, occupied := r.Seats[i]; !occupied {
					seatIdx = i
					break
				}
			}
			if seatIdx < 0 {
				return ErrRoomFull
			}
		}
		if seatIdx >= r.MaxSeats {
			return fmt.Errorf("seat index %d exceeds maxSeats %d", seatIdx, r.MaxSeats)
		}
		if _, occupied := r.Seats[seatIdx]; occupied {
			return ErrSeatTaken
		}
		r.Seats[seatIdx] = userID
		delete(r.Listeners, userID)
		return nil
	})
}

// LeaveSeat drops the user from their current seat back into the audience.
func (s *Store) LeaveSeat(ctx context.Context, roomID, userID string) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		found := false
		for idx, uid := range r.Seats {
			if uid == userID {
				delete(r.Seats, idx)
				found = true
				break
			}
		}
		if !found {
			return ErrNotOnSeat
		}
		r.Listeners[userID] = true
		delete(r.Muted, userID)
		return nil
	})
}

// MuteSeat host-mutes or un-mutes a user on a seat.
func (s *Store) MuteSeat(ctx context.Context, roomID, requesterID, targetID string, muted bool) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		if requesterID != r.OwnerID {
			return ErrNotOwner
		}
		if !containsValue(r.Seats, targetID) {
			return ErrNotOnSeat
		}
		if muted {
			r.Muted[targetID] = true
		} else {
			delete(r.Muted, targetID)
		}
		return nil
	})
}

// Lock toggles room-level access (non-owners can't join when locked).
func (s *Store) Lock(ctx context.Context, roomID, requesterID string, locked bool) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		if requesterID != r.OwnerID {
			return ErrNotOwner
		}
		r.Locked = locked
		return nil
	})
}

// Kick evicts a user; host-only.
func (s *Store) Kick(ctx context.Context, roomID, requesterID, targetID string) (*Room, error) {
	return s.Update(ctx, roomID, func(r *Room) error {
		if requesterID != r.OwnerID {
			return ErrNotOwner
		}
		delete(r.Listeners, targetID)
		delete(r.Muted, targetID)
		for idx, uid := range r.Seats {
			if uid == targetID {
				delete(r.Seats, idx)
			}
		}
		return nil
	})
}

// Counts returns a fast snapshot of participant numbers. The API service
// polls this every few seconds to keep the Postgres row fresh for Discover.
func (s *Store) Counts(ctx context.Context, roomID string) (listeners, speakers int, err error) {
	r, err := s.Get(ctx, roomID)
	if err != nil {
		return 0, 0, err
	}
	return len(r.Listeners), len(r.Seats), nil
}

func (s *Store) write(ctx context.Context, r *Room) error {
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, roomKey(r.ID), b, s.ttl).Err()
}

func containsValue(m map[int]string, v string) bool {
	for _, x := range m {
		if x == v {
			return true
		}
	}
	return false
}
