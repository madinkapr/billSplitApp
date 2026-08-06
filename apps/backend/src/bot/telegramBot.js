const TelegramBot = require('node-telegram-bot-api')

let bot = null
let botUsername = null

function fmtSom(amount) {
  return `${Math.round(amount).toLocaleString('en-US')} so'm`
}

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en']

function resolveLang(lang) {
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : 'uz'
}

// Maps a Telegram client's language_code (e.g. "ru", "en-US") to one of our supported
// languages — used only where there's no bill yet to read the app's own language from.
function langFromTelegramCode(code) {
  const base = String(code || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'uz'
}

const MESSAGES = {
  uz: {
    initial: 'Salom! Bu TabUp bot — hisob-kitob havolasi orqali ochiladi.',
    linkNotFound: 'Havola topilmadi yoki eskirgan.',
    sendError: "Xabar yuborishda xatolik yuz berdi. To'lovchiga murojaat qiling.",
    greeting: (crew, amount) => `Salom! ${crew} uchun ulushingiz: ${amount}`,
    payTo: (contact) => `To'lov: ${contact}`,
    tapToTransfer: (amount) => `👉 Bosib, ${amount} o'tkazish`,
    dialHintWithLink: "Ishlamasa, qo'lda tering:",
    dialHint: "Qo'lda tering:",
    reminderPrefix: 'Eslatma!',
    thanks: 'Rahmat! ✅',
    paidConfirm: (amount) => `✅ To'landi — ${amount}`,
  },
  ru: {
    initial: 'Привет! Это бот TabUp — он открывается по ссылке для расчёта.',
    linkNotFound: 'Ссылка не найдена или устарела.',
    sendError: 'Не удалось отправить сообщение. Обратитесь к плательщику.',
    greeting: (crew, amount) => `Привет! Ваша доля за «${crew}»: ${amount}`,
    payTo: (contact) => `Оплата: ${contact}`,
    tapToTransfer: (amount) => `👉 Нажмите, чтобы перевести ${amount}`,
    dialHintWithLink: 'Если не сработает, наберите вручную:',
    dialHint: 'Наберите вручную:',
    reminderPrefix: 'Напоминание!',
    thanks: 'Спасибо! ✅',
    paidConfirm: (amount) => `✅ Оплачено — ${amount}`,
  },
  en: {
    initial: 'Hi! This is the TabUp bot — it opens via a settle-up link.',
    linkNotFound: 'Link not found or expired.',
    sendError: 'Failed to send the message. Please contact the payer.',
    greeting: (crew, amount) => `Hi! Your share for ${crew} is: ${amount}`,
    payTo: (contact) => `Pay to: ${contact}`,
    tapToTransfer: (amount) => `👉 Tap to transfer ${amount}`,
    dialHintWithLink: "If that doesn't work, dial manually:",
    dialHint: 'Dial manually:',
    reminderPrefix: 'Reminder!',
    thanks: 'Thanks! ✅',
    paidConfirm: (amount) => `✅ Paid — ${amount}`,
  },
}

function getMessages(lang) {
  return MESSAGES[resolveLang(lang)]
}

// Escape legacy Telegram Markdown special chars in free-text (user-entered) segments,
// so a stray _ * ` or [ in a crew/payer name can't break parsing of the whole message.
function escapeMarkdown(text) {
  return String(text ?? '').replace(/([_*`[])/g, '\\$1')
}

// Uzbekistan-wide interbank card2card USSD transfer (*880#), works from any carrier/bank,
// no Click account or merchant registration required — see plan notes for source.
function buildUssdCode(contact, contactType, amount) {
  const digits = String(contact || '').replace(/\D/g, '')
  if (!digits) return null
  const roundedAmount = Math.round(amount)
  if (contactType === 'phone') {
    const local = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits
    return `*880*3*${local}*${roundedAmount}#`
  }
  return `*880*${digits}*${roundedAmount}#`
}

function buildOwedMessage(bill, participant) {
  const msgs = getMessages(bill.language)
  const crewName = escapeMarkdown(bill.crew_name || (bill.language === 'en' ? 'the bill' : bill.language === 'ru' ? 'счёт' : 'Hisob'))
  const ussd = buildUssdCode(bill.payer_contact, bill.payer_contact_type, participant.amount)
  const lines = [
    msgs.greeting(crewName, fmtSom(participant.amount)),
    '',
    `${msgs.payTo(escapeMarkdown(bill.payer_contact || '—'))}${bill.payer_name ? ` (${escapeMarkdown(bill.payer_name)})` : ''}`,
  ]
  if (ussd) {
    // Telegram strips tel: links from message text (only http/https/tg allowed), so the
    // tappable option routes through our own https bridge page instead of tel: directly.
    const publicBase = process.env.PUBLIC_BASE_URL
    if (publicBase) {
      lines.push('', `[${msgs.tapToTransfer(fmtSom(participant.amount))}](${publicBase}/api/settle/dial/${participant.id})`)
    }
    lines.push(publicBase ? msgs.dialHintWithLink : msgs.dialHint, `\`${ussd}\``)
  }
  return lines.join('\n')
}

function paidKeyboard(participantId) {
  return { inline_keyboard: [[{ text: "To'ladim ✅", callback_data: `pay:${participantId}` }]] }
}

async function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  bot = new TelegramBot(token, { polling: true })
  const me = await bot.getMe()
  botUsername = me.username
  return bot
}

function getBot() {
  return bot
}

function getBotUsername() {
  return botUsername
}

async function sendReminder(pool, participant) {
  if (!bot || !participant.telegram_chat_id) return
  const { rows } = await pool.query('SELECT * FROM bills WHERE id = $1', [participant.bill_id])
  const bill = rows[0]
  if (!bill) return
  const msgs = getMessages(bill.language)
  const sent = await bot.sendMessage(
    participant.telegram_chat_id,
    `${msgs.reminderPrefix}\n${buildOwedMessage(bill, participant)}`,
    { parse_mode: 'Markdown', reply_markup: paidKeyboard(participant.id) }
  )
  await pool.query(
    `UPDATE bill_participants
     SET last_reminded_at = NOW(), reminder_count = reminder_count + 1, telegram_message_id = $1
     WHERE id = $2`,
    [sent.message_id, participant.id]
  )
}

module.exports = {
  init,
  getBot,
  getBotUsername,
  sendReminder,
  buildOwedMessage,
  paidKeyboard,
  fmtSom,
  buildUssdCode,
  getMessages,
  langFromTelegramCode,
}
