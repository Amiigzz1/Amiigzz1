package rooms

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newStore(t *testing.T) (*Store, context.Context) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return NewStore(rdb, time.Hour), context.Background()
}

func TestEnsureRoomIsIdempotent(t *testing.T) {
	s, ctx := newStore(t)

	first, err := s.EnsureRoom(ctx, "r1", "owner", 8)
	if err != nil {
		t.Fatalf("first EnsureRoom: %v", err)
	}
	if first.OwnerID != "owner" || first.MaxSeats != 8 {
		t.Errorf("unexpected initial room: %+v", first)
	}

	second, err := s.EnsureRoom(ctx, "r1", "owner", 8)
	if err != nil {
		t.Fatalf("second EnsureRoom: %v", err)
	}
	if second.ID != first.ID || second.Version != first.Version {
		t.Errorf("EnsureRoom should be idempotent: got v=%d then v=%d", first.Version, second.Version)
	}
}

func TestAddListenerIncrementsVersion(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 8)

	r1, err := s.AddListener(ctx, "r1", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if !r1.Listeners["user-a"] {
		t.Error("user-a should be in listeners")
	}
	if r1.Version < 1 {
		t.Errorf("expected version bumped, got %d", r1.Version)
	}
}

func TestTakeSeat(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 3)
	_, _ = s.AddListener(ctx, "r1", "user-a")

	t.Run("explicit seat index", func(t *testing.T) {
		r, err := s.TakeSeat(ctx, "r1", "user-a", 1)
		if err != nil {
			t.Fatal(err)
		}
		if r.Seats[1] != "user-a" {
			t.Errorf("expected user-a on seat 1, got %v", r.Seats)
		}
		if r.Listeners["user-a"] {
			t.Error("user-a should no longer be a listener")
		}
	})

	t.Run("auto-pick lowest free seat", func(t *testing.T) {
		_, _ = s.AddListener(ctx, "r1", "user-b")
		r, err := s.TakeSeat(ctx, "r1", "user-b", -1)
		if err != nil {
			t.Fatal(err)
		}
		// Seat 0 is free (seat 1 already taken by user-a).
		if r.Seats[0] != "user-b" {
			t.Errorf("expected user-b on seat 0, got %v", r.Seats)
		}
	})

	t.Run("seat already taken", func(t *testing.T) {
		_, _ = s.AddListener(ctx, "r1", "user-c")
		_, err := s.TakeSeat(ctx, "r1", "user-c", 1)
		if !errors.Is(err, ErrSeatTaken) {
			t.Errorf("expected ErrSeatTaken, got %v", err)
		}
	})

	t.Run("room full", func(t *testing.T) {
		// Fill the remaining seat (2).
		_, _ = s.AddListener(ctx, "r1", "user-d")
		if _, err := s.TakeSeat(ctx, "r1", "user-d", 2); err != nil {
			t.Fatal(err)
		}
		// Now add another listener and try auto-pick.
		_, _ = s.AddListener(ctx, "r1", "user-e")
		_, err := s.TakeSeat(ctx, "r1", "user-e", -1)
		if !errors.Is(err, ErrRoomFull) {
			t.Errorf("expected ErrRoomFull, got %v", err)
		}
	})
}

func TestLeaveSeatReturnsToAudience(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)
	_, _ = s.AddListener(ctx, "r1", "user-a")
	_, _ = s.TakeSeat(ctx, "r1", "user-a", 0)

	r, err := s.LeaveSeat(ctx, "r1", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if _, occupied := r.Seats[0]; occupied {
		t.Error("seat 0 should be free after leave")
	}
	if !r.Listeners["user-a"] {
		t.Error("user-a should be back in listeners")
	}
}

func TestMuteRequiresOwner(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)
	_, _ = s.AddListener(ctx, "r1", "user-a")
	_, _ = s.TakeSeat(ctx, "r1", "user-a", 0)

	_, err := s.MuteSeat(ctx, "r1", "stranger", "user-a", true)
	if !errors.Is(err, ErrNotOwner) {
		t.Errorf("expected ErrNotOwner, got %v", err)
	}

	r, err := s.MuteSeat(ctx, "r1", "owner", "user-a", true)
	if err != nil {
		t.Fatal(err)
	}
	if !r.Muted["user-a"] {
		t.Error("user-a should be muted")
	}
}

func TestLockBlocksNonOwnerListeners(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)

	if _, err := s.Lock(ctx, "r1", "owner", true); err != nil {
		t.Fatal(err)
	}

	_, err := s.AddListener(ctx, "r1", "user-a")
	if !errors.Is(err, ErrRoomLocked) {
		t.Errorf("expected ErrRoomLocked, got %v", err)
	}
	// Owner still gets in.
	if _, err := s.AddListener(ctx, "r1", "owner"); err != nil {
		t.Errorf("owner should be able to join locked room: %v", err)
	}
}

func TestKickEvictsTarget(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)
	_, _ = s.AddListener(ctx, "r1", "user-a")
	_, _ = s.TakeSeat(ctx, "r1", "user-a", 1)

	r, err := s.Kick(ctx, "r1", "owner", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := r.Seats[1]; ok {
		t.Error("seat 1 should be free after kick")
	}
	if r.Listeners["user-a"] {
		t.Error("user-a should be gone from listeners")
	}
}

func TestRemoveParticipantIsThorough(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)
	_, _ = s.AddListener(ctx, "r1", "user-a")
	_, _ = s.TakeSeat(ctx, "r1", "user-a", 0)
	_, _ = s.MuteSeat(ctx, "r1", "owner", "user-a", true)

	r, err := s.RemoveParticipant(ctx, "r1", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := r.Seats[0]; ok {
		t.Error("seat should be cleared")
	}
	if r.Listeners["user-a"] || r.Muted["user-a"] {
		t.Error("user-a should be fully removed")
	}
}

func TestCounts(t *testing.T) {
	s, ctx := newStore(t)
	_, _ = s.EnsureRoom(ctx, "r1", "owner", 4)
	_, _ = s.AddListener(ctx, "r1", "user-a")
	_, _ = s.AddListener(ctx, "r1", "user-b")
	_, _ = s.TakeSeat(ctx, "r1", "user-a", 0)

	listeners, speakers, err := s.Counts(ctx, "r1")
	if err != nil {
		t.Fatal(err)
	}
	if listeners != 1 || speakers != 1 {
		t.Errorf("got listeners=%d speakers=%d, want 1/1", listeners, speakers)
	}
}
