import { useRef, useState } from 'react'
import { WavRecorder } from '../utils/wavRecorder'

const MIN_RECORDING_MS = 400
const DEFAULT_TIMEOUT = 30000

// state: 'idle' | 'recording' | 'processing' | 'error'
export function useVoiceInput(endpoint, { timeout: timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const recorderRef = useRef(null)
  // Mirrors `state === 'recording'` but read synchronously (not via React state,
  // which can still hold the pre-update value if stop() fires right after start()).
  const recordingRef = useRef(false)

  async function startRecording() {
    setError(null)
    setErrorCode(null)
    if (!recorderRef.current) recorderRef.current = new WavRecorder()
    try {
      await recorderRef.current.start()
      recordingRef.current = true
      setState('recording')
    } catch (err) {
      recordingRef.current = false
      const code = err.name === 'NotAllowedError' ? 'MIC_DENIED' : 'MIC_ERROR'
      setErrorCode(code)
      setError(code === 'MIC_DENIED' ? 'Microphone access denied.' : 'Could not access microphone.')
      setState('error')
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return null
    recordingRef.current = false
    const { blob, durationMs } = recorderRef.current.stop()

    // Accidental tap guard — matches the source project's threshold.
    if (durationMs < MIN_RECORDING_MS) {
      setState('idle')
      return null
    }

    setState('processing')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.wav')

      const res = await fetch(endpoint, { method: 'POST', body: fd, signal: controller.signal })

      let json = null
      try {
        json = await res.json()
      } catch {
        throw Object.assign(new Error('Server error. Please try again.'), { errorCode: 'BAD_RESPONSE' })
      }

      if (!res.ok || !json.success) {
        throw Object.assign(new Error(json.error || 'Voice input failed.'), { errorCode: json.errorCode || 'BAD_RESPONSE' })
      }

      setState('idle')
      return json.data
    } catch (err) {
      const isTimeout = err.name === 'AbortError' || controller.signal.aborted
      const code = isTimeout ? 'TIMEOUT' : err.errorCode || 'NETWORK_ERROR'
      const message = isTimeout ? 'Took too long. Try again.' : err.errorCode ? err.message : 'Connection error. Please try again.'
      setErrorCode(code)
      setError(message)
      setState('error')
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  function cancelRecording() {
    if (!recordingRef.current) return
    recordingRef.current = false
    recorderRef.current?.stop()
    setState('idle')
  }

  function reset() {
    setError(null)
    setErrorCode(null)
    setState('idle')
  }

  return { state, error, errorCode, startRecording, stopRecording, cancelRecording, reset }
}
