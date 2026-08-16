import React from 'react'
import { motion } from 'framer-motion'
import { Mic, Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { voiceErrorMessage } from '../utils/voiceErrors'

// Hold-to-talk mic button that dictates an entire bill (members, items, per-person
// quantities, tip) in one take. Sits compact (1 grid column) next to the scan
// buttons while idle, then expands to the full row once recording starts —
// which visually relocates it (CSS grid wraps it to its own row). Pointer
// capture on press is what keeps release working through that jump: without
// it, a finger held at the original press position would land on whatever
// ended up there after the reflow, not on this (now relocated) button.
export default function VoiceBillButton({ onResult }) {
  const { t } = useTranslation()
  // The whole-bill dictation is the longest recording and the biggest upload of the
  // three voice endpoints — give it the most headroom for slow connections.
  const { state, errorCode, startRecording, stopRecording, cancelRecording } = useVoiceInput('/api/voice/bill', { timeout: 90000 })

  function handlePress(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (state === 'idle' || state === 'error') startRecording()
  }

  async function handleRelease(e) {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (state !== 'recording') return
    try {
      const data = await stopRecording()
      if (data) onResult(data)
    } catch {
      // error surfaced via hook state
    }
  }

  const isIdle = state === 'idle'

  const style =
    state === 'recording'
      ? 'bg-red-500 text-white shadow-md shadow-red-200'
      : state === 'processing'
        ? 'bg-indigo-50 border-2 border-indigo-200'
        : state === 'error'
          ? 'bg-red-50 border-2 border-red-200'
          : 'bg-indigo-500 text-white shadow-md shadow-indigo-200'

  const title =
    state === 'recording' ? t('billSetup.voiceListening')
      : state === 'processing' ? t('billSetup.voiceProcessing')
        : state === 'error' ? t('billSetup.voiceFailed')
          : t('billSetup.voiceDictate')

  const subtitle =
    state === 'recording' ? t('billSetup.voiceListeningSubtitle')
      : state === 'processing' ? t('billSetup.voiceProcessingSubtitle')
        : state === 'error' ? voiceErrorMessage(t, errorCode)
          : t('billSetup.voiceDictateSubtitle')

  const icon =
    state === 'processing' ? (
      <Loader2 size={20} className="text-indigo-500 animate-spin flex-shrink-0" />
    ) : state === 'error' ? (
      <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
    ) : (
      <Mic size={20} className="flex-shrink-0" />
    )

  return (
    <motion.button
      whileTap={{ scale: isIdle ? 0.98 : 1 }}
      animate={state === 'recording' ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={state === 'recording' ? { duration: 1, repeat: Infinity } : undefined}
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerCancel={cancelRecording}
      disabled={state === 'processing'}
      className={`select-none touch-none rounded-2xl transition-colors ${style} ${
        isIdle
          ? 'flex flex-col items-center justify-center gap-1.5 px-3 py-4 text-center'
          : 'col-span-3 w-full flex items-center gap-3 px-5 py-4'
      }`}
    >
      {icon}
      {isIdle ? (
        <p className="text-xs font-semibold leading-tight">{t('billSetup.voiceDictateShort')}</p>
      ) : (
        <div className="text-left min-w-0">
          <p className={`text-sm font-semibold ${state === 'processing' ? 'text-indigo-700' : state === 'error' ? 'text-red-700' : ''}`}>
            {title}
          </p>
          <p className={`text-xs truncate ${state === 'recording' ? 'text-red-100' : state === 'processing' ? 'text-indigo-400' : state === 'error' ? 'text-red-400' : 'text-indigo-200'}`}>
            {subtitle}
          </p>
        </div>
      )}
    </motion.button>
  )
}
