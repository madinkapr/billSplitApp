const { GoogleGenAI } = require('@google/genai')
const { v4: uuidv4 } = require('uuid')
const { mapGeminiError } = require('./ocrService')

const MEMBERS_PROMPT = `You are transcribing spoken names for a bill-splitting app. The speaker may talk in Uzbek, Russian, or English — detect and parse whichever language is actually spoken, do not force one.
Return ONLY valid JSON, no markdown, no explanation:

{ "understood": <true or false>, "detectedLanguage": "uz" or "ru" or "en" or "unknown", "members": [string, ...] }

Rules:
- members = every person's name mentioned, in the order spoken, properly capitalized, transliterated to Latin script (never Cyrillic).
- Do not translate names. Do not add titles/honorifics.
- If the speaker refers to themselves ("men"/"я"/"I"/"myself"), include "Me" as their entry instead of guessing a name.
- IMPORTANT: if the audio is empty, silent, unclear, or an accidental tap with no names spoken, do NOT invent anything — return { "understood": false, "detectedLanguage": "unknown", "members": [] }.`

const BILL_PROMPT = `You are transcribing one continuous spoken description of a restaurant bill for a bill-splitting app. The speaker may talk in Uzbek, Russian, or English — detect and parse whichever language is actually spoken, do not force one.
Return ONLY valid JSON, no markdown, no explanation, in exactly this shape:

{
  "understood": <true or false>,
  "detectedLanguage": "uz" or "ru" or "en" or "unknown",
  "members": [ { "name": string, "isMe": boolean } ],
  "personalItems": [ { "name": string, "unitPrice": number, "perMember": [ { "member": string, "quantity": number } ] } ],
  "sharedItems": [ { "name": string, "quantity": number, "totalPrice": number } ],
  "grandTotal": number or null,
  "tipAmount": number or null,
  "tipPercent": number or null,
  "discountAmount": number or null
}

Rules:
- members = every person mentioned. If the speaker refers to themselves in first person ("men"/"я"/"I"), set that member's name to "Me" and isMe=true. Everyone else isMe=false.
- personalItems = a dish where DIFFERENT people ate DIFFERENT quantities of the SAME dish (e.g. "men to'rtta shashlik, Eldor uchta shashlik yedi" => one personalItems entry named "Shashlik" with unitPrice, and perMember=[{"member":"Me","quantity":4},{"member":"Eldor","quantity":3}]).
  - Every "member" string inside perMember MUST be copied exactly from the members list above (use "Me" for the speaker) — never paraphrase, translate, or add words to it.
- sharedItems = a dish or drink shared evenly by everyone, or where no per-person quantity was mentioned (e.g. "choy va non hammaga" => sharedItems entries for tea and bread with the TOTAL quantity purchased and TOTAL price for that line). Never try to compute each person's portion yourself — the app splits sharedItems evenly automatically.
- unitPrice/totalPrice: numbers only, in the currency spoken (no symbols). Uzbek number words: "-ta" count suffix (e.g. "to'rtta"=4, "uchta"=3); "ming" multiplies by 1000 (e.g. "5 ming"=5000, "120 ming"=120000); "million" multiplies by 1000000. Russian: "тысяча"/"тыс"=×1000, "миллион"=×1000000. English: "thousand"=×1000, "million"=×1000000.
- grandTotal = the total amount the speaker says was charged, if mentioned.
- tipAmount = a service charge / tip / "xizmat haqi" / "чаевые" amount if mentioned, as a currency amount (not a percent).
- tipPercent = a tip/service percentage if mentioned instead of (or in addition to) an amount.
- discountAmount = any discount mentioned, as a positive number.
- Use null for any of grandTotal/tipAmount/tipPercent/discountAmount that wasn't mentioned. Use empty arrays for personalItems/sharedItems/members that weren't mentioned.
- IMPORTANT: if the audio is empty, silent, unclear, or an accidental tap with nothing usable spoken, do NOT invent any members, items, or totals — return { "understood": false, "detectedLanguage": "unknown", "members": [], "personalItems": [], "sharedItems": [], "grandTotal": null, "tipAmount": null, "tipPercent": null, "discountAmount": null }.`

const ERROR_MAP = {
  INVALID_FILE_TYPE: { status: 400, error: 'Please record audio.' },
  FILE_TOO_LARGE: { status: 413, error: 'Recording too large. Max 15MB.' },
  PARSE_ERROR: { status: 422, error: 'Could not understand the recording. Try again or enter manually.' },
  NOTHING_HEARD: { status: 422, error: "Didn't catch that. Try again." },
  GEMINI_KEY_INVALID: { status: 503, error: 'Voice service unavailable.' },
  GEMINI_KEY_FORBIDDEN: { status: 503, error: 'Voice service unavailable.' },
  GEMINI_BAD_REQUEST: { status: 502, error: 'Voice service error. Try again.' },
  GEMINI_MODEL_UNAVAILABLE: { status: 503, error: 'Voice service unavailable.' },
  GEMINI_RATE_LIMIT: { status: 429, error: 'Too many requests. Try again in a moment.' },
  GEMINI_SERVER_ERROR: { status: 502, error: 'Voice service error. Try again.' },
  TIMEOUT: { status: 504, error: 'Took too long. Try again.' },
  NETWORK_ERROR: { status: 502, error: 'Connection error. Please try again.' },
}

async function transcribe(audioBuffer, mimetype, promptText, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimetype, data: audioBuffer.toString('base64') } },
            { text: promptText },
          ],
        },
      ],
    })
    return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } finally {
    clearTimeout(timeout)
  }
}

