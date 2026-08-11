import { useState, useRef } from 'react'

const MAX_DIMENSION = 1600
const TARGET_SIZE = 2 * 1024 * 1024
const SIZE_THRESHOLD = 1.5 * 1024 * 1024
const QUALITY_LADDER = [0.8, 0.6, 0.45]
const COMPRESS_TIMEOUT = 10000
const FETCH_TIMEOUT = 30000

function encode(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function compressImage(file) {
  const work = new Promise((resolve) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    let canvas = null
    let settled = false

    // Always settles with *some* file — never rejects, never left pending.
    const done = (result) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(objectUrl)
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      resolve(result)
    }

    img.onload = async () => {
      try {
        const { width: w0, height: h0 } = img
        if (w0 <= MAX_DIMENSION && h0 <= MAX_DIMENSION && file.size <= SIZE_THRESHOLD) {
          done(file)
          return
        }

        const scale = Math.min(1, MAX_DIMENSION / Math.max(w0, h0))
        const width = Math.round(w0 * scale)
        const height = Math.round(h0 * scale)

        canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          done(file)
          return
        }

        // JPEG has no alpha — without this, transparent PNG areas become black.
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        let best = null
        for (const quality of QUALITY_LADDER) {
          const blob = await encode(canvas, quality)
          if (!blob) break
          best = blob
          if (blob.size <= TARGET_SIZE) break
        }

        // Re-encoding an already-tight JPEG can grow it — keep the smaller one.
        if (!best || best.size >= file.size) {
          done(file)
          return
        }

        const name = (file.name || 'receipt').replace(/\.[^.]+$/, '') + '.jpg'
        done(new File([best], name, { type: 'image/jpeg' }))
      } catch {
        done(file)
      }
    }

    img.onerror = () => done(file)
    img.src = objectUrl
  })

  return Promise.race([
    work,
    new Promise((resolve) => setTimeout(() => resolve(file), COMPRESS_TIMEOUT)),
  ])
}

export function useOcr() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const lastFileRef = useRef(null)
  const pendingRef = useRef(null)

  async function runScan(file) {
    lastFileRef.current = file
    setScanning(true)
    setError(null)

    let controller = null
    let timeout = null

    try {
      const uploadFile = await compressImage(file)

      const fd = new FormData()
      fd.append('receipt', uploadFile)

      // Clock starts after compression so a slow decode can't eat the upload budget.
      controller = new AbortController()
      timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      })

      let json = null
      try {
        json = await res.json()
      } catch {
        throw Object.assign(new Error('Server error. Please try again.'), {
          errorCode: 'BAD_RESPONSE',
        })
      }

      if (!res.ok || !json.success) {
        throw Object.assign(new Error(json.error || 'Scan failed.'), {
          errorCode: json.errorCode || 'BAD_RESPONSE',
        })
      }

      return json.data
    } catch (err) {
      let message
      if (err.name === 'AbortError' || controller?.signal.aborted) {
        message = 'Scan took too long. Try again.'
      } else if (err.errorCode) {
        message = err.message
      } else {
        message = 'Connection error. Please try again.'
      }
      setError(message)
      throw err
    } finally {
      if (timeout) clearTimeout(timeout)
      setScanning(false)
    }
  }

  function scanReceipt(file) {
    // A second tap joins the in-flight scan instead of starting a duplicate upload.
    if (pendingRef.current) return pendingRef.current

    const pending = runScan(file).finally(() => {
      pendingRef.current = null
    })
    pendingRef.current = pending
    return pending
  }

  function retry() {
    if (lastFileRef.current) return scanReceipt(lastFileRef.current)
    return Promise.resolve(undefined)
  }

  return { scanning, error, scanReceipt, retry }
}
