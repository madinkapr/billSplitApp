const jwt = require('jsonwebtoken')

function requireAdmin(req, res, next) {
  const secret = process.env.JWT_SECRET
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!secret || !token) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const payload = jwt.verify(token, secret)
    // User sessions are signed with the same secret (middleware/auth.js) — only a token
    // issued by the admin login (it carries adminId) may pass here.
    if (!payload.adminId || payload.typ === 'user') return res.status(401).json({ error: 'unauthorized' })
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

module.exports = requireAdmin