function parseJson(rawText) {
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw Object.assign(new Error('JSON parse failed'), { code: 'PARSE_ERROR' })
  }
}

function normalizeMembers(parsed) {
  if (typeof parsed !== 'object' || parsed === null) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })

  const understood = parsed.understood !== false
  const members = Array.isArray(parsed.members)
    ? [...new Set(parsed.members.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim().slice(0, 25)))]
    : []

  if (!understood || members.length === 0) {
    throw Object.assign(new Error('Nothing heard'), { code: 'NOTHING_HEARD' })
  }

  return { members, detectedLanguage: parsed.detectedLanguage || 'unknown' }
}

// Converts Gemini's name-keyed voice output into the same `Item[]` shape
// Itemizer/math.js already consume ({id, name, price, quantity, unitPrice, shares, everyone?}),
// resolving each spoken member name to a generated id along the way.
function normalizeBillVoice(parsed) {
  if (typeof parsed !== 'object' || parsed === null) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })

  const understood = parsed.understood !== false
  const rawMembers = Array.isArray(parsed.members) ? parsed.members : []
  const rawPersonal = Array.isArray(parsed.personalItems) ? parsed.personalItems : []
  const rawShared = Array.isArray(parsed.sharedItems) ? parsed.sharedItems : []

  if (!understood || (rawMembers.length === 0 && rawPersonal.length === 0 && rawShared.length === 0)) {
    throw Object.assign(new Error('Nothing heard'), { code: 'NOTHING_HEARD' })
  }

  const warnings = []
  const members = []
  const nameToId = new Map()

  rawMembers.forEach((m) => {
    const name = (m?.name || '').trim().slice(0, 25)
    if (!name) return
    const key = name.toLowerCase()
    if (nameToId.has(key)) return
    const id = uuidv4()
    nameToId.set(key, id)
    members.push({ id, name, isMe: !!m?.isMe })
  })

  // A name Gemini used in perMember but never listed in `members` — auto-add
  // them rather than silently dropping their food, and flag it for review.
  function resolveMemberId(rawName) {
    const name = (rawName || '').trim().slice(0, 25)
    const key = name.toLowerCase()
    if (nameToId.has(key)) return nameToId.get(key)
    const id = uuidv4()
    nameToId.set(key, id)
    members.push({ id, name: name || 'Unknown', isMe: false })
    if (name) warnings.push(name)
    return id
  }

  const items = []

  rawPersonal.forEach((entry) => {
    const name = (entry?.name || '').trim()
    const unitPrice = parseFloat(entry?.unitPrice) || 0
    const perMember = Array.isArray(entry?.perMember) ? entry.perMember : []
    if (!name || unitPrice <= 0 || perMember.length === 0) return

    const shares = {}
    let quantity = 0
    perMember.forEach((p) => {
      const qty = Math.max(0, parseInt(p?.quantity) || 0)
      if (qty <= 0) return
      const id = resolveMemberId(p?.member)
      shares[id] = (shares[id] || 0) + qty
      quantity += qty
    })
    if (quantity === 0) return

    items.push({ id: uuidv4(), name, unitPrice, quantity, price: unitPrice * quantity, shares })
  })

  rawShared.forEach((entry) => {
    const name = (entry?.name || '').trim()
    const quantity = Math.max(1, parseInt(entry?.quantity) || 1)
    const totalPrice = parseFloat(entry?.totalPrice) || 0
    if (!name || totalPrice <= 0) return

    items.push({ id: uuidv4(), name, unitPrice: totalPrice / quantity, quantity, price: totalPrice, shares: {}, everyone: true })
  })

  const grandTotal = parsed.grandTotal != null ? parseFloat(parsed.grandTotal) : null
  const tipAmount = parsed.tipAmount != null ? parseFloat(parsed.tipAmount) : null
  const tipPercent = parsed.tipPercent != null ? parseFloat(parsed.tipPercent) : null
  const discountAmount = parsed.discountAmount != null ? Math.abs(parseFloat(parsed.discountAmount)) : null
  const detectedLanguage = parsed.detectedLanguage || 'unknown'

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = grandTotal != null ? grandTotal - (tipAmount || 0) + (discountAmount || 0) : null
  const mismatch = foodBudget != null && Math.abs(itemsTotal - foodBudget) > 0.5

  return { members, items, grandTotal, tipAmount, tipPercent, discountAmount, detectedLanguage, warnings, mismatch }
}

async function runVoiceMembers(audioBuffer, mimetype) {
  let errorCode = null
  let result = null

  try {
    let rawText
    try {
      rawText = await transcribe(audioBuffer, mimetype, MEMBERS_PROMPT, 20000)
    } catch (geminiErr) {
      errorCode = mapGeminiError(geminiErr)
      throw geminiErr
    }
    result = normalizeMembers(parseJson(rawText))
  } catch (err) {
    if (!errorCode) errorCode = err.code || 'GEMINI_SERVER_ERROR'
  }

  return { result, errorCode }
}

async function runVoiceBill(audioBuffer, mimetype) {
  let errorCode = null
  let result = null

  try {
    let rawText
    try {
      rawText = await transcribe(audioBuffer, mimetype, BILL_PROMPT, 45000)
    } catch (geminiErr) {
      errorCode = mapGeminiError(geminiErr)
      throw geminiErr
    }
    result = normalizeBillVoice(parseJson(rawText))
  } catch (err) {
    if (!errorCode) errorCode = err.code || 'GEMINI_SERVER_ERROR'
  }

  return { result, errorCode }
}

module.exports = {
  ERROR_MAP,
  runVoiceMembers,
  runVoiceBill,
}
