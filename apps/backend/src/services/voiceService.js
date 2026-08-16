const { GoogleGenAI, Type } = require('@google/genai')
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

const AMOUNT_PROMPT = `You are transcribing a single spoken currency amount for a bill-splitting app, used to fill in one field the speaker forgot to mention earlier (e.g. "hammasi bo'lib yuz ming" or "besh ming"). The speaker may talk in Uzbek, Russian, or English.
Return ONLY valid JSON, no markdown, no explanation: { "understood": <true or false>, "amount": number }

Rules:
- amount = the spoken number as a plain number, no currency symbols. Uzbek: "-ta" is a count suffix, not part of the amount; "ming" multiplies by 1000 (e.g. "besh ming"=5000, "bir yuz ming"=100000); "million" multiplies by 1000000. Russian: "тысяча"/"тыс"=×1000, "миллион"=×1000000. English: "thousand"=×1000, "million"=×1000000.
- IMPORTANT: if the audio is empty, silent, unclear, or no number was said, do NOT guess — return { "understood": false, "amount": 0 }.`

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
  - IMPORTANT — do not drop anyone: if several names were listed together earlier (e.g. "Men Eldor, Elyor, Elbek bilan bordik"), all of them must appear in the top-level members list, and you must listen through the ENTIRE recording for what EACH of those specific people ate — people are often listed quickly in a row near the start but their food quantities come later, one at a time. Before finalizing perMember for a dish, re-check: does every name from the members list who was said to eat that dish actually have an entry here? A rushed or fast-spoken list of names is exactly where names get missed — slow down and re-listen rather than stopping after the first few matches.
