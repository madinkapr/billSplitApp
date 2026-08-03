const cron = require('node-cron')
const pool = require('../db')
const { sendReminder } = require('./telegramBot')

function start() {
  const delayHours = Number(process.env.REMINDER_DELAY_HOURS || 24)
  const cronExpr = process.env.REMINDER_CRON || '0 * * * *'

  cron.schedule(cronExpr, async () => {
    let rows
    try {
      ;({ rows } = await pool.query(
        `SELECT * FROM bill_participants
         WHERE paid = false AND telegram_chat_id IS NOT NULL
           AND created_at < NOW() - ($1::numeric * INTERVAL '1 hour')
           AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - ($1::numeric * INTERVAL '1 hour'))`,
        [delayHours]
      ))
    } catch (err) {
      console.error('Reminder query failed:', err.message)
      return
    }
    for (const participant of rows) {
      try {
        await sendReminder(pool, participant)
      } catch (err) {
        console.error('Reminder send failed:', err.message)
      }
    }
  })
}

module.exports = { start }
