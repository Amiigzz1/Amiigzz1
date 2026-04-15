// Package ludo implements an authoritative, server-side Ludo game state
// machine.
//
// Board model (standard Ludo, 4 players, 4 tokens each)
// ------------------------------------------------------
//   - 52 squares on the main track. Each player enters at a fixed square
//     (0, 13, 26, 39) and rotates clockwise.
//   - After 51 steps around the main track, a player enters their 6-square
//     home column (values 52..57). Square 57 is "center" — the finish.
//   - Tokens start at position -1 (home). Rolling a 6 moves a token to the
//     player's entry square.
//   - Landing on an opponent's token (that isn't on a safe square) captures
//     it back to home (-1).
//   - Capturing or rolling a 6 grants another roll (up to three times).
//
// Simplifications (documented so reviewers can see the cut scope)
// ---------------------------------------------------------------
//   - No safe squares except home. Real Ludo has 8 starred squares; the
//     bracket below leaves a hook for a future allow-list.
//   - No triple-6 forfeit.
//   - No block (two tokens on same square forming a wall).
//   - Turn timer is not enforced here; the scheduler handles it externally.
//
// Expanding either is a matter of gating IsCapture + ApplyMove; the public
// surface won't change.
package ludo

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	MainTrackLen    = 52
	HomeColumnLen   = 6  // squares 52..57
	FinishPosition  = 57
	TokensPerPlayer = 4
)

// PlayerEntrySquare is the main-track square where player N's tokens enter.
var PlayerEntrySquare = [4]int{0, 13, 26, 39}

// Errors surfaced to callers.
var (
	ErrNotYourTurn     = errors.New("not your turn")
	ErrMustRollFirst   = errors.New("must roll dice before moving")
	ErrAlreadyRolled   = errors.New("dice already rolled this turn")
	ErrInvalidToken    = errors.New("invalid token index")
	ErrNoLegalMove     = errors.New("no legal moves")
	ErrMoveNotLegal    = errors.New("move is not legal")
	ErrGameAlreadyOver = errors.New("game already over")
)

// GameState is the full snapshot sent to the view-only Phaser client.
type GameState struct {
	ID          string              `json:"id"`
	Players     [4]string           `json:"players"` // userIds; empty slot = ""
	Tokens      [4][TokensPerPlayer]int `json:"tokens"` // -1 home, 0..51 track, 52..57 home column
	CurrentIdx  int                 `json:"currentIdx"`
	LastRoll    int                 `json:"lastRoll"` // 0 when waiting for roll
	RollsThisTurn int               `json:"rollsThisTurn"`
	WinnerIdx   int                 `json:"winnerIdx"` // -1 if not over
	LastMove    *LastMove           `json:"lastMove,omitempty"`
	Version     int64               `json:"version"`
}

// LastMove is attached to events so the client can animate the delta.
type LastMove struct {
	PlayerIdx int   `json:"playerIdx"`
	TokenIdx  int   `json:"tokenIdx"`
	From      int   `json:"from"`
	To        int   `json:"to"`
	Captured  []int `json:"captured,omitempty"` // seat indexes whose tokens got sent home
}

// NewGame initializes a 4-player game. `players[i] == ""` marks a bot seat
// (handled by the scheduler; the engine itself doesn't care).
func NewGame(id string, players [4]string) *GameState {
	g := &GameState{
		ID:         id,
		Players:    players,
		CurrentIdx: 0,
		LastRoll:   0,
		WinnerIdx:  -1,
	}
	for p := range g.Tokens {
		for t := range g.Tokens[p] {
			g.Tokens[p][t] = -1
		}
	}
	return g
}

// Roll consumes a dice for the given player. Returns the rolled value.
func (g *GameState) Roll(playerID string) (int, error) {
	if g.WinnerIdx >= 0 {
		return 0, ErrGameAlreadyOver
	}
	if g.Players[g.CurrentIdx] != playerID {
		return 0, ErrNotYourTurn
	}
	if g.LastRoll != 0 {
		return 0, ErrAlreadyRolled
	}
	g.LastRoll = SecureDiceRoll()
	g.Version++

	// If no legal moves, skip the turn.
	if len(g.LegalMoves(g.CurrentIdx, g.LastRoll)) == 0 {
		g.endTurn(false)
	}
	return g.LastRoll, nil
}

// LegalMoves returns token indexes this player can move with the given roll.
func (g *GameState) LegalMoves(playerIdx, roll int) []int {
	var out []int
	for t := 0; t < TokensPerPlayer; t++ {
		pos := g.Tokens[playerIdx][t]
		if pos == -1 && roll != 6 {
			continue
		}
		if target, ok := g.targetPosition(playerIdx, t, roll); ok {
			if target != pos {
				out = append(out, t)
			}
		}
	}
	return out
}

