const jwt = require('jsonwebtoken')

function requireAdmin(req, res, next) {
  const secret = process.env.JWT_SECRET
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!secret || !token) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    req.admin = jwt.verify(token, secret)
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

module.exports = requireAdmin
