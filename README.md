# schet.uz 💸

A mobile-first web app for splitting restaurant bills fairly among friends and colleagues. Instead of dividing everything equally, schet.uz uses a proportional split — tip is distributed based on what each person actually ordered.

## Features

- **Crews** — save recurring groups (Office, Family, etc.) for one-tap bill starts
- **Attendance** — check off who showed up before each meal
- **Itemizer** — add dishes and assign them to people with drag-and-drop
- **Receipt OCR** — scan a receipt photo and auto-fill items via Gemini
- **Voice dictation** — say the whole bill out loud (who's here, who ate what, the total) and Gemini fills it in; a short follow-up voice note fixes anything missing or misheard, in both the web app and the Telegram bot
- **Telegram bill creation** — start and build a full bill straight from `/newbill` in Telegram: scan a receipt, dictate it by voice, or type it in — no need to open the web app
- **Proportional math** — each person's share of tip scales with their food subtotal
- **Rounding correction** — totals always add up to the exact grand total
- **Receipt report** — clean breakdown per person, including each person's dishes and tip share, with a copy button for sharing
- **Calorie estimate** — Gemini estimates calories per dish on the report, shown alongside a "steps/minutes to walk it off" equivalent
- **Settle Up** — Telegram bot collects payments: each person gets a link with their amount, a "Paid ✅" button, and automatic reminders if they forget; the payer sees live status
- **Persistent** — crews and recent bills survive page refreshes via localStorage
- **Admin dashboard** — password-protected `/admin` page with traffic and usage charts (visitors, receipt scans, manual entries) over 7/30/90-day ranges

## Tech Stack

- Frontend: React 18 + Vite, Tailwind CSS, Framer Motion, Lucide React
- Backend: Node.js + Express, PostgreSQL
- Telegram Bot API (`node-telegram-bot-api`) for `/newbill` bill creation and Settle Up, + `node-cron` for reminders
- pnpm workspaces monorepo (`apps/frontend`, `apps/backend`)

---

## Setup (`.env`)

Both run methods below (Docker and local/pnpm) read from a single `.env` file at the repo root.

```bash
cp .env.example .env
```

Fill in:

| Variable | Required? | What it's for |
|---|---|---|
| `GEMINI_API_KEY` | For OCR & voice | Receipt scanning and voice dictation via Gemini |
| `POSTGRES_PASSWORD` | Yes | Password for the `tabup` Postgres user |
| `DATABASE_URL` | Yes | Full Postgres connection string (see notes per run method below) |
| `PORT` | Yes | Backend port (default `3001`) |
| `TELEGRAM_BOT_TOKEN` | For the Telegram bot | Bot token — see below. Powers both `/newbill` (bill creation) and Settle Up. Leave blank to run without the bot; nothing else breaks |
| `REMINDER_DELAY_HOURS` | No | Hours before an unpaid participant gets auto-reminded (default `24`) |
| `REMINDER_CRON` | No | Cron schedule for the reminder check (default hourly: `0 * * * *`) |
| `PUBLIC_BASE_URL` | For one-tap payment | Public HTTPS URL the app is reachable at — enables a "tap to pay" button in bot messages. Leave blank to fall back to a copy-paste payment code |
| `JWT_SECRET` | For the admin dashboard | Signs admin login sessions |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | For the admin dashboard | Login credentials for `/admin` — set your own, don't commit real values |

**Getting a `TELEGRAM_BOT_TOKEN`:**
1. Open Telegram, message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts.
3. Copy the token it gives you into `TELEGRAM_BOT_TOKEN`.

---

## Running with Docker

**Prerequisites:** Docker + Docker Compose, and `.env` set up (above).

```bash
# Build and start
docker compose up --build

# Run in background
docker compose up --build -d

# Stop
docker compose down
```

Open [http://localhost:8890](http://localhost:8890).

Docker Compose runs everything for you — `frontend` (nginx, proxies `/api` to the backend), `backend` (Express + the Settle Up bot, if `TELEGRAM_BOT_TOKEN` is set), and `db` (PostgreSQL). You don't need a local Postgres install; `DATABASE_URL` in `.env` is overridden internally to point at the `db` service.

---

## Running Locally (pnpm)

**Prerequisites:** Node.js 18+, [pnpm](https://pnpm.io), and a **local PostgreSQL instance running** with a `tabup` database — unlike Docker, nothing here starts Postgres for you, so `DATABASE_URL` in `.env` must point at a database you already have running (e.g. `postgresql://postgres:postgres@localhost:5432/tabup`).

```bash
# Install dependencies (repo root — installs both apps)
pnpm install

# Start frontend + backend together
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) — the Vite dev server proxies `/api` requests to the backend on port `3001` automatically (see `apps/frontend/vite.config.js`), no extra setup needed.

```bash
# Production build (frontend)
pnpm --filter frontend build

# Preview the production build locally
pnpm --filter frontend preview
```
