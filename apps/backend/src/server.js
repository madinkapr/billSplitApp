require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') })
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const pool = require('./db')
const ocrRouter = require('./routes/ocr')
const settleRouter = require('./routes/settle')
const analyticsRouter = require('./routes/analytics')
const adminAuthRouter = require('./routes/adminAuth')
const caloriesRouter = require('./routes/calories')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/ocr', ocrRouter)
app.use('/api/settle', settleRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/admin', adminAuthRouter)
app.use('/api/calories', caloriesRouter)

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')
  await pool.query(schema)
}

async function ensureInitialAdmin() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return

  const { rows } = await pool.query('SELECT 1 FROM admins WHERE username = $1', [ADMIN_USERNAME])
  if (rows.length) return

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [ADMIN_USERNAME, passwordHash])
  console.log(`Seeded initial admin account: ${ADMIN_USERNAME}`)
}

initDb()
  .then(ensureInitialAdmin)
  .then(async () => {
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
    if (process.env.TELEGRAM_BOT_TOKEN) {
      await require('./bot').start()
    } else {
      console.warn('TELEGRAM_BOT_TOKEN not set — settle-up bot disabled')
    }
  })
  .catch((err) => {
    console.error('DB init failed:', err.message)
    process.exit(1)
  })

async function shutdown() {
  console.log('Shutting down...')
  try {
    require('./bot').stop()
  } catch (err) {
    console.error('Error stopping bot:', err.message)
  }
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
