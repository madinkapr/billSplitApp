const express = require('express')
const pool = require('../db')

const router = express.Router()

const VISITOR_ID_RE = /^[a-zA-Z0-9-]{8,64}$/

router.post('/track', async (req, res) => {
  const { visitorId } = req.body
  if (typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId)) {
    return res.status(400).json({ error: 'invalid_visitor_id' })
  }

  try {
    await pool.query('INSERT INTO page_views (visitor_id) VALUES ($1)', [visitorId])
    res.status(204).end()
  } catch (err) {
    console.error('Track pageview failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/manual-entry', async (req, res) => {
  try {
    await pool.query('INSERT INTO manual_entries DEFAULT VALUES')
    res.status(204).end()
  } catch (err) {
    console.error('Track manual entry failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey || req.get('x-admin-key') !== adminKey) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}

const DAY_QUERY = (table) => `
  SELECT to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
  FROM ${table}
  WHERE created_at >= NOW() - ($1 || ' days')::interval
  GROUP BY day
`

router.get('/stats', requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)

  try {
    const [viewsResult, scansResult, manualResult] = await Promise.all([
      pool.query(
        `SELECT
           to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS total_views,
           COUNT(DISTINCT visitor_id)::int AS unique_visitors
         FROM page_views
         WHERE created_at >= NOW() - ($1 || ' days')::interval
         GROUP BY day`,
        [days]
      ),
      pool.query(DAY_QUERY('receipts'), [days]),
      pool.query(DAY_QUERY('manual_entries'), [days]),
    ])

    const byDate = new Map()
    function upsert(day, patch) {
      const row = byDate.get(day) || { date: day, totalViews: 0, uniqueVisitors: 0, scans: 0, manualEntries: 0 }
      Object.assign(row, patch)
      byDate.set(day, row)
    }

    viewsResult.rows.forEach((r) => upsert(r.day, { totalViews: r.total_views, uniqueVisitors: r.unique_visitors }))
    scansResult.rows.forEach((r) => upsert(r.day, { scans: r.count }))
    manualResult.rows.forEach((r) => upsert(r.day, { manualEntries: r.count }))

    const daysArr = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))

    res.json({ days: daysArr })
  } catch (err) {
    console.error('Fetch analytics stats failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
