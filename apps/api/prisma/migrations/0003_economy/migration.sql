-- Majlis — Phase 3 economy + games schema.

-- CreateEnum
CREATE TYPE "TxType" AS ENUM (
  'purchase',
  'game_stake',
  'game_payout',
  'gift_sent',
  'gift_received',
  'withdrawal',
  'admin_adjust'
);

-- CreateTable
CREATE TABLE "wallets" (
    "user_id"    UUID         NOT NULL,
    "coins"      BIGINT       NOT NULL DEFAULT 0,
    "diamonds"   BIGINT       NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id"          UUID         NOT NULL,
    "user_id"     UUID         NOT NULL,
    "type"        "TxType"     NOT NULL,
    "coins_delta" BIGINT       NOT NULL DEFAULT 0,
    "diamond_delta" BIGINT     NOT NULL DEFAULT 0,
    -- Idempotency key: scoped by (user, type, ref_id).
    "ref_id"      TEXT         NOT NULL,
    "metadata"    JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (game rounds, settled at round end)
CREATE TYPE "GameKind" AS ENUM ('ludo');

CREATE TABLE "game_rounds" (
    "id"          UUID         NOT NULL,
    "kind"        "GameKind"   NOT NULL,
    "stake_coins" BIGINT       NOT NULL,
    "winner_id"   UUID,
    "participants" UUID[]      NOT NULL DEFAULT ARRAY[]::UUID[],
    "started_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"    TIMESTAMP(3),
    "metadata"    JSONB,

    CONSTRAINT "game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_type_ref_id_key"
    ON "transactions"("user_id", "type", "ref_id");
CREATE INDEX "transactions_user_id_created_at_idx"
    ON "transactions"("user_id", "created_at");
CREATE INDEX "game_rounds_started_at_idx" ON "game_rounds"("started_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
