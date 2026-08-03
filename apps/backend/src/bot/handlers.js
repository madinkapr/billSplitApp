const pool = require('../db')
const { getBot, buildOwedMessage, paidKeyboard } = require('./telegramBot')

function register() {
  const bot = getBot()
  if (!bot) return

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const token = match[1]?.trim()
    if (!token) {
      return bot.sendMessage(msg.chat.id, "Salom! Bu TabUp bot — hisob-kitob havolasi orqali ochiladi.")
    }

    const { rows } = await pool.query(
      `UPDATE bill_participants SET telegram_chat_id = $1, telegram_username = $2
       WHERE token = $3 RETURNING *`,
      [msg.chat.id, msg.from.username || null, token]
    )
    const participant = rows[0]
    if (!participant) {
      return bot.sendMessage(msg.chat.id, 'Havola topilmadi yoki eskirgan.')
    }

    const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [participant.bill_id])
    const bill = billResult.rows[0]
    try {
      const sent = await bot.sendMessage(msg.chat.id, buildOwedMessage(bill, participant), {
        parse_mode: 'Markdown',
        reply_markup: paidKeyboard(participant.id),
      })
      await pool.query('UPDATE bill_participants SET telegram_message_id = $1 WHERE id = $2', [
        sent.message_id,
        participant.id,
      ])
    } catch (err) {
      console.error('Failed to send owed message:', err.message)
      await bot.sendMessage(msg.chat.id, "Xabar yuborishda xatolik yuz berdi. To'lovchiga murojaat qiling.")
    }
  })

  bot.on('callback_query', async (query) => {
    const [action, participantId] = (query.data || '').split(':')
    if (action !== 'pay') return

    const { rows } = await pool.query(
      `UPDATE bill_participants SET paid = true, paid_at = NOW()
       WHERE id = $1 AND paid = false RETURNING *`,
      [participantId]
    )
    await bot.answerCallbackQuery(query.id, { text: 'Rahmat! ✅' })

    const participant = rows[0]
    if (participant) {
      await bot.editMessageText(`✅ To'landi — ${Math.round(participant.amount).toLocaleString('en-US')} so'm`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      })
    }
  })
}

module.exports = { register }
