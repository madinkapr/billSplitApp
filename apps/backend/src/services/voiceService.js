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
  - IMPORTANT — do not drop anyone: if several names were listed together earlier (e.g. "Men Eldor, Elyor, Elbek bilan bordik"), all of them must appear in the top-level members list, and you must listen through the ENTIRE recording for what EACH of those specific people ate — people are often listed quickly in a row near the start but their food quantities come later, one at a time, sometimes all in one dense sentence (e.g. "Men to'rtta, Eldor uchta, Elyor uchta, Elbek to'rtta shashlik yedi" names FOUR people back to back — all four need a perMember entry, not just the first two). Before finalizing perMember for a dish, run this self-check: count how many names are in the top-level members list, then count how many perMember entries you produced for that dish — if a member was said to eat that dish and your count is short, you stopped listening too early; go back through the whole recording again rather than submitting a partial list.
- sharedItems = a dish or drink shared evenly by everyone, or where no per-person quantity was mentioned (e.g. "choy va non hammaga" => sharedItems entries for tea and bread with the TOTAL quantity purchased and TOTAL price for that line). Never try to compute each person's portion yourself — the app splits sharedItems evenly automatically.
- unitPrice/totalPrice: numbers only, in the currency spoken (no symbols). Uzbek number words: "-ta" count suffix (e.g. "to'rtta"=4, "uchta"=3); "ming" multiplies by 1000 (e.g. "5 ming"=5000, "120 ming"=120000); "million" multiplies by 1000000. Russian: "тысяча"/"тыс"=×1000, "миллион"=×1000000. English: "thousand"=×1000, "million"=×1000000.
- IMPORTANT — never guess a price, and never let one item's price bleed into another's: each number spoken in the recording belongs to exactly ONE item — the one it was said next to. Before writing a unitPrice/totalPrice, find the specific words in the recording that state THIS item's price; if you can't point to those words for this exact item, the number belongs to a different item (or to the grand total/tip) and does NOT apply here — put 0 instead of copying a number you found elsewhere. Concretely: hearing ".. ikkita non 12 ming so'm bo'ldi" states NON's total price, not the price of any other dish mentioned earlier or later in the same recording — a dish whose own price was never stated must get 0 even if some other number was said somewhere in the audio. It's expected and fine for at most one item to end up with an unknown (0) price; a separate system works out its real price afterward from the grand total once every other amount is known, so 0 there is the honest answer, not a failure.
- grandTotal = the total amount the speaker says was charged, if mentioned.
- tipAmount = a service charge / tip / "xizmat haqi" / "чаевые" amount if mentioned, as a currency amount (not a percent).
- tipPercent = a tip/service percentage if mentioned instead of (or in addition to) an amount.
- discountAmount = any discount mentioned, as a positive number.
- Use null for any of grandTotal/tipAmount/tipPercent/discountAmount that wasn't mentioned. Use empty arrays for personalItems/sharedItems/members that weren't mentioned.
- IMPORTANT: if the audio is empty, silent, unclear, or an accidental tap with nothing usable spoken, do NOT invent any members, items, or totals — return { "understood": false, "detectedLanguage": "unknown", "members": [], "personalItems": [], "sharedItems": [], "grandTotal": null, "tipAmount": null, "tipPercent": null, "discountAmount": null }.`

// A correction utterance is short and assumes the listener already knows the bill —
// e.g. just "Elyor to'rtta" ("Elyor, four") with no dish name repeated, because from
// the speaker's point of view it's obvious which dish that refers to. BILL_PROMPT alone
// has no idea a bill already exists, so a bare correction like that gives it no dish
// name to hang the quantity on and it likely returns nothing for that person at all —
// the fix would then silently do nothing. Appending the pending bill's current state
// (who's on it, what dishes exist and who's already assigned to them) lets Gemini
// resolve "just a name and a number" against the one dish it's obviously about.
function buildFixPrompt(pending) {
  const memberNames = (pending.members || []).map((m) => m.name)
  const personalLines = (pending.items || [])
    .filter((i) => !i.everyone)
    .map((i) => {
      const shareParts = Object.entries(i.shares || {}).map(([id, qty]) => {
        const m = (pending.members || []).find((mm) => mm.id === id)
        return `${m?.name || '?'}=${qty}`
      })
      const priceNote = i.unitPrice > 0 ? `${i.unitPrice}/dona` : 'price unknown'
      return `  - "${i.name}" (${priceNote}): ${shareParts.length > 0 ? shareParts.join(', ') : 'no one recorded yet'}`
    })
  const sharedLines = (pending.items || [])
    .filter((i) => i.everyone)
    .map((i) => `  - "${i.name}" (shared by everyone, total ${i.price})`)

  return `${BILL_PROMPT}

