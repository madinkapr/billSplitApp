const pool = require('../db')

async function getSession(chatId) {
  const { rows } = await pool.query('SELECT * FROM bot_sessions WHERE telegram_chat_id = $1', [chatId])
  return rows[0] || null
}

async function saveSession(chatId, state, draft) {
  await pool.query(
    `INSERT INTO bot_sessions (telegram_chat_id, state, draft, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (telegram_chat_id) DO UPDATE SET
       state = EXCLUDED.state,
       draft = EXCLUDED.draft,
       updated_at = NOW()`,
    [chatId, state, JSON.stringify(draft)]
  )
}

async function clearSession(chatId) {
  await pool.query('DELETE FROM bot_sessions WHERE telegram_chat_id = $1', [chatId])
}

module.exports = { getSession, saveSession, clearSession }
