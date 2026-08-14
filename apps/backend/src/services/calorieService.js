const { GoogleGenAI } = require('@google/genai')
const { mapGeminiError } = require('./ocrService')
const pool = require('../db')

const ERROR_MAP = {
  EMPTY_ITEMS: { status: 400, error: 'No items to estimate.' },
  TOO_MANY_ITEMS: { status: 400, error: 'Too many items to estimate at once.' },
  PARSE_ERROR: { status: 502, error: 'Could not estimate calories right now.' },
  GEMINI_KEY_INVALID: { status: 503, error: 'Calorie estimate unavailable.' },
  GEMINI_KEY_FORBIDDEN: { status: 503, error: 'Calorie estimate unavailable.' },
  GEMINI_BAD_REQUEST: { status: 502, error: 'Calorie estimate error. Try again.' },
  GEMINI_MODEL_UNAVAILABLE: { status: 503, error: 'Calorie estimate unavailable.' },
  GEMINI_RATE_LIMIT: { status: 429, error: 'Too many requests. Try again in a moment.' },
  GEMINI_SERVER_ERROR: { status: 502, error: 'Calorie estimate error. Try again.' },
  TIMEOUT: { status: 504, error: 'Estimate took too long. Try again.' },
  NETWORK_ERROR: { status: 502, error: 'Connection error. Please try again.' },
}

// Cache key is the dish name only, not the name+quantity — "ЧИЗБУРГЕР СТАНДАРТ" means the
// same burger whether one bill ordered 1 or another ordered 3, so caloriesPerUnit is what's
// cached, and each request's own quantity is multiplied in afterwards.
function normalizeNameKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildCaloriePrompt(dishes) {
  return `You are a nutrition estimator. Estimate realistic calories (kcal) PER UNIT (a single serving) for each dish/drink below. Names may be in Russian, English, or Uzbek.

Return ONLY valid JSON, no markdown, no explanation — a JSON array in the EXACT SAME ORDER as the input, one entry per input item, using the EXACT SAME "id" values given:

[{ "id": string, "caloriesPerUnit": number }]

Rules:
- "caloriesPerUnit" = estimated kcal for ONE serving/unit of the named dish — do NOT multiply by any quantity, there is none here, just the single-unit estimate.
- Base estimates on typical restaurant/cafe portion sizes for the dish named — use general nutrition knowledge, it does not need to be lab-precise, just a realistic ballpark.
- IMPORTANT: A line is NOT food/drink — and MUST get caloriesPerUnit: 0 — if its name is a bill/receipt line rather than a dish, in ANY of these languages: discount/скидка/chegirma, service charge/tip/gratuity/обслуживание/чаевые/xizmat haqi, delivery/доставка/yetkazib berish, cover charge, rounding adjustment. This applies even if the name includes a percent sign or number (e.g. "Скидка 10%", "10% off", "Chegirma 10%") — a percentage or price-like number in the name is itself a strong signal it's a discount/fee line, not a dish, so default to 0 rather than guessing it's food.
- If a name is a real but ambiguous or unfamiliar DISH name, make your best reasonable estimate rather than returning 0 — 0 is only for non-food bill lines as described above.
- caloriesPerUnit must be a non-negative number, never null, never a string.
- Output array length MUST equal input array length, same order, same ids — do not skip, merge, or reorder items.

Items:
${JSON.stringify(dishes.map((d) => ({ id: d.id, name: d.name })))}`
}

function validateAndNormalize(parsed, inputDishes) {
  if (!Array.isArray(parsed)) throw Object.assign(new Error(), { code: 'PARSE_ERROR' })

  const byId = new Map()
  parsed.forEach((entry) => {
    if (entry && entry.id != null) {
      const cal = parseFloat(entry.caloriesPerUnit)
      byId.set(String(entry.id), Number.isFinite(cal) && cal >= 0 ? cal : 0)
    }
  })

  // Always return exactly one entry per input dish, in input order, id-matched — callers
  // attribute this back to specific cache keys and must never hit a hole.
  return inputDishes.map((d) => ({ id: String(d.id), caloriesPerUnit: byId.get(String(d.id)) ?? 0 }))
}

