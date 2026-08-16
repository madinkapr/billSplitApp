const express = require('express')
const multer = require('multer')
const { ERROR_MAP, runVoiceAmount, runVoiceMembers, runVoiceBill } = require('../services/voiceService')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(Object.assign(new Error('INVALID_FILE_TYPE'), { code: 'INVALID_FILE_TYPE' }))
    }
    cb(null, true)
  },
})

function handleUpload(req, res, next) {
  upload.single('audio')(req, res, (uploadErr) => {
    if (uploadErr) {
      const code = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : (uploadErr.code || 'INVALID_FILE_TYPE')
      const mapped = ERROR_MAP[code] || { status: 400, error: uploadErr.message }
      return res.status(mapped.status).json({ success: false, errorCode: code, error: mapped.error })
    }
    if (!req.file) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_FILE_TYPE', error: 'No audio recording provided.' })
    }
    next()
  })
}

router.post('/amount', handleUpload, async (req, res) => {
  const { result, errorCode } = await runVoiceAmount(req.file.buffer, req.file.mimetype)

  if (errorCode) {
    const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
    return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
  }

  return res.json({ success: true, data: result })
})

router.post('/members', handleUpload, async (req, res) => {
  const { result, errorCode } = await runVoiceMembers(req.file.buffer, req.file.mimetype)

  if (errorCode) {
    const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
    return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
  }

  return res.json({ success: true, data: result })
})

router.post('/bill', handleUpload, async (req, res) => {
  const { result, errorCode } = await runVoiceBill(req.file.buffer, req.file.mimetype)

  if (errorCode) {
    const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
    return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
  }

  return res.json({ success: true, data: result })
})

module.exports = router
