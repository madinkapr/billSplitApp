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
-- Bot-sourced receipts are now written to the same uploads dir as web-app uploads,
-- but filepath stays nullable so a disk-write failure still logs the OCR row.
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
-- A manual entry also keeps the bill it describes (members, items, totals) so the admin
-- day export can ship it next to scan photos and voice recordings. The row is inserted at
-- the counter moment (no items yet) and bill_data is filled in once the bill is complete:
-- web rows are matched by the client's local bill id, bot rows by the id kept in the session.
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS bill_data JSONB;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_manual_entries_local_id ON manual_entries (local_id);

-- Who did what, for the admin activity table: `ip` for web requests (via trust proxy),
-- `tg_user` (@username, or name/id when the account has none) for bot actions. Rows
-- written before these columns existed have neither.
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tg_user TEXT;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS tg_user TEXT;

-- One row per bill entered by dictating the whole bill (web app + bot), inserted when
-- the user confirms the voice-parsed result. Mirrors manual_entries/page_views — feeds
-- the admin dashboard's "voice input" counter alongside scans and manual entries.
CREATE TABLE IF NOT EXISTS voice_entries (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_entries_created_at ON voice_entries (created_at);
ALTER TABLE voice_entries ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE voice_entries ADD COLUMN IF NOT EXISTS tg_user TEXT;

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

-- One row per voice call (web app + bot) across amount/members/bill/bill_fix. Exists purely
-- to build a training corpus: the audio at `filepath` is the model input, `gemini_response`
-- (Gemini's raw JSON string, before parseJson/normalize) is the label, and `result` is the
-- post-processed output kept only for filtering/analysis. `context` holds the pending-bill
-- state that buildFixPrompt() injected, so bill_fix rows are reproducible. filepath is
-- nullable: a disk-write failure still logs the row. Logged even on OCR/voice failure.
CREATE TABLE IF NOT EXISTS voice_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        TEXT,
  filepath        TEXT,
  mimetype        TEXT NOT NULL,
  kind            TEXT NOT NULL,
  language        TEXT,
  gemini_response TEXT,
  result          JSONB,
  context         JSONB,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_created_at ON voice_recordings (created_at);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_kind ON voice_recordings (kind);

-- AI-estimated calories per dish name, keyed by a normalized (lowercased/trimmed) name —
-- not per bill line — so the same dish ordered again in any future bill resolves instantly
-- without another Gemini call. See services/calorieService.js.
CREATE TABLE IF NOT EXISTS calorie_cache (
  name_key          TEXT PRIMARY KEY,
  calories_per_unit NUMERIC(8,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App users (web login). Separate from `admins`: an account here is a regular customer.
-- password_hash is NULL for Google-only accounts; google_sub is Google's stable user id.
-- Emails are stored lowercased so "Ali@Mail.com" and "ali@mail.com" are one account.
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  name           TEXT,
  password_hash  TEXT,
  google_sub     TEXT UNIQUE,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ
);

-- Who did it, when logged in — lets the admin activity table show the account
-- instead of just an IP. NULL for guests and for rows from before login existed.
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manual_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE voice_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Daily usage of the Gemini-backed features (scan, voice), per guest IP ("ip:1.2.3.4")
-- or per user ("user:<uuid>"), keyed by Tashkent calendar day. Backs the guest limits
-- in middleware/usageLimit.js; only successful calls are counted.
CREATE TABLE IF NOT EXISTS usage_counters (
  subject  TEXT NOT NULL,
  kind     TEXT NOT NULL,
  day      DATE NOT NULL,
  count    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, kind, day)
);

-- Bumped whenever the password changes; sessions carry the version they were issued
-- with (middleware/auth.js), so a reset signs out every other device at once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;

-- "Forgot password" links. Only a SHA-256 of the token is stored, so a database leak
-- doesn't hand out working links; each one expires after an hour and works once.
CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

-- A signed-in user's groups ("crews") and bill history, so they follow the account across
-- devices. Guests keep both in browser localStorage only. `id` is the client-generated id;
-- `data` is the object exactly as the frontend keeps it. Crews list in creation order
-- (clock_timestamp so rows inserted in one statement still keep their order); bills by
-- the bill's own createdAt.
CREATE TABLE IF NOT EXISTS user_crews (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS user_bills (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_user_bills_recent ON user_bills (user_id, created_at DESC NULLS LAST);

-- Email ownership. Email/password sign-ups start unverified until they click the emailed
-- link; Google sign-in and a completed password reset prove ownership too. Unverified
-- accounts get guest-level limits, and linking Google keeps the password only when the
-- email was verified (routes/auth.js /google).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET email_verified = TRUE
WHERE NOT email_verified
  AND (google_sub IS NOT NULL OR id IN (SELECT user_id FROM password_resets WHERE used_at IS NOT NULL));

-- "Confirm your email" links — same scheme as password_resets (SHA-256 of the token only,
-- one live link per account), valid for 24 hours.
CREATE TABLE IF NOT EXISTS email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications (user_id);

-- Unconfirmed sign-ups get one reminder two weeks after the first confirmation email and
-- are deleted two weeks after that (services/emailVerification.js). verification_sent_at
-- is the first send; NULL for accounts from before confirmation existed, which are left
-- alone. `lang` is the UI language at sign-up, for the reminder email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reminded_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT;
