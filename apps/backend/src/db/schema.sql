CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS receipts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  filepath    TEXT NOT NULL,
  mimetype    TEXT NOT NULL,
  language    TEXT,
  ocr_result  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Bot-sourced receipts (downloaded from Telegram into memory) never touch local disk,
-- unlike web-app uploads (saved via multer) — so filepath has nothing to store for them.
ALTER TABLE receipts ALTER COLUMN filepath DROP NOT NULL;

CREATE TABLE IF NOT EXISTS bills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id    UUID REFERENCES receipts(id) ON DELETE SET NULL,
  crew_name     TEXT,
  grand_total   NUMERIC(10,2),
  tip_amount    NUMERIC(10,2),
  tip_percent   NUMERIC(5,2),
  bill_data     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bills ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE bills ADD COLUMN IF NOT EXISTS local_id TEXT UNIQUE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payer_contact TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payer_contact_type TEXT DEFAULT 'card';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'uz';
-- Set only when a bill is created via the bot's /newbill flow (NULL for web-app bills) —
-- lets the bot push a "so-and-so paid" update back to whoever ran /newbill, and lets
-- /status look up "the bill I most recently created" without needing its ID remembered.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS created_by_chat_id BIGINT;
-- The web-app's currency is a global browser setting, never persisted per-bill. The bot's
-- /newbill asks per-bill, so this column exists so /status can format amounts correctly later.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'UZS';

CREATE TABLE IF NOT EXISTS page_views (
  id          BIGSERIAL PRIMARY KEY,
  visitor_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at);

CREATE TABLE IF NOT EXISTS manual_entries (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manual_entries_created_at ON manual_entries (created_at);

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_participants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id             UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  member_local_id     TEXT NOT NULL,
  name                TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  token               TEXT UNIQUE NOT NULL,
  telegram_chat_id    BIGINT,
  telegram_username   TEXT,
  telegram_message_id BIGINT,
  paid                BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at             TIMESTAMPTZ,
  last_reminded_at    TIMESTAMPTZ,
  reminder_count      INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bill_id, member_local_id)
);

-- Tracks each Telegram chat's in-progress /newbill conversation. Bots poll for messages
-- statelessly, so "which step is this chat on" has to be persisted somewhere that survives
-- a server restart — this row is that somewhere.
CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_chat_id BIGINT PRIMARY KEY,
  state             TEXT NOT NULL,
  draft             JSONB NOT NULL DEFAULT '{}',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per /newbill start, mirroring page_views/manual_entries — feeds the admin
-- stats dashboard's "bills started via the bot" metric (see routes/analytics.js).
CREATE TABLE IF NOT EXISTS bot_starts (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_starts_created_at ON bot_starts (created_at);
