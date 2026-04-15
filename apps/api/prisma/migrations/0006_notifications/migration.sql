-- Majlis — Phase 6: device tokens for FCM + notification preferences.

CREATE TABLE "device_tokens" (
    "id"           UUID         NOT NULL,
    "user_id"      UUID         NOT NULL,
    "token"        TEXT         NOT NULL,
    "platform"     VARCHAR(16)  NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Prayer-time quiet hours preference lives on the user row so we don't
-- need a join for every notification dispatch.
ALTER TABLE "users" ADD COLUMN "prayer_quiet_hours" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
