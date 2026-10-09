import React, { useEffect, useMemo, useState } from 'react'
import { Lock, Loader2, Table as TableIcon, LineChart as LineChartIcon, ArrowLeft, LogOut, Eye, EyeOff, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useIsDesktop } from '../hooks/useIsDesktop'
import Sidebar from '../desktop/components/Sidebar'

const ADMIN_TOKEN_STORAGE = 'tabup_admin_token'
const RANGE_OPTIONS = [7, 30, 90]
const ALL_KEYS = ['uniqueVisitors', 'totalViews', 'scans', 'manualEntries', 'voiceEntries']
const TRAFFIC_COLORS = { uniqueVisitors: '#2a78d6', totalViews: '#eb6834' }
const ENTRY_COLORS = { scans: '#1baf7a', manualEntries: '#eda100', voiceEntries: '#8b5cf6' }

const THEMES = {
  mobile: {
    card: 'card',
    tile: 'card p-4 flex-1 min-w-[140px]',
    heading: 'text-xl font-semibold text-gray-800',
    sectionHeading: 'text-xs font-semibold text-gray-400 uppercase tracking-wider',
    tileLabel: 'text-xs font-medium text-gray-500 mb-1',
    pillWrap: 'flex bg-white rounded-xl border border-gray-200 p-1',
    pillActive: 'bg-indigo-600 text-white',
    pillInactive: 'text-gray-600 hover:bg-gray-50',
    viewToggleWrap: 'flex bg-gray-100 rounded-lg p-0.5',
    viewToggleActive: 'bg-white shadow-sm',
    viewToggleInactive: 'text-gray-400',
    compactActivity: true,
  },
  desktop: {
    card: 'bg-white rounded-2xl border border-desktop-cardBorder',
    tile: 'bg-white rounded-2xl border border-desktop-cardBorder p-4 flex-1 min-w-[160px]',
    heading: 'text-[22px] font-extrabold text-desktop-text',
    sectionHeading: 'text-[12px] font-bold uppercase tracking-wide text-desktop-textMuted3',
    tileLabel: 'text-xs font-medium text-desktop-textMuted3 mb-1',
    pillWrap: 'flex bg-white rounded-xl border border-desktop-cardBorder p-1',
    pillActive: 'bg-desktop-primary text-white',
    pillInactive: 'text-desktop-textMuted hover:bg-desktop-content',
    viewToggleWrap: 'flex bg-desktop-content rounded-lg p-0.5',
    viewToggleActive: 'bg-white shadow-sm',
    viewToggleInactive: 'text-desktop-textMuted3',
  },
}

const TASHKENT_TZ = 'Asia/Tashkent'

// Backend buckets visits by Tashkent calendar day; the client's own timezone
// must never leak into "today" or these date keys, or they drift out of sync.
function tashkentDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TASHKENT_TZ }).format(date)
}

function fmtDateLabel(iso) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

function fillRange(rows, days) {
  const byDate = new Map(rows.map((r) => [r.date.slice(0, 10), r]))
  const out = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const key = tashkentDateKey(d)
    const row = byDate.get(key)
    const entry = { date: key }
    for (const k of ALL_KEYS) entry[k] = row?.[k] ?? 0
    out.push(entry)
  }
  return out
}

async function fetchStats(token, days) {
  const res = await fetch(`/api/analytics/stats?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 })
  if (!res.ok) throw new Error('server_error')
  const json = await res.json()
  return json.days
}

async function downloadExport(token, date) {
  const res = await fetch(`/api/analytics/export?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 })
  if (res.status === 404) throw Object.assign(new Error('no_files'), { code: 404 })
  if (!res.ok) throw new Error('server_error')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${date}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function loginRequest(username, password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw Object.assign(new Error('unauthorized'), { code: res.status })
  const json = await res.json()
  return json.token
}

function LoginForm({ onSubmit, error, loading }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(username, password)
        }}
        className="card w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center gap-2 text-gray-800">
          <Lock size={18} />
          <h1 className="font-semibold text-lg">{t('adminStats.adminKeyTitle')}</h1>
        </div>
        <input
          type="text"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('adminStats.username')}
          className="input-field"
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('adminStats.password')}
            className="input-field pr-10 w-full"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{t('adminStats.invalidCredentials')}</p>}
        <button type="submit" disabled={loading || !username || !password} className="btn-primary w-full">
          {loading ? <Loader2 size={16} className="animate-spin" /> : t('adminStats.login')}
        </button>
      </form>
    </div>
  )
}

