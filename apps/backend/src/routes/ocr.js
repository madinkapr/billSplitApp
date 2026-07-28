const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { GoogleGenAI } = require('@google/genai')
const pool = require('../db')

const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(Object.assign(new Error('INVALID_FILE_TYPE'), { code: 'INVALID_FILE_TYPE' }))
    }
    cb(null, true)
  },
})

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
- Translate item names to English
- quantity = how many of this item (default 1 if not shown)
- unitPrice = price per single item; price = quantity x unitPrice
- Example: "Burger x2 - $25.98" => name="Burger", quantity=2, unitPrice=12.99, price=25.98
- All prices must be numbers, not strings
- Use null for any field not found on the receipt
- IMPORTANT: Each line item on the receipt = exactly one entry in items array. A price number on the receipt belongs to the item on the SAME line, never combine numbers from different lines into one price.
- IMPORTANT: If an item name spans multiple lines but has only ONE price, it is ONE item. Example: "Pasta di mare\nsiciliana:Spaghetti  1.00 198900.00" => ONE item, name="Pasta di mare Siciliana: Spaghetti", quantity=1, unitPrice=198900. NEVER create two items from one price.
- IMPORTANT: Do NOT translate item names — keep them exactly as written on the receipt. Only translate if the name is a generic word (e.g. "чай" → "tea"). Proper nouns, brand names, dish names (e.g. "Succo di mela", "Caprese", "Te nero") must be kept as-is.
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
  GEMINI_RATE_LIMIT: { status: 429, error: 'Too many requests. Try again in a moment.' },
  GEMINI_SERVER_ERROR: { status: 502, error: 'OCR service error. Try again.' },
  TIMEOUT: { status: 504, error: 'Scan took too long. Try again.' },
  NETWORK_ERROR: { status: 502, error: 'Connection error. Please try again.' },
}

function mapGeminiError(err) {
  const msg = err.message || ''
  if (msg.includes('API_KEY') || msg.includes('401')) return 'GEMINI_KEY_INVALID'
  if (msg.includes('429') || msg.includes('quota')) return 'GEMINI_RATE_LIMIT'
  if (msg.includes('500') || msg.includes('503')) return 'GEMINI_SERVER_ERROR'
  if (err.name === 'AbortError' || msg.includes('timeout')) return 'TIMEOUT'
  if (msg.includes('fetch') || msg.includes('ECONNREFUSED')) return 'NETWORK_ERROR'
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

router.post('/scan', (req, res) => {
  upload.single('receipt')(req, res, async (uploadErr) => {
    // Handle multer errors
    if (uploadErr) {
      const code = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : (uploadErr.code || 'INVALID_FILE_TYPE')
      const mapped = ERROR_MAP[code] || { status: 400, error: uploadErr.message }
      return res.status(mapped.status).json({ success: false, errorCode: code, error: mapped.error })
    }

    if (!req.file) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_FILE_TYPE', error: 'No image file provided.' })
    }

    let receiptId = null
    let ocrResult = null
    let errorCode = null

    try {
      // Call Gemini with 25s timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      const imageData = fs.readFileSync(req.file.path)
      const base64 = imageData.toString('base64')

      let rawText
      try {
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: [
            {
              parts: [
                { inlineData: { mimeType: req.file.mimetype, data: base64 } },
                { text: OCR_PROMPT },
              ],
            },
          ],
        })
        clearTimeout(timeout)
        rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch (geminiErr) {
        clearTimeout(timeout)
        console.error('[Gemini error]', geminiErr?.message, geminiErr?.status, JSON.stringify(geminiErr))
        errorCode = mapGeminiError(geminiErr)
        throw geminiErr
      }

      // Strip markdown fences if present
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

    // Always save receipt to DB (even on OCR failure — for ML training)
    try {
      const dbResult = await pool.query(
        'INSERT INTO receipts (filename, filepath, mimetype, language, ocr_result) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [
          req.file.filename,
          req.file.path,
          req.file.mimetype,
          ocrResult?.detectedLanguage || null,
          ocrResult ? JSON.stringify(ocrResult) : null,
        ]
      )
      receiptId = dbResult.rows[0].id
    } catch (dbErr) {
      console.error('DB insert failed:', dbErr.message)
    }

    if (errorCode) {
      const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
      return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
    }

    return res.json({ success: true, receiptId, data: ocrResult })
  })
})

module.exports = router
