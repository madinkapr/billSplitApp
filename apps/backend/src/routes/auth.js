const crypto = require('crypto')
const express = require('express')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const { OAuth2Client } = require('google-auth-library')
const pool = require('../db')
const { setSessionCookie, clearSessionCookie, publicUser } = require('../middleware/auth')
const { getUsage } = require('../middleware/usageLimit')
const { sendEmail, passwordResetEmail } = require('../services/email')

const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const MAX_NAME = 50

// Per-IP (trust proxy is on, see server.js) — slows password guessing and sign-up spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
})

const googleClient = new OAuth2Client()

function normEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

// The frontend reads this instead of a build-time env var, so the Google button
// appears as soon as GOOGLE_CLIENT_ID is set on the server.
router.get('/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null })
})

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

// What's left of today's free scan/voice uses — only meaningful for guests; signed-in
// users get { guest: false } and the UI shows no counter.
router.get('/usage', async (req, res) => {
  if (req.user) return res.json({ guest: false })
  try {
    res.json({ guest: true, ...(await getUsage(req, ['scan', 'voice'])) })
  } catch (err) {
    console.error('Usage lookup failed:', err.message)
    res.json({ guest: true })
  }
})

router.post('/register', authLimiter, async (req, res) => {
  const email = normEmail(req.body?.email)
  const password = req.body?.password
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, MAX_NAME) : ''
  if (!name) return res.status(400).json({ error: 'name_required' })
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' })
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return res.status(400).json({ error: 'weak_password' })

  try {
    const existing = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email])
    if (existing.rows[0]) {
      // A Google-only account has no password yet — point them to Google instead.
      return res.status(409).json({ error: existing.rows[0].password_hash ? 'email_taken' : 'use_google' })
    }
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash, last_login_at) VALUES ($1, $2, $3, NOW())
       RETURNING id, email, name, avatar_url, session_version`,
      [email, name, hash]
    )
    setSessionCookie(res, rows[0].id, rows[0].session_version)
    res.status(201).json({ user: publicUser(rows[0]) })
  } catch (err) {
    console.error('Register failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Constant-time-ish failure: always run bcrypt, even for an unknown email, so response
// timing doesn't reveal which emails have accounts. Same message for both cases.
const DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva'

router.post('/login', authLimiter, async (req, res) => {
  const email = normEmail(req.body?.email)
  const password = req.body?.password
  if (!email || typeof password !== 'string') return res.status(400).json({ error: 'invalid_request' })

  try {
    const { rows } = await pool.query('SELECT id, email, name, avatar_url, password_hash, session_version FROM users WHERE email = $1', [email])
    const user = rows[0]
    const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH)
    if (!user || !user.password_hash || !valid) {
      return res.status(401).json({ error: user && !user.password_hash ? 'use_google' : 'invalid_credentials' })
    }
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
    setSessionCookie(res, user.id, user.session_version)
    res.json({ user: publicUser(user) })
  } catch (err) {
    console.error('Login failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Google Identity Services hands the browser a signed ID token ("credential"); we
// verify its signature and audience with Google's keys, then sign the user in —
// matching by Google id first, then by (Google-verified) email so an existing
// email/password account simply gains Google sign-in instead of becoming a duplicate.
router.post('/google', authLimiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const credential = req.body?.credential
  if (!clientId) return res.status(503).json({ error: 'google_not_configured' })
  if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: 'invalid_request' })

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId })
    payload = ticket.getPayload()
  } catch (err) {
    console.error('Google token rejected:', err.message)
    return res.status(401).json({ error: 'google_invalid' })
  }
  const email = normEmail(payload?.email)
  if (!payload?.sub || !email || payload.email_verified !== true) {
    return res.status(401).json({ error: 'google_invalid' })
  }

  try {
    let { rows } = await pool.query('SELECT id FROM users WHERE google_sub = $1', [payload.sub])
    let userId = rows[0]?.id
    if (!userId) {
      ;({ rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]))
      userId = rows[0]?.id
      // Email/password sign-up never proves the email is theirs, so someone could have
      // pre-registered this address. Google just proved who owns it: link the account
      // and drop the unverified password so only the real owner can get in from now on —
      // bumping session_version also signs out anyone already inside with that password.
      if (userId) {
        await pool.query(
          'UPDATE users SET google_sub = $2, password_hash = NULL, session_version = session_version + 1 WHERE id = $1',
          [userId, payload.sub]
        )
      }
    }
    if (!userId) {
      ;({ rows } = await pool.query(
        'INSERT INTO users (email, name, google_sub, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, (payload.name || '').slice(0, MAX_NAME) || null, payload.sub, payload.picture || null]
      ))
      userId = rows[0].id
    }
    // Fill in name/photo from Google only where the account has none yet.
    ;({ rows } = await pool.query(
      `UPDATE users SET last_login_at = NOW(),
         name = COALESCE(name, $2), avatar_url = COALESCE(avatar_url, $3)
       WHERE id = $1 RETURNING id, email, name, avatar_url, session_version`,
      [userId, (payload.name || '').slice(0, MAX_NAME) || null, payload.picture || null]
    ))
    setSessionCookie(res, userId, rows[0].session_version)
    res.json({ user: publicUser(rows[0]) })
  } catch (err) {
    console.error('Google login failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Stricter than sign-in: each request can send an email.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
})

// Separate bucket for setting the new password (typos on the reset form shouldn't
// block asking for a link, or the other way round).
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
})

const RESET_TTL_MINUTES = 60
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

// Never derived from request headers (Host/Origin): a forged header would otherwise put
// an attacker's domain in the emailed link and leak the token when the victim clicks.
function appBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

// Always answers the same way whether or not the email has an account, so this can't be
// used to find out who is registered. Google-only accounts may also set a password here.
router.post('/forgot', forgotLimiter, async (req, res) => {
  const email = normEmail(req.body?.email)
  const lang = ['uz', 'ru', 'en'].includes(req.body?.lang) ? req.body.lang : 'uz'
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' })

  try {
    const { rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      // One live link per account: asking again cancels the previous one.
      await pool.query('DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL', [user.id])
      await pool.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval '${RESET_TTL_MINUTES} minutes')`,
        [user.id, sha256(token)]
      )
      const link = `${appBaseUrl()}/reset-password?token=${token}`
      // A delivery failure is logged, never surfaced: answering differently here would
      // tell the caller this email has an account (and the user can just retry).
      try {
        await sendEmail({ to: email, ...passwordResetEmail({ name: user.name, link, lang }) })
      } catch (mailErr) {
        console.error('Password reset email failed:', mailErr.message)
      }
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Forgot password failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Sets the new password from an emailed link, then signs the user in. Bumping
// session_version logs out every other device that still had the old password.
router.post('/reset', resetLimiter, async (req, res) => {
  const token = req.body?.token
  const password = req.body?.password
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'reset_invalid' })
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return res.status(400).json({ error: 'weak_password' })

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [sha256(token)]
    )
    const reset = rows[0]
    if (!reset) return res.status(400).json({ error: 'reset_invalid' })

    // Mark used first (conditionally), so the same link can't win twice in a race.
    const claimed = await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1 AND used_at IS NULL', [reset.id])
    if (claimed.rowCount === 0) return res.status(400).json({ error: 'reset_invalid' })

    const hash = await bcrypt.hash(password, 10)
    const updated = await pool.query(
      `UPDATE users SET password_hash = $2, session_version = session_version + 1, last_login_at = NOW()
       WHERE id = $1 RETURNING id, email, name, avatar_url, session_version`,
      [reset.user_id, hash]
    )
    await pool.query('DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL', [reset.user_id])
    const user = updated.rows[0]
    setSessionCookie(res, user.id, user.session_version)
    res.json({ user: publicUser(user) })
  } catch (err) {
    console.error('Password reset failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.status(204).end()
})

module.exports = router
