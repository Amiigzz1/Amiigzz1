package ludo

import (
	"sync"
	"testing"
	"time"
)

func TestEnqueueMatchesFourPlayers(t *testing.T) {
	m := NewManager()
	ids := make(chan string, 4)
	var wg sync.WaitGroup
	for i, u := range []string{"a", "b", "c", "d"} {
		i, u := i, u
		wg.Add(1)
		go func() {
			defer wg.Done()
			id, err := m.Enqueue(u, 3*time.Second, false)
			if err != nil {
				t.Errorf("enqueue %d: %v", i, err)
				return
			}
			ids <- id
		}()
	}
	wg.Wait()
	close(ids)

	var first string
	for id := range ids {
		if first == "" {
			first = id
		} else if id != first {
			t.Errorf("all four waiters should share the same game id, got %q vs %q", first, id)
		}
	}
	if first == "" {
		t.Fatal("no game id returned")
	}

	state, err := m.State(first)
	if err != nil {
		t.Fatalf("State: %v", err)
	}
	// Seat order depends on goroutine scheduling; just verify the set.
	seen := map[string]bool{}
	for _, p := range state.Players {
		if p != "" {
			seen[p] = true
		}
	}
	for _, u := range []string{"a", "b", "c", "d"} {
		if !seen[u] {
			t.Errorf("missing player %q in seats %+v", u, state.Players)
		}
	}
}

func TestEnqueueTimesOutWhenAlone(t *testing.T) {
	m := NewManager()
	if _, err := m.Enqueue("solo", 100*time.Millisecond, false); err == nil {
		t.Error("expected timeout error, got nil")
	}
}

func TestEnqueueFallsBackToBotFilled(t *testing.T) {
	m := NewManager()
	id, err := m.Enqueue("solo", 100*time.Millisecond, true)
	if err != nil {
		t.Fatalf("enqueue: %v", err)
	}
	state, _ := m.State(id)
	if state.Players[0] != "solo" {
		t.Errorf("human seat lost: %+v", state.Players)
	}
	for i := 1; i < 4; i++ {
		if state.Players[i] != "" {
			t.Errorf("seat %d should be bot slot, got %q", i, state.Players[i])
		}
	}
}