async function lookupCache(nameKeys) {
  if (nameKeys.length === 0) return new Map()
  try {
    const { rows } = await pool.query(
      'SELECT name_key, calories_per_unit FROM calorie_cache WHERE name_key = ANY($1)',
      [nameKeys]
    )
    const map = new Map(rows.map((r) => [r.name_key, Number(r.calories_per_unit)]))
    if (map.size > 0) {
      // Best-effort recency touch, not load-bearing — a failure here shouldn't break the estimate.
      pool
        .query('UPDATE calorie_cache SET last_used_at = NOW() WHERE name_key = ANY($1)', [[...map.keys()]])
        .catch((err) => console.error('Calorie cache touch failed:', err.message))
    }
    return map
  } catch (err) {
    console.error('Calorie cache lookup failed:', err.message)
    return new Map()
  }
}

async function saveToCache(entries) {
  if (entries.length === 0) return
  try {
    await Promise.all(
      entries.map(([nameKey, caloriesPerUnit]) =>
        pool.query(
          `INSERT INTO calorie_cache (name_key, calories_per_unit)
           VALUES ($1, $2)
           ON CONFLICT (name_key) DO UPDATE SET calories_per_unit = EXCLUDED.calories_per_unit, last_used_at = NOW()`,
          [nameKey, caloriesPerUnit]
        )
      )
    )
  } catch (err) {
    console.error('Calorie cache save failed:', err.message)
  }
}

async function estimateCaloriesPerUnitViaAI(dishes) {
  let errorCode = null
  let result = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    let rawText
    try {
      const genResult = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: [{ parts: [{ text: buildCaloriePrompt(dishes) }] }],
      })
      clearTimeout(timeout)
      rawText = genResult.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (geminiErr) {
      clearTimeout(timeout)
      console.error('[Gemini calorie error]', {
        name: geminiErr?.name,
        message: geminiErr?.message,
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

    result = validateAndNormalize(parsed, dishes)
  } catch (err) {
    if (!errorCode) errorCode = err.code || 'GEMINI_SERVER_ERROR'
  }

  return { result, errorCode }
}

// items: [{id, name, quantity}]. Cache is keyed by normalized dish name (not quantity),
// so only genuinely new dish names ever reach Gemini — repeat dishes (same restaurant,
// same menu item across different bills) resolve instantly from calorie_cache.
async function estimateCalories(items) {
  const withKeys = items.map((item) => ({ ...item, nameKey: normalizeNameKey(item.name) }))
  const uniqueKeys = [...new Set(withKeys.map((i) => i.nameKey))]

  const cacheHits = await lookupCache(uniqueKeys)

  const missingKeys = uniqueKeys.filter((k) => !cacheHits.has(k))
  let errorCode = null

  if (missingKeys.length > 0) {
    // One representative item name per missing key — Gemini only needs to see each
    // distinct dish once, even if it appears on multiple lines/bills in this request.
    const dishesToAsk = missingKeys.map((nameKey) => ({
      id: nameKey,
      name: withKeys.find((i) => i.nameKey === nameKey).name,
    }))
    const { result, errorCode: aiErrorCode } = await estimateCaloriesPerUnitViaAI(dishesToAsk)

    if (result) {
      result.forEach((r) => cacheHits.set(r.id, r.caloriesPerUnit))
      await saveToCache(result.map((r) => [r.id, r.caloriesPerUnit]))
    } else {
      errorCode = aiErrorCode
    }
  }

  // Only a hard failure if we still don't have every key covered (i.e. the AI call itself
  // failed) — a bill mixing cached and newly-estimated dishes is the common, non-error case.
  if (errorCode && uniqueKeys.some((k) => !cacheHits.has(k))) {
    return { calorieResult: null, errorCode }
  }

  const calorieResult = withKeys.map((item) => ({
    id: item.id,
    calories: Math.round((cacheHits.get(item.nameKey) || 0) * (item.quantity || 1)),
  }))

  return { calorieResult, errorCode: null }
}

module.exports = {
  ERROR_MAP,
  normalizeNameKey,
  buildCaloriePrompt,
  validateAndNormalize,
  estimateCalories,
}
