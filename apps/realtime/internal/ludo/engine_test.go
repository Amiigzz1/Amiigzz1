package ludo

import (
	"errors"
	"testing"
)

func TestNewGameInitialState(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	if g.CurrentIdx != 0 {
		t.Errorf("expected player 0 first, got %d", g.CurrentIdx)
	}
	if g.LastRoll != 0 {
		t.Errorf("roll should start 0, got %d", g.LastRoll)
	}
	for p := 0; p < 4; p++ {
		for tk := 0; tk < TokensPerPlayer; tk++ {
			if g.Tokens[p][tk] != -1 {
				t.Errorf("tokens should start at home, got p%d t%d=%d", p, tk, g.Tokens[p][tk])
			}
		}
	}
}

func TestRollBlocksOutOfTurn(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	if _, err := g.Roll("b"); !errors.Is(err, ErrNotYourTurn) {
		t.Errorf("expected ErrNotYourTurn, got %v", err)
	}
}

func TestRollTwiceBeforeMoving(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	g.LastRoll = 3 // pretend already rolled
	if _, err := g.Roll("a"); !errors.Is(err, ErrAlreadyRolled) {
		t.Errorf("expected ErrAlreadyRolled, got %v", err)
	}
}

func TestRollSixActivatesToken(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	g.LastRoll = 6
	moves := g.LegalMoves(0, 6)
	if len(moves) != 4 {
		t.Errorf("all 4 tokens should be legal with a 6, got %d", len(moves))
	}
	if _, err := g.Move("a", 0); err != nil {
		t.Fatalf("move: %v", err)
	}
	if g.Tokens[0][0] != PlayerEntrySquare[0] {
		t.Errorf("expected entry square %d, got %d", PlayerEntrySquare[0], g.Tokens[0][0])
	}
	// Rolling a 6 grants another roll; still player 0's turn.
	if g.CurrentIdx != 0 {
		t.Errorf("expected same player after 6, got %d", g.CurrentIdx)
	}
}

func TestNonSixFromHomeIsIllegal(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	g.LastRoll = 3
	if moves := g.LegalMoves(0, 3); len(moves) != 0 {
		t.Errorf("expected no legal moves, got %v", moves)
	}
	if _, err := g.Move("a", 0); !errors.Is(err, ErrMoveNotLegal) {
		t.Errorf("expected ErrMoveNotLegal, got %v", err)
	}
}

func TestRollAfterTurnAdvance(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	// Force 3 rolls in a row with no legal moves (all tokens home, roll != 6).
	g.LastRoll = 0 // Roll will auto-skip because no moves.
	// Simulate a non-6 roll: force it deterministically.
	g.LastRoll = 3
	// Directly trigger the "no legal moves" skip branch via helper.
	if len(g.LegalMoves(0, g.LastRoll)) != 0 {
		t.Skip("RNG yielded legal moves — test assumptions broken")
	}
	g.endTurn(false)
	if g.CurrentIdx != 1 {
		t.Errorf("expected advance to player 1, got %d", g.CurrentIdx)
	}
}

func TestCaptureSendsOpponentHome(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})

	// Put player 1 token onto square 3.
	g.Tokens[1][0] = 3
	// Put player 0 token onto square 0 (entry), with roll 3, they'll land on 3.
	g.Tokens[0][0] = 0
	g.CurrentIdx = 0
	g.LastRoll = 3

	move, err := g.Move("a", 0)
	if err != nil {
		t.Fatalf("move: %v", err)
	}
	if g.Tokens[0][0] != 3 {
		t.Errorf("expected p0t0=3, got %d", g.Tokens[0][0])
	}
	if g.Tokens[1][0] != -1 {
		t.Errorf("opponent token should be home, got %d", g.Tokens[1][0])
	}
	if len(move.Captured) != 1 {
		t.Errorf("expected one capture, got %v", move.Captured)
	}
}

func TestFinishAllTokensWins(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	// Put player 0's first three tokens at the finish.
	for i := 0; i < 3; i++ {
		g.Tokens[0][i] = FinishPosition
	}
	// Last token one step from the finish, roll 1 to clinch.
	g.Tokens[0][3] = FinishPosition - 1
	g.CurrentIdx = 0
	g.LastRoll = 1

	if _, err := g.Move("a", 3); err != nil {
		t.Fatalf("move: %v", err)
	}
	if g.WinnerIdx != 0 {
		t.Errorf("expected winner=0, got %d", g.WinnerIdx)
	}
}

func TestOvershootingFinishIsIllegal(t *testing.T) {
	g := NewGame("g1", [4]string{"a", "b", "c", "d"})
	g.Tokens[0][0] = FinishPosition - 1 // one square from center
	g.CurrentIdx = 0
	g.LastRoll = 5

	moves := g.LegalMoves(0, 5)
	for _, m := range moves {
		if m == 0 {
			t.Error("overshooting the finish should not be legal")
		}
	}
}
