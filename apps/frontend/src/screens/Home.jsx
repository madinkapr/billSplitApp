import React, { useRef } from 'react'
import { ScanLine, Mic, PencilLine, ChevronRight, Plus, AlertTriangle, Loader2, BarChart2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, openLogin } from '../hooks/useAuth'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { voiceErrorMessage } from '../utils/voiceErrors'
import { inAppLinkClick } from '../utils/navigate'
import Page from '../ui/Page'
import Card, { List, SectionHead } from '../ui/Card'
import Avatar from '../ui/Avatar'
import VerifyEmailBanner from '../components/VerifyEmailBanner'
import ResendVerificationButton from '../components/ResendVerificationButton'
import BillRow from './BillRow'

const tileBase =
  'flex flex-col items-center justify-center gap-2 min-h-[96px] px-2 py-3 rounded-[14px] border text-[15px] font-semibold text-center sm:min-h-[132px] sm:items-start sm:justify-end sm:text-left sm:p-4 transition-transform active:scale-[0.97]'

function Tile({ icon: Icon, label, hint, primary = false, busy = false, tone, ...rest }) {
  const look =
    tone === 'live'
      ? 'bg-warn-tint border-warn text-warn'
      : primary
        ? 'bg-accent border-accent text-on-accent hover:bg-accent-ink'
        : 'bg-accent-tint border-accent-line text-accent-ink hover:border-accent'
  return (
    <button type="button" className={`${tileBase} ${look}`} {...rest}>
      {busy ? <Loader2 size={28} className="animate-spin" aria-hidden="true" /> : <Icon size={28} strokeWidth={1.8} aria-hidden="true" />}
      <span>{label}</span>
      {hint && <small className="hidden sm:block text-[13px] font-normal opacity-90">{hint}</small>}
    </button>
  )
}

// Guests (and unconfirmed accounts) see today's free scan/voice uses inside the start card.
function UsageLine() {
  const { t } = useTranslation()
  const { usage } = useAuth()
  if (!usage?.scan || !usage?.voice) return null

  const left = (k) => Math.max(usage[k].limit - usage[k].used, 0)
  const scanLeft = left('scan')
  const voiceLeft = left('voice')
  const out = scanLeft === 0 || voiceLeft === 0
  const last = !out && (scanLeft === 1 || voiceLeft === 1)
  const verify = !!usage.verify
  const message = out
    ? t(verify ? 'auth.usageOutVerify' : 'auth.usageOut', { what: scanLeft === 0 && voiceLeft === 0 ? t('auth.usageBoth') : scanLeft === 0 ? t('auth.usageScan') : t('auth.usageVoice') })
    : last
      ? t(verify ? 'auth.usageLastVerify' : 'auth.usageLast', { what: scanLeft === 1 ? t('auth.usageScan') : t('auth.usageVoice') })
      : null

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 text-[14px] text-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="tabular-nums">{t('home.usageLine', { scan: scanLeft, scanLimit: usage.scan.limit, voice: voiceLeft, voiceLimit: usage.voice.limit })}</span>
        {verify ? (
          <ResendVerificationButton className="inline-flex items-center min-h-[44px] font-semibold text-link hover:underline" label={t('auth.verifyUsageButton')} />
        ) : (
          <button type="button" onClick={() => openLogin('register')} className="inline-flex items-center min-h-[44px] font-semibold text-link hover:underline">
            {t('home.usageSignUp')}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="flex items-start gap-1.5 rounded-ctl bg-warn-tint text-warn px-3 py-2">
          <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  )
}

function StartCard({ onScanFile, onVoiceResult, onType }) {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const voice = useVoiceInput('/api/voice/bill', { timeout: 90000 })

  async function onVoice() {
    if (voice.state === 'idle' || voice.state === 'error') {
      voice.startRecording()
      return
    }
    if (voice.state !== 'recording') return
    try {
      const data = await voice.stopRecording()
      if (data) onVoiceResult(data)
    } catch {
      // shown below via voice.errorCode
    }
  }

  const voiceLabel =
    voice.state === 'recording' ? t('home.voiceRecording') : voice.state === 'processing' ? t('billSetup.voiceProcessing') : t('home.voiceTile')

  return (
    <Card aria-labelledby="start-title" className="lg:[grid-area:start]">
      <div>
        <h1 id="start-title" className="text-[clamp(24px,2.4vw+14px,34px)] font-bold tracking-[-0.025em] leading-tight">{t('home.startTitle')}</h1>
        <p className="text-[14px] text-ink-2 mt-1">{t('home.startSubtitle')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile primary icon={ScanLine} label={t('home.scanTile')} hint={t('home.scanTileHint')} onClick={() => fileRef.current?.click()} />
        <Tile
          icon={Mic}
          label={voiceLabel}
          hint={voice.state === 'recording' ? t('billSetup.voiceListeningSubtitle') : t('home.voiceTileHint')}
          tone={voice.state === 'recording' ? 'live' : undefined}
          busy={voice.state === 'processing'}
          disabled={voice.state === 'processing'}
          aria-pressed={voice.state === 'recording'}
          onClick={onVoice}
        />
        <Tile icon={PencilLine} label={t('home.typeTile')} hint={t('home.typeTileHint')} onClick={onType} />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onScanFile(file)
          }}
        />
      </div>
      {voice.state === 'error' && (
        <p role="alert" className="text-[14px] text-warn">{voiceErrorMessage(t, voice.errorCode)}</p>
      )}
      <UsageLine />
    </Card>
  )
}

