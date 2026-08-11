const express = require('express')
const { v4: uuidv4 } = require('uuid')
const pool = require('../db')
const { getBotUsername, sendReminder, buildUssdCode, fmtSom } = require('../bot/telegramBot')
const { isValidCurrency, DEFAULT_CURRENCY } = require('../services/currency')

const router = express.Router()

function deepLink(token) {
  const username = getBotUsername()
  return username ? `https://t.me/${username}?start=${token}` : null
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Telegram strips tel: links from message text (only http/https/tg are allowed), so the bot
// links here instead — a plain https page whose only job is to hand off to tel: with one tap.
router.get('/dial/:participantId', async (req, res) => {
  const { participantId } = req.params
  const result = await pool.query(
    `SELECT p.amount, b.payer_contact, b.payer_contact_type
     FROM bill_participants p JOIN bills b ON b.id = p.bill_id
     WHERE p.id = $1`,
    [participantId]
  )
  const row = result.rows[0]
  if (!row) return res.status(404).send('Havola topilmadi.')

  const ussd = buildUssdCode(row.payer_contact, row.payer_contact_type, row.amount)
  if (!ussd) return res.status(404).send("To'lov ma'lumoti topilmadi.")

  const telHref = `tel:${ussd.replace(/#/g, '%23')}`
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>To'lov</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f3f4f6; margin: 0; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; text-align: center; }
  h1 { font-size: 20px; color: #1f2937; margin: 12px 0 4px; }
  p { color: #6b7280; font-size: 14px; max-width: 320px; }
  a.button { display: block; background: #4f46e5; color: white; font-weight: 600; text-decoration: none; padding: 16px 24px; border-radius: 14px; margin: 20px 0; width: 100%; max-width: 320px; box-sizing: border-box; }
  code { background: #e5e7eb; padding: 4px 8px; border-radius: 8px; font-size: 13px; }
</style></head>
<body>
  <h1>${escapeHtml(fmtSom(row.amount))} o'tkazish</h1>
  <p>Tugmani bosing — telefon qo'ng'iroq ekrani ochiladi, "Chaqiruv"ni bosib tasdiqlang.</p>
  <a class="button" href="${escapeHtml(telHref)}">👉 O'tkazishni boshlash</a>
  <p>Ishlamasa, qo'lda tering: <code>${escapeHtml(ussd)}</code></p>
</body></html>`)
})

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en']

// Shared by POST /bills below and the bot's /newbill flow (newBillHandlers.js) — both
// need to create a bill + participants and get back per-participant deep links.
async function createSettleBill({ localId, crewName, grandTotal, tipAmount, tipPercent, payerName, payerContact, payerContactType, participants, language, createdByChatId, currency }) {
  const billLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'uz'
  const billCurrency = isValidCurrency(currency) ? currency : DEFAULT_CURRENCY

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const billResult = await client.query(
      `INSERT INTO bills (local_id, crew_name, grand_total, tip_amount, tip_percent, payer_name, payer_contact, payer_contact_type, language, created_by_chat_id, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (local_id) DO UPDATE SET
         crew_name = EXCLUDED.crew_name,
         grand_total = EXCLUDED.grand_total,
         tip_amount = EXCLUDED.tip_amount,
         tip_percent = EXCLUDED.tip_percent,
         payer_name = EXCLUDED.payer_name,
         payer_contact = EXCLUDED.payer_contact,
         payer_contact_type = EXCLUDED.payer_contact_type,
         language = EXCLUDED.language,
         created_by_chat_id = EXCLUDED.created_by_chat_id,
         currency = EXCLUDED.currency
       RETURNING id`,
      [
        localId,
        crewName || null,
        grandTotal || null,
        tipAmount || null,
        tipPercent || null,
        payerName || null,
        payerContact || null,
        payerContactType === 'phone' ? 'phone' : 'card',
        billLanguage,
        createdByChatId || null,
        billCurrency,
      ]
    )
    const billId = billResult.rows[0].id

    const result = []
    for (const p of participants) {
      const row = await client.query(
        `INSERT INTO bill_participants (bill_id, member_local_id, name, amount, token)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (bill_id, member_local_id) DO UPDATE SET
           name = EXCLUDED.name,
           amount = EXCLUDED.amount
         RETURNING id, member_local_id, name, amount, token`,
        [billId, p.localId, p.name, p.amount, uuidv4()]
      )
      const participant = row.rows[0]
      result.push({
        localId: participant.member_local_id,
        name: participant.name,
        amount: Number(participant.amount),
        deepLink: deepLink(participant.token),
      })
    }

    await client.query('COMMIT')
    return { billId, participants: result }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

router.post('/bills', async (req, res) => {
  const { localId, crewName, grandTotal, tipAmount, tipPercent, payerName, payerContact, payerContactType, participants, language } = req.body

  if (!localId || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ error: 'invalid_body' })
  }

  try {
    const result = await createSettleBill({
      localId, crewName, grandTotal, tipAmount, tipPercent, payerName, payerContact, payerContactType, participants, language,
    })
    res.json(result)
  } catch (err) {
    console.error('Create settle bill failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/bills/:billId/status', async (req, res) => {
  const { billId } = req.params
  const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [billId])
  const bill = billResult.rows[0]
  if (!bill) return res.status(404).json({ error: 'not_found' })

  const participantsResult = await pool.query(
    'SELECT * FROM bill_participants WHERE bill_id = $1 ORDER BY created_at ASC',
    [billId]
  )

  res.json({
    billId: bill.id,
    payerName: bill.payer_name,
    payerContact: bill.payer_contact,
    participants: participantsResult.rows.map((p) => ({
      id: p.id,
      localId: p.member_local_id,
      name: p.name,
      amount: Number(p.amount),
      paid: p.paid,
      paidAt: p.paid_at,
      hasChatId: !!p.telegram_chat_id,
      deepLink: deepLink(p.token),
    })),
  })
})

router.post('/participants/:participantId/remind', async (req, res) => {
  const { participantId } = req.params
  const result = await pool.query('SELECT * FROM bill_participants WHERE id = $1', [participantId])
  const participant = result.rows[0]
  if (!participant) return res.status(404).json({ error: 'not_found' })
  if (!participant.telegram_chat_id) return res.status(409).json({ error: 'not_started' })
  if (participant.paid) return res.status(409).json({ error: 'already_paid' })

  try {
    await sendReminder(pool, participant)
    res.json({ success: true })
  } catch (err) {
    console.error('Manual remind failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.createSettleBill = createSettleBill

module.exports = router
