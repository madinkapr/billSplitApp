import React from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput'

// Tiny hold-to-talk mic for filling in exactly one number the dictation
// missed (e.g. a forgotten grand total or item price) without redoing the
// whole VoiceBillReviewModal dictation.
export default function AmountMicButton({ onResult }) {
  const { t } = useTranslation()
  const { state, startRecording, stopRecording, cancelRecording } = useVoiceInput('/api/voice/amount', { timeout: 30000 })

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
      aria-label={t('voiceReview.holdToSayAmount')}
      className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 select-none touch-none transition-colors ${
        state === 'recording'
          ? 'bg-warn text-surface'
          : state === 'error'
            ? 'bg-warn-tint text-warn'
            : 'bg-accent-tint text-link'
      }`}
    >
      {state === 'processing' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
    </button>
  )
}