- sharedItems = a dish or drink shared evenly by everyone, or where no per-person quantity was mentioned (e.g. "choy va non hammaga" => sharedItems entries for tea and bread with the TOTAL quantity purchased and TOTAL price for that line). Never try to compute each person's portion yourself — the app splits sharedItems evenly automatically.
- unitPrice/totalPrice: numbers only, in the currency spoken (no symbols). Uzbek number words: "-ta" count suffix (e.g. "to'rtta"=4, "uchta"=3); "ming" multiplies by 1000 (e.g. "5 ming"=5000, "120 ming"=120000); "million" multiplies by 1000000. Russian: "тысяча"/"тыс"=×1000, "миллион"=×1000000. English: "thousand"=×1000, "million"=×1000000.
- IMPORTANT — never guess a price: if a personalItems or sharedItems price was genuinely never stated anywhere in the recording, do NOT reuse or estimate from a price mentioned for a different item — put 0 for that unitPrice/totalPrice instead. It's expected and fine for at most one item to end up with an unknown (0) price; a separate system works out its real price afterward from the grand total once every other amount is known, so 0 there is the honest answer, not a failure.
- grandTotal = the total amount the speaker says was charged, if mentioned.
- tipAmount = a service charge / tip / "xizmat haqi" / "чаевые" amount if mentioned, as a currency amount (not a percent).
- tipPercent = a tip/service percentage if mentioned instead of (or in addition to) an amount.
- discountAmount = any discount mentioned, as a positive number.
- Use null for any of grandTotal/tipAmount/tipPercent/discountAmount that wasn't mentioned. Use empty arrays for personalItems/sharedItems/members that weren't mentioned.
- IMPORTANT: if the audio is empty, silent, unclear, or an accidental tap with nothing usable spoken, do NOT invent any members, items, or totals — return { "understood": false, "detectedLanguage": "unknown", "members": [], "personalItems": [], "sharedItems": [], "grandTotal": null, "tipAmount": null, "tipPercent": null, "discountAmount": null }.`

// Constrains Gemini's output to this exact shape (responseSchema), rather than relying
// on the prompt's prose description alone — BILL_PROMPT's nested arrays-of-objects are
// exactly the kind of structure freeform JSON mode tends to drift on (e.g. flattening
// `members` into plain strings), which silently starved normalizeBillVoice() of data.
const AMOUNT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    understood: { type: Type.BOOLEAN },
    amount: { type: Type.NUMBER },
  },
  required: ['understood', 'amount'],
}

const MEMBERS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    understood: { type: Type.BOOLEAN },
    detectedLanguage: { type: Type.STRING },
    members: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['understood', 'members'],
}

const BILL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    understood: { type: Type.BOOLEAN },
    detectedLanguage: { type: Type.STRING },
    members: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          isMe: { type: Type.BOOLEAN },
        },
        required: ['name', 'isMe'],
      },
    },
    personalItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          perMember: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                member: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
              },
              required: ['member', 'quantity'],
            },
          },
        },
        required: ['name', 'unitPrice', 'perMember'],
      },
    },
    sharedItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          totalPrice: { type: Type.NUMBER },
        },
        required: ['name', 'quantity', 'totalPrice'],
      },
    },
    grandTotal: { type: Type.NUMBER, nullable: true },
    tipAmount: { type: Type.NUMBER, nullable: true },
    tipPercent: { type: Type.NUMBER, nullable: true },
    discountAmount: { type: Type.NUMBER, nullable: true },
  },
  required: ['understood', 'members', 'personalItems', 'sharedItems'],
}

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

async function transcribe(audioBuffer, mimetype, promptText, responseSchema, timeoutMs) {
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
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    })
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
    // Only visibility into what Gemini actually returned — kept short since audio-derived
    // JSON can be verbose; enough to spot shape drift without flooding the log.
    console.log('[voice] raw Gemini response:', rawText.slice(0, 1000))
    return rawText
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

function normalizeAmount(parsed) {
  if (typeof parsed !== 'object' || parsed === null) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })

  const understood = parsed.understood !== false
  const amount = parseFloat(parsed.amount) || 0

  if (!understood || amount <= 0) {
    throw Object.assign(new Error('Nothing heard'), { code: 'NOTHING_HEARD' })
  }

  return { amount }
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
    // Schema constrains this to {name, isMe}, but tolerate a bare string too
    // in case a future prompt/model change drifts from the declared shape.
    const entry = typeof m === 'string' ? { name: m, isMe: false } : m || {}
    const name = (entry.name || '').trim().slice(0, 25)
    if (!name) return
    const key = name.toLowerCase()
    if (nameToId.has(key)) return
    const id = uuidv4()
    nameToId.set(key, id)
    members.push({ id, name, isMe: !!entry.isMe })
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

  // A price of 0 means "genuinely wasn't said" (per BILL_PROMPT) — kept as an item
  // with an unknown price rather than dropped, since dropping it would silently lose
  // that person's whole dish instead of just its price.
  rawPersonal.forEach((entry) => {
    const name = (entry?.name || '').trim()
    const unitPrice = parseFloat(entry?.unitPrice) || 0
    const perMember = Array.isArray(entry?.perMember) ? entry.perMember : []
    if (!name || perMember.length === 0) return

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
    if (!name) return

    items.push({ id: uuidv4(), name, unitPrice: totalPrice / quantity, quantity, price: totalPrice, shares: {}, everyone: true })
  })

  const grandTotal = parsed.grandTotal != null ? parseFloat(parsed.grandTotal) : null
  const tipAmount = parsed.tipAmount != null ? parseFloat(parsed.tipAmount) : null
  const tipPercent = parsed.tipPercent != null ? parseFloat(parsed.tipPercent) : null
  const discountAmount = parsed.discountAmount != null ? Math.abs(parseFloat(parsed.discountAmount)) : null
  const detectedLanguage = parsed.detectedLanguage || 'unknown'

  // Exactly one item with an unstated (0) price, everything else known — solve for it
  // the way a person doing the math by hand would: grand total minus tip minus every
  // other item's price is what's left for this one. Ambiguous (2+ unknowns) cases are
  // left alone; the user fixes those directly in the review modal.
  const uncertainIds = new Set(items.filter((i) => i.unitPrice <= 0).map((i) => i.id))
  if (uncertainIds.size === 1 && grandTotal != null) {
    const unknown = items.find((i) => uncertainIds.has(i.id))
    const knownItemsTotal = items.filter((i) => i.id !== unknown.id).reduce((s, i) => s + i.price, 0)
    const foodBudget = grandTotal - (tipAmount || 0) + (discountAmount || 0)
    const remaining = foodBudget - knownItemsTotal
    if (remaining > 0 && unknown.quantity > 0) {
      unknown.unitPrice = remaining / unknown.quantity
      unknown.price = remaining
    }
  }
  items.forEach((i) => {
    if (uncertainIds.has(i.id)) i.unitPriceUncertain = true
  })

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = grandTotal != null ? grandTotal - (tipAmount || 0) + (discountAmount || 0) : null
  const mismatch = foodBudget != null && Math.abs(itemsTotal - foodBudget) > 0.5

  return { members, items, grandTotal, tipAmount, tipPercent, discountAmount, detectedLanguage, warnings, mismatch }
}

async function runVoiceAmount(audioBuffer, mimetype) {
  let errorCode = null
  let result = null

  try {
    let rawText
    try {
      rawText = await transcribe(audioBuffer, mimetype, AMOUNT_PROMPT, AMOUNT_SCHEMA, 15000)
    } catch (geminiErr) {
      errorCode = mapGeminiError(geminiErr)
      throw geminiErr
    }
    result = normalizeAmount(parseJson(rawText))
  } catch (err) {
    if (!errorCode) errorCode = err.code || 'GEMINI_SERVER_ERROR'
  }

  return { result, errorCode }
}

async function runVoiceMembers(audioBuffer, mimetype) {
  let errorCode = null
  let result = null

  try {
    let rawText
    try {
      rawText = await transcribe(audioBuffer, mimetype, MEMBERS_PROMPT, MEMBERS_SCHEMA, 20000)
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
      rawText = await transcribe(audioBuffer, mimetype, BILL_PROMPT, BILL_SCHEMA, 45000)
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
  runVoiceAmount,
  runVoiceMembers,
  runVoiceBill,
}
