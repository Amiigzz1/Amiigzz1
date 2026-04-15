package ludo

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Manager holds in-flight Ludo games in memory.
//
// Design note: we deliberately keep game state in-process (not in Redis) for
// Phase 3 simplicity. Cross-pod failover would require persisting the full
// GameState on every Move; that lands in Phase 6 hardening.
type Manager struct {
	mu    sync.Mutex
	games map[string]*session
	queue []queued
}

type queued struct {
	UserID  string
	JoinedAt time.Time
	WaitCh   chan string // game id
}

type session struct {
	state *GameState
}

func NewManager() *Manager {
	return &Manager{games: map[string]*session{}}
}

// Enqueue waits up to `timeout` for matchmaking to fill a 4-player game.
// Returns the game id to join.
//
// The queue is simple FIFO; 4 waiters pop together into a new GameState.
// Partial queues after `timeout` optionally fill with bot seats (empty
// strings), which the scheduler can later skip.
func (m *Manager) Enqueue(userID string, timeout time.Duration, fillWithBots bool) (string, error) {
	waitCh := make(chan string, 1)

	m.mu.Lock()
	m.queue = append(m.queue, queued{
		UserID:   userID,
		JoinedAt: time.Now(),
		WaitCh:   waitCh,
	})
	m.tryFlushLocked()
	m.mu.Unlock()

	select {
	case gameID := <-waitCh:
		return gameID, nil
	case <-time.After(timeout):
		// Timed out waiting for a full table. Optionally create a partial
		// game with bot slots.
		m.mu.Lock()
		defer m.mu.Unlock()
		// Remove this user from the queue if still present.
		found := false
		for i, q := range m.queue {
			if q.UserID == userID && q.WaitCh == waitCh {
				m.queue = append(m.queue[:i], m.queue[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			// Race: the user just got matched.
			select {
			case gameID := <-waitCh:
				return gameID, nil
			default:
			}
		}
		if fillWithBots {
			players := [4]string{userID, "", "", ""}
			return m.start(players), nil
		}
		return "", errors.New("matchmaking timeout")
	}
}

func (m *Manager) tryFlushLocked() {
	for len(m.queue) >= 4 {
		batch := m.queue[:4]
		m.queue = m.queue[4:]
		var players [4]string
		for i, q := range batch {
			players[i] = q.UserID
		}
		id := m.start(players)
		for _, q := range batch {
			q.WaitCh <- id
			close(q.WaitCh)
		}
	}
}

func (m *Manager) start(players [4]string) string {
	id := uuid.NewString()
	m.games[id] = &session{state: NewGame(id, players)}
	return id
}

// State returns a snapshot of the current game state (safe to serialize).
func (m *Manager) State(gameID string) (*GameState, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.games[gameID]
	if !ok {
		return nil, errors.New("game not found")
	}
	clone := *s.state
	return &clone, nil
}

func (m *Manager) Roll(gameID, userID string) (*GameState, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.games[gameID]
	if !ok {
		return nil, 0, errors.New("game not found")
	}
	roll, err := s.state.Roll(userID)
	if err != nil {
		return nil, 0, err
	}
	clone := *s.state
	return &clone, roll, nil
}

func (m *Manager) Move(gameID, userID string, tokenIdx int) (*GameState, LastMove, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.games[gameID]
	if !ok {
		return nil, LastMove{}, errors.New("game not found")
	}
	move, err := s.state.Move(userID, tokenIdx)
	if err != nil {
		return nil, LastMove{}, err
	}
	clone := *s.state
	return &clone, move, nil
}

// Cleanup removes finished games older than `maxAge`.
func (m *Manager) Cleanup(maxAge time.Duration) {
	// Phase 6: schedule periodic cleanup; for now games live until restart.
	_ = maxAge
}
