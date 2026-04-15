// Package auth verifies the NestJS-issued access tokens.
//
// The API signs JWTs with HS256 and the shared JWT_SECRET. We recreate the
// minimal validator here instead of making an HTTP call per WebSocket
// upgrade — saves a network round-trip on the hot path.
package auth

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the subset of the access-token payload we care about.
type Claims struct {
	UserID string `json:"-"`
	jwt.RegisteredClaims
	Typ string `json:"typ"`
}

// ParseAccessToken validates signature + expiry and returns the user id.
func ParseAccessToken(tokenStr, secret string) (string, error) {
	if tokenStr == "" {
		return "", errors.New("missing token")
	}

	parsed, err := jwt.ParseWithClaims(
		tokenStr,
		&Claims{},
		func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(secret), nil
		},
	)
	if err != nil {
		return "", err
	}
	if !parsed.Valid {
		return "", errors.New("invalid token")
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok {
		return "", errors.New("invalid claims shape")
	}
	if claims.Typ != "access" {
		return "", errors.New("not an access token")
	}
	if claims.Subject == "" {
		return "", errors.New("missing subject")
	}
	return claims.Subject, nil
}
