import { useState, useRef } from 'react'

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
      const fd = new FormData()
      fd.append('receipt', file)

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
      const message = err.name === 'AbortError'
        ? 'Scan took too long. Try again.'
        : (err.message || 'Connection error. Please try again.')
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
