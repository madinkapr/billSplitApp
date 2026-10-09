const jwt = require('jsonwebtoken')
const pool = require('../db')

// User sessions live in an httpOnly cookie (not localStorage) so page scripts can't read
// the token. The JWT carries only the user id; `typ` keeps an admin token (same secret,
// see routes/adminAuth.js) from ever passing as a user session and vice versa.
const COOKIE_NAME = 'schet_session'
const SESSION_DAYS = 30

function parseCookies(header) {
  const out = {}
  ;(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i < 0) return
    const key = part.slice(0, i).trim()
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim())
  })
  return out
}

// Secure-only cookies on the real https site; plain http on localhost dev.
function cookieIsSecure() {
  return (process.env.PUBLIC_BASE_URL || '').startsWith('https://')
}

// `sv` = the user's session_version when signing in; a password reset bumps it, which
// invalidates every session issued before (see attachUser).
function setSessionCookie(res, userId, sessionVersion = 0) {
  const token = jwt.sign({ uid: userId, typ: 'user', sv: sessionVersion }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` })
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieIsSecure(),
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: cookieIsSecure(), path: '/' })
}

// Runs on every request: sets req.user = { id, email, name, avatarUrl, emailVerified } for a valid
// session, otherwise leaves it null (guest). Never rejects — use requireUser for that.
async function attachUser(req, res, next) {
  req.user = null
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  if (!token || !process.env.JWT_SECRET) return next()
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.typ !== 'user' || !payload.uid) return next()
    const { rows } = await pool.query('SELECT id, email, name, avatar_url, email_verified, session_version FROM users WHERE id = $1', [payload.uid])
    if (rows[0] && rows[0].session_version === (payload.sv || 0)) req.user = publicUser(rows[0])
  } catch {
    // expired/forged token or deleted user — treat as a guest
  }
  next()
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    emailVerified: !!(row.email_verified ?? row.emailVerified),
  }
}

module.exports = { attachUser, setSessionCookie, clearSessionCookie, publicUser, COOKIE_NAME }
