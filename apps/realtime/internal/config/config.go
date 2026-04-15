// Package config loads realtime service configuration from environment variables.
package config

import (
	"os"
	"strings"
)

// Config holds process-wide settings. Populated once at boot; do not mutate.
type Config struct {
	Port       string
	RedisURL   string
	JWTSecret  string
	InternalToken string // shared secret for NestJS → realtime internal calls
}

// Load reads config from env with sensible defaults for local dev.
func Load() Config {
	return Config{
		Port:          fallback(os.Getenv("PORT"), "8080"),
		RedisURL:      fallback(os.Getenv("REDIS_URL"), "redis://localhost:6379"),
		JWTSecret:     strings.TrimSpace(os.Getenv("JWT_SECRET")),
		InternalToken: strings.TrimSpace(os.Getenv("REALTIME_INTERNAL_TOKEN")),
	}
}

func fallback(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