export default function Home({ crews, recentBills, onScanFile, onVoiceResult, onStartNewBill, onSelectCrew, onManageCrews, onNewCrew, onViewBill, onViewAllBills, onOpenStats }) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()

  return (
    <Page topInset={false}>
      <VerifyEmailBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:[grid-template-areas:'start_crews'_'bills_crews'] lg:items-start lg:gap-8">
        <StartCard onScanFile={onScanFile} onVoiceResult={onVoiceResult} onType={onStartNewBill} />

        <section aria-labelledby="crews-title" className="flex flex-col gap-2.5 min-w-0 lg:[grid-area:crews]">
          <SectionHead
            id="crews-title"
            title={t('home.yourCrews')}
            action={crews.length > 0 && (
              <button type="button" onClick={onManageCrews} className="inline-flex items-center min-h-[44px] text-[15px] font-semibold text-link hover:underline">
                {t('home.manage')}
              </button>
            )}
          />
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:m-0 lg:p-0">
            {crews.map((crew) => (
              <button
                key={crew.id}
                type="button"
                onClick={() => onSelectCrew(crew)}
                className="flex-none snap-start flex items-center gap-2.5 min-h-[64px] pl-3 pr-4 rounded-[14px] border border-line bg-surface text-left text-ink hover:bg-surface-2 lg:w-full"
              >
                <Avatar square size="lg" id={crew.id} name={crew.name} className="text-[20px]">{crew.emoji || undefined}</Avatar>
                <span className="min-w-0">
                  <b className="block text-[15px] font-semibold truncate max-w-[12rem] lg:max-w-none">{crew.name}</b>
                  <small className="block text-[13px] text-ink-2">{t('billHistory.peopleCount', { count: crew.members.length })}</small>
                </span>
                <ChevronRight size={18} className="hidden lg:block ml-auto text-ink-2 flex-none" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={onNewCrew}
              className="flex-none snap-start flex items-center gap-2.5 min-h-[64px] pl-3 pr-4 rounded-[14px] border border-dashed border-line-strong bg-surface text-left text-link hover:bg-surface-2 lg:w-full"
            >
              <Avatar square size="lg" tone="off"><Plus size={20} aria-hidden="true" /></Avatar>
              <span>
                <b className="block text-[15px] font-semibold">{t('home.newCrew')}</b>
                <small className="block text-[13px] text-ink-2">{t('home.newCrewHint')}</small>
              </span>
            </button>
          </div>
        </section>

        {recentBills.length > 0 && (
          <section aria-labelledby="bills-title" className="flex flex-col gap-2.5 min-w-0 lg:[grid-area:bills]">
            <SectionHead
              id="bills-title"
              title={t('home.recentBills')}
              action={
                <button type="button" onClick={onViewAllBills} className="inline-flex items-center min-h-[44px] text-[15px] font-semibold text-link hover:underline">
                  {t('home.seeAll')}
                </button>
              }
            />
            <List>
              {recentBills.slice(0, 5).map((bill) => (
                <BillRow key={bill.id} bill={bill} onOpen={onViewBill} />
              ))}
            </List>
          </section>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 text-[13px] text-ink-2 lg:hidden">
        {isAdmin && (
          <a
            href="/admin/stats"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              onOpenStats()
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] hover:text-ink"
          >
            <BarChart2 size={14} aria-hidden="true" />
            {t('nav.stats')}
          </a>
        )}
        <a href="/privacy" onClick={inAppLinkClick('/privacy')} className="inline-flex items-center min-h-[44px] hover:text-ink">
          {t('legal.privacy')}
        </a>
      </footer>
    </Page>
  )
}
