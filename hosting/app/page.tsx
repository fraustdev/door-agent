'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { AccessLogRow, StatusData, DayStat, VisitorWindow, CalendarConnection } from '../lib/types'

const WeeklyChart = dynamic(() => import('./WeeklyChart'), { ssr: false })

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function msToCountdown(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.ceil((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function maskCaller(id: string): string {
  if (!id || id === 'unknown') return 'unknown'
  if (id.length > 7) return id.slice(0, 3) + ' •••• ' + id.slice(-4)
  return id
}

function groupVisitorsByDay(visitors: VisitorWindow[]): { label: string; date: string; visitors: VisitorWindow[] }[] {
  const map = new Map<string, VisitorWindow[]>()
  for (const v of visitors) {
    const date = v.meetingStart.slice(0, 10)
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(v)
  }
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, visitors]) => {
      const label = date === today ? 'Today'
        : date === tomorrow ? 'Tomorrow'
        : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      return { label, date, visitors }
    })
}

function todayStats(logs: AccessLogRow[]) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const today = logs.filter(l => new Date(l.created_at) >= start)
  return {
    total: today.length,
    granted: today.filter(l => l.granted).length,
    denied: today.filter(l => !l.granted && !l.locked_out).length,
  }
}

export default function Dashboard() {
  const [logs, setLogs] = useState<AccessLogRow[]>([])
  const [status, setStatus] = useState<StatusData | null>(null)
  const [stats, setStats] = useState<DayStat[]>([])
  const [visitors, setVisitors] = useState<VisitorWindow[]>([])
  const [calendars, setCalendars] = useState<CalendarConnection[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connError, setConnError] = useState(false)
  const [calendarFeedback, setCalendarFeedback] = useState<string | null>(null)
  const [calendarRefreshing, setCalendarRefreshing] = useState(false)

  // Word editing
  const [editingWord, setEditingWord] = useState(false)
  const [wordInput, setWordInput] = useState('')
  const [wordSaving, setWordSaving] = useState(false)
  const [wordFeedback, setWordFeedback] = useState<'saved' | 'error' | null>(null)
  const wordInputRef = useRef<HTMLInputElement>(null)

  // Word background image
  const [wordImageUrl, setWordImageUrl] = useState<string | null>(null)
  const [wordImageLoaded, setWordImageLoaded] = useState(false)
  const prevWord = useRef<string | null>(null)

  useEffect(() => {
    const word = status?.currentWord
    if (word && word !== prevWord.current) {
      prevWord.current = word
      setWordImageLoaded(false)
      setWordImageUrl(null)
      fetch(`/api/wordgif?word=${encodeURIComponent(word)}`)
        .then(r => r.json())
        .then(d => { if (d.url) setWordImageUrl(d.url) })
        .catch(() => {})
    }
  }, [status?.currentWord])

  const refresh = useCallback(async () => {
    try {
      const [lr, sr, str, vr, cr] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/status'),
        fetch('/api/stats'),
        fetch('/api/visitors'),
        fetch('/api/calendars'),
      ])
      if (lr.ok)  setLogs(await lr.json())
      if (sr.ok)  setStatus(await sr.json())
      if (str.ok) setStats(await str.json())
      if (vr.ok)  setVisitors(await vr.json())
      if (cr.ok)  setCalendars(await cr.json())
      setLastUpdated(new Date())
      setConnError(false)
    } catch {
      setConnError(true)
    }
  }, [])

  // Handle OAuth callback feedback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('calendar_connected')
    const error = params.get('calendar_error')
    if (connected) {
      setCalendarFeedback(`✓ ${decodeURIComponent(connected)} connected`)
      window.history.replaceState({}, '', '/')
    } else if (error) {
      setCalendarFeedback(`Failed to connect: ${error}`)
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const forceCalendarRefresh = async () => {
    setCalendarRefreshing(true)
    await fetch('/api/calendar', { method: 'POST' }).catch(() => {})
    await refresh()
    setCalendarRefreshing(false)
  }

  const disconnectCalendar = async (email: string) => {
    await fetch('/api/calendars', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    await refresh()
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const startEditWord = () => {
    setWordInput(status?.currentWord ?? '')
    setWordFeedback(null)
    setEditingWord(true)
    setTimeout(() => wordInputRef.current?.focus(), 50)
  }

  const saveWord = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const word = wordInput.trim()
    if (!word) return
    setWordSaving(true)
    setWordFeedback(null)
    try {
      const res = await fetch('/api/word', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      if (res.ok) {
        setWordFeedback('saved')
        setEditingWord(false)
        await refresh()
      } else {
        setWordFeedback('error')
      }
    } catch {
      setWordFeedback('error')
    } finally {
      setWordSaving(false)
    }
  }

  const today = todayStats(logs)

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse at 12% 48%, rgba(59,112,128,0.32) 0%, transparent 48%),
          radial-gradient(ellipse at 88% 16%, rgba(173,226,93,0.18) 0%, transparent 46%),
          radial-gradient(ellipse at 52% 90%, rgba(252,236,82,0.14) 0%, transparent 46%),
          #080810
        `,
      }}
    >
      {/* Header — full width border, constrained content */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 2389 logo mark */}
          <div
            className="select-none flex items-center justify-center px-2.5 py-1.5 rounded-lg"
            style={{
              background: '#0c0c0c',
              border: '1px solid rgba(255,255,255,0.13)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            <span
              style={{
                fontWeight: 900,
                fontSize: '17px',
                color: '#ffffff',
                letterSpacing: '-0.04em',
                lineHeight: 1,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}
            >
              2389
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10" />

          {/* Product name */}
          <div>
            <h1
              className="text-[18px] leading-none text-white/95"
              style={{ fontWeight: 700, letterSpacing: '-0.03em' }}
            >
              Door
            </h1>
            <p className="text-[10px] text-white/30 mt-0.5 tracking-widest uppercase">
              Access Control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {connError ? (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Connection lost
            </div>
          ) : lastUpdated ? (
            <div className="flex items-center gap-1.5 text-[11px] text-white/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Updated {timeAgo(lastUpdated.toISOString())}
            </div>
          ) : (
            <span className="text-[11px] text-white/25">Connecting…</span>
          )}
        </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-8 py-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'Today',
              value: today.total,
              sub: 'total attempts',
              cls: 'stat-total',
              valueColor: '#a8cfd8',
            },
            {
              label: 'Granted',
              value: today.granted,
              sub: 'doors opened',
              cls: 'stat-granted',
              valueColor: '#cfffb3',
            },
            {
              label: 'Denied',
              value: today.denied,
              sub: 'failed attempts',
              cls: 'stat-denied',
              valueColor: '#fca5a5',
            },
            {
              label: 'Locked Out',
              value: status?.lockouts.length ?? 0,
              sub: 'active lockouts',
              cls: 'stat-locked',
              valueColor: '#fcec52',
            },
          ].map(({ label, value, sub, cls, valueColor }) => (
            <div key={label} className={`rounded-2xl px-5 py-5 ${cls}`}>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.12em] mb-3">
                {label}
              </p>
              <p className="text-[52px] font-[200] leading-none" style={{ color: valueColor }}>{value}</p>
              <p className="text-[11px] text-white/30 mt-2.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* 7-day chart */}
        <div className="rounded-2xl glass px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
              7-Day Activity
            </p>
            <div className="flex items-center gap-4 text-[10px] text-white/30">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: '#ADE25D' }} />
                Granted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.85)' }} />
                Denied
              </span>
              {stats.some(d => d.locked > 0) && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: '#FCEC52' }} />
                  Locked
                </span>
              )}
            </div>
          </div>
          <WeeklyChart stats={stats} />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left panel */}
          <div className="space-y-4">
            {/* Word of the day */}
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                minHeight: '190px',
                border: '1px solid rgba(255,255,255,0.13)',
                borderTopColor: 'rgba(255,255,255,0.26)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              {/* Background: photo or glass */}
              {wordImageUrl ? (
                <>
                  <img
                    src={wordImageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ opacity: wordImageLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
                    onLoad={() => setWordImageLoaded(true)}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(160deg, rgba(8,8,16,0.1) 0%, rgba(8,8,16,0.88) 62%)' }}
                  />
                </>
              ) : (
                <div className="absolute inset-0 glass" style={{ borderRadius: 0 }} />
              )}

              {/* Content */}
              <div className="relative z-10 px-6 py-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.12em]">
                    Word of the Day
                  </p>
                  {!editingWord && (
                    <button
                      onClick={startEditWord}
                      className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingWord ? (
                  <form onSubmit={saveWord} className="space-y-3">
                    <input
                      ref={wordInputRef}
                      value={wordInput}
                      onChange={e => setWordInput(e.target.value)}
                      placeholder="New word…"
                      maxLength={32}
                      className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-[20px] font-light text-white/90 placeholder-white/25 outline-none focus:border-white/40 transition-all capitalize"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={wordSaving || !wordInput.trim()}
                        className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40"
                        style={{ background: 'rgba(59,112,128,0.5)', border: '1px solid rgba(59,112,128,0.7)', color: '#a8cfd8' }}
                      >
                        {wordSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingWord(false); setWordFeedback(null) }}
                        className="px-4 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/60 transition-colors"
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        Cancel
                      </button>
                    </div>
                    {wordFeedback === 'error' && (
                      <p className="text-[11px] text-red-400/80">Failed to save — check server logs</p>
                    )}
                  </form>
                ) : (
                  <div>
                    {wordFeedback === 'saved' && (
                      <p className="text-[11px] mb-2" style={{ color: '#cfffb3' }}>✓ Word updated</p>
                    )}
                    {status?.currentWord ? (
                      <>
                        <p
                          className="text-[38px] font-[300] leading-none capitalize text-white"
                          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}
                        >
                          {status.currentWord}
                        </p>
                        <p className="text-[11px] text-white/40 mt-4">
                          Callers must speak this word to enter
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] text-white/25 italic">Not available</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Active lockouts */}
            <div className="rounded-2xl glass px-6 py-6">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em] mb-5">
                Active Lockouts
              </p>
              {!status || status.lockouts.length === 0 ? (
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    style={{ boxShadow: '0 0 8px rgba(16,185,129,0.7)' }}
                  />
                  <span className="text-[13px] text-white/45">All clear</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {status.lockouts.map(l => (
                    <div key={l.callerId} className="glass-row rounded-xl px-4 py-3">
                      <p className="text-[13px] text-white/80 font-mono">{maskCaller(l.callerId)}</p>
                      <p className="text-[11px] text-amber-400/80 mt-1">
                        {msToCountdown(l.msRemaining)} remaining
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visitor schedule — week view */}
            <div className="rounded-2xl glass px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
                  Visitor Schedule
                </p>
                <button
                  onClick={forceCalendarRefresh}
                  disabled={calendarRefreshing}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 disabled:opacity-40"
                >
                  {calendarRefreshing ? 'Refreshing…' : '↻ Refresh'}
                </button>
              </div>
              {visitors.length === 0 ? (
                <p className="text-[13px] text-white/25 italic">No visitors this week</p>
              ) : (
                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-0.5">
                  {groupVisitorsByDay(visitors).map(({ label, date, visitors: dayVisitors }) => (
                    <div key={date}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                         style={{ color: label === 'Today' ? '#ADE25D' : 'rgba(255,255,255,0.35)' }}>
                        {label}
                      </p>
                      <div className="space-y-1.5">
                        {dayVisitors.map((v, i) => (
                          <div key={i} className="glass-row rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {v.active && (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: '#ADE25D', boxShadow: '0 0 6px rgba(173,226,93,0.7)' }} />
                                )}
                                <p className="text-[13px] text-white/85 font-medium capitalize truncate">{v.firstName}</p>
                              </div>
                              <p className="text-[10px] text-white/30 shrink-0 tabular-nums">
                                {new Date(v.meetingStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                {' – '}
                                {new Date(v.meetingEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                            <p className="text-[10px] text-white/30 mt-1 truncate">{v.meetingTitle}</p>
                            <p className="text-[9px] text-white/20 mt-0.5">
                              Door access: {new Date(v.windowStart).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              {' – '}
                              {new Date(v.windowEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Connected calendars */}
            <div className="rounded-2xl glass px-6 py-6">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em] mb-4">
                Calendars
              </p>
              {calendarFeedback && (
                <p className="text-[11px] mb-3" style={{ color: calendarFeedback.startsWith('✓') ? '#cfffb3' : '#fca5a5' }}>
                  {calendarFeedback}
                </p>
              )}
              <div className="space-y-2 mb-3">
                {calendars.map(c => (
                  <div key={c.email} className="glass-row rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] text-white/80 truncate">{c.display_name ?? c.email}</p>
                      <p className="text-[10px] text-white/30 truncate">{c.email}</p>
                    </div>
                    <button
                      onClick={() => disconnectCalendar(c.email)}
                      className="text-[10px] text-white/30 hover:text-red-400/70 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-red-400/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{ background: 'rgba(59,112,128,0.25)', border: '1px solid rgba(59,112,128,0.45)', color: '#a8cfd8' }}
              >
                <span>+</span>
                <span>Connect a calendar</span>
              </a>
            </div>
          </div>

          {/* Access log */}
          <div className="col-span-2 rounded-2xl glass px-6 py-6 flex flex-col self-start">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
                Access Log
              </p>
              <p className="text-[10px] text-white/20">Last 50 attempts · auto-refreshes every 5s</p>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[560px] pr-0.5">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[32px] mb-3">🔇</p>
                  <p className="text-[13px] text-white/30">No attempts recorded yet</p>
                  <p className="text-[11px] text-white/18 mt-1">
                    Entries appear here when someone calls the door
                  </p>
                </div>
              ) : (
                logs.map(row => (
                  <div key={row.id} className="glass-row rounded-xl px-4 py-3 flex items-center gap-4">
                    {/* Badge */}
                    <span
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-full shrink-0 tracking-[0.1em] uppercase ${
                        row.locked_out
                          ? 'badge-locked'
                          : row.granted
                          ? 'badge-granted'
                          : 'badge-denied'
                      }`}
                    >
                      {row.locked_out ? 'Locked' : row.granted ? 'Granted' : 'Denied'}
                    </span>

                    {/* Caller */}
                    <span className="text-[12px] font-mono text-white/45 w-28 shrink-0 truncate">
                      {maskCaller(row.caller_id)}
                    </span>

                    {/* Word spoken */}
                    <span className="text-[13px] text-white/85 font-medium flex-1 capitalize truncate">
                      &ldquo;{row.word_spoken}&rdquo;
                    </span>

                    {/* Expected + distance (only show on denied) */}
                    {!row.granted && !row.locked_out && row.word_expected && (
                      <span className="text-[11px] text-white/28 shrink-0 hidden xl:flex items-center gap-1.5">
                        {row.match_distance != null && row.match_distance > 0 && (
                          <span className="text-amber-400/60 font-mono">Δ{row.match_distance}</span>
                        )}
                        <span>expected &ldquo;{row.word_expected}&rdquo;</span>
                      </span>
                    )}

                    {/* Time */}
                    <span className="text-[11px] text-white/25 shrink-0 w-16 text-right tabular-nums">
                      {timeAgo(row.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
