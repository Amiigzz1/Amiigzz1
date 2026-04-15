-- Majlis — initial schema (Phase 1a)
-- Users, user_profiles, refresh_tokens.

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('SA', 'AE', 'EG', 'KW', 'OM', 'BH', 'QA', 'JO');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ar', 'en');

-- CreateTable
CREATE TABLE "users" (
    "id"            UUID         NOT NULL,
    "phone_hash"    TEXT         NOT NULL,
    "phone_cipher"  TEXT,
    "display_name"  VARCHAR(48),
    "avatar_url"    TEXT,
    "country"       "Country",
    "language"      "Language"   NOT NULL DEFAULT 'ar',
    "birthdate"     DATE,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    "banned_at"     TIMESTAMP(3),
    "ban_reason"    TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id"        UUID    NOT NULL,
    "bio"            VARCHAR(240),
    "favorite_games" TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
    "badges"         TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
    "frame_id"       TEXT,
    "nameplate_id"   TEXT,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "device_id"  TEXT,
    "user_agent" VARCHAR(256),
    "ip_hash"    TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "rotated_to" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
