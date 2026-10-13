const fs = require('fs')
const path = require('path')
const express = require('express')

// The "Kafelar" (cafes) map. It's built in the separate private `map` repo
// (`node build-map.js` → map.html, a self-contained Leaflet page with the venues baked
// in) from scraped sources whose terms forbid publishing copies — and this repo is
// public. So the file never enters git: it sits in apps/backend/data/ (gitignored),
// mounted into the container by docker-compose.yml, and is served as is.
const router = express.Router()

const MAP_FILE = path.join(__dirname, '../../data/kafelar-map.html')

const NOT_READY = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#6b7280;text-align:center;padding:16px}</style>
</head><body><p>Xarita hali yuklanmagan · Карта ещё не загружена · The map isn't available yet</p></body></html>`

router.get('/map', (req, res) => {
  if (!fs.existsSync(MAP_FILE)) return res.status(404).type('html').send(NOT_READY)
  // Revalidate each time: a rebuilt map should show up without waiting out a cache.
  res.set('Cache-Control', 'no-cache')
  res.sendFile(MAP_FILE)
})

module.exports = router
