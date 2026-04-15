package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func signAccessToken(t *testing.T, secret, sub, typ string, ttl time.Duration) string {
	t.Helper()
	claims := Claims{
		Typ: typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sub,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func TestParseAccessTokenHappyPath(t *testing.T) {
	secret := "test-secret-value-long-enough"
	tok := signAccessToken(t, secret, "user-abc", "access", time.Minute)

	uid, err := ParseAccessToken(tok, secret)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if uid != "user-abc" {
		t.Errorf("got sub=%q, want user-abc", uid)
	}
}

func TestParseAccessTokenRejectsWrongSecret(t *testing.T) {
	tok := signAccessToken(t, "real-secret-xxxxxxxxxxxxxxx", "user", "access", time.Minute)
	if _, err := ParseAccessToken(tok, "other-secret-yyyyyyyyyyyyy"); err == nil {
		t.Error("expected signature error")
	}
}

func TestParseAccessTokenRejectsExpired(t *testing.T) {
	secret := "test-secret-value-long-enough"
	tok := signAccessToken(t, secret, "user", "access", -time.Minute)
	if _, err := ParseAccessToken(tok, secret); err == nil {
		t.Error("expected expiry error")
	}
}

func TestParseAccessTokenRejectsNonAccessTyp(t *testing.T) {
	secret := "test-secret-value-long-enough"
	tok := signAccessToken(t, secret, "user", "refresh", time.Minute)
	if _, err := ParseAccessToken(tok, secret); err == nil {
		t.Error("expected type error")
	}
}
