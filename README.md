# TabUp 💸

A mobile-first web app for splitting restaurant bills fairly among friends and colleagues. Instead of dividing everything equally, TabUp uses a proportional split — tip is distributed based on what each person actually ordered.

## Features

- **Crews** — save recurring groups (Office, Family, etc.) for one-tap bill starts
- **Attendance** — check off who showed up before each meal
- **Itemizer** — add dishes and assign them to people with name toggles
- **Proportional math** — each person's share of tip scales with their food subtotal
- **Rounding correction** — totals always add up to the exact grand total
- **Receipt report** — clean breakdown per person with a copy button for WhatsApp/Slack
- **Persistent** — crews and recent bills survive page refreshes via localStorage

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Framer Motion
- Lucide React
- localStorage for persistence

---

## Running with Docker

**Prerequisites:** Docker + Docker Compose

```bash
# Build and start
docker compose up --build

# Run in background
docker compose up --build -d

# Stop
docker compose down
```

Open [http://localhost:8080](http://localhost:8080).

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```
