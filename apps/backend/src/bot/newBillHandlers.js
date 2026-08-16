const { getBot, getMessages, langFromTelegramCode } = require('./telegramBot')
const { getSession, saveSession, clearSession } = require('./session')
const pool = require('../db')
const { CURRENCIES, isValidCurrency, formatAmount } = require('../services/currency')
const { generateId, calculateSplits, getTotalUnits, getAssignedUnits, getRemainingUnits, getItemShares, getUnitPrice } = require('../services/splitCalculator')
const { createSettleBill } = require('../routes/settle')
const { runOcr, saveReceiptRecord } = require('../services/ocrService')
const { runVoiceBill, runVoiceBillFix, runVoiceMembers } = require('../services/voiceService')

const STATES = {
  AWAITING_LANGUAGE: 'awaiting_language',
  AWAITING_CURRENCY: 'awaiting_currency',
  AWAITING_ENTRY_METHOD: 'awaiting_entry_method',
  AWAITING_TOTAL: 'awaiting_total',
  AWAITING_OCR_CONFIRM: 'awaiting_ocr_confirm',
  AWAITING_VOICE_BILL: 'awaiting_voice_bill',
  AWAITING_VOICE_CONFIRM: 'awaiting_voice_confirm',
  AWAITING_VOICE_FIX: 'awaiting_voice_fix',
  AWAITING_TIP: 'awaiting_tip',
  AWAITING_CUSTOM_TIP_PERCENT: 'awaiting_custom_tip_percent',
  AWAITING_TIP_AMOUNT: 'awaiting_tip_amount',
  AWAITING_DISCOUNT: 'awaiting_discount',
  AWAITING_MEMBERS: 'awaiting_members',
  AWAITING_ITEM_INPUT: 'awaiting_item_input',
  ASSIGNING_ITEM: 'assigning_item',
  AWAITING_REPORT: 'awaiting_report',
  AWAITING_PAYER_CONTACT: 'awaiting_payer_contact',
}

const MAX_VOICE_FILE_SIZE = 15 * 1024 * 1024

const MAX_MEMBER_NAME_LENGTH = 25
const MAX_ITEM_NAME_LENGTH = 40
const MAX_ITEM_QUANTITY = 99

// Fire-and-forget analytics, mirroring trackPageView/trackManualEntry (routes/analytics.js) —
// feeds the admin dashboard's "bills started via the bot" metric. Never allowed to break
// the conversation if the insert fails.
async function trackBotStart() {
  try {
    await pool.query('INSERT INTO bot_starts DEFAULT VALUES')
  } catch (err) {
    console.error('Track bot start failed:', err.message)
  }
}

// Mirrors BillSetup.jsx's trackManualEntry() (fires when the user proceeds without a
// successful OCR scan) — feeds the same admin dashboard "Ручной ввод" counter, combined
// with web-app entries for now (bot vs web breakdown is a later, separate step).
async function trackManualEntry() {
  try {
    await pool.query('INSERT INTO manual_entries DEFAULT VALUES')
  } catch (err) {
    console.error('Track manual entry failed:', err.message)
  }
}

function parseMemberName(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed || trimmed.length > MAX_MEMBER_NAME_LENGTH) return null
  return trimmed
}

// Accepts "<name> <unitPrice>" (quantity 1) or "<name> <unitPrice> x<quantity>",
// e.g. "Osh 45000" or "Choy 5000 x2" (2 units at 5000 each -> total price 10000).
// item.price is stored as the TOTAL, matching the frontend's model (itemizerState.js: unitPrice = price / quantity).
function parseItemInput(text) {
  const trimmed = String(text || '').trim()
  const match = trimmed.match(/^(.+?)\s+([\d.,]+)(?:\s*[xX]\s*(\d+))?$/)
  if (!match) return null
  const name = match[1].trim()
  if (!name || name.length > MAX_ITEM_NAME_LENGTH) return null
  const unitPrice = parseAmount(match[2])
  if (!unitPrice) return null
  const quantity = match[3] ? parseInt(match[3], 10) : 1
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_ITEM_QUANTITY) return null
  return { name, quantity, price: unitPrice * quantity }
}

const TIP_PRESETS = [15, 18, 20]

