-- Majlis — Phase 2a rooms schema.

-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('gaming', 'music', 'chat', 'story');

-- CreateTable
CREATE TABLE "rooms" (
    "id"              UUID            NOT NULL,
    "name"            VARCHAR(64)     NOT NULL,
    "description"     VARCHAR(240),
    "owner_id"        UUID            NOT NULL,
    "category"        "RoomCategory"  NOT NULL,
    "country"         "Country",
    "max_seats"       INTEGER         NOT NULL DEFAULT 8,
    "locked"          BOOLEAN         NOT NULL DEFAULT false,
    "agora_channel"   TEXT            NOT NULL,
    "listeners_live"  INTEGER         NOT NULL DEFAULT 0,
    "speakers_live"   INTEGER         NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)    NOT NULL,
    "closed_at"       TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_agora_channel_key" ON "rooms"("agora_channel");

-- CreateIndex — Discover list: open rooms, filtered by category + country, newest first.
CREATE INDEX "rooms_closed_at_category_country_created_at_idx"
    ON "rooms"("closed_at", "category", "country", "created_at");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
