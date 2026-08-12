const TelegramBot = require('node-telegram-bot-api')

let bot = null
let botUsername = null

function fmtSom(amount) {
  return `${Math.round(amount).toLocaleString('en-US')} so'm`
}

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en']
// Matches the frontend's default (HomeScreen.jsx / Sidebar.jsx useLocalStorage('tabup_language', 'ru')).
const DEFAULT_LANGUAGE = 'ru'

function resolveLang(lang) {
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE
}

// Maps a Telegram client's language_code (e.g. "ru", "en-US") to one of our supported
// languages — used only where there's no bill yet to read the app's own language from.
function langFromTelegramCode(code) {
  const base = String(code || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE
}

const MESSAGES = {
  uz: {
    initial: "Salom! Bu schet.uz boti.\n\nYangi hisob boshlash uchun /newbill deb yozing.",
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
    paidButton: "To'ladim ✅",
    newBill: {
      start: "Yangi hisob boshladik!\n\nBu safar qaysi valyutada hisoblaymiz?",
      currencySet: (code) => `Valyuta: ${code}.\n\nEndi umumiy summani yuboring (yoki chek rasmini yuboring — o'zi o'qib beraman):`,
      invalidCurrency: "Noma'lum valyuta",
      currencySelected: (code) => `${code} tanlandi`,
      totalReceived: (amountStr) => `Qabul qilindi: ${amountStr}.\n\nEndi tip/xizmat foizini tanlang:`,
      invalidAmount: "Iltimos, to'g'ri summa kiriting.",
      tipPercentPrompt: 'Tip foizini kiriting (masalan: 12):',
      invalidTipPercent: "Iltimos, to'g'ri foiz kiriting (masalan: 12).",
      tipAmountPrompt: 'Tip summasini kiriting:',
      tipSet: (str) => `Tip: ${str}.\n\nChegirma bormi? (ixtiyoriy)`,
      tipPercentSelected: (percent) => `${percent}% tanlandi`,
      discountPrompt: 'Chegirma summasini kiriting:',
      discountSet: (str) => `Chegirma: ${str}.`,
      discountNone: "Chegirma: yo'q.",
      membersIntro: "Endi hisobda kim ishtirok etganini yozing (masalan: Ali). Har birini alohida xabar sifatida yuboring, tugatgach 'Tayyor' tugmasini bosing.",
      memberAdded: (list) => `✅ Qo'shildi. Hozircha: ${list}.\n\nYana kimdir bo'lsa, yozing yoki 'Tayyor'ni bosing.`,
      invalidMemberName: "Ism bo'sh yoki juda uzun (25 belgigacha bo'lishi kerak).",
      noMembersYet: 'Avval kamida bitta a\'zo qo\'shing.',
      itemsIntro: "Endi taomlarni yuboring — nomi va narxi (masalan: Osh 45000), bir nechta dona bo'lsa 'x' bilan (masalan: Choy 5000 x2). Har birini alohida xabar sifatida yuboring.",
      nextItemPrompt: "Yana taom qo'shing (masalan: Choy 5000 x2) yoki tugating:",
      invalidItemInput: "Iltimos, 'Nomi DonaNarxi' yoki 'Nomi DonaNarxi xMiqdor' formatida yuboring (masalan: Osh 45000 yoki Choy 5000 x2).",
      itemAdded: (name, priceStr, quantity, remaining) =>
        `"${name}" qo'shildi (${priceStr}${quantity > 1 ? `, ${quantity} dona` : ''}). Qoldi: ${remaining} dona.\n\nKim nechtasini olganini belgilang:`,
      allUnitsAssigned: "Bu taomning barcha donalari allaqachon taqsimlandi.",
      itemEveryoneSet: (name, priceStr) => `"${name}" hammaga teng taqsimlandi (${priceStr}).`,
      noItemsYet: 'Avval kamida bitta taom qo\'shing.',
      report: {
        header: 'Hisob taqsimoti',
        totalLine: (amountStr) => `Umumiy: ${amountStr}`,
        tipPercentLine: (percent, amountStr) => `Tip (${percent}%): ${amountStr}`,
        tipAmountLine: (amountStr) => `Tip: ${amountStr}`,
        foodLine: (amountStr) => `Taom: ${amountStr}`,
        discountLine: (amountStr) => `Chegirma: ${amountStr}`,
        personLine: (name, amountStr) => `${name}: ${amountStr}`,
        verifiedLine: (sumStr) => `Jami: ${sumStr} ✓`,
      },
      settle: {
        typePrompt: "To'lovni qanday qabul qilasiz?",
        contactPrompt: (type) => (type === 'phone' ? 'Telefon raqamingizni yuboring:' : 'Karta raqamingizni yuboring:'),
        invalidContact: "Iltimos, to'g'ri raqam kiriting.",
        createdHeader: '✅ To\'lov havolalari tayyor! Har biriga mos havolani forward qiling:',
        participantLine: (name, amountStr, link) => `${name}: ${amountStr}${link ? `\n👉 ${link}` : ''}`,
      },
      ocr: {
        scanning: '📷 Chekni o\'qiyapman...',
        failed: "Chekni o'qib bo'lmadi. Umumiy summani qo'lda kiriting:",
        summaryHeader: '📷 Chekdan topildi:',
        summaryTotal: (amountStr) => `Umumiy: ${amountStr}`,
        summaryTip: (amountStr) => `Tip: ${amountStr}`,
        summaryDiscount: (amountStr) => `Chegirma: ${amountStr}`,
        summaryItemLine: (name, priceStr, quantity) => `• ${name} — ${priceStr}${quantity > 1 ? ` (${quantity} dona)` : ''}`,
        summaryFooter: "To'g'rimi?",
        noTotalFound: "Chekda umumiy summani topa olmadim. Umumiy summani qo'lda kiriting:",
      },
      status: {
        header: (paid, total) => `To'lov holati: ${paid}/${total} to'landi`,
        noBill: "Sizda hali yaratilgan hisob yo'q. /newbill bilan boshlang.",
        paidLine: (name, amountStr) => `✅ ${name}: ${amountStr}`,
        unpaidLine: (name, amountStr) => `⏳ ${name}: ${amountStr}`,
        notStartedHint: '(hali botni ochmagan)',
        reminderSent: (name) => `${name}ga eslatma yuborildi.`,
        reminderFailed: "Eslatma yuborib bo'lmadi.",
        paymentUpdate: (name, paid, total) => `✅ ${name} to'ladi! (${paid}/${total} to'landi)`,
      },
      buttons: {
        tipOther: 'Boshqa foiz', tipFixed: 'Aniq summa', discountNo: "Yo'q", discountYes: 'Ha, bor', membersDone: 'Tayyor ✅',
        everyone: 'Hammaga', itemDone: 'Tayyor ✅', finishItems: 'Itemlar tugadi ✅', reset: '↺ Tozalash',
        settleStart: "💳 To'lov havolalarini yaratish", typeCard: '💳 Karta', typePhone: '📱 Telefon',
        remind: '🔔 Eslatish', refresh: '🔄 Yangilash',
        ocrConfirm: '✅ Davom etish', ocrManual: "✍️ Qo'lda kiritish",
      },
    },
  },
  ru: {
    initial: 'Привет! Это бот schet.uz.\n\nЧтобы начать новый счёт, напишите /newbill.',
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
    paidButton: 'Оплатил(а) ✅',
    newBill: {
      start: 'Начинаем новый счёт!\n\nВ какой валюте будем считать?',
      currencySet: (code) => `Валюта: ${code}.\n\nТеперь отправьте общую сумму (или отправьте фото чека — я сам его прочитаю):`,
      invalidCurrency: 'Неизвестная валюта',
      currencySelected: (code) => `Выбрано: ${code}`,
      totalReceived: (amountStr) => `Принято: ${amountStr}.\n\nТеперь выберите чаевые/сервисный сбор:`,
      invalidAmount: 'Пожалуйста, введите корректную сумму.',
      tipPercentPrompt: 'Введите процент чаевых (например: 12):',
      invalidTipPercent: 'Пожалуйста, введите корректный процент (например: 12).',
      tipAmountPrompt: 'Введите сумму чаевых:',
      tipSet: (str) => `Чаевые: ${str}.\n\nЕсть скидка? (необязательно)`,
      tipPercentSelected: (percent) => `Выбрано ${percent}%`,
      discountPrompt: 'Введите сумму скидки:',
      discountSet: (str) => `Скидка: ${str}.`,
      discountNone: 'Скидка: нет.',
      membersIntro: 'Теперь напишите, кто участвует в счёте (например: Али). Каждого — отдельным сообщением, а закончив — нажмите «Готово».',
      memberAdded: (list) => `✅ Добавлено. Пока что: ${list}.\n\nЕсли есть ещё, напишите, или нажмите «Готово».`,
      invalidMemberName: 'Имя пустое или слишком длинное (до 25 символов).',
      noMembersYet: 'Сначала добавьте хотя бы одного участника.',
      itemsIntro: 'Теперь отправляйте блюда — название и цена (например: Плов 45000), если несколько порций — через «x» (например: Чай 5000 x2). Каждое — отдельным сообщением.',
      nextItemPrompt: 'Добавьте ещё блюдо (например: Чай 5000 x2) или завершите:',
      invalidItemInput: "Пожалуйста, отправьте в формате 'Название Цена' или 'Название Цена xКоличество' (например: Плов 45000 или Чай 5000 x2).",
      itemAdded: (name, priceStr, quantity, remaining) =>
        `«${name}» добавлено (${priceStr}${quantity > 1 ? `, ${quantity} порц.` : ''}). Осталось: ${remaining}.\n\nОтметьте, кто сколько взял:`,
      allUnitsAssigned: 'Все порции этого блюда уже распределены.',
      itemEveryoneSet: (name, priceStr) => `«${name}» разделено поровну на всех (${priceStr}).`,
      noItemsYet: 'Сначала добавьте хотя бы одно блюдо.',
      report: {
        header: 'Разбивка счёта',
        totalLine: (amountStr) => `Итого: ${amountStr}`,
        tipPercentLine: (percent, amountStr) => `Чаевые (${percent}%): ${amountStr}`,
        tipAmountLine: (amountStr) => `Чаевые: ${amountStr}`,
        foodLine: (amountStr) => `Еда: ${amountStr}`,
        discountLine: (amountStr) => `Скидка: ${amountStr}`,
        personLine: (name, amountStr) => `${name}: ${amountStr}`,
        verifiedLine: (sumStr) => `Сумма: ${sumStr} ✓`,
      },
      settle: {
        typePrompt: 'Как вы будете принимать оплату?',
        contactPrompt: (type) => (type === 'phone' ? 'Отправьте номер телефона:' : 'Отправьте номер карты:'),
        invalidContact: 'Пожалуйста, введите корректный номер.',
        createdHeader: '✅ Ссылки для оплаты готовы! Перешлите каждому его ссылку:',
        participantLine: (name, amountStr, link) => `${name}: ${amountStr}${link ? `\n👉 ${link}` : ''}`,
      },
      ocr: {
        scanning: '📷 Читаю чек...',
        failed: 'Не удалось прочитать чек. Введите общую сумму вручную:',
        summaryHeader: '📷 Найдено на чеке:',
        summaryTotal: (amountStr) => `Итого: ${amountStr}`,
        summaryTip: (amountStr) => `Чаевые: ${amountStr}`,
        summaryDiscount: (amountStr) => `Скидка: ${amountStr}`,
        summaryItemLine: (name, priceStr, quantity) => `• ${name} — ${priceStr}${quantity > 1 ? ` (${quantity} порц.)` : ''}`,
        summaryFooter: 'Всё верно?',
        noTotalFound: 'Не удалось найти итоговую сумму на чеке. Введите сумму вручную:',
      },
      status: {
        header: (paid, total) => `Статус оплаты: ${paid}/${total} оплачено`,
        noBill: 'У вас пока нет созданного счёта. Начните с /newbill.',
        paidLine: (name, amountStr) => `✅ ${name}: ${amountStr}`,
        unpaidLine: (name, amountStr) => `⏳ ${name}: ${amountStr}`,
        notStartedHint: '(ещё не открыл(а) бота)',
        reminderSent: (name) => `Напоминание отправлено ${name}.`,
        reminderFailed: 'Не удалось отправить напоминание.',
        paymentUpdate: (name, paid, total) => `✅ ${name} оплатил(а)! (${paid}/${total} оплачено)`,
      },
      buttons: {
        tipOther: 'Другой процент', tipFixed: 'Точная сумма', discountNo: 'Нет', discountYes: 'Да, есть', membersDone: 'Готово ✅',
        everyone: 'Всем', itemDone: 'Готово ✅', finishItems: 'Блюда готовы ✅', reset: '↺ Сбросить',
        settleStart: '💳 Создать ссылки для оплаты', typeCard: '💳 Карта', typePhone: '📱 Телефон',
        remind: '🔔 Напомнить', refresh: '🔄 Обновить',
        ocrConfirm: '✅ Продолжить', ocrManual: '✍️ Ввести вручную',
      },
    },
  },
  en: {
    initial: "Hi! This is the schet.uz bot.\n\nType /newbill to start a new bill.",
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
    paidButton: 'Paid ✅',
    newBill: {
      start: "Let's start a new bill!\n\nWhich currency this time?",
      currencySet: (code) => `Currency: ${code}.\n\nNow send the total amount (or send a photo of the receipt — I'll read it for you):`,
      invalidCurrency: 'Unknown currency',
      currencySelected: (code) => `${code} selected`,
      totalReceived: (amountStr) => `Got it: ${amountStr}.\n\nNow choose the tip/service percentage:`,
      invalidAmount: 'Please enter a valid amount.',
      tipPercentPrompt: 'Enter the tip percentage (e.g. 12):',
      invalidTipPercent: 'Please enter a valid percentage (e.g. 12).',
      tipAmountPrompt: 'Enter the tip amount:',
      tipSet: (str) => `Tip: ${str}.\n\nAny discount? (optional)`,
      tipPercentSelected: (percent) => `${percent}% selected`,
      discountPrompt: 'Enter the discount amount:',
      discountSet: (str) => `Discount: ${str}.`,
      discountNone: 'Discount: none.',
      membersIntro: "Now list who's splitting this bill (e.g. Alex). Send each name as its own message, then tap 'Done' when finished.",
      memberAdded: (list) => `✅ Added. So far: ${list}.\n\nSend another name, or tap 'Done'.`,
      invalidMemberName: 'Name is empty or too long (max 25 characters).',
      noMembersYet: 'Add at least one member first.',
      itemsIntro: "Now send the items — name and price (e.g. Pizza 45000), or with 'x' for multiple (e.g. Tea 5000 x2). Send each one as its own message.",
      nextItemPrompt: 'Add another item (e.g. Tea 5000 x2), or finish:',
      invalidItemInput: "Please send it as 'Name Price' or 'Name Price xQuantity' (e.g. Pizza 45000 or Tea 5000 x2).",
      itemAdded: (name, priceStr, quantity, remaining) =>
        `"${name}" added (${priceStr}${quantity > 1 ? `, ${quantity}x` : ''}). Remaining: ${remaining}.\n\nMark who got how many:`,
      allUnitsAssigned: 'All units of this item are already assigned.',
      itemEveryoneSet: (name, priceStr) => `"${name}" split evenly among everyone (${priceStr}).`,
      noItemsYet: 'Add at least one item first.',
      report: {
        header: 'Bill breakdown',
        totalLine: (amountStr) => `Total: ${amountStr}`,
        tipPercentLine: (percent, amountStr) => `Tip (${percent}%): ${amountStr}`,
        tipAmountLine: (amountStr) => `Tip: ${amountStr}`,
        foodLine: (amountStr) => `Food: ${amountStr}`,
        discountLine: (amountStr) => `Discount: ${amountStr}`,
        personLine: (name, amountStr) => `${name}: ${amountStr}`,
        verifiedLine: (sumStr) => `Sum: ${sumStr} ✓`,
      },
      settle: {
        typePrompt: 'How will you receive payment?',
        contactPrompt: (type) => (type === 'phone' ? 'Send your phone number:' : 'Send your card number:'),
        invalidContact: 'Please enter a valid number.',
        createdHeader: '✅ Payment links are ready! Forward each one to the right person:',
        participantLine: (name, amountStr, link) => `${name}: ${amountStr}${link ? `\n👉 ${link}` : ''}`,
      },
      ocr: {
        scanning: '📷 Reading the receipt...',
        failed: "Couldn't read the receipt. Enter the total amount manually:",
        summaryHeader: '📷 Found on the receipt:',
        summaryTotal: (amountStr) => `Total: ${amountStr}`,
        summaryTip: (amountStr) => `Tip: ${amountStr}`,
        summaryDiscount: (amountStr) => `Discount: ${amountStr}`,
        summaryItemLine: (name, priceStr, quantity) => `• ${name} — ${priceStr}${quantity > 1 ? ` (${quantity}x)` : ''}`,
        summaryFooter: 'Look right?',
        noTotalFound: "Couldn't find a total on the receipt. Enter the total amount manually:",
      },
      status: {
        header: (paid, total) => `Payment status: ${paid}/${total} paid`,
        noBill: "You don't have a bill yet. Start with /newbill.",
        paidLine: (name, amountStr) => `✅ ${name}: ${amountStr}`,
        unpaidLine: (name, amountStr) => `⏳ ${name}: ${amountStr}`,
        notStartedHint: "(hasn't opened the bot yet)",
        reminderSent: (name) => `Reminder sent to ${name}.`,
        reminderFailed: 'Failed to send the reminder.',
        paymentUpdate: (name, paid, total) => `✅ ${name} paid! (${paid}/${total} paid)`,
      },
      buttons: {
        tipOther: 'Other %', tipFixed: 'Fixed amount', discountNo: 'No', discountYes: 'Yes', membersDone: 'Done ✅',
        everyone: 'Everyone', itemDone: 'Done ✅', finishItems: 'Items done ✅', reset: '↺ Reset',
        settleStart: '💳 Create payment links', typeCard: '💳 Card', typePhone: '📱 Phone',
        remind: '🔔 Remind', refresh: '🔄 Refresh',
        ocrConfirm: '✅ Continue', ocrManual: '✍️ Enter manually',
      },
    },
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

function paidKeyboard(participantId, lang) {
  return { inline_keyboard: [[{ text: getMessages(lang).paidButton, callback_data: `pay:${participantId}` }]] }
}

// Populates Telegram's own "/" command menu so users can discover /newbill and /status
// without being told about them first. Set per-language (client-side, independent of any
// bill's own language) plus a default fallback for unlisted client languages.
const COMMAND_SETS = {
  uz: [
    { command: 'newbill', description: 'Yangi hisob boshlash' },
    { command: 'status', description: "To'lov holatini ko'rish" },
  ],
  ru: [
    { command: 'newbill', description: 'Начать новый счёт' },
    { command: 'status', description: 'Статус оплаты' },
  ],
  en: [
    { command: 'newbill', description: 'Start a new bill' },
    { command: 'status', description: 'Check payment status' },
  ],
}

async function registerCommandMenu() {
  try {
    await bot.setMyCommands(COMMAND_SETS[DEFAULT_LANGUAGE])
    await Promise.all(
      Object.entries(COMMAND_SETS).map(([lang, commands]) =>
        bot.setMyCommands(commands, { language_code: lang })
      )
    )
  } catch (err) {
    console.error('setMyCommands failed:', err.message)
  }
}

async function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  bot = new TelegramBot(token, { polling: true })
  bot.on('polling_error', (err) => console.error('Telegram polling error:', err.message))
  const me = await bot.getMe()
  botUsername = me.username
  await registerCommandMenu()
  return bot
}

function stop() {
  if (bot) bot.stopPolling()
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
    { parse_mode: 'Markdown', reply_markup: paidKeyboard(participant.id, bill.language) }
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
  stop,
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