function parseAmount(text) {
  const trimmed = String(text || '').trim()
  if (trimmed.startsWith('-')) return null
  const cleaned = trimmed.replace(/[^\d.]/g, '')
  const amount = parseFloat(cleaned)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function parseTipPercent(text) {
  const trimmed = String(text || '').trim()
  if (trimmed.startsWith('-')) return null
  const cleaned = trimmed.replace(/[^\d.]/g, '')
  const percent = parseFloat(cleaned)
  return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null
}

// Mirrors BillSetup.jsx: grandTotal is the final, tip-inclusive amount already charged,
// so the tip amount is backed out of it rather than added on top.
function tipAmountFromPercent(grandTotal, tipPercent) {
  if (!(tipPercent > 0) || !(grandTotal > 0)) return 0
  return grandTotal - grandTotal / (1 + tipPercent / 100)
}

function tipKeyboard(msgs) {
  return {
    inline_keyboard: [
      TIP_PRESETS.map((p) => ({ text: `${p}%`, callback_data: `tip:preset:${p}` })),
      [
        { text: msgs.newBill.buttons.tipOther, callback_data: 'tip:custom_percent' },
        { text: msgs.newBill.buttons.tipFixed, callback_data: 'tip:fixed_amount' },
      ],
    ],
  }
}

function discountKeyboard(msgs) {
  return {
    inline_keyboard: [[
      { text: msgs.newBill.buttons.discountNo, callback_data: 'discount:none' },
      { text: msgs.newBill.buttons.discountYes, callback_data: 'discount:enter' },
    ]],
  }
}

const LANGUAGE_PROMPT = "🌐 Tilni tanlang / Выберите язык / Choose language:"

function languageKeyboard() {
  return {
    inline_keyboard: [[
      { text: "🇺🇿 O'zbekcha", callback_data: 'lang:uz' },
      { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
      { text: '🇬🇧 English', callback_data: 'lang:en' },
    ]],
  }
}

function currencyKeyboard() {
  return {
    inline_keyboard: [Object.values(CURRENCIES).map((c) => ({ text: `${c.code} (${c.symbol})`, callback_data: `curr:${c.code}` }))],
  }
}

function entryMethodKeyboard(msgs) {
  return {
    inline_keyboard: [
      [{ text: msgs.newBill.buttons.entryReceipt, callback_data: 'entry:receipt' }],
      [{ text: msgs.newBill.buttons.entryVoice, callback_data: 'entry:voice' }],
      [{ text: msgs.newBill.buttons.entryManual, callback_data: 'entry:manual' }],
    ],
  }
}

function ocrConfirmKeyboard(msgs) {
  return {
    inline_keyboard: [[
      { text: msgs.newBill.buttons.ocrConfirm, callback_data: 'ocr:confirm' },
      { text: msgs.newBill.buttons.ocrManual, callback_data: 'ocr:manual' },
    ]],
  }
}

// Generic — works for photos and voice notes alike (node-telegram-bot-api's
// getFileLink is file-type-agnostic; it just resolves file_id -> a download URL).
async function downloadTelegramFile(bot, fileId) {
  const link = await bot.getFileLink(fileId)
  const res = await fetch(link)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function buildOcrSummaryText(msgs, currency, ocrResult) {
  const o = msgs.newBill.ocr
  const fmt = (n) => formatAmount(n, currency)
  const lines = [o.summaryHeader, '', o.summaryTotal(fmt(ocrResult.grandTotal))]
  if (ocrResult.tipAmount > 0) lines.push(o.summaryTip(fmt(ocrResult.tipAmount)))
  if (ocrResult.discountAmount > 0) lines.push(o.summaryDiscount(fmt(ocrResult.discountAmount)))
  if (ocrResult.items.length > 0) {
    lines.push('')
    ocrResult.items.forEach((i) => lines.push(o.summaryItemLine(i.name, fmt(i.price), i.quantity)))
  }
  lines.push('', o.summaryFooter)
  return lines.join('\n')
}

// Triggered when the user sends a photo instead of typing the total (AWAITING_TOTAL).
// Downloads the largest available size, runs it through the shared OCR service (same
// code path as POST /api/ocr/scan), and either shows a confirm/manual choice or falls
// back to asking for the total by hand.
async function handleReceiptPhoto(bot, chatId, msg, session, msgs) {
  const currency = session.draft.currency
  await bot.sendMessage(chatId, msgs.newBill.ocr.scanning)

  const photo = msg.photo[msg.photo.length - 1]
  let ocrResult = null
  let errorCode = null
  try {
    const buffer = await downloadTelegramFile(bot, photo.file_id)
    const result = await runOcr(buffer, 'image/jpeg')
    ocrResult = result.ocrResult
    errorCode = result.errorCode
    await saveReceiptRecord({
      filename: `${photo.file_id}.jpg`,
      filepath: null,
      mimetype: 'image/jpeg',
      ocrResult,
    })
  } catch (err) {
    console.error('Bot OCR failed:', err.message)
    errorCode = 'GEMINI_SERVER_ERROR'
  }

  if (errorCode) {
    await bot.sendMessage(chatId, msgs.newBill.ocr.failed)
    return
  }
  if (!ocrResult?.grandTotal) {
    await bot.sendMessage(chatId, msgs.newBill.ocr.noTotalFound)
    return
  }

  const items = ocrResult.items.map((i) => ({
    id: generateId(), name: i.name, price: i.price, quantity: i.quantity, shares: {}, everyone: false,
  }))
  const ocrPending = {
    grandTotal: ocrResult.grandTotal,
    tipMode: ocrResult.tipAmount > 0 ? 'amount' : 'percent',
    tipPercent: ocrResult.tipPercent || null,
    tipAmount: ocrResult.tipAmount || 0,
    discountAmount: ocrResult.discountAmount || 0,
    items,
  }
  const draft = { ...session.draft, ocrPending }
  await saveSession(chatId, STATES.AWAITING_OCR_CONFIRM, draft)
  await bot.sendMessage(chatId, buildOcrSummaryText(msgs, currency, ocrResult), {
    reply_markup: ocrConfirmKeyboard(msgs),
  })
}

// Collects what's still missing/uncertain from a voice-dictated bill — driven off the
// same fields VoiceBillReviewModal.jsx flags in the web app (unresolved names, an
// item price the backend couldn't infer, a still-unknown grand total). Reused for both
// the confirmation summary text and deciding whether to show the "🎤 Fix" button.
function voiceIssueLines(msgs, currency, result) {
  const v = msgs.newBill.voice
  const issues = []
  result.warnings.forEach((name) => issues.push(v.issueUnresolvedName(name)))
  result.items.forEach((item) => {
    if (item.unitPriceUncertain && !(item.unitPrice > 0)) issues.push(v.issuePriceUnknown(item.name))
  })
  if (!(result.grandTotal > 0)) issues.push(v.issueTotalUnknown)
  // Items summed up to a different amount than the stated total implies (after
  // backing out tip/discount) — e.g. total+tip were dictated but an item got missed,
  // or a number was misheard. Surfaced so it can be caught before confirming instead
  // of only showing up as a confusing number on the final settle-up report.
  if (result.mismatch) {
    issues.push(v.issueMismatch(formatAmount(result.itemsTotal, currency), formatAmount(result.foodBudget, currency)))
  }
  return issues
}

function buildVoiceBillSummaryText(msgs, currency, result) {
  const v = msgs.newBill.voice
  const fmt = (n) => formatAmount(n, currency)
  const lines = [v.confirmHeader, '']

  if (result.members.length > 0) {
    lines.push(v.membersLine(result.members.map((m) => m.name).join(', ')), '')
  }

  result.items.forEach((item) => {
    if (item.everyone) {
      lines.push(msgs.newBill.ocr.summaryItemLine(item.name, fmt(item.price), item.quantity))
    } else {
      lines.push(v.personalItemLine(item.name, fmt(item.unitPrice)))
      Object.entries(item.shares).forEach(([memberId, qty]) => {
        const member = result.members.find((m) => m.id === memberId)
        lines.push(v.personalShareLine(member?.name || '?', qty))
      })
    }
  })

  lines.push('')
  if (result.grandTotal != null) lines.push(msgs.newBill.ocr.summaryTotal(fmt(result.grandTotal)))
  if (result.tipAmount > 0) lines.push(msgs.newBill.ocr.summaryTip(fmt(result.tipAmount)))
  if (result.discountAmount > 0) lines.push(msgs.newBill.ocr.summaryDiscount(fmt(result.discountAmount)))

  const issues = voiceIssueLines(msgs, currency, result)
  if (issues.length > 0) lines.push('', v.issuesHeader, ...issues)

  lines.push('', v.confirmFooter)
  return lines.join('\n')
}

// The Fix button is always offered, not just when voiceIssueLines() flagged something —
// Gemini can confidently mishear a number (e.g. "12000" heard as "120000") without
// leaving any gap for the issue-detector to notice, so the speaker still needs a way to
// correct a value the bot thinks is already fine.
function voiceConfirmKeyboard(msgs) {
  return {
    inline_keyboard: [
      [{ text: msgs.newBill.buttons.voiceConfirm, callback_data: 'voice:confirm' }],
      [{ text: msgs.newBill.buttons.voiceFix, callback_data: 'voice:fix' }],
      [{ text: msgs.newBill.buttons.ocrManual, callback_data: 'voice:manual' }],
    ],
  }
}

// Triggered by a voice note in AWAITING_VOICE_BILL (the "🎤 By voice" entry-method
// choice) — the whole bill dictated in one message, same Gemini call the web app's
// big mic button uses. Lands in AWAITING_VOICE_CONFIRM with a text summary + a "Fix"
// option (see handleVoiceBillFix) when anything came back uncertain.
async function handleVoiceBillDictation(bot, chatId, msg, session, msgs) {
  const currency = session.draft.currency
  if (msg.voice.file_size && msg.voice.file_size > MAX_VOICE_FILE_SIZE) {
    await bot.sendMessage(chatId, msgs.newBill.voice.tooLarge)
    return
  }

  await bot.sendMessage(chatId, msgs.newBill.voice.listening)

  let result = null
  let errorCode = null
  try {
    const buffer = await downloadTelegramFile(bot, msg.voice.file_id)
    const run = await runVoiceBill(buffer, 'audio/ogg')
    result = run.result
    errorCode = run.errorCode
  } catch (err) {
    console.error('Bot voice bill failed:', err.message)
    errorCode = 'GEMINI_SERVER_ERROR'
  }

  if (errorCode || !result) {
    await bot.sendMessage(chatId, msgs.newBill.voice.failed, {
      reply_markup: { inline_keyboard: [[{ text: msgs.newBill.buttons.ocrManual, callback_data: 'voice:manual' }]] },
    })
    return
  }

  const draft = { ...session.draft, voicePending: result }
  await saveSession(chatId, STATES.AWAITING_VOICE_CONFIRM, draft)
  await bot.sendMessage(chatId, buildVoiceBillSummaryText(msgs, currency, result), {
    reply_markup: voiceConfirmKeyboard(msgs),
  })
}

// Triggered by a voice note sent while on the confirm summary — either after tapping
// "🎤 Fix" (AWAITING_VOICE_FIX) or sent directly from AWAITING_VOICE_CONFIRM without
// pressing anything, so a misheard value can be corrected with just another voice note.
// A short follow-up utterance naming just the wrong/missing piece (a name or an amount)
// is merged into the existing voicePending draft, then re-shown as an updated summary.
async function handleVoiceBillFix(bot, chatId, msg, session, msgs) {
  const currency = session.draft.currency
  if (msg.voice.file_size && msg.voice.file_size > MAX_VOICE_FILE_SIZE) {
    await bot.sendMessage(chatId, msgs.newBill.voice.tooLarge)
    return
  }

  await bot.sendMessage(chatId, msgs.newBill.voice.listening)

  let result = null
  let errorCode = null
  try {
    const buffer = await downloadTelegramFile(bot, msg.voice.file_id)
    const run = await runVoiceBillFix(buffer, 'audio/ogg', session.draft.voicePending)
    result = run.result
    errorCode = run.errorCode
  } catch (err) {
    console.error('Bot voice fix failed:', err.message)
    errorCode = 'GEMINI_SERVER_ERROR'
  }

  if (errorCode || !result) {
    await bot.sendMessage(chatId, msgs.newBill.voice.fixFailed, {
      reply_markup: { inline_keyboard: [[{ text: msgs.newBill.buttons.ocrManual, callback_data: 'voice:manual' }]] },
    })
    return // stays in AWAITING_VOICE_FIX — session/draft untouched, so nothing already fixed is lost
  }

  const draft = { ...session.draft, voicePending: result }
  await saveSession(chatId, STATES.AWAITING_VOICE_CONFIRM, draft)
  await bot.sendMessage(chatId, buildVoiceBillSummaryText(msgs, currency, result), {
    reply_markup: voiceConfirmKeyboard(msgs),
  })
}

// Triggered by a voice note in AWAITING_MEMBERS — the "say everyone's name in one
// message" alternative to typing them one at a time. Reuses parseMemberName so a
// voice-transcribed name is held to the exact same validation as a typed one.
async function handleVoiceMembers(bot, chatId, msg, session, msgs) {
  if (msg.voice.file_size && msg.voice.file_size > MAX_VOICE_FILE_SIZE) {
    await bot.sendMessage(chatId, msgs.newBill.voice.tooLarge)
    return
  }

  let result = null
  let errorCode = null
  try {
    const buffer = await downloadTelegramFile(bot, msg.voice.file_id)
    const run = await runVoiceMembers(buffer, 'audio/ogg')
    result = run.result
    errorCode = run.errorCode
  } catch (err) {
    console.error('Bot voice members failed:', err.message)
    errorCode = 'GEMINI_SERVER_ERROR'
  }

  if (errorCode || !result) {
    await bot.sendMessage(chatId, msgs.newBill.voice.failed, { reply_markup: membersKeyboard(msgs) })
    return
  }

  const newNames = result.members.map((n) => parseMemberName(n)).filter(Boolean)
  const members = [...(session.draft.members || []), ...newNames.map((name) => ({ id: generateId(), name }))]
  const draft = { ...session.draft, members }
  await saveSession(chatId, STATES.AWAITING_MEMBERS, draft)
  await bot.sendMessage(chatId, msgs.newBill.memberAdded(members.map((m) => m.name).join(', ')), {
    reply_markup: membersKeyboard(msgs),
  })
}

function membersKeyboard(msgs) {
  return { inline_keyboard: [[{ text: msgs.newBill.buttons.membersDone, callback_data: 'members:done' }]] }
}

async function askForMembers(bot, chatId, draft, msgs) {
  await saveSession(chatId, STATES.AWAITING_MEMBERS, { ...draft, members: draft.members || [] })
  await bot.sendMessage(chatId, msgs.newBill.membersIntro, { reply_markup: membersKeyboard(msgs) })
}

function finishItemsKeyboard(msgs) {
  return { inline_keyboard: [[{ text: msgs.newBill.buttons.finishItems, callback_data: 'items:finish' }]] }
}

// Chunks members into 2-per-row buttons, each showing how many units of the current
// item they've been assigned so far. Tapping adds 1 more (see the 'item:add' handler).
function itemAssignKeyboard(msgs, members, item) {
  const shares = item.shares || {}
  const memberRows = []
  for (let i = 0; i < members.length; i += 2) {
    memberRows.push(
      members.slice(i, i + 2).map((m) => ({
        text: `${m.name} (${shares[m.id] || 0})`,
        callback_data: `item:add:${m.id}`,
      }))
    )
  }
  return {
    inline_keyboard: [
      ...memberRows,
      [{ text: msgs.newBill.buttons.everyone, callback_data: 'item:everyone' }, { text: msgs.newBill.buttons.reset, callback_data: 'item:reset' }],
      [{ text: msgs.newBill.buttons.itemDone, callback_data: 'item:done' }],
    ],
  }
}

function itemAssignText(msgs, item, currency) {
  if (item.everyone) {
    return msgs.newBill.itemEveryoneSet(item.name, formatAmount(item.price, currency))
  }
  const remaining = getRemainingUnits(item)
  return msgs.newBill.itemAdded(item.name, formatAmount(item.price, currency), item.quantity, remaining)
}

async function askForItemInput(bot, chatId, draft, msgs, isFirst) {
  await saveSession(chatId, STATES.AWAITING_ITEM_INPUT, draft)
  const text = isFirst ? msgs.newBill.itemsIntro : msgs.newBill.nextItemPrompt
  await bot.sendMessage(chatId, text, { reply_markup: finishItemsKeyboard(msgs) })
}

// If items already exist (from OCR) and haven't been assigned to anyone yet, jump straight
// into assigning the first one instead of prompting to type a new item — the user only
// needs to mark who had what, not re-type dishes the receipt already gave us.
async function askForNextItem(bot, chatId, draft, msgs, isFirst) {
  const items = draft.items || []
  const pending = items.find((i) => Object.keys(i.shares || {}).length === 0 && !i.everyone)
  if (pending) {
    const newDraft = { ...draft, currentItemId: pending.id }
    await saveSession(chatId, STATES.ASSIGNING_ITEM, newDraft)
    const members = draft.members || []
    await bot.sendMessage(chatId, itemAssignText(msgs, pending, draft.currency), {
      reply_markup: itemAssignKeyboard(msgs, members, pending),
    })
    return
  }
  await askForItemInput(bot, chatId, draft, msgs, isFirst)
}

// Every personal item this member has a share of, formatted as "Name ×qty - price".
// Mirrors useBillSummary.js/useSettleShare.js's personalItemsForMember() on the frontend.
function personalItemsForMember(items, memberId) {
  return (items || [])
    .filter((item) => getItemShares(item)[memberId] > 0)
    .map((item) => {
      const count = getItemShares(item)[memberId]
      const amount = getUnitPrice(item) * count
      const label = count > 1 ? `${item.name} ×${count}` : item.name
      return { label, amount }
    })
}

// Items marked "everyone" with no explicit per-person shares — split evenly across
// every active member. Mirrors the frontend's sharedItems() helper.
function sharedItemsList(items, memberCount) {
  return (items || [])
    .filter((item) => item.everyone === true && Object.keys(getItemShares(item)).length === 0)
    .map((item) => ({ label: item.name, amount: item.price / Math.max(memberCount, 1) }))
}

// The "what am I actually paying for" block under one person's total — their share of
// the tip, their personal dishes, and their cut of anything split evenly. Reused by both
// the full report (buildReportText) and the per-participant payment-link message
// (buildSettleText) so the breakdown is identical wherever a person's total appears.
function personBreakdownLines(msgs, currency, r, items, sharedList, tipAmount, totalSubtotal, tipMode, tipPercent) {
  const rmsgs = msgs.newBill.report
  const fmt = (n) => formatAmount(n, currency)
  const lines = []
  if (tipAmount > 0 && totalSubtotal > 0) {
    const personalTip = tipAmount * (r.subtotal / totalSubtotal)
    lines.push(`  ${rmsgs.tipShareLabel(tipMode === 'percent' ? tipPercent : null)}: ${fmt(personalTip)}`)
  }
  const personal = personalItemsForMember(items, r.id)
  if (personal.length > 0) {
    const isMe = r.isMe === true || r.name === 'Me'
    lines.push(`  ${isMe ? rmsgs.ateLabel : rmsgs.dishesLabel}:`)
    personal.forEach((p) => lines.push(`  - ${p.label} - ${fmt(p.amount)}`))
  }
  if (sharedList.length > 0) {
    lines.push(`  ${rmsgs.everyoneSplitEqually}:`)
    sharedList.forEach((s) => lines.push(`  - ${s.label} - ${fmt(s.amount)}`))
  }
  return lines
}

// Mirrors Report.jsx's buildTextSummary(): grandTotal is already tip/discount-inclusive,
// so "food" is derived by backing the tip out and adding the discount back in for display.
// Each person's line is followed by their tip share and what they actually ate (see
// personBreakdownLines) instead of just the bottom-line total.
function buildReportText(msgs, draft, results) {
  const { grandTotal, tipMode, tipPercent, tipAmount, discountAmount, currency, items, members } = draft
  const r = msgs.newBill.report
  const fmt = (n) => formatAmount(n, currency)
  const foodTotal = grandTotal - (tipAmount || 0) + (discountAmount || 0)
  const totalSubtotal = results.reduce((s, x) => s + x.subtotal, 0)
  const sharedList = sharedItemsList(items, (members || []).length)

  const lines = [`📋 ${r.header}`, '─'.repeat(28), r.totalLine(fmt(grandTotal))]
  lines.push('  ' + (tipMode === 'amount' ? r.tipAmountLine(fmt(tipAmount || 0)) : r.tipPercentLine(tipPercent || 0, fmt(tipAmount || 0))))
  lines.push('  ' + r.foodLine(fmt(foodTotal)))
  if (discountAmount > 0) lines.push('  ' + r.discountLine(fmt(discountAmount)))
  lines.push('─'.repeat(28))
  results.forEach((res, i) => {
    if (i > 0) lines.push('')
    lines.push(r.personLine(res.name, fmt(res.finalTotal)))
    lines.push(...personBreakdownLines(msgs, currency, res, items, sharedList, tipAmount, totalSubtotal, tipMode, tipPercent))
  })
  lines.push('─'.repeat(28))
  const sum = results.reduce((s, res) => s + res.finalTotal, 0)
  lines.push(r.verifiedLine(fmt(sum)))
  return lines.join('\n')
}

function settleStartKeyboard(msgs) {
  return { inline_keyboard: [[{ text: msgs.newBill.buttons.settleStart, callback_data: 'settle:start' }]] }
}

function payerTypeKeyboard(msgs) {
  return {
    inline_keyboard: [[
      { text: msgs.newBill.buttons.typeCard, callback_data: 'settle:type:card' },
      { text: msgs.newBill.buttons.typePhone, callback_data: 'settle:type:phone' },
    ]],
  }
}

async function askForReport(bot, chatId, draft, msgs) {
  await saveSession(chatId, STATES.AWAITING_REPORT, draft)
  const results = calculateSplits({ items: draft.items, members: draft.members, grandTotal: draft.grandTotal })
  await bot.sendMessage(chatId, buildReportText(msgs, draft, results), { reply_markup: settleStartKeyboard(msgs) })
}

// Appends the same per-person breakdown (tip share, dishes, shared items) used in
// buildReportText under each participant's payment link, so the message doubles as
// both "here's your link" and "here's what you're paying for" — mirrors
// useSettleShare.js's personDetailLines() on the frontend. `results` is the full
// calculateSplits() output (every member, payer included) so tip-share proportions
// match the report exactly; `participants` (a subset, payer excluded) only supplies
// the amount/deepLink actually shown per line.
function buildSettleText(msgs, participants, currency, draft, results) {
  const lines = [msgs.newBill.settle.createdHeader, '']
  const totalSubtotal = results.reduce((s, x) => s + x.subtotal, 0)
  const sharedList = sharedItemsList(draft.items, (draft.members || []).length)
  participants.forEach((p) => {
    lines.push(msgs.newBill.settle.participantLine(p.name, formatAmount(p.amount, currency), p.deepLink))
    const res = results.find((r) => r.id === p.localId)
    if (res) {
      lines.push(...personBreakdownLines(msgs, currency, res, draft.items, sharedList, draft.tipAmount, totalSubtotal, draft.tipMode, draft.tipPercent))
    }
    lines.push('')
  })
  return lines.join('\n').trim()
}

function register() {
  const bot = getBot()
  if (!bot) return

  bot.onText(/\/newbill/, async (msg) => {
    try {
      const chatId = msg.chat.id
      await saveSession(chatId, STATES.AWAITING_LANGUAGE, {})
      await bot.sendMessage(chatId, LANGUAGE_PROMPT, { reply_markup: languageKeyboard() })
      trackBotStart()
    } catch (err) {
      console.error('/newbill handler failed:', err.message)
    }
  })

  // Generic text/photo handler — only acts if this chat has an active /newbill session.
  // Commands (leading "/") are ignored here; they're handled by their own onText matchers.
  // Registered as a thin sync wrapper so a rejected promise anywhere inside (e.g. Telegram's
  // "message is not modified" error from a duplicate/no-op button tap) can't crash the whole
  // bot process for every user — see handleMessage/handleCallbackQuery below.
  bot.on('message', (msg) => {
    handleMessage(bot, msg).catch((err) => console.error('newBillHandlers message handler failed:', err.message))
  })

  bot.on('callback_query', (query) => {
    handleCallbackQuery(bot, query).catch((err) => console.error('newBillHandlers callback_query handler failed:', err.message))
  })
}

async function handleMessage(bot, msg) {
    const chatId = msg.chat.id

    if (msg.photo) {
      const photoSession = await getSession(chatId)
      if (photoSession && photoSession.state === STATES.AWAITING_TOTAL) {
        await handleReceiptPhoto(bot, chatId, msg, photoSession, getMessages(photoSession.draft.language))
      }
      return
    }

    if (msg.voice) {
      const voiceSession = await getSession(chatId)
      if (!voiceSession) return
      const voiceMsgs = getMessages(voiceSession.draft.language)
      if (voiceSession.state === STATES.AWAITING_VOICE_BILL) {
        await handleVoiceBillDictation(bot, chatId, msg, voiceSession, voiceMsgs)
      } else if (voiceSession.state === STATES.AWAITING_VOICE_FIX || voiceSession.state === STATES.AWAITING_VOICE_CONFIRM) {
        await handleVoiceBillFix(bot, chatId, msg, voiceSession, voiceMsgs)
      } else if (voiceSession.state === STATES.AWAITING_MEMBERS) {
        await handleVoiceMembers(bot, chatId, msg, voiceSession, voiceMsgs)
      }
      return
    }

    if (!msg.text || msg.text.startsWith('/')) return

    const session = await getSession(chatId)
    if (!session) return
    const { currency, language } = session.draft
    const msgs = getMessages(language)

    if (session.state === STATES.AWAITING_TOTAL) {
      const amount = parseAmount(msg.text)
      if (!amount) {
        return bot.sendMessage(chatId, msgs.newBill.invalidAmount)
      }

      const draft = { ...session.draft, grandTotal: amount }
      await saveSession(chatId, STATES.AWAITING_TIP, draft)
      await bot.sendMessage(chatId, msgs.newBill.totalReceived(formatAmount(amount, currency)), {
        reply_markup: tipKeyboard(msgs),
      })
      trackManualEntry()
      return
    }

    if (session.state === STATES.AWAITING_CUSTOM_TIP_PERCENT) {
      const percent = parseTipPercent(msg.text)
      if (percent === null) {
        return bot.sendMessage(chatId, msgs.newBill.invalidTipPercent)
      }

      const draft = {
        ...session.draft,
        tipMode: 'percent',
        tipPercent: percent,
        tipAmount: tipAmountFromPercent(session.draft.grandTotal, percent),
      }
      await saveSession(chatId, STATES.AWAITING_DISCOUNT, draft)
      await bot.sendMessage(chatId, msgs.newBill.tipSet(`${percent}%`), { reply_markup: discountKeyboard(msgs) })
      return
    }

    if (session.state === STATES.AWAITING_TIP_AMOUNT) {
      const amount = parseAmount(msg.text)
      if (!amount) {
        return bot.sendMessage(chatId, msgs.newBill.invalidAmount)
      }

      const draft = { ...session.draft, tipMode: 'amount', tipPercent: null, tipAmount: amount }
      await saveSession(chatId, STATES.AWAITING_DISCOUNT, draft)
      await bot.sendMessage(chatId, msgs.newBill.tipSet(formatAmount(amount, currency)), {
        reply_markup: discountKeyboard(msgs),
      })
      return
    }

    if (session.state === STATES.AWAITING_DISCOUNT) {
      const amount = parseAmount(msg.text)
      if (!amount) {
        return bot.sendMessage(chatId, msgs.newBill.invalidAmount)
      }

      const draft = { ...session.draft, discountAmount: amount }
      await bot.sendMessage(chatId, msgs.newBill.discountSet(formatAmount(amount, currency)))
      await askForMembers(bot, chatId, draft, msgs)
      return
    }

    if (session.state === STATES.AWAITING_MEMBERS) {
      const name = parseMemberName(msg.text)
      if (!name) {
        return bot.sendMessage(chatId, msgs.newBill.invalidMemberName)
      }

      const members = [...(session.draft.members || []), { id: generateId(), name }]
      const draft = { ...session.draft, members }
      await saveSession(chatId, STATES.AWAITING_MEMBERS, draft)
      await bot.sendMessage(chatId, msgs.newBill.memberAdded(members.map((m) => m.name).join(', ')), {
        reply_markup: membersKeyboard(msgs),
      })
      return
    }

    if (session.state === STATES.AWAITING_ITEM_INPUT) {
      const parsed = parseItemInput(msg.text)
      if (!parsed) {
        return bot.sendMessage(chatId, msgs.newBill.invalidItemInput)
      }

      const item = { id: generateId(), name: parsed.name, price: parsed.price, quantity: parsed.quantity, shares: {}, everyone: false }
      const items = [...(session.draft.items || []), item]
      const draft = { ...session.draft, items, currentItemId: item.id }
      await saveSession(chatId, STATES.ASSIGNING_ITEM, draft)
      const members = session.draft.members || []
      await bot.sendMessage(chatId, itemAssignText(msgs, item, currency), {
        reply_markup: itemAssignKeyboard(msgs, members, item),
      })
      return
    }

    if (session.state === STATES.AWAITING_PAYER_CONTACT) {
      const contact = msg.text.trim()
      if (!contact) {
        return bot.sendMessage(chatId, msgs.newBill.settle.invalidContact)
      }

      const draft = session.draft
      const results = calculateSplits({ items: draft.items, members: draft.members, grandTotal: draft.grandTotal })
      const { participants } = await createSettleBill({
        localId: generateId(),
        crewName: null,
        grandTotal: draft.grandTotal,
        tipAmount: draft.tipAmount,
        tipPercent: draft.tipPercent,
        payerName: draft.payerName,
        payerContact: contact,
        payerContactType: draft.payerContactType,
        participants: results.map((r) => ({ localId: r.id, name: r.name, amount: r.finalTotal })),
        language,
        createdByChatId: chatId,
        currency,
      })

      await bot.sendMessage(chatId, buildSettleText(msgs, participants, currency, draft, results))
      await clearSession(chatId)
    }
}

async function handleCallbackQuery(bot, query) {
    const [namespace, ...rest] = (query.data || '').split(':')
    const chatId = query.message.chat.id

    const session = await getSession(chatId)
    const language = session?.draft?.language || langFromTelegramCode(query.from.language_code)
    const msgs = getMessages(language)

    if (namespace === 'lang') {
      if (!session || session.state !== STATES.AWAITING_LANGUAGE) return bot.answerCallbackQuery(query.id)
      const [code] = rest
      const newMsgs = getMessages(code)

      await saveSession(chatId, STATES.AWAITING_CURRENCY, { language: code })
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageText(newMsgs.newBill.start, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: currencyKeyboard(),
      })
      return
    }

    if (namespace === 'curr') {
      if (!session || session.state !== STATES.AWAITING_CURRENCY) return bot.answerCallbackQuery(query.id)
      const [code] = rest
      if (!isValidCurrency(code)) {
        await bot.answerCallbackQuery(query.id, { text: msgs.newBill.invalidCurrency })
        return
      }

      await saveSession(chatId, STATES.AWAITING_ENTRY_METHOD, { ...session.draft, currency: code })
      await bot.answerCallbackQuery(query.id, { text: msgs.newBill.currencySelected(code) })
      await bot.editMessageText(msgs.newBill.entryMethodPrompt(code), {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: entryMethodKeyboard(msgs),
      })
      return
    }

    if (namespace === 'entry') {
      if (!session || session.state !== STATES.AWAITING_ENTRY_METHOD) return bot.answerCallbackQuery(query.id)
      const [kind] = rest
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})

      if (kind === 'voice') {
        await saveSession(chatId, STATES.AWAITING_VOICE_BILL, session.draft)
        await bot.sendMessage(chatId, msgs.newBill.voice.billPrompt)
        return
      }

      // kind === 'receipt' | 'manual' — both land in AWAITING_TOTAL, which already
      // accepts either a photo or a typed amount, so there's nothing to branch on here.
      await saveSession(chatId, STATES.AWAITING_TOTAL, session.draft)
      await bot.sendMessage(chatId, msgs.newBill.currencySet(session.draft.currency))
      return
    }

    if (namespace === 'voice') {
      const [kind] = rest

      if (kind === 'manual') {
        const bailableStates = [STATES.AWAITING_VOICE_CONFIRM, STATES.AWAITING_VOICE_BILL, STATES.AWAITING_VOICE_FIX]
        if (!session || !bailableStates.includes(session.state)) {
          return bot.answerCallbackQuery(query.id)
        }
        const draft = { ...session.draft }
        delete draft.voicePending
        await saveSession(chatId, STATES.AWAITING_TOTAL, draft)
        await bot.answerCallbackQuery(query.id)
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})
        await bot.sendMessage(chatId, msgs.newBill.currencySet(draft.currency))
        return
      }

      if (!session || session.state !== STATES.AWAITING_VOICE_CONFIRM) return bot.answerCallbackQuery(query.id)

      if (kind === 'fix') {
        await saveSession(chatId, STATES.AWAITING_VOICE_FIX, session.draft)
        await bot.answerCallbackQuery(query.id)
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})
        await bot.sendMessage(chatId, msgs.newBill.voice.fixPrompt)
        return
      }

      // kind === 'confirm' — a still-missing total or zero members would make
      // calculateSplits produce a meaningless (or NaN) result, so route those
      // straight to the fix flow instead of "confirming" a broken report.
      const { voicePending } = session.draft
      if (!(voicePending.grandTotal > 0) || voicePending.members.length === 0) {
        await saveSession(chatId, STATES.AWAITING_VOICE_FIX, session.draft)
        await bot.answerCallbackQuery(query.id, { text: msgs.newBill.voice.issueTotalUnknown })
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})
        await bot.sendMessage(chatId, msgs.newBill.voice.fixPrompt)
        return
      }

      const { voicePending: pending, ...restDraft } = session.draft
      const draft = {
        ...restDraft,
        members: pending.members,
        items: pending.items,
        grandTotal: pending.grandTotal,
        tipMode: pending.tipAmount > 0 ? 'amount' : 'percent',
        tipPercent: pending.tipPercent || null,
        tipAmount: pending.tipAmount || 0,
        discountAmount: pending.discountAmount || 0,
      }
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})
      await askForReport(bot, chatId, draft, msgs)
      return
    }

    if (namespace === 'ocr') {
      if (!session || session.state !== STATES.AWAITING_OCR_CONFIRM) return bot.answerCallbackQuery(query.id)
      const [kind] = rest

      if (kind === 'manual') {
        const draft = { ...session.draft }
        delete draft.ocrPending
        await saveSession(chatId, STATES.AWAITING_TOTAL, draft)
        await bot.answerCallbackQuery(query.id)
        await bot.sendMessage(chatId, msgs.newBill.currencySet(draft.currency))
        return
      }

      // kind === 'confirm'
      const { ocrPending, ...rest2 } = session.draft
      const draft = { ...rest2, ...ocrPending }
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {})
      await askForMembers(bot, chatId, draft, msgs)
      return
    }

    if (namespace === 'tip') {
      if (!session || session.state !== STATES.AWAITING_TIP) return bot.answerCallbackQuery(query.id)
      const [kind, value] = rest
      const { currency } = session.draft

      if (kind === 'custom_percent') {
        await saveSession(chatId, STATES.AWAITING_CUSTOM_TIP_PERCENT, session.draft)
        await bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId, msgs.newBill.tipPercentPrompt)
      }

      if (kind === 'fixed_amount') {
        await saveSession(chatId, STATES.AWAITING_TIP_AMOUNT, session.draft)
        await bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId, msgs.newBill.tipAmountPrompt)
      }

      // kind === 'preset'
      const percent = parseFloat(value)
      const draft = {
        ...session.draft,
        tipMode: 'percent',
        tipPercent: percent,
        tipAmount: tipAmountFromPercent(session.draft.grandTotal, percent),
      }
      await saveSession(chatId, STATES.AWAITING_DISCOUNT, draft)
      await bot.answerCallbackQuery(query.id, { text: msgs.newBill.tipPercentSelected(percent) })
      await bot.editMessageText(msgs.newBill.tipSet(`${percent}%`), {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: discountKeyboard(msgs),
      })
      return
    }

    if (namespace === 'discount') {
      if (!session || session.state !== STATES.AWAITING_DISCOUNT) return bot.answerCallbackQuery(query.id)
      const [kind] = rest

      if (kind === 'enter') {
        await bot.answerCallbackQuery(query.id)
        await bot.editMessageText(msgs.newBill.discountPrompt, {
          chat_id: chatId,
          message_id: query.message.message_id,
        })
        return
      }

      // kind === 'none'
      const draft = { ...session.draft, discountAmount: 0 }
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageText(msgs.newBill.discountNone, {
        chat_id: chatId,
        message_id: query.message.message_id,
      })
      await askForMembers(bot, chatId, draft, msgs)
      return
    }

    if (namespace === 'members') {
      if (!session || session.state !== STATES.AWAITING_MEMBERS) return bot.answerCallbackQuery(query.id)
      const members = session.draft.members || []
      if (members.length === 0) {
        await bot.answerCallbackQuery(query.id, { text: msgs.newBill.noMembersYet })
        return
      }

      await bot.answerCallbackQuery(query.id)
      await askForNextItem(bot, chatId, session.draft, msgs, true)
      return
    }

    if (namespace === 'items') {
      if (!session || session.state !== STATES.AWAITING_ITEM_INPUT) return bot.answerCallbackQuery(query.id)
      const items = session.draft.items || []
      if (items.length === 0) {
        await bot.answerCallbackQuery(query.id, { text: msgs.newBill.noItemsYet })
        return
      }

      await bot.answerCallbackQuery(query.id)
      await askForReport(bot, chatId, session.draft, msgs)
      return
    }

    if (namespace === 'item') {
      if (!session || session.state !== STATES.ASSIGNING_ITEM) return bot.answerCallbackQuery(query.id)
      const [kind, memberId] = rest
      const items = session.draft.items || []
      const members = session.draft.members || []
      const currentItem = items.find((i) => i.id === session.draft.currentItemId)
      if (!currentItem) return bot.answerCallbackQuery(query.id)

      if (kind === 'done') {
        await bot.answerCallbackQuery(query.id)
        const draft = { ...session.draft, currentItemId: null }
        await askForNextItem(bot, chatId, draft, msgs, false)
        return
      }

      const shares = { ...currentItem.shares }
      let everyone = currentItem.everyone || false

      if (kind === 'reset') {
        Object.keys(shares).forEach((id) => delete shares[id])
        everyone = false
      } else if (kind === 'everyone') {
        // Mirrors Itemizer.jsx: "everyone" means the whole price splits evenly among
        // all active members, independent of quantity — so shares stays empty and
        // calculateSplits' own unassigned-item fallback (math.js) does the even split.
        Object.keys(shares).forEach((id) => delete shares[id])
        everyone = true
      } else if (kind === 'add') {
        if (getRemainingUnits(currentItem) <= 0) {
          await bot.answerCallbackQuery(query.id, { text: msgs.newBill.allUnitsAssigned })
          return
        }
        shares[memberId] = (shares[memberId] || 0) + 1
        everyone = false
      }

      const updatedItem = { ...currentItem, shares, everyone }
      const updatedItems = items.map((i) => (i.id === updatedItem.id ? updatedItem : i))
      const draft = { ...session.draft, items: updatedItems }
      await saveSession(chatId, STATES.ASSIGNING_ITEM, draft)
      await bot.answerCallbackQuery(query.id)
      await bot.editMessageText(itemAssignText(msgs, updatedItem, session.draft.currency), {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: itemAssignKeyboard(msgs, members, updatedItem),
      })
      return
    }

    if (namespace === 'settle') {
      if (!session || session.state !== STATES.AWAITING_REPORT) return bot.answerCallbackQuery(query.id)
      const [kind, type] = rest

      if (kind === 'start') {
        const payerName = query.from.first_name || query.from.username || null
        await saveSession(chatId, STATES.AWAITING_REPORT, { ...session.draft, payerName })
        await bot.answerCallbackQuery(query.id)
        await bot.sendMessage(chatId, msgs.newBill.settle.typePrompt, { reply_markup: payerTypeKeyboard(msgs) })
        return
      }

      // kind === 'type'
      const draft = { ...session.draft, payerContactType: type }
      await saveSession(chatId, STATES.AWAITING_PAYER_CONTACT, draft)
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, msgs.newBill.settle.contactPrompt(type))
    }
}

module.exports = {
  register,
  STATES,
  parseAmount,
  parseTipPercent,
  tipAmountFromPercent,
  parseMemberName,
  parseItemInput,
  buildReportText,
  buildSettleText,
  buildOcrSummaryText,
}
