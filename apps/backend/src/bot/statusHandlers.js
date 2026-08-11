const { getBot, getMessages, langFromTelegramCode, sendReminder } = require('./telegramBot')
const pool = require('../db')
const { formatAmount } = require('../services/currency')

async function getLatestBillForChat(chatId) {
  const { rows } = await pool.query(
    'SELECT * FROM bills WHERE created_by_chat_id = $1 ORDER BY created_at DESC LIMIT 1',
    [chatId]
  )
  return rows[0] || null
}

async function getBillById(billId) {
  const { rows } = await pool.query('SELECT * FROM bills WHERE id = $1', [billId])
  return rows[0] || null
}

async function getParticipants(billId) {
  const { rows } = await pool.query(
    'SELECT * FROM bill_participants WHERE bill_id = $1 ORDER BY created_at ASC',
    [billId]
  )
  return rows
}

async function getParticipantById(participantId) {
  const { rows } = await pool.query('SELECT * FROM bill_participants WHERE id = $1', [participantId])
  return rows[0] || null
}

function statusText(msgs, bill, participants) {
  const paid = participants.filter((p) => p.paid).length
  const total = participants.length
  const lines = [msgs.status.header(paid, total), '']

  participants.forEach((p) => {
    const amountStr = formatAmount(Number(p.amount), bill.currency)
    if (p.paid) {
      lines.push(msgs.status.paidLine(p.name, amountStr))
    } else {
      const hint = p.telegram_chat_id ? '' : ` ${msgs.status.notStartedHint}`
      lines.push(msgs.status.unpaidLine(p.name, amountStr) + hint)
    }
  })

  return lines.join('\n')
}

function statusKeyboard(msgs, billId, participants) {
  const rows = participants
    .filter((p) => !p.paid && p.telegram_chat_id)
    .map((p) => [{ text: `${msgs.buttons.remind} — ${p.name}`, callback_data: `status:remind:${p.id}` }])
  rows.push([{ text: msgs.buttons.refresh, callback_data: `status:refresh:${billId}` }])
  return { inline_keyboard: rows }
}

function register() {
  const bot = getBot()
  if (!bot) return

  bot.onText(/\/status/, async (msg) => {
    try {
      const chatId = msg.chat.id
      const msgs = getMessages(langFromTelegramCode(msg.from.language_code)).newBill

      const bill = await getLatestBillForChat(chatId)
      if (!bill) {
        return bot.sendMessage(chatId, msgs.status.noBill)
      }

      const participants = await getParticipants(bill.id)
      await bot.sendMessage(chatId, statusText(msgs, bill, participants), {
        reply_markup: statusKeyboard(msgs, bill.id, participants),
      })
    } catch (err) {
      console.error('/status handler failed:', err.message)
    }
  })

  // A rejected promise here (e.g. Telegram's "message is not modified" error when
  // "refresh" is tapped with no new payments) must never crash the whole bot process.
  bot.on('callback_query', (query) => {
    handleStatusCallback(bot, query).catch((err) => console.error('statusHandlers callback_query handler failed:', err.message))
  })
}

async function handleStatusCallback(bot, query) {
    const [namespace, kind, id] = (query.data || '').split(':')
    if (namespace !== 'status') return

    const chatId = query.message.chat.id
    const msgs = getMessages(langFromTelegramCode(query.from.language_code)).newBill

    if (kind === 'remind') {
      const participant = await getParticipantById(id)
      if (!participant) return bot.answerCallbackQuery(query.id)

      try {
        await sendReminder(pool, participant)
        await bot.answerCallbackQuery(query.id, { text: msgs.status.reminderSent(participant.name) })
      } catch (err) {
        console.error('Manual bot reminder failed:', err.message)
        await bot.answerCallbackQuery(query.id, { text: msgs.status.reminderFailed })
      }
      return
    }

    if (kind === 'refresh') {
      const bill = await getBillById(id)
      if (!bill) return bot.answerCallbackQuery(query.id)

      const participants = await getParticipants(bill.id)
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageText(statusText(msgs, bill, participants), {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: statusKeyboard(msgs, bill.id, participants),
      })
    }
}

module.exports = { register, statusText, statusKeyboard }
