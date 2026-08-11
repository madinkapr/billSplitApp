const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { UPLOADS_DIR, ERROR_MAP, runOcr, saveReceiptRecord } = require('../services/ocrService')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(Object.assign(new Error('INVALID_FILE_TYPE'), { code: 'INVALID_FILE_TYPE' }))
    }
    cb(null, true)
  },
})

router.post('/scan', (req, res) => {
  upload.single('receipt')(req, res, async (uploadErr) => {
    // Handle multer errors
    if (uploadErr) {
      const code = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : (uploadErr.code || 'INVALID_FILE_TYPE')
      const mapped = ERROR_MAP[code] || { status: 400, error: uploadErr.message }
      return res.status(mapped.status).json({ success: false, errorCode: code, error: mapped.error })
    }

    if (!req.file) {
      return res.status(400).json({ success: false, errorCode: 'INVALID_FILE_TYPE', error: 'No image file provided.' })
    }

    const imageData = fs.readFileSync(req.file.path)
    const { ocrResult, errorCode } = await runOcr(imageData, req.file.mimetype)

    const receiptId = await saveReceiptRecord({
      filename: req.file.filename,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      ocrResult,
    })

    if (errorCode) {
      const mapped = ERROR_MAP[errorCode] || { status: 500, error: 'An unexpected error occurred.' }
      return res.status(mapped.status).json({ success: false, errorCode, error: mapped.error })
    }

    return res.json({ success: true, receiptId, data: ocrResult })
  })
})

module.exports = router