function StatTile({ theme, label, value, color }) {
  return (
    <div className={theme.tile}>
      <p className={theme.tileLabel}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>
        {value.toLocaleString('ru-RU')}
      </p>
    </div>
  )
}

function RangeToggle({ theme, days, setDays, t }) {
  return (
    <div className={theme.pillWrap}>
      {RANGE_OPTIONS.map((n) => (
        <button
          key={n}
          onClick={() => setDays(n)}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            days === n ? theme.pillActive : theme.pillInactive
          }`}
        >
          {n} {t('adminStats.days')}
        </button>
      ))}
    </div>
  )
}

function StatTiles({ theme, t, today, periodTotals, days, keys, colors, labels }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {keys.map((k) => (
        <StatTile
          key={`today-${k}`}
          theme={theme}
          label={t('adminStats.todayStat', { label: labels[k] })}
          value={today?.[k] ?? 0}
          color={colors[k]}
        />
      ))}
      {keys.map((k) => (
        <StatTile
          key={`period-${k}`}
          theme={theme}
          label={t('adminStats.periodStat', { days, label: labels[k] })}
          value={periodTotals[k]}
          color={colors[k]}
        />
      ))}
    </div>
  )
}

function LineChart({ data, keys, colors, labels }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const width = 720
  const height = 280
  const padding = { top: 16, right: 16, bottom: 48, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const maxY = Math.max(1, ...data.map((d) => Math.max(...keys.map((k) => d[k]))))
  const x = (i) => padding.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v) => padding.top + plotH - (v / maxY) * plotH

  const linePath = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ')

  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxY / yTicks) * i))

  const minLabelSpacingPx = 16
  const maxLabels = Math.max(1, Math.floor(plotW / minLabelSpacingPx))
  const labelEvery =
    data.length === 30 ? 3 : data.length === 90 ? 7 : Math.max(1, Math.ceil(data.length / maxLabels))
  const lastIdx = data.length - 1
  const labelIndices = new Set()
  for (let i = 0; i < data.length; i += labelEvery) labelIndices.add(i)
  // "today" must always be labeled — but not right on top of the previous tick
  const closestRegular = Math.floor(lastIdx / labelEvery) * labelEvery
  if (closestRegular !== lastIdx && lastIdx - closestRegular < labelEvery / 2) {
    labelIndices.delete(closestRegular)
  }
  labelIndices.add(lastIdx)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {tickVals.map((v) => (
          <g key={v}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e1e0d9"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#898781">
              {v}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          labelIndices.has(i) ? (
            <text
              key={d.date}
              x={x(i)}
              y={height - padding.bottom + 14}
              textAnchor="end"
              fontSize="8.5"
              fill="#898781"
              transform={`rotate(-45 ${x(i)} ${height - padding.bottom + 14})`}
            >
              {fmtDateLabel(d.date)}
            </text>
          ) : null
        )}

        {keys.map((k) => (
          <path key={k} d={linePath(k)} fill="none" stroke={colors[k]} strokeWidth="2" />
        ))}

        {data.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - plotW / data.length / 2}
            y={padding.top}
            width={plotW / data.length}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}

        {hoverIdx !== null && (
          <g>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={padding.top}
              y2={padding.top + plotH}
              stroke="#c3c2b7"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            {keys.map((k) => (
              <circle key={k} cx={x(hoverIdx)} cy={y(data[hoverIdx][k])} r="4" fill={colors[k]} />
            ))}
          </g>
        )}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute top-0 bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs pointer-events-none"
          style={{
            left: `${(x(hoverIdx) / width) * 100}%`,
            transform: hoverIdx > data.length / 2 ? 'translateX(-105%)' : 'translateX(5%)',
          }}
        >
          <p className="font-semibold text-gray-700 mb-1">{fmtDateLabel(data[hoverIdx].date)}</p>
          {keys.map((k) => (
            <p key={k} style={{ color: colors[k] }}>
              {labels[k]}: {data[hoverIdx][k]}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Legend({ keys, colors, labels }) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      {keys.map((k) => (
        <div key={k} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[k] }} />
          {labels[k]}
        </div>
      ))}
    </div>
  )
}

function DataTable({ data, keys, labels, t }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2 pr-4 font-medium">{t('adminStats.dateCol')}</th>
            {keys.map((k) => (
              <th key={k} className="py-2 pr-4 font-medium">
                {labels[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.date} className="border-b border-gray-50">
              <td className="py-2 pr-4 text-gray-700 tabular-nums">{fmtDateLabel(d.date)}</td>
              {keys.map((k) => (
                <td key={k} className="py-2 pr-4 tabular-nums">
                  {d[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({ theme, t, keys, colors, labels, data }) {
  const [view, setView] = useState('chart')
  return (
    <div className={`${theme.card} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <Legend keys={keys} colors={colors} labels={labels} />
        <div className={theme.viewToggleWrap}>
          <button
            onClick={() => setView('chart')}
            className={`p-1.5 rounded-md ${view === 'chart' ? theme.viewToggleActive : theme.viewToggleInactive}`}
          >
            <LineChartIcon size={15} />
          </button>
          <button
            onClick={() => setView('table')}
            className={`p-1.5 rounded-md ${view === 'table' ? theme.viewToggleActive : theme.viewToggleInactive}`}
          >
            <TableIcon size={15} />
          </button>
        </div>
      </div>
      {view === 'chart' ? (
        <LineChart data={data} keys={keys} colors={colors} labels={labels} />
      ) : (
        <DataTable data={data} keys={keys} labels={labels} t={t} />
      )}
    </div>
  )
}

const ACTIVITY_COLORS = {
  visit: TRAFFIC_COLORS.totalViews,
  scan: ENTRY_COLORS.scans,
  manual: ENTRY_COLORS.manualEntries,
  voice: ENTRY_COLORS.voiceEntries,
}
const ACTIVITY_TYPES = ['visit', 'scan', 'manual', 'voice']

async function fetchActivity(token, date) {
  const res = await fetch(date ? `/api/analytics/activity?date=${date}` : '/api/analytics/activity', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 })
  if (!res.ok) throw new Error('server_error')
  return res.json()
}

// "03.10.2026 18:42:07" in Tashkent time
function fmtTashkentDateTime(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TASHKENT_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  )
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
}

