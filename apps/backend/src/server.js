require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') })
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const pool = require('./db')
const ocrRouter = require('./routes/ocr')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/ocr', ocrRouter)

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')
  await pool.query(schema)
}

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
  })
  .catch((err) => {
    console.error('DB init failed:', err.message)
    process.exit(1)
  })
