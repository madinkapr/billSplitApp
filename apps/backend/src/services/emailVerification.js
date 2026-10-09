const crypto = require('crypto')
const cron = require('node-cron')
const pool = require('../db')
const { sendEmail, verifyEmailEmail, verifyReminderEmail, appBaseUrl } = require('./email')

// Confirmation links only mark the email as confirmed (nobody is signed in by them), so
// they can live a week — long enough for a reminder read a few days late.
const VERIFY_TTL_DAYS = 7
// Unconfirmed sign-ups: one reminder two weeks after the first email, and the account is
// deleted two weeks after that reminder (≈ one month in all). Accounts from before email
// confirmation existed have no verification_sent_at and are never touched.
const REMIND_AFTER_DAYS = 14
const DELETE_AFTER_REMINDER_DAYS = 14

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const DAY_MS = 24 * 60 * 60 * 1000

// When the daily job will delete this unconfirmed account (a users row) — known once the
// reminder has gone out, and shown from then on as a countdown in the "confirm your
// email" notice, so the warning appears together with the reminder email. Null before
// the reminder, and for confirmed or pre-confirmation accounts that are never deleted.
function deletionDate(row) {
  if (row.email_verified || !row.verification_reminded_at) return null
  return new Date(new Date(row.verification_reminded_at).getTime() + DELETE_AFTER_REMINDER_DAYS * DAY_MS)
}

// Emails a fresh "confirm your email" link, cancelling any earlier one. The first send
// starts the account's reminder/deletion clock; `lang` is remembered for the reminder.
async function sendVerificationEmail(user, lang, { reminder = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex')
  await pool.query('DELETE FROM email_verifications WHERE user_id = $1 AND used_at IS NULL', [user.id])
  await pool.query(
    `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + make_interval(days => $3))`,
    [user.id, sha256(token), VERIFY_TTL_DAYS]
  )
  await pool.query('UPDATE users SET verification_sent_at = COALESCE(verification_sent_at, NOW()), lang = $2 WHERE id = $1', [
    user.id,
    lang,
  ])
  const link = `${appBaseUrl()}/verify-email?token=${token}`
  const build = reminder ? verifyReminderEmail : verifyEmailEmail
  await sendEmail({ to: user.email, ...build({ name: user.name, link, lang }) })
}

async function remindUnverified() {
  const { rows } = await pool.query(
    `SELECT id, email, name, lang FROM users
     WHERE NOT email_verified AND verification_reminded_at IS NULL
       AND verification_sent_at < NOW() - make_interval(days => $1)`,
    [REMIND_AFTER_DAYS]
  )
  let sent = 0
  for (const user of rows) {
    // Marked only after a successful send, so a Resend outage means "retry tomorrow"
    // rather than a deletion nobody was warned about.
    try {
      await sendVerificationEmail(user, user.lang || 'uz', { reminder: true })
      await pool.query('UPDATE users SET verification_reminded_at = NOW() WHERE id = $1', [user.id])
      sent++
    } catch (err) {
      console.error('Verification reminder failed:', err.message)
    }
  }
  return sent
}

// Groups and history go with the account (ON DELETE CASCADE); scans, voice entries and
// visits stay in the stats with their user_id set to NULL.
async function deleteUnverified() {
  const { rowCount } = await pool.query(
    `DELETE FROM users
     WHERE NOT email_verified AND verification_reminded_at < NOW() - make_interval(days => $1)`,
    [DELETE_AFTER_REMINDER_DAYS]
  )
  return rowCount
}

async function runUnverifiedCleanup() {
  try {
    const reminded = await remindUnverified()
    const deleted = await deleteUnverified()
    if (reminded || deleted) console.log(`Unverified accounts: ${reminded} reminded, ${deleted} deleted`)
  } catch (err) {
    console.error('Unverified account cleanup failed:', err.message)
  }
}

// Once a day, early morning Tashkent time.
function startUnverifiedCleanup() {
  cron.schedule('0 4 * * *', runUnverifiedCleanup, { timezone: 'Asia/Tashkent' })
}

module.exports = { sendVerificationEmail, runUnverifiedCleanup, startUnverifiedCleanup, deletionDate }