CONTEXT — this is a short spoken CORRECTION or ADDITION to a bill that was already dictated once, not a fresh full dictation. The speaker is only fixing or adding the ONE thing they're saying now:
- People already on the bill: ${memberNames.length > 0 ? memberNames.join(', ') : '(none yet)'}
- Personal dishes already on the bill:
${personalLines.length > 0 ? personalLines.join('\n') : '  (none yet)'}
- Shared dishes already on the bill:
${sharedLines.length > 0 ? sharedLines.join('\n') : '  (none yet)'}

Extra rules for this correction:
- If the speaker names a person and just a quantity WITHOUT repeating a dish name (e.g. "Elyor to'rtta" / "Элёр четыре" / "Elyor, four"), do NOT return an empty personalItems just because no dish name was spoken. If there is exactly one personal dish already on the bill, attribute the quantity to THAT dish. If there are several, attribute it to whichever one is missing that exact person or whose count for them looks wrong, based on the context above.
- The prices shown in the context above are only so you understand what's already on the bill — they are NOT something the speaker said in this recording. Only put a non-zero unitPrice/totalPrice in your output if a price was actually spoken in THIS audio; otherwise use 0, exactly per the "never guess a price" rule, even for a dish whose price is already listed above.`
}

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

  let grandTotal = parsed.grandTotal != null ? parseFloat(parsed.grandTotal) : null
  const tipAmount = parsed.tipAmount != null ? parseFloat(parsed.tipAmount) : null
  const tipPercent = parsed.tipPercent != null ? parseFloat(parsed.tipPercent) : null
  const discountAmount = parsed.discountAmount != null ? Math.abs(parseFloat(parsed.discountAmount)) : null
  const detectedLanguage = parsed.detectedLanguage || 'unknown'

  grandTotal = applyPriceInference(items, grandTotal, tipAmount, discountAmount)

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = grandTotal != null ? grandTotal - (tipAmount || 0) + (discountAmount || 0) : null
  const mismatch = foodBudget != null && Math.abs(itemsTotal - foodBudget) > 0.5

  return { members, items, grandTotal, tipAmount, tipPercent, discountAmount, detectedLanguage, warnings, mismatch, itemsTotal, foodBudget }
}

// Given items where a genuinely-unstated price was recorded as 0 (see BILL_PROMPT's
// "never guess a price" rule), back-solve the ONE such item from the grand total once
// everything else is known — grand total minus tip minus every other item's price is
// what's left for it. Ambiguous (2+ unknowns) cases are left alone. Shared by the
// initial dictation (normalizeBillVoice) and a later voice correction (mergeBillVoiceFix)
// so both apply the identical inference instead of two copies drifting apart.
//
// Also runs the reverse: if every item's price IS known but no grand total was ever
// stated, the total is just the sum of the items (plus tip, minus discount) — no need
// to make the speaker repeat a number that's already fully implied. Returns the
// (possibly inferred) grand total since callers need to persist it onto their result.
function applyPriceInference(items, grandTotal, tipAmount, discountAmount) {
  const uncertainIds = new Set(items.filter((i) => !(i.unitPrice > 0)).map((i) => i.id))
  if (uncertainIds.size === 1 && grandTotal != null) {
    const unknown = items.find((i) => uncertainIds.has(i.id))
    const knownItemsTotal = items.filter((i) => i.id !== unknown.id).reduce((s, i) => s + i.price, 0)
    const foodBudget = grandTotal - (tipAmount || 0) + (discountAmount || 0)
    const remaining = foodBudget - knownItemsTotal
    if (remaining > 0 && unknown.quantity > 0) {
      unknown.unitPrice = remaining / unknown.quantity
      unknown.price = remaining
      uncertainIds.delete(unknown.id)
    }
  }
  items.forEach((i) => {
    if (uncertainIds.has(i.id)) i.unitPriceUncertain = true
  })

  if (grandTotal == null && items.length > 0 && uncertainIds.size === 0) {
    const itemsTotal = items.reduce((s, i) => s + i.price, 0)
    return itemsTotal + (tipAmount || 0) - (discountAmount || 0)
  }
  return grandTotal
}

