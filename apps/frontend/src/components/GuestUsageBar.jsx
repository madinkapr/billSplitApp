import React from 'react'
import { ScanLine, Mic, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, openLogin } from '../hooks/useAuth'
import ResendVerificationButton from './ResendVerificationButton'

// Under the scan / voice buttons, for guests only: how many free uses are left today
// ("Free today: Camera/Gallery 2/3 · Voice 3/3" — one scan limit covers both the camera
// and the gallery button), turning amber at the last one and red when one runs out — so
// the limit doesn't come as a surprise. Signed-in users see nothing, except while their
// email is unconfirmed (usage.verify): they share the guest limits and are asked to confirm.
export default function GuestUsageBar({ variant = 'mobile' }) {
  const { t } = useTranslation()
  const { usage } = useAuth()
  if (!usage?.scan || !usage?.voice) return null

  const left = (k) => Math.max(usage[k].limit - usage[k].used, 0)
  const scanLeft = left('scan')
  const voiceLeft = left('voice')
  const out = scanLeft === 0 || voiceLeft === 0
  const last = !out && (scanLeft === 1 || voiceLeft === 1)

  const tone = out
    ? 'bg-red-50 border-red-200 text-red-700'
    : last
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : variant === 'desktop'
        ? 'bg-desktop-content border-desktop-cardBorder text-desktop-textMuted'
        : 'bg-gray-50 border-gray-200 text-gray-600'

  const verify = !!usage.verify
  const message = out
    ? t(verify ? 'auth.usageOutVerify' : 'auth.usageOut', { what: scanLeft === 0 && voiceLeft === 0 ? t('auth.usageBoth') : scanLeft === 0 ? t('auth.usageScan') : t('auth.usageVoice') })
    : last
      ? t(verify ? 'auth.usageLastVerify' : 'auth.usageLast', { what: scanLeft === 1 ? t('auth.usageScan') : t('auth.usageVoice') })
      : null

  return (
    <div className={`col-span-full flex flex-col gap-1 rounded-xl border px-3 py-2 text-xs ${tone}`}>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="font-semibold">{t('auth.usageFree')}</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ScanLine size={13} />
          {t('auth.usageScanLabel')} {scanLeft}/{usage.scan.limit}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Mic size={13} />
          {t('auth.usageVoiceLabel')} {voiceLeft}/{usage.voice.limit}
        </span>
        {verify ? (
          <ResendVerificationButton className="ml-auto inline-flex items-center font-semibold underline underline-offset-2" label={t('auth.verifyUsageButton')} />
        ) : (
          <button onClick={() => openLogin('register')} className="ml-auto font-semibold underline underline-offset-2">
            {t('auth.usageUnlimited')}
          </button>
        )}
      </div>
      {message && (
        <p className="flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-[1px] flex-shrink-0" />
          {message}
        </p>
      )}
    </div>
  )
}
