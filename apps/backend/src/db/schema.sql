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
