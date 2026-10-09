const fs = require('fs')
const path = require('path')
const express = require('express')
const archiver = require('archiver')
const pool = require('../db')
const requireAdmin = require('../middleware/requireAdmin')
const clientIp = require('../middleware/clientIp')
const { UPLOADS_DIR } = require('../services/ocrService')
const { VOICE_UPLOADS_DIR } = require('../services/voiceService')

const router = express.Router()

const VISITOR_ID_RE = /^[a-zA-Z0-9-]{8,64}$/

router.post('/track', async (req, res) => {
  const { visitorId } = req.body
  if (typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId)) {
    return res.status(400).json({ error: 'invalid_visitor_id' })
  }

  try {
    await pool.query('INSERT INTO page_views (visitor_id, ip, user_id) VALUES ($1, $2, $3)', [visitorId, clientIp(req), req.user?.id || null])
    res.status(204).end()
  } catch (err) {
    console.error('Track pageview failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

const LOCAL_ID_RE = /^[a-zA-Z0-9-]{1,64}$/

router.post('/manual-entry', async (req, res) => {
  const localId = typeof req.body?.localId === 'string' && LOCAL_ID_RE.test(req.body.localId) ? req.body.localId : null
  try {
    await pool.query(`INSERT INTO manual_entries (source, local_id, ip, user_id) VALUES ('web', $1, $2, $3)`, [localId, clientIp(req), req.user?.id || null])
    res.status(204).end()
  } catch (err) {
    console.error('Track manual entry failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Fills in the finished bill for the most recent web manual entry with this local bill id.
// Limited to entries from the last day so a stale or guessed id can't rewrite old rows.
router.put('/manual-entry/:localId', async (req, res) => {
  const { localId } = req.params
  const billData = req.body?.billData
  if (!LOCAL_ID_RE.test(localId) || typeof billData !== 'object' || billData === null || Array.isArray(billData)) {
    return res.status(400).json({ error: 'invalid_request' })
  }

  try {
    await pool.query(
      `UPDATE manual_entries SET bill_data = $2, updated_at = NOW()
       WHERE id = (
         SELECT id FROM manual_entries
         WHERE local_id = $1 AND source = 'web' AND created_at >= NOW() - interval '1 day'
         ORDER BY created_at DESC LIMIT 1
       )`,
      [localId, JSON.stringify(billData)]
    )
    res.status(204).end()
  } catch (err) {
    console.error('Save manual entry bill failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/voice-entry', async (req, res) => {
  try {
    await pool.query('INSERT INTO voice_entries (ip, user_id) VALUES ($1, $2)', [clientIp(req), req.user?.id || null])
    res.status(204).end()
  } catch (err) {
    console.error('Track voice entry failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// A manual entry counts only once its bill was completed (bill_data filled in), matching
// how a scan counts only with an OCR result. Rows from before the source/bill_data columns
// existed (source IS NULL) never had content stored, so they keep counting as before.
const MANUAL_DONE = '(bill_data IS NOT NULL OR source IS NULL)'

const DAY_QUERY = (table, extraWhere = '') => `
  SELECT to_char(created_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
  FROM ${table}
  WHERE created_at >= NOW() - ($1 || ' days')::interval${extraWhere ? ` AND ${extraWhere}` : ''}
  GROUP BY day
`

router.get('/stats', requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)

  try {
    const [viewsResult, scansResult, manualResult, voiceResult] = await Promise.all([
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
      pool.query(DAY_QUERY('receipts', 'ocr_result IS NOT NULL'), [days]),
      pool.query(DAY_QUERY('manual_entries', MANUAL_DONE), [days]),
      pool.query(DAY_QUERY('voice_entries'), [days]),
    ])

    const byDate = new Map()
    function upsert(day, patch) {
      const row = byDate.get(day) || { date: day, totalViews: 0, uniqueVisitors: 0, scans: 0, manualEntries: 0, voiceEntries: 0 }
      Object.assign(row, patch)
      byDate.set(day, row)
    }

    viewsResult.rows.forEach((r) => upsert(r.day, { totalViews: r.total_views, uniqueVisitors: r.unique_visitors }))
    scansResult.rows.forEach((r) => upsert(r.day, { scans: r.count }))
    manualResult.rows.forEach((r) => upsert(r.day, { manualEntries: r.count }))
    voiceResult.rows.forEach((r) => upsert(r.day, { voiceEntries: r.count }))

    const daysArr = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))

    res.json({ days: daysArr })
  } catch (err) {
    console.error('Fetch analytics stats failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ON_DAY = `(created_at AT TIME ZONE 'Asia/Tashkent')::date = $1::date`

// Same "success" definitions the stats counters use, so a day's ZIP holds exactly what
// the dashboard counted: a scan only counts once OCR produced a result, and a voice
// recording only once Gemini's answer was understood (no error_code, normalized result).
const MEDIA_EXPORTS = [
  {
    key: 'scans',
    folder: 'images',
    dir: UPLOADS_DIR,
    query: `
      SELECT id, filename, filepath, mimetype, language, ocr_result, created_at
      FROM receipts
      WHERE ocr_result IS NOT NULL AND ${ON_DAY}
      ORDER BY created_at`,
    meta: (r) => ({ id: r.id, mimetype: r.mimetype, language: r.language, createdAt: r.created_at, ocrResult: r.ocr_result }),
  },
  {
    key: 'voice',
    folder: 'voice',
    dir: VOICE_UPLOADS_DIR,
    query: `
      SELECT id, filename, filepath, mimetype, kind, language, gemini_response, result, context, created_at
      FROM voice_recordings
      WHERE error_code IS NULL AND result IS NOT NULL AND ${ON_DAY}
      ORDER BY created_at`,
    meta: (r) => ({
      id: r.id,
      kind: r.kind,
      mimetype: r.mimetype,
      language: r.language,
      createdAt: r.created_at,
      geminiResponse: r.gemini_response,
      result: r.result,
      context: r.context,
    }),
  },
]

// The stored filepath is absolute inside whichever container wrote it, so prefer the
// filename resolved against today's uploads dir and only fall back to the stored path.
function resolveFile(dir, row) {
  const candidates = []
  if (row.filename) candidates.push(path.join(dir, path.basename(row.filename)))
  if (row.filepath) candidates.push(row.filepath)
  return candidates.find((p) => fs.existsSync(p)) || null
}

// One ZIP per Tashkent calendar day: successful scan photos under images/, successful
// voice recordings under voice/, manually entered bills under manual/ (one JSON each),
// and metadata.json describing every entry.
router.get('/export', requireAdmin, async (req, res) => {
  const date = req.query.date
  if (typeof date !== 'string' || !DATE_RE.test(date)) return res.status(400).json({ error: 'invalid_date' })

  let mediaResults, manualResult
  try {
    ;[manualResult, ...mediaResults] = await Promise.all([
      pool.query(
        `SELECT id, source, bill_data, created_at, updated_at FROM manual_entries
         WHERE ${MANUAL_DONE} AND ${ON_DAY} ORDER BY created_at`,
        [date]
      ),
      ...MEDIA_EXPORTS.map((e) => pool.query(e.query, [date])),
    ])
  } catch (err) {
    console.error('Export day query failed:', err.message)
    return res.status(500).json({ error: 'server_error' })
  }

  const media = MEDIA_EXPORTS.map((e, i) => ({
    ...e,
    files: mediaResults[i].rows
      .map((row) => ({ row, filePath: resolveFile(e.dir, row) }))
      .filter((f) => f.filePath),
  }))
  const manual = manualResult.rows
  if (manual.length === 0 && media.every((m) => m.files.length === 0)) {
    return res.status(404).json({ error: 'no_files' })
  }

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${date}.zip"`)

  const archive = archiver('zip', { zlib: { level: 1 } })
  archive.on('error', (err) => {
    console.error('Export day archive failed:', err.message)
    res.destroy(err)
  })
  archive.pipe(res)

  const metadata = { date }
  for (const m of media) {
    metadata[m.key] = m.files.map(({ row, filePath }) => {
      const name = `${m.folder}/${path.basename(filePath)}`
      archive.file(filePath, { name })
      return { file: name, ...m.meta(row) }
    })
  }
  // Entries from before bill_data existed have no content to write, so they stay in
  // metadata.json with file: null to keep the list matching the dashboard count.
  metadata.manual = manual.map((r) => {
    const name = r.bill_data ? `manual/${r.id}.json` : null
    if (name) archive.append(JSON.stringify(r.bill_data, null, 2), { name })
    return { file: name, id: r.id, source: r.source, createdAt: r.created_at, updatedAt: r.updated_at }
  })
  archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' })
  archive.finalize()
})

// Every visit and every successful entry (of one Tashkent calendar day, if given), newest first —
// same success rules as the /stats counters, so the table adds up to the dashboard.
const ACTIVITY_LIMIT = 2000

// Without ?date it returns the latest activity across all days.
router.get('/activity', requireAdmin, async (req, res) => {
  const date = req.query.date
  if (date !== undefined && (typeof date !== 'string' || !DATE_RE.test(date))) {
    return res.status(400).json({ error: 'invalid_date' })
  }
  const day = date ? ON_DAY : 'TRUE'

  try {
    const { rows } = await pool.query(
      `SELECT a.created_at, a.type, a.ip, a.tg_user, u.email AS user_email, u.name AS user_name FROM (
         SELECT created_at, 'visit' AS type, ip, NULL AS tg_user, user_id FROM page_views WHERE ${day}
         UNION ALL
         SELECT created_at, 'scan', ip, tg_user, user_id FROM receipts WHERE ocr_result IS NOT NULL AND ${day}
         UNION ALL
         SELECT created_at, 'manual', ip, tg_user, user_id FROM manual_entries WHERE ${MANUAL_DONE} AND ${day}
         UNION ALL
         SELECT created_at, 'voice', ip, tg_user, user_id FROM voice_entries WHERE ${day}
       ) a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT ${ACTIVITY_LIMIT + 1}`,
      date ? [date] : []
    )
    res.json({
      truncated: rows.length > ACTIVITY_LIMIT,
      rows: rows.slice(0, ACTIVITY_LIMIT).map((r) => ({
        createdAt: r.created_at,
        type: r.type,
        ip: r.ip,
        tgUser: r.tg_user,
        userEmail: r.user_email,
        userName: r.user_name,
      })),
    })
  } catch (err) {
    console.error('Fetch activity failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
