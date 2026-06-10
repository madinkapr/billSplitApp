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
  id           UUID PRIMARY KEY,
  receipt_id   UUID REFERENCES receipts(id) ON DELETE SET NULL,
  crew_name    TEXT,
  grand_total  NUMERIC(10,2),
  tip_amount   NUMERIC(10,2),
  tip_percent  NUMERIC(5,2),
  bill_data    JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
