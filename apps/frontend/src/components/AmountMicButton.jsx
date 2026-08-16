import React from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { useVoiceInput } from '../hooks/useVoiceInput'

// Tiny hold-to-talk mic for filling in exactly one number the dictation
// missed (e.g. a forgotten grand total or item price) without redoing the
// whole VoiceBillReviewModal dictation.
export default function AmountMicButton({ onResult }) {
  const { state, startRecording, stopRecording, cancelRecording } = useVoiceInput('/api/voice/amount', { timeout: 15000 })

  function handlePress(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (state === 'idle' || state === 'error') startRecording()
  }

  async function handleRelease(e) {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (state !== 'recording') return
    try {
      const data = await stopRecording()
      if (data?.amount > 0) onResult(data.amount)
    } catch {
      // error state shown via the button itself (brief red flash), no inline text — stays compact
    }
  }

  return (
    <button
      type="button"
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerCancel={cancelRecording}
      disabled={state === 'processing'}
      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 select-none touch-none transition-colors ${
        state === 'recording'
          ? 'bg-red-500 text-white'
          : state === 'error'
            ? 'bg-red-50 text-red-400'
            : 'bg-indigo-50 text-indigo-500'
      }`}
    >
      {state === 'processing' ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
    </button>
  )
}