// Move applies the chosen token move. Advances turn state; returns the
// LastMove descriptor for broadcasting.
func (g *GameState) Move(playerID string, tokenIdx int) (LastMove, error) {
	if g.WinnerIdx >= 0 {
		return LastMove{}, ErrGameAlreadyOver
	}
	if g.Players[g.CurrentIdx] != playerID {
		return LastMove{}, ErrNotYourTurn
	}
	if g.LastRoll == 0 {
		return LastMove{}, ErrMustRollFirst
	}
	if tokenIdx < 0 || tokenIdx >= TokensPerPlayer {
		return LastMove{}, ErrInvalidToken
	}
	legal := g.LegalMoves(g.CurrentIdx, g.LastRoll)
	ok := false
	for _, t := range legal {
		if t == tokenIdx {
			ok = true
			break
		}
	}
	if !ok {
		return LastMove{}, ErrMoveNotLegal
	}

	from := g.Tokens[g.CurrentIdx][tokenIdx]
	to, _ := g.targetPosition(g.CurrentIdx, tokenIdx, g.LastRoll)
	g.Tokens[g.CurrentIdx][tokenIdx] = to

	captured := g.resolveCaptures(g.CurrentIdx, to)

	move := LastMove{
		PlayerIdx: g.CurrentIdx,
		TokenIdx:  tokenIdx,
		From:      from,
		To:        to,
		Captured:  captured,
	}
	g.LastMove = &move

	// Win?
	if g.playerFinished(g.CurrentIdx) {
		g.WinnerIdx = g.CurrentIdx
		g.Version++
		return move, nil
	}

	grantAnother := g.LastRoll == 6 || len(captured) > 0
	g.endTurn(grantAnother)
	g.Version++
	return move, nil
}

func (g *GameState) endTurn(grantAnother bool) {
	g.LastRoll = 0
	if grantAnother && g.RollsThisTurn < 3 {
		g.RollsThisTurn++
		return
	}
	g.RollsThisTurn = 0
	g.CurrentIdx = (g.CurrentIdx + 1) % 4
	// Skip empty seats (bots would be filled by scheduler; if truly empty, skip).
	for i := 0; i < 4 && g.Players[g.CurrentIdx] == ""; i++ {
		g.CurrentIdx = (g.CurrentIdx + 1) % 4
	}
}

// targetPosition returns the would-be position for (player, token) given roll.
// The second return is false when the roll would overshoot the finish.
func (g *GameState) targetPosition(playerIdx, tokenIdx, roll int) (int, bool) {
	pos := g.Tokens[playerIdx][tokenIdx]
	if pos == -1 {
		if roll == 6 {
			return PlayerEntrySquare[playerIdx], true
		}
		return pos, false
	}

	entry := PlayerEntrySquare[playerIdx]
	// Steps walked so far from entry, modulo main-track length. -1 for not
	// yet in home column.
	if pos >= MainTrackLen {
		target := pos + roll
		if target > FinishPosition {
			return pos, false
		}
		return target, true
	}

	stepsFromEntry := (pos - entry + MainTrackLen) % MainTrackLen
	newSteps := stepsFromEntry + roll
	if newSteps < MainTrackLen-1 {
		return (entry + newSteps) % MainTrackLen, true
	}
	// Enter home column. Stepping one past the "last before home" puts us
	// on home square 52; overshoot past 57 is illegal.
	overshoot := newSteps - (MainTrackLen - 1)
	target := MainTrackLen + overshoot - 1
	if target > FinishPosition {
		return pos, false
	}
	return target, true
}

func (g *GameState) resolveCaptures(movedPlayer, landedAt int) []int {
	if landedAt >= MainTrackLen {
		return nil // home column — never captures.
	}
	var captured []int
	for p := 0; p < 4; p++ {
		if p == movedPlayer || g.Players[p] == "" {
			continue
		}
		for t := 0; t < TokensPerPlayer; t++ {
			if g.Tokens[p][t] == landedAt {
				g.Tokens[p][t] = -1
				captured = append(captured, p*TokensPerPlayer+t)
			}
		}
	}
	return captured
}

func (g *GameState) playerFinished(p int) bool {
	for t := 0; t < TokensPerPlayer; t++ {
		if g.Tokens[p][t] != FinishPosition {
			return false
		}
	}
	return true
}

// SecureDiceRoll returns a 1..6 value backed by crypto/rand so players can't
// predict the sequence by observing prior rolls (and we don't need to seed
// per-game RNG state).
func SecureDiceRoll() int {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		// Should never happen on supported platforms; panic loud if it does.
		panic(fmt.Sprintf("crypto/rand: %v", err))
	}
	n := binary.BigEndian.Uint32(b[:]) % 6
	return int(n) + 1
}