// Merges a short follow-up voice correction (same BILL_SCHEMA shape) into an
// already-normalized bill result — used both when the initial dictation missed a name
// or a price (fills the gap) and when it heard something wrong (e.g. misheard "non
// 12000" as 120000) and the speaker re-says just that one thing to correct it. Because
// this is a dedicated "fix" utterance, anything it explicitly restates — a price, a
// person's quantity for a named dish, the grand total — overwrites the old value rather
// than being ignored; only fields NOT mentioned in the fix are left untouched. Then
// re-runs the same price inference in case the fix unblocked it.
function mergeBillVoiceFix(pending, parsed) {
  if (typeof parsed !== 'object' || parsed === null) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })
  if (parsed.understood === false) throw Object.assign(new Error('Nothing heard'), { code: 'NOTHING_HEARD' })

  const members = pending.members.map((m) => ({ ...m }))
  const nameToId = new Map(members.map((m) => [m.name.toLowerCase(), m.id]))
  const warnings = [...pending.warnings]

  function resolveMemberId(rawName) {
    const name = (rawName || '').trim().slice(0, 25)
    const key = name.toLowerCase()
    if (nameToId.has(key)) return nameToId.get(key)
    const id = uuidv4()
    nameToId.set(key, id)
    members.push({ id, name: name || 'Unknown', isMe: false })
    return id
  }

  const rawNewMembers = Array.isArray(parsed.members) ? parsed.members : []
  rawNewMembers.forEach((m) => {
    const entry = typeof m === 'string' ? { name: m, isMe: false } : m || {}
    const name = (entry.name || '').trim().slice(0, 25)
    if (name) resolveMemberId(name)
  })

  const items = pending.items.map((i) => ({ ...i, shares: { ...i.shares } }))

  const rawFixPersonal = Array.isArray(parsed.personalItems) ? parsed.personalItems : []
  rawFixPersonal.forEach((entry) => {
    const name = (entry?.name || '').trim()
    if (!name) return
    const unitPrice = parseFloat(entry?.unitPrice) || 0
    const perMember = Array.isArray(entry?.perMember) ? entry.perMember : []

    let target = items.find((i) => !i.everyone && i.name.toLowerCase() === name.toLowerCase())
    if (!target) {
      // If this name existed as a shared item before but the fix now gives
      // per-person quantities for it, that's new information upgrading it to a
      // personal item — reuse the same item rather than creating a duplicate.
      const existingShared = items.find((i) => i.everyone && i.name.toLowerCase() === name.toLowerCase())
      if (existingShared && perMember.length > 0) {
        existingShared.everyone = false
        existingShared.shares = {}
        target = existingShared
      } else {
        target = { id: uuidv4(), name, unitPrice: 0, quantity: 0, price: 0, shares: {} }
        items.push(target)
      }
    }
    if (unitPrice > 0) {
      target.unitPrice = unitPrice
      target.unitPriceUncertain = false
    }
    const addsQuantity = perMember.some((p) => Math.max(0, parseInt(p?.quantity) || 0) > 0)
    // The item's current unitPrice was never actually spoken — it was only back-solved
    // (applyPriceInference) from the OLD quantity. Now that this fix is changing the
    // quantity, that number is stale (e.g. it was divided across 10 units and is about
    // to become 14), so it must be re-derived below rather than kept as if it were fact.
    if (addsQuantity && !(unitPrice > 0) && target.unitPriceUncertain) {
      target.unitPrice = 0
    }
    perMember.forEach((p) => {
      const qty = Math.max(0, parseInt(p?.quantity) || 0)
      if (qty <= 0) return
      const id = resolveMemberId(p?.member)
      target.shares[id] = qty
    })
    target.quantity = Object.values(target.shares).reduce((s, q) => s + q, 0)
    target.price = target.unitPrice * target.quantity
  })

  const rawFixShared = Array.isArray(parsed.sharedItems) ? parsed.sharedItems : []
  rawFixShared.forEach((entry) => {
    const name = (entry?.name || '').trim()
    if (!name) return
    const totalPrice = parseFloat(entry?.totalPrice) || 0
    const quantity = Math.max(1, parseInt(entry?.quantity) || 1)

    // A bare "name + price" fix utterance (no per-person split repeated) reads as a
    // shared item to Gemini in isolation — but if this name already exists as a
    // personal item (with its per-member breakdown already known from the original
    // dictation), the fix is filling THAT item's price, not describing a new,
    // separate shared item of the same name.
    const existingPersonal = items.find((i) => !i.everyone && i.name.toLowerCase() === name.toLowerCase())
    if (existingPersonal) {
      if (totalPrice > 0) {
        const impliedUnitPrice = totalPrice / quantity
        existingPersonal.unitPrice = impliedUnitPrice
        existingPersonal.price = impliedUnitPrice * existingPersonal.quantity
        existingPersonal.unitPriceUncertain = false
      }
      return
    }

    let target = items.find((i) => i.everyone && i.name.toLowerCase() === name.toLowerCase())
    if (!target) {
      target = { id: uuidv4(), name, unitPrice: 0, quantity, price: 0, shares: {}, everyone: true }
      items.push(target)
    }
    if (totalPrice > 0) {
      target.quantity = quantity
      target.unitPrice = totalPrice / quantity
      target.price = totalPrice
      target.unitPriceUncertain = false
    }
  })

  let grandTotal = pending.grandTotal
  if (parsed.grandTotal != null) grandTotal = parseFloat(parsed.grandTotal)
  let tipAmount = pending.tipAmount
  if (parsed.tipAmount != null) tipAmount = parseFloat(parsed.tipAmount)
  let tipPercent = pending.tipPercent
  if (parsed.tipPercent != null) tipPercent = parseFloat(parsed.tipPercent)
  let discountAmount = pending.discountAmount
  if (parsed.discountAmount != null) discountAmount = Math.abs(parseFloat(parsed.discountAmount))

  grandTotal = applyPriceInference(items, grandTotal, tipAmount, discountAmount)

  const itemsTotal = items.reduce((s, i) => s + i.price, 0)
  const foodBudget = grandTotal != null ? grandTotal - (tipAmount || 0) + (discountAmount || 0) : null
  const mismatch = foodBudget != null && Math.abs(itemsTotal - foodBudget) > 0.5

  return {
    members,
    items,
    grandTotal,
    tipAmount,
    tipPercent,
    discountAmount,
    detectedLanguage: pending.detectedLanguage,
    warnings,
    mismatch,
    itemsTotal,
    foodBudget,
  }
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

async function runVoiceBillFix(audioBuffer, mimetype, pending) {
  let errorCode = null
  let result = null

  try {
    let rawText
    try {
      rawText = await transcribe(audioBuffer, mimetype, buildFixPrompt(pending), BILL_SCHEMA, 30000)
    } catch (geminiErr) {
      errorCode = mapGeminiError(geminiErr)
      throw geminiErr
    }
    result = mergeBillVoiceFix(pending, parseJson(rawText))
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
  runVoiceBillFix,
}
