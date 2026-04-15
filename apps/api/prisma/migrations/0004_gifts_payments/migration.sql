-- Majlis — Phase 4: gifts catalog, gift sends, payments, withdrawals.

-- ========== Gifts ==========

CREATE TABLE "gifts_catalog" (
    "id"             TEXT          NOT NULL,
    "name_ar"        VARCHAR(40)   NOT NULL,
    "name_en"        VARCHAR(40)   NOT NULL,
    "price_coins"    BIGINT        NOT NULL,
    "animation_url"  TEXT,
    "category"       VARCHAR(32)   NOT NULL,
    "active"         BOOLEAN       NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_catalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gift_sends" (
    "id"            UUID         NOT NULL,
    "gift_id"       TEXT         NOT NULL,
    "sender_id"     UUID         NOT NULL,
    "recipient_id"  UUID         NOT NULL,
    "room_id"       UUID,
    "quantity"      INTEGER      NOT NULL DEFAULT 1,
    "total_coins"   BIGINT       NOT NULL,
    "total_diamonds" BIGINT      NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_sends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gift_sends_sender_id_created_at_idx" ON "gift_sends"("sender_id", "created_at");
CREATE INDEX "gift_sends_recipient_id_created_at_idx" ON "gift_sends"("recipient_id", "created_at");

ALTER TABLE "gift_sends" ADD CONSTRAINT "gift_sends_gift_id_fkey"
    FOREIGN KEY ("gift_id") REFERENCES "gifts_catalog"("id") ON UPDATE CASCADE;
ALTER TABLE "gift_sends" ADD CONSTRAINT "gift_sends_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "gift_sends" ADD CONSTRAINT "gift_sends_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "gift_sends" ADD CONSTRAINT "gift_sends_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL;

-- Seed 20 gifts. Coin prices are approximate tap-anchor levels.
INSERT INTO "gifts_catalog" ("id", "name_ar", "name_en", "price_coins", "category") VALUES
    ('rose',       'ورد',       'Rose',       10,      'classic'),
    ('heart',      'قلب',       'Heart',      20,      'classic'),
    ('coffee',     'قهوة عربي', 'Arabic Coffee', 50,   'regional'),
    ('dates',      'تمر',       'Dates',      60,      'regional'),
    ('oud',        'عود',       'Oud',        80,      'regional'),
    ('bakhoor',    'بخور',      'Bakhoor',    100,     'regional'),
    ('falafel',    'فلافل',     'Falafel',    120,     'regional'),
    ('tea',        'شاي',       'Tea',        150,     'regional'),
    ('dallah',     'دلة',       'Dallah',     200,     'regional'),
    ('crown',      'تاج',       'Crown',      300,     'prestige'),
    ('tent',       'خيمة',      'Khaima',     500,     'regional'),
    ('lion',       'أسد',       'Lion',       800,     'prestige'),
    ('falcon',     'صقر',       'Falcon',     1000,    'prestige'),
    ('car',        'سيارة',     'Car',        2000,    'luxury'),
    ('plane',      'طيارة',     'Plane',      3000,    'luxury'),
    ('yacht',      'يخت',       'Yacht',      5000,    'luxury'),
    ('castle',     'قصر',       'Palace',     8000,    'luxury'),
    ('rocket',     'صاروخ',     'Rocket',     10000,   'luxury'),
    ('galaxy',     'مجرة',      'Galaxy',     20000,   'luxury'),
    ('universe',   'الكون',     'Universe',   50000,   'luxury');

-- ========== Payments ==========

CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE "payments" (
    "id"             UUID            NOT NULL,
    "user_id"        UUID            NOT NULL,
    "package_id"     TEXT            NOT NULL,
    "coins_granted"  BIGINT          NOT NULL,
    "amount"         NUMERIC(10,2)   NOT NULL,
    "currency"       VARCHAR(3)      NOT NULL,
    "provider"       VARCHAR(32)     NOT NULL,
    "provider_ref"   TEXT            NOT NULL,
    "status"         "PaymentStatus" NOT NULL DEFAULT 'pending',
    "created_at"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at"     TIMESTAMP(3),
    "metadata"       JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_provider_provider_ref_key" ON "payments"("provider", "provider_ref");
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- ========== Withdrawals ==========

CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'approved', 'rejected', 'paid');

CREATE TABLE "withdrawals" (
    "id"                UUID                NOT NULL,
    "user_id"           UUID                NOT NULL,
    "diamonds"          BIGINT              NOT NULL,
    "amount_usd"        NUMERIC(10,2)       NOT NULL,
    "method"            VARCHAR(32)         NOT NULL,
    "method_details"    JSONB               NOT NULL,
    "status"            "WithdrawalStatus"  NOT NULL DEFAULT 'pending',
    "reviewer_id"       UUID,
    "reason"            TEXT,
    "requested_at"      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at"       TIMESTAMP(3),

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "withdrawals_status_requested_at_idx" ON "withdrawals"("status", "requested_at");
CREATE INDEX "withdrawals_user_id_idx" ON "withdrawals"("user_id");

ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
