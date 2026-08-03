require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') })
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const pool = require('./db')
const ocrRouter = require('./routes/ocr')
const settleRouter = require('./routes/settle')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/ocr', ocrRouter)
app.use('/api/settle', settleRouter)

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')
  await pool.query(schema)
}

initDb()
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
