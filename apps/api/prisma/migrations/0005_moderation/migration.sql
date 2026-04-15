-- Majlis — Phase 5: moderation reports, actions, appeals.

CREATE TYPE "ReportTargetType" AS ENUM ('user', 'room', 'message', 'voice_clip');
CREATE TYPE "ReportStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');
CREATE TYPE "ModerationActionKind" AS ENUM ('warning', 'mute_24h', 'ban_7d', 'ban_30d', 'ban_permanent', 'no_action');
CREATE TYPE "AppealStatus" AS ENUM ('open', 'upheld', 'overturned');

CREATE TABLE "moderation_reports" (
    "id"            UUID              NOT NULL,
    "reporter_id"   UUID              NOT NULL,
    "target_type"   "ReportTargetType" NOT NULL,
    "target_id"     TEXT              NOT NULL,
    "room_id"       UUID,
    "category"      VARCHAR(32)       NOT NULL,
    "details"       VARCHAR(500),
    "status"        "ReportStatus"    NOT NULL DEFAULT 'open',
    "auto_flags"    JSONB,
    "created_at"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"   TIMESTAMP(3),
    "resolver_id"   UUID,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_reports_status_created_at_idx"
    ON "moderation_reports"("status", "created_at");
CREATE INDEX "moderation_reports_target_idx"
    ON "moderation_reports"("target_type", "target_id");

ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL;

CREATE TABLE "moderation_actions" (
    "id"           UUID               NOT NULL,
    "target_user_id" UUID             NOT NULL,
    "moderator_id" UUID               NOT NULL,
    "action"       "ModerationActionKind" NOT NULL,
    "reason"       VARCHAR(500)       NOT NULL,
    "report_id"    UUID,
    "ban_until"    TIMESTAMP(3),
    "created_at"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_actions_target_user_id_idx"
    ON "moderation_actions"("target_user_id");
CREATE INDEX "moderation_actions_created_at_idx"
    ON "moderation_actions"("created_at");

ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "moderation_reports"("id") ON DELETE SET NULL;

CREATE TABLE "moderation_appeals" (
    "id"                UUID           NOT NULL,
    "user_id"           UUID           NOT NULL,
    "action_id"         UUID           NOT NULL,
    "reason"            VARCHAR(500)   NOT NULL,
    "status"            "AppealStatus" NOT NULL DEFAULT 'open',
    "reviewer_id"       UUID,
    "reviewer_notes"    VARCHAR(500),
    "created_at"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"       TIMESTAMP(3),

    CONSTRAINT "moderation_appeals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "moderation_appeals_user_action_key"
    ON "moderation_appeals"("user_id", "action_id");
CREATE INDEX "moderation_appeals_status_created_at_idx"
    ON "moderation_appeals"("status", "created_at");

ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_action_id_fkey"
    FOREIGN KEY ("action_id") REFERENCES "moderation_actions"("id") ON DELETE CASCADE;
