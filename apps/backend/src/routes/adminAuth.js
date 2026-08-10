const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const pool = require('../db')

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
})

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid_request' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET not set — admin login disabled')
    return res.status(500).json({ error: 'server_error' })
  }

  try {
    const { rows } = await pool.query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username])
    const admin = rows[0]
    const passwordHash = admin ? admin.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva'
    const valid = await bcrypt.compare(password, passwordHash)

    if (!admin || !valid) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }

    const token = jwt.sign({ adminId: admin.id, username: admin.username }, secret, { expiresIn: '7d' })
    res.json({ token })
  } catch (err) {
    console.error('Admin login failed:', err.message)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