const activitySource = (r) => (r.tgUser ? 'Telegram' : r.ip || r.userEmail ? 'Web' : '—')
// Signed-in web users show as "Name · email", guests by IP, bot users by @username.
const activityUser = (r) =>
  r.userEmail ? [r.userName, r.userEmail].filter(Boolean).join(' · ') : r.tgUser || r.ip || '—'

// Phone-width variant of the table: one two-line row per entry instead of four columns,
// so nothing needs horizontal scrolling.
function ActivityList({ t, rows }) {
  return (
    <div className="overflow-y-auto max-h-[480px] divide-y divide-gray-100">
      {rows.map((r, i) => (
        <div key={i} className="py-2.5 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACTIVITY_COLORS[r.type] }} />
              {t(`adminStats.activityTypes.${r.type}`)}
            </span>
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{fmtTashkentDateTime(r.createdAt)}</span>
          </div>
          <div className="text-xs text-gray-500 pl-3.5 break-all">
            {activitySource(r)} · <span className="text-gray-700 tabular-nums">{activityUser(r)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Who did what on the selected day: each visit and successful entry with its time, type
// and who it was — client IP for the web app, @username for the bot. Rows recorded before
// IPs were stored have neither, shown as "—".
function ActivityTable({ t, activity, compact }) {
  if (activity.rows.length === 0) {
    return <p className="text-sm text-gray-500">{t('adminStats.activityEmpty')}</p>
  }

  const counts = Object.fromEntries(ACTIVITY_TYPES.map((k) => [k, 0]))
  activity.rows.forEach((r) => {
    counts[r.type] += 1
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-600">
        {ACTIVITY_TYPES.map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACTIVITY_COLORS[k] }} />
            {t(`adminStats.activityTypes.${k}`)}: <span className="font-semibold tabular-nums">{counts[k]}</span>
          </div>
        ))}
      </div>
      {compact ? (
        <ActivityList t={t} rows={activity.rows} />
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4 font-medium">{t('adminStats.activityTime')}</th>
                <th className="py-2 pr-4 font-medium">{t('adminStats.activityType')}</th>
                <th className="py-2 pr-4 font-medium">{t('adminStats.activitySource')}</th>
                <th className="py-2 pr-4 font-medium">{t('adminStats.activityUser')}</th>
              </tr>
            </thead>
            <tbody>
              {activity.rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-700 tabular-nums whitespace-nowrap">{fmtTashkentDateTime(r.createdAt)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACTIVITY_COLORS[r.type] }} />
                      {t(`adminStats.activityTypes.${r.type}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{activitySource(r)}</td>
                  <td className="py-2 pr-4 text-gray-700 tabular-nums">{activityUser(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activity.truncated && <p className="text-xs text-gray-400">{t('adminStats.activityTruncated')}</p>}
    </div>
  )
}

// Everything for one Tashkent calendar day: the activity table, plus a single ZIP of that
// day's successful scan photos, voice recordings and manual bills (with metadata.json).
function DaySection({ theme, t, onUnauthorized }) {
  const todayKey = tashkentDateKey(new Date())
  // Empty = no day picked: the table shows the latest activity across all days.
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [activity, setActivity] = useState(null)
  const [activityError, setActivityError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setActivity(null)
    setActivityError(false)
    fetchActivity(localStorage.getItem(ADMIN_TOKEN_STORAGE), date)
      .then((data) => {
        if (!cancelled) setActivity(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (err.code === 401) onUnauthorized()
        else setActivityError(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function handleDownload() {
    setLoading(true)
    setMessage(null)
    try {
      await downloadExport(localStorage.getItem(ADMIN_TOKEN_STORAGE), date)
    } catch (err) {
      if (err.code === 401) onUnauthorized()
      else setMessage(err.code === 404 ? t('adminStats.exportEmpty') : t('adminStats.exportError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className={theme.sectionHeading}>{t('adminStats.daySection')}</h2>
      <div className={`${theme.card} p-4 flex flex-col gap-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => {
              setDate(e.target.value)
              setMessage(null)
            }}
            className="input-field !w-auto"
          />
          {date && (
            <button
              type="button"
              onClick={() => {
                setDate('')
                setMessage(null)
              }}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${theme.pillInactive}`}
            >
              {t('adminStats.allDays')}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={!date || loading}
            title={date ? undefined : t('adminStats.exportPickDay')}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${theme.pillActive}`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {t('adminStats.exportDay')}
          </button>
          {!date && <span className="text-xs text-gray-400">{t('adminStats.exportPickDay')}</span>}
        </div>
        {message && <p className="text-sm text-gray-500">{message}</p>}
        {activityError ? (
          <p className="text-sm text-red-600">{t('adminStats.loadError')}</p>
        ) : activity ? (
          <ActivityTable t={t} activity={activity} compact={theme.compactActivity} />
        ) : (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        )}
      </div>
    </div>
  )
}

function MetricSection({ theme, t, title, days, data, today, periodTotals, keys, colors, labels }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className={theme.sectionHeading}>{title}</h2>
      <StatTiles theme={theme} t={t} today={today} periodTotals={periodTotals} days={days} keys={keys} colors={colors} labels={labels} />
      <ChartCard theme={theme} t={t} keys={keys} colors={colors} labels={labels} data={data} />
    </div>
  )
}

function StatsBody({ theme, t, days, setDays, rows, error, data, today, periodTotals, trafficLabels, entryLabels, onLogout }) {
  if (!rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" />
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-600">{t('adminStats.loadError')}</p>
  }
  return (
    <>
      <MetricSection
        theme={theme}
        t={t}
        title={t('adminStats.trafficSection')}
        days={days}
        data={data}
        today={today}
        periodTotals={periodTotals}
        keys={['uniqueVisitors', 'totalViews']}
        colors={TRAFFIC_COLORS}
        labels={trafficLabels}
      />
      <MetricSection
        theme={theme}
        t={t}
        title={t('adminStats.entrySection')}
        days={days}
        data={data}
        today={today}
        periodTotals={periodTotals}
        keys={['scans', 'manualEntries', 'voiceEntries']}
        colors={ENTRY_COLORS}
        labels={entryLabels}
      />
      <DaySection theme={theme} t={t} onUnauthorized={onLogout} />
    </>
  )
}

function MobileLayout(props) {
  const { t, days, setDays, onBack, onLogout } = props
  const theme = THEMES.mobile
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-[500px] min-h-screen bg-white relative pb-8">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button onClick={() => onBack()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold flex-1">{t('adminStats.title')}</h1>
          <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors" title={t('adminStats.logout')}>
            <LogOut size={18} />
          </button>
        </div>

        <div className="px-4 flex flex-col gap-5">
          <RangeToggle theme={theme} days={days} setDays={setDays} t={t} />
          <StatsBody theme={theme} {...props} />
        </div>
      </div>
    </div>
  )
}

function DesktopLayout(props) {
  const { t, days, setDays, onBack, onLogout } = props
  const theme = THEMES.desktop
  const [collapsed, setCollapsed] = useLocalStorage('tabup_sidebar_collapsed', false)

  return (
    <div className="h-screen flex bg-desktop-content font-desktop overflow-hidden">
      <Sidebar
        screen={null}
        onNavigate={(screen) => onBack(screen)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((p) => !p)}
        statsActive
      />

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="flex flex-col gap-[30px]" style={{ padding: '40px 44px' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className={theme.heading}>{t('adminStats.title')}</h1>
            <div className="flex items-center gap-3">
              <RangeToggle theme={theme} days={days} setDays={setDays} t={t} />
              <button
                onClick={onLogout}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-desktop-cardBorder hover:bg-desktop-content transition-colors"
                title={t('adminStats.logout')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <StatsBody theme={theme} {...props} />
        </div>
      </div>
    </div>
  )
}

export default function AdminStatsPage({ onBack }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(ADMIN_TOKEN_STORAGE))
  const [loginError, setLoginError] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const trafficLabels = useMemo(
    () => ({ uniqueVisitors: t('adminStats.uniqueVisitors'), totalViews: t('adminStats.totalViews') }),
    [t]
  )
  const entryLabels = useMemo(
    () => ({
      scans: t('adminStats.scans'),
      manualEntries: t('adminStats.manualEntries'),
      voiceEntries: t('adminStats.voiceEntries'),
    }),
    [t]
  )

  useEffect(() => {
    if (!authed) return
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE)
    setError(null)
    fetchStats(token, days)
      .then(setRows)
      .catch((err) => {
        if (err.code === 401) {
          localStorage.removeItem(ADMIN_TOKEN_STORAGE)
          setAuthed(false)
        } else {
          setError('server_error')
        }
      })
  }, [authed, days])

  async function handleLogin(username, password) {
    setLoginLoading(true)
    setLoginError(false)
    try {
      const token = await loginRequest(username, password)
      const data = await fetchStats(token, days)
      localStorage.setItem(ADMIN_TOKEN_STORAGE, token)
      setRows(data)
      setAuthed(true)
    } catch {
      setLoginError(true)
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE)
    setRows(null)
    setAuthed(false)
  }

  const data = useMemo(() => (rows ? fillRange(rows, days) : []), [rows, days])
  const today = data[data.length - 1]
  const periodTotals = useMemo(
    () =>
      data.reduce((acc, d) => {
        for (const k of ALL_KEYS) acc[k] += d[k]
        return acc
      }, { uniqueVisitors: 0, totalViews: 0, scans: 0, manualEntries: 0, voiceEntries: 0 }),
    [data]
  )

  if (!authed) {
    return <LoginForm onSubmit={handleLogin} error={loginError} loading={loginLoading} />
  }

  const layoutProps = { t, days, setDays, rows, error, data, today, periodTotals, trafficLabels, entryLabels, onBack, onLogout: handleLogout }

  return isDesktop ? <DesktopLayout {...layoutProps} /> : <MobileLayout {...layoutProps} />
}
