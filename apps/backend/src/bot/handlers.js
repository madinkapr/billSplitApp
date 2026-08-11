const pool = require('../db')
const { getBot, buildOwedMessage, paidKeyboard, fmtSom, getMessages, langFromTelegramCode } = require('./telegramBot')

function register() {
  const bot = getBot()
  if (!bot) return

  // Thin sync wrappers so a rejected promise anywhere inside (DB hiccup, a Telegram API
  // error like "message is not modified") can never crash the whole bot process — that
  // would take down Settle Up for every real user, not just the one who triggered it.
  bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    handleStart(bot, msg, match).catch((err) => console.error('handlers /start failed:', err.message))
  })

  bot.on('callback_query', (query) => {
    handlePayCallback(bot, query).catch((err) => console.error('handlers callback_query failed:', err.message))
  })
}

async function handleStart(bot, msg, match) {
    const token = match[1]?.trim()
    if (!token) {
      const msgs = getMessages(langFromTelegramCode(msg.from.language_code))
      return bot.sendMessage(msg.chat.id, msgs.initial)
    }

    const { rows } = await pool.query(
      `UPDATE bill_participants SET telegram_chat_id = $1, telegram_username = $2
       WHERE token = $3 RETURNING *`,
      [msg.chat.id, msg.from.username || null, token]
    )
    const participant = rows[0]
    if (!participant) {
      const msgs = getMessages(langFromTelegramCode(msg.from.language_code))
      return bot.sendMessage(msg.chat.id, msgs.linkNotFound)
    }

    const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [participant.bill_id])
    const bill = billResult.rows[0]
    try {
      const sent = await bot.sendMessage(msg.chat.id, buildOwedMessage(bill, participant), {
        parse_mode: 'Markdown',
        reply_markup: paidKeyboard(participant.id, bill.language),
      })
      await pool.query('UPDATE bill_participants SET telegram_message_id = $1 WHERE id = $2', [
        sent.message_id,
        participant.id,
      ])
    } catch (err) {
      console.error('Failed to send owed message:', err.message)
      await bot.sendMessage(msg.chat.id, getMessages(bill?.language).sendError)
    }
}

async function handlePayCallback(bot, query) {
    const [action, participantId] = (query.data || '').split(':')
    if (action !== 'pay') return

    const { rows } = await pool.query(
      `UPDATE bill_participants SET paid = true, paid_at = NOW()
       WHERE id = $1 AND paid = false RETURNING *`,
      [participantId]
    )
    const participant = rows[0]

    let bill
    if (participant) {
      const billResult = await pool.query('SELECT language, created_by_chat_id FROM bills WHERE id = $1', [participant.bill_id])
      bill = billResult.rows[0]
    }
    const msgs = getMessages(bill?.language)
    await bot.answerCallbackQuery(query.id, { text: msgs.thanks })

    if (participant) {
      await bot.editMessageText(msgs.paidConfirm(fmtSom(participant.amount)), {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      })
    }

    // Best-effort live update to whoever ran /newbill for this bill (bot-created bills
    // only — bill.created_by_chat_id is NULL for web-app bills). Never let this break
    // the payment confirmation above if it fails (e.g. the payer blocked the bot).
    if (participant && bill?.created_by_chat_id) {
      try {
        const countResult = await pool.query(
          'SELECT COUNT(*) FILTER (WHERE paid) AS paid, COUNT(*) AS total FROM bill_participants WHERE bill_id = $1',
          [participant.bill_id]
        )
        const { paid, total } = countResult.rows[0]
        await bot.sendMessage(bill.created_by_chat_id, getMessages(bill.language).newBill.status.paymentUpdate(participant.name, paid, total))
      } catch (err) {
        console.error('Payer notification failed:', err.message)
      }
    }
}

module.exports = { register }
