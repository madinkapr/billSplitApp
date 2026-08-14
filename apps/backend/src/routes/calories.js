const express = require('express')
const { ERROR_MAP, estimateCalories } = require('../services/calorieService')

const router = express.Router()

// Real receipts top out around 20-30 lines — 100 gives generous headroom while still
// bounding prompt/token size and blocking pathological payloads.
const MAX_ITEMS = 100

router.post('/estimate', async (req, res) => {
  const items = req.body?.items

  if (!Array.isArray(items) || items.length === 0) {
    const m = ERROR_MAP.EMPTY_ITEMS
    return res.status(m.status).json({ success: false, errorCode: 'EMPTY_ITEMS', error: m.error })
  }
  if (items.length > MAX_ITEMS) {
    const m = ERROR_MAP.TOO_MANY_ITEMS
    return res.status(m.status).json({ success: false, errorCode: 'TOO_MANY_ITEMS', error: m.error })
  }

  const cleanItems = items
    .filter((i) => i && i.id != null && typeof i.name === 'string' && i.name.trim())
    .map((i) => ({ id: String(i.id), name: i.name.trim().slice(0, 200), quantity: parseInt(i.quantity) || 1 }))

  if (cleanItems.length === 0) {
    const m = ERROR_MAP.EMPTY_ITEMS
    return res.status(m.status).json({ success: false, errorCode: 'EMPTY_ITEMS', error: m.error })
  }

  const { calorieResult, errorCode } = await estimateCalories(cleanItems)

  if (errorCode) {
    const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
    return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
  }

  return res.json({ success: true, data: calorieResult })
})

module.exports = router
