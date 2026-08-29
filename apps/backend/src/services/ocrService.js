const path = require('path')
const fs = require('fs')
const { GoogleGenAI } = require('@google/genai')
const pool = require('../db')

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const OCR_PROMPT = `You are a receipt OCR parser. The receipt may be in Russian, English, or Uzbek.
Return ONLY valid JSON, no markdown, no explanation:

{
  "grandTotal": <final total charged or null>,
  "subtotal": <food subtotal before tip/tax or null>,
  "taxAmount": <tax amount or null>,
  "tipAmount": <tip/service charge dollar amount or null>,
  "tipPercent": <tip/service charge percentage number or null>,
  "discountAmount": <discount/reduction dollar amount as positive number or null>,
  "detectedLanguage": "ru" or "en" or "uz" or "unknown",
  "items": [{ "name": string, "price": number, "quantity": number, "unitPrice": number }]
}

Rules:
- grandTotal = the final charged amount (Итого / Jami / Total)
- items = individual food/drink lines only, NOT tax/tip/subtotal lines
- quantity = how many of this item (default 1 if not shown)
- unitPrice = price per single item; price = quantity x unitPrice
- Example: "Burger x2 - $25.98" => name="Burger", quantity=2, unitPrice=12.99, price=25.98
- All prices must be numbers, not strings
- Use null for any field not found on the receipt
- IMPORTANT: Each line item on the receipt = exactly one entry in items array. A price number on the receipt belongs to the item on the SAME line, never combine numbers from different lines into one price.
- IMPORTANT: If an item name spans multiple lines but has only ONE price, it is ONE item. Example: "Pasta di mare\nsiciliana:Spaghetti  1.00 198900.00" => ONE item, name="Pasta di mare Siciliana: Spaghetti", quantity=1, unitPrice=198900. NEVER create two items from one price.
- IMPORTANT: NEVER translate item names, not even generic words (e.g. "чай", "нон", "salat") — copy every item name exactly as printed on the receipt, in whatever language and script it appears in (Cyrillic, Latin, etc). Do not convert it to English or any other language under any circumstance.
- IMPORTANT: quantity must match exactly what is printed on the receipt. If no quantity shown, use 1. Never guess quantity from context.
- discountAmount = any line with a NEGATIVE amount or labeled as discount/reduction/скидка/chegirma (e.g. "10% -98120.00" => discountAmount=98120, "Скидка -50000" => discountAmount=50000). Store as positive number. If no such line, use null.
- tipAmount = a POSITIVE service/gratuity charge line (e.g. "Обслуживание 15% +147180" => tipAmount=147180). These are opposite signs — do not confuse them.
- Example: receipt shows "Обслуживание 15%: 147180" and "10%: -98120" => tipAmount=147180, tipPercent=15, discountAmount=98120
- IMPORTANT: quantity and unitPrice are ALWAYS separate columns. If you see "1.00198900.00" on one line, it means quantity=1, unitPrice=198900 — NEVER merge them into one number like 100198900.
- IMPORTANT: unitPrice is never larger than grandTotal. If a parsed unitPrice seems larger than grandTotal, you have merged quantity and price — re-read and separate them.`

const ERROR_MAP = {
  INVALID_FILE_TYPE: { status: 400, error: 'Please upload an image file.' },
  FILE_TOO_LARGE: { status: 413, error: 'Image too large. Max 15MB.' },
  PARSE_ERROR: { status: 422, error: 'Receipt format not recognized. Enter details manually.' },
  IMAGE_UNREADABLE: { status: 422, error: 'Could not read receipt. Try a clearer photo.' },
  GEMINI_KEY_INVALID: { status: 503, error: 'OCR service unavailable.' },
  GEMINI_KEY_FORBIDDEN: { status: 503, error: 'OCR service unavailable.' },
  GEMINI_BAD_REQUEST: { status: 502, error: 'OCR service error. Try again.' },
  GEMINI_MODEL_UNAVAILABLE: { status: 503, error: 'OCR service unavailable.' },
  GEMINI_RATE_LIMIT: { status: 429, error: 'Too many requests. Try again in a moment.' },
  GEMINI_SERVER_ERROR: { status: 502, error: 'OCR service error. Try again.' },
  TIMEOUT: { status: 504, error: 'Scan took too long. Try again.' },
  NETWORK_ERROR: { status: 502, error: 'Connection error. Please try again.' },
}

// @google/genai throws ApiError with a numeric .status; some transports nest it
// under .response.status or embed the API's JSON envelope in .message.
function geminiStatusCode(err) {
  if (typeof err?.status === 'number') return err.status
  if (typeof err?.response?.status === 'number') return err.response.status
  if (typeof err?.code === 'number') return err.code
  try {
    const parsed = JSON.parse(err?.message || '')
    if (typeof parsed?.error?.code === 'number') return parsed.error.code
  } catch {
    /* message is not the JSON envelope */
  }
  return null
}

