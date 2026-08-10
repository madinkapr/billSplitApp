import { useState, useRef } from 'react'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file)
        return
      }

      const scale = MAX_DIMENSION / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export function useOcr() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const lastFileRef = useRef(null)

  async function scanReceipt(file) {
    lastFileRef.current = file
    setScanning(true)
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const uploadFile = await compressImage(file)
      const fd = new FormData()
      fd.append('receipt', uploadFile)

      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      })

      const json = await res.json()
      if (!json.success) {
        throw Object.assign(new Error(json.error), { errorCode: json.errorCode })
      }

      return json.data
    } catch (err) {
      let message
      if (err.name === 'AbortError' || controller.signal.aborted) {
        message = 'Scan took too long. Try again.'
      } else if (err.errorCode) {
        message = err.message
      } else {
        message = 'Connection error. Please try again.'
      }
      setError(message)
      throw err
    } finally {
      clearTimeout(timeout)
      setScanning(false)
    }
  }

  async function retry() {
    if (lastFileRef.current) return scanReceipt(lastFileRef.current)
  }

  return { scanning, error, scanReceipt, retry }
}
