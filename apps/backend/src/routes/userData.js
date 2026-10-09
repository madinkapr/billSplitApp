const express = require('express')
const pool = require('../db')

// A signed-in user's groups and bill history (tables user_crews / user_bills). The
// frontend keeps the same objects it used to keep in localStorage; the server stores them
// as-is under the client's own ids. Guests never reach these routes.
const router = express.Router()

const MAX_BILLS = 100
const MAX_CREWS = 100
const MAX_ITEM_BYTES = 100 * 1024

router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'not_signed_in' })
  next()
})

function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 64
}

// The object must carry its own id (that's how the frontend finds it again) and stay small.
function validItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.id)) return false
  return JSON.stringify(item).length <= MAX_ITEM_BYTES
}

// bill.createdAt is a ms timestamp; older history entries can lack one.
function billTime(bill) {
  return Number.isFinite(bill.createdAt) ? bill.createdAt : null
}

async function loadData(userId) {
  const [crews, bills] = await Promise.all([
    pool.query('SELECT data FROM user_crews WHERE user_id = $1 ORDER BY created_at', [userId]),
    pool.query(
      'SELECT data FROM user_bills WHERE user_id = $1 ORDER BY created_at DESC NULLS LAST, updated_at DESC LIMIT $2',
      [userId, MAX_BILLS]
    ),
  ])
  return { crews: crews.rows.map((r) => r.data), bills: bills.rows.map((r) => r.data) }
}

// Keeps only the newest MAX_BILLS, like the old localStorage list did.
function trimBills(db, userId) {
  return db.query(
    `DELETE FROM user_bills WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM user_bills WHERE user_id = $1
       ORDER BY created_at DESC NULLS LAST, updated_at DESC LIMIT $2)`,
    [userId, MAX_BILLS]
  )
}

router.get('/data', async (req, res) => {
  try {
    res.json(await loadData(req.user.id))
  } catch (err) {
    console.error('Load user data failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

// Right after sign-in: whatever the browser collected as a guest joins the account.
// Anything the account already has (same id) wins, so re-sending is harmless.
router.post('/import', async (req, res) => {
  const crews = Array.isArray(req.body?.crews) ? req.body.crews.filter(validItem).slice(0, MAX_CREWS) : []
  const bills = Array.isArray(req.body?.bills) ? req.body.bills.filter(validItem).slice(0, MAX_BILLS) : []
  const userId = req.user.id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM user_crews WHERE user_id = $1', [userId])
    let room = MAX_CREWS - rows[0].n
    for (const crew of crews) {
      if (room <= 0) break
      const r = await client.query(
        'INSERT INTO user_crews (user_id, id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, crew.id, crew]
      )
      room -= r.rowCount
    }
    for (const bill of bills) {
      await client.query(
        `INSERT INTO user_bills (user_id, id, data, created_at)
         VALUES ($1, $2, $3, to_timestamp($4::double precision / 1000)) ON CONFLICT DO NOTHING`,
        [userId, bill.id, bill, billTime(bill)]
      )
    }
    await trimBills(client, userId)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Import user data failed:', err.message)
    return res.status(500).json({ error: 'server_error' })
  } finally {
    client.release()
  }

  try {
    res.json(await loadData(userId))
  } catch (err) {
    console.error('Load user data failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/crews/:id', async (req, res) => {
  const crew = req.body?.data
  if (!validId(req.params.id) || !validItem(crew) || crew.id !== req.params.id) {
    return res.status(400).json({ error: 'invalid_request' })
  }
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM user_crews WHERE user_id = $1 AND id <> $2', [
      req.user.id,
      crew.id,
    ])
    if (rows[0].n >= MAX_CREWS) return res.status(400).json({ error: 'too_many_crews' })
    await pool.query(
      `INSERT INTO user_crews (user_id, id, data) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [req.user.id, crew.id, crew]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Save crew failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/crews/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid_request' })
  try {
    await pool.query('DELETE FROM user_crews WHERE user_id = $1 AND id = $2', [req.user.id, req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Delete crew failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/bills/:id', async (req, res) => {
  const bill = req.body?.data
  if (!validId(req.params.id) || !validItem(bill) || bill.id !== req.params.id) {
    return res.status(400).json({ error: 'invalid_request' })
  }
  try {
    await pool.query(
      `INSERT INTO user_bills (user_id, id, data, created_at)
       VALUES ($1, $2, $3, to_timestamp($4::double precision / 1000))
       ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at, updated_at = NOW()`,
      [req.user.id, bill.id, bill, billTime(bill)]
    )
    await trimBills(pool, req.user.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('Save bill failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
