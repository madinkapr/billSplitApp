const pool = require('../db')
const clientIp = require('./clientIp')

// Daily caps on the Gemini-backed features. Guests (no login) get a small free taste;
// signed-in users with a confirmed email get a generous ceiling that only exists to stop
// a runaway script from running up the Gemini bill. Override with env vars, e.g.
// GUEST_SCAN_LIMIT=5.
const LIMITS = {
  scan: { guest: 'GUEST_SCAN_LIMIT', guestDefault: 3, user: 'USER_SCAN_LIMIT', userDefault: 100 },
  voice: { guest: 'GUEST_VOICE_LIMIT', guestDefault: 3, user: 'USER_VOICE_LIMIT', userDefault: 100 },
  // Small helper mics (one amount / a list of names) — cheap, so a looser guest cap.
  voice_mini: { guest: 'GUEST_VOICE_MINI_LIMIT', guestDefault: 15, user: 'USER_VOICE_MINI_LIMIT', userDefault: 300 },
}

function limitFor(kind, isUser) {
  const cfg = LIMITS[kind]
  const raw = parseInt(process.env[isUser ? cfg.user : cfg.guest], 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : isUser ? cfg.userDefault : cfg.guestDefault
}

const TODAY = `(NOW() AT TIME ZONE 'Asia/Tashkent')::date`

// Only accounts with a confirmed email get their own (larger) allowance. Unconfirmed ones
// count against their IP exactly like guests — otherwise signing up with made-up emails
// would hand out a fresh set of free uses each time.
function isFullUser(req) {
  return !!req.user?.emailVerified
}

function subjectOf(req) {
  return isFullUser(req) ? `user:${req.user.id}` : `ip:${clientIp(req) || 'unknown'}`
}

// Today's usage vs. caps for the given kinds — feeds the "Free: 2/3 left" hint.
async function getUsage(req, kinds) {
  const isUser = isFullUser(req)
  const { rows } = await pool.query(
    `SELECT kind, count FROM usage_counters WHERE subject = $1 AND kind = ANY($2) AND day = ${TODAY}`,
    [subjectOf(req), kinds]
  )
  const used = Object.fromEntries(rows.map((r) => [r.kind, r.count]))
  return Object.fromEntries(kinds.map((k) => [k, { used: used[k] || 0, limit: limitFor(k, isUser) }]))
}

// Rejects with 429 once today's successful uses reach the cap; otherwise lets the request
// through and counts it only if the handler answers { success: true } — a Gemini outage
// or an unreadable photo shouldn't eat one of a guest's three tries.
function usageLimit(kind) {
  return async (req, res, next) => {
    const isUser = isFullUser(req)
    const subject = subjectOf(req)
    const limit = limitFor(kind, isUser)

    try {
      const { rows } = await pool.query(
        `SELECT count FROM usage_counters WHERE subject = $1 AND kind = $2 AND day = ${TODAY}`,
        [subject, kind]
      )
      const used = rows[0]?.count || 0
      if (used >= limit) {
        return res.status(429).json({
          success: false,
          errorCode: isUser ? 'USER_LIMIT' : req.user ? 'VERIFY_EMAIL' : 'GUEST_LIMIT',
          error: isUser
            ? 'Daily limit reached. Try again tomorrow.'
            : req.user
              ? 'Free daily limit reached. Confirm your email to continue.'
              : 'Free daily limit reached. Sign in to continue.',
          limit,
        })
      }
    } catch (err) {
      // Never block the feature because the counter table hiccuped.
      console.error('Usage limit check failed:', err.message)
      return next()
    }

    // Count before the response goes out, so a usage refresh right after a successful
    // scan already sees the new number.
    const json = res.json.bind(res)
    res.json = (body) => {
      if (!body || body.success !== true) return json(body)
      pool
        .query(
          `INSERT INTO usage_counters (subject, kind, day, count) VALUES ($1, $2, ${TODAY}, 1)
           ON CONFLICT (subject, kind, day) DO UPDATE SET count = usage_counters.count + 1`,
          [subject, kind]
        )
        .catch((err) => console.error('Usage count failed:', err.message))
        .finally(() => json(body))
      return res
    }
    next()
  }
}

module.exports = { usageLimit, limitFor, getUsage }