function mapGeminiError(err) {
  const msg = (err.message || '').toLowerCase()

  if (err.name === 'AbortError' || msg.includes('timeout') || msg.includes('aborted')) return 'TIMEOUT'

  switch (geminiStatusCode(err)) {
    case 400:
      // "API key not valid" is reported as 400 INVALID_ARGUMENT, not 401
      return msg.includes('api key') ? 'GEMINI_KEY_INVALID' : 'GEMINI_BAD_REQUEST'
    case 401:
      return 'GEMINI_KEY_INVALID'
    case 403:
      // key restrictions (referrer/IP/API), or Generative Language API disabled on the project
      return 'GEMINI_KEY_FORBIDDEN'
    case 404:
      // configured model retired, renamed, or closed to new API keys
      return 'GEMINI_MODEL_UNAVAILABLE'
    case 429:
      return 'GEMINI_RATE_LIMIT'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'GEMINI_SERVER_ERROR'
  }

  if (msg.includes('api key') || msg.includes('api_key')) return 'GEMINI_KEY_INVALID'
  if (msg.includes('permission') || msg.includes('forbidden')) return 'GEMINI_KEY_FORBIDDEN'
  if (msg.includes('quota') || msg.includes('rate limit')) return 'GEMINI_RATE_LIMIT'
  if (msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('enotfound')) return 'NETWORK_ERROR'
  return 'GEMINI_SERVER_ERROR'
}

function validateAndNormalize(parsed) {
  if (typeof parsed !== 'object' || parsed === null) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })

  const grandTotal = parsed.grandTotal != null ? parseFloat(parsed.grandTotal) : null
  const tipAmount = parsed.tipAmount != null ? parseFloat(parsed.tipAmount) : null
  const tipPercent = parsed.tipPercent != null ? parseFloat(parsed.tipPercent) : null
  const discountAmount = parsed.discountAmount != null ? Math.abs(parseFloat(parsed.discountAmount)) : null
  const subtotal = parsed.subtotal != null ? parseFloat(parsed.subtotal) : null
  const detectedLanguage = parsed.detectedLanguage || 'unknown'

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((i) => i && typeof i.name === 'string' && parseFloat(i.price) > 0)
        .map((i) => ({
          name: i.name.trim(),
          price: parseFloat(i.price),
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || parseFloat(i.price),
        }))
    : []

  return { grandTotal, tipAmount, tipPercent, discountAmount, subtotal, detectedLanguage, items }
}

// Runs the Gemini call + JSON parse + validation on an already-loaded image buffer.
// Shared by POST /api/ocr/scan (multer-uploaded file) and the bot's photo handler
// (downloaded from Telegram) — neither cares how the buffer got there.
async function runOcr(imageBuffer, mimetype) {
  let errorCode = null
  let ocrResult = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const base64 = imageBuffer.toString('base64')

    let rawText
    try {
      const result = await ai.models.generateContent({
        // gemini-2.5-* is closed to new API keys ("no longer available to new
        // users", 404) — it only kept working on older grandfathered keys.
        // Pinned, not gemini-flash-latest: OCR_PROMPT is tuned for this
        // model and a floating alias could regress parsing without warning.
        // Using the full flash tier (not flash-lite) — receipts are messy
        // enough (skewed photos, dense currency formatting) to benefit from
        // the stronger model, same reasoning as BILL_MODEL in voiceService.js.
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimetype, data: base64 } },
              { text: OCR_PROMPT },
            ],
          },
        ],
      })
      clearTimeout(timeout)
      rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (geminiErr) {
      clearTimeout(timeout)
      console.error('[Gemini error]', {
        name: geminiErr?.name,
        httpStatus: geminiStatusCode(geminiErr),
        message: geminiErr?.message,
        // key fingerprint only — never log the key itself
        keyTail: (process.env.GEMINI_API_KEY || '').slice(-6) || '(unset)',
      })
      errorCode = mapGeminiError(geminiErr)
      throw geminiErr
    }

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      errorCode = 'PARSE_ERROR'
      throw Object.assign(new Error('JSON parse failed'), { code: 'PARSE_ERROR' })
    }

    ocrResult = validateAndNormalize(parsed)
  } catch (err) {
    if (!errorCode) errorCode = err.code || 'GEMINI_SERVER_ERROR'
  }

  return { ocrResult, errorCode }
}

// Always logged (even on OCR failure — for ML training), matching the original route's behavior.
async function saveReceiptRecord({ filename, filepath, mimetype, ocrResult }) {
  try {
    const dbResult = await pool.query(
      'INSERT INTO receipts (filename, filepath, mimetype, language, ocr_result) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [filename, filepath, mimetype, ocrResult?.detectedLanguage || null, ocrResult ? JSON.stringify(ocrResult) : null]
    )
    return dbResult.rows[0].id
  } catch (dbErr) {
    console.error('DB insert failed:', dbErr.message)
    return null
  }
}

module.exports = {
  UPLOADS_DIR,
  OCR_PROMPT,
  ERROR_MAP,
  mapGeminiError,
  validateAndNormalize,
  runOcr,
  saveReceiptRecord,
}
