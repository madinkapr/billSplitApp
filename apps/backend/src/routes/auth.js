const crypto = require('crypto')
const express = require('express')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const { OAuth2Client } = require('google-auth-library')
const pool = require('../db')
const { setSessionCookie, clearSessionCookie, publicUser } = require('../middleware/auth')
const { getUsage } = require('../middleware/usageLimit')
const { sendEmail, passwordResetEmail, verifyEmailEmail } = require('../services/email')

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

// Language for outgoing emails, from the app's current UI language.
function pickLang(lang) {
  return ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz'
}

// The frontend reads this instead of a build-time env var, so the Google button
// appears as soon as GOOGLE_CLIENT_ID is set on the server.
router.get('/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null })
})

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

// What's left of today's free scan/voice uses — only meaningful for guests and for
// accounts whose email isn't confirmed yet (they share the guest limits; `verify` tells
// the UI to ask for the email instead of a sign-in). Verified users get { guest: false }.
router.get('/usage', async (req, res) => {
  if (req.user?.emailVerified) return res.json({ guest: false })
  const verify = !!req.user
  try {
    res.json({ guest: true, verify, ...(await getUsage(req, ['scan', 'voice'])) })
  } catch (err) {
    console.error('Usage lookup failed:', err.message)
    res.json({ guest: true, verify })
  }
})

router.post('/register', authLimiter, async (req, res) => {
  const email = normEmail(req.body?.email)
  const password = req.body?.password
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, MAX_NAME) : ''
  const lang = pickLang(req.body?.lang)
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
       RETURNING id, email, name, avatar_url, email_verified, session_version`,
      [email, name, hash]
    )
    await sendVerificationEmail(rows[0], lang)
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
    const { rows } = await pool.query(
      'SELECT id, email, name, avatar_url, email_verified, password_hash, session_version FROM users WHERE email = $1',
      [email]
    )
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
      ;({ rows } = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email]))
      userId = rows[0]?.id
      if (userId && rows[0].email_verified) {
        // The owner already confirmed this email, so the password is theirs too: keep it,
        // and both sign-in methods work from now on.
        await pool.query('UPDATE users SET google_sub = $2 WHERE id = $1', [userId, payload.sub])
      } else if (userId) {
        // An unconfirmed sign-up never proved the email is theirs, so someone could have
        // pre-registered this address. Google just proved who owns it: link the account and
        // drop the unverified password so only the real owner can get in from now on —
        // bumping session_version also signs out anyone already inside with that password.
        await pool.query(
          'UPDATE users SET google_sub = $2, password_hash = NULL, session_version = session_version + 1 WHERE id = $1',
          [userId, payload.sub]
        )
      }
    }
    if (!userId) {
      ;({ rows } = await pool.query(
        'INSERT INTO users (email, name, google_sub, avatar_url, email_verified) VALUES ($1, $2, $3, $4, TRUE) RETURNING id',
        [email, (payload.name || '').slice(0, MAX_NAME) || null, payload.sub, payload.picture || null]
      ))
      userId = rows[0].id
    }
    // Fill in name/photo from Google only where the account has none yet. Google vouches
    // for the email, so the account counts as verified from here on.
    ;({ rows } = await pool.query(
      `UPDATE users SET last_login_at = NOW(), email_verified = TRUE,
         name = COALESCE(name, $2), avatar_url = COALESCE(avatar_url, $3)
       WHERE id = $1 RETURNING id, email, name, avatar_url, email_verified, session_version`,
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
  const lang = pickLang(req.body?.lang)
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
// session_version logs out every other device that still had the old password. The link
// reached their inbox, so this also confirms the email.
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
      `UPDATE users SET password_hash = $2, session_version = session_version + 1, last_login_at = NOW(), email_verified = TRUE
       WHERE id = $1 RETURNING id, email, name, avatar_url, email_verified, session_version`,
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

const VERIFY_TTL_HOURS = 24

// Sends a fresh "confirm your email" link (cancelling any earlier one). A delivery
// failure is only logged: the account still works, and the user can ask for another.
async function sendVerificationEmail(user, lang) {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('DELETE FROM email_verifications WHERE user_id = $1 AND used_at IS NULL', [user.id])
    await pool.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval '${VERIFY_TTL_HOURS} hours')`,
      [user.id, sha256(token)]
    )
    const link = `${appBaseUrl()}/verify-email?token=${token}`
    await sendEmail({ to: user.email, ...verifyEmailEmail({ name: user.name, link, lang }) })
  } catch (err) {
    console.error('Verification email failed:', err.message)
  }
}

// Each call sends an email, so it shares the tight bucket with "forgot password".
router.post('/verify-email/resend', forgotLimiter, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_signed_in' })
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true })
  await sendVerificationEmail(req.user, pickLang(req.body?.lang))
  res.json({ ok: true })
})

// Opened from the emailed link (/verify-email?token=…). Doesn't sign anyone in — the link
// may be opened on another device; it only marks the email as confirmed. A link that was
// already used still answers ok while its account is verified, so a double click or a
// page reload doesn't show an error.
router.post('/verify-email', resetLimiter, async (req, res) => {
  const token = req.body?.token
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'verify_invalid' })

  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.user_id, v.used_at, v.expires_at > NOW() AS live, u.email_verified
       FROM email_verifications v JOIN users u ON u.id = v.user_id
       WHERE v.token_hash = $1`,
      [sha256(token)]
    )
    const v = rows[0]
    if (v?.used_at && v.email_verified) return res.json({ ok: true })
    if (!v || v.used_at || !v.live) return res.status(400).json({ error: 'verify_invalid' })

    await pool.query('UPDATE email_verifications SET used_at = NOW() WHERE id = $1', [v.id])
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [v.user_id])
    await pool.query('DELETE FROM email_verifications WHERE user_id = $1 AND used_at IS NULL', [v.user_id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Email verification failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.status(204).end()
})

module.exports = router
