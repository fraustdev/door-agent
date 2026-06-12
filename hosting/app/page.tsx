'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { AccessLogRow, StatusData, DayStat, SlackVisitor, WordEntry } from '../lib/types'

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

function maskCaller(id: string): string {
  if (!id || id === 'unknown') return 'unknown'
  if (id.length > 7) return id.slice(0, 3) + ' •••• ' + id.slice(-4)
  return id
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
  const [visitors, setVisitors] = useState<SlackVisitor[]>([])
  const [weekWords, setWeekWords] = useState<WordEntry[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connError, setConnError] = useState(false)

  // Weekly word editing
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [showWeek, setShowWeek] = useState(false)
  const [wordImageUrl, setWordImageUrl] = useState<string | null>(null)
  const [wordImageLoaded, setWordImageLoaded] = useState(false)
  const prevWord = useRef<string | null>(null)

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    const word = weekWords.find(w => w.date === today)?.word ?? ''
    if (word && word !== prevWord.current) {
      prevWord.current = word
      setWordImageLoaded(false)
      setWordImageUrl(null)
      fetch(`/api/wordgif?word=${encodeURIComponent(word)}`)
        .then(r => r.json())
        .then(d => { if (d.url) setWordImageUrl(d.url) })
        .catch(() => {})
    }
  }, [weekWords])

  const refresh = useCallback(async () => {
    try {
      const [lr, sr, str, vr, wr] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/status'),
        fetch('/api/stats'),
        fetch('/api/visitors'),
        fetch('/api/words'),
      ])
      if (lr.ok)  setLogs(await lr.json())
      if (sr.ok)  setStatus(await sr.json())
      if (str.ok) setStats(await str.json())
      if (vr.ok)  setVisitors(await vr.json())
      if (wr.ok)  setWeekWords(await wr.json())
      setLastUpdated(new Date())
      setConnError(false)
    } catch {
      setConnError(true)
    }
  }, [])

useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const todayChicago = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const startEdit = (date: string, currentWord: string) => {
    setEditInput(currentWord)
    setEditingDate(date)
  }

  const saveEdit = async (date: string) => {
    const word = editInput.trim()
    if (!word) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, word }),
      })
      if (res.ok) {
        setEditingDate(null)
        await refresh()
      }
    } finally {
      setEditSaving(false)
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
        <div className="grid grid-cols-3 gap-3">
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
              className="rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.13)',
                borderTopColor: 'rgba(255,255,255,0.26)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              {/* GIF section — only this portion has the background image */}
              <div className="relative px-6 py-6">
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
                      style={{ background: 'linear-gradient(160deg, rgba(8,8,16,0.15) 0%, rgba(8,8,16,0.88) 52%)' }}
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 glass" style={{ borderRadius: 0 }} />
                )}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
                      Word of the Day
                    </p>
                    {editingDate !== todayChicago() && (
                      <button
                        onClick={() => startEdit(todayChicago(), weekWords.find(w => w.date === todayChicago())?.word ?? '')}
                        className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {editingDate === todayChicago() ? (
                    <form onSubmit={e => { e.preventDefault(); saveEdit(todayChicago()) }} className="space-y-3">
                      <input
                        autoFocus
                        value={editInput}
                        onChange={e => setEditInput(e.target.value)}
                        placeholder="New word…"
                        maxLength={32}
                        className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-[20px] font-light text-white/90 placeholder-white/25 outline-none focus:border-white/40 transition-all capitalize"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={editSaving || !editInput.trim()}
                          className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40"
                          style={{ background: 'rgba(59,112,128,0.5)', border: '1px solid rgba(59,112,128,0.7)', color: '#a8cfd8' }}
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDate(null)}
                          className="px-4 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/60 transition-colors"
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (() => {
                    const todayWord = weekWords.find(w => w.date === todayChicago())?.word ?? ''
                    return todayWord ? (
                      <>
                        <p className="text-[38px] font-[300] leading-none capitalize text-white">
                          {todayWord}
                        </p>
                        <p className="text-[11px] text-white/40 mt-4">
                          Callers must speak this word to enter
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] text-white/25 italic">No word set for today</p>
                    )
                  })()}

                  {/* This week toggle */}
                  <button
                    onClick={() => setShowWeek(v => !v)}
                    className="mt-5 flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors"
                  >
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${showWeek ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>This week</span>
                  </button>
                </div>
              </div>

              {/* Week dropdown — sits below the GIF section, plain dark background */}
              {showWeek && (
                <div className="px-6 pb-5" style={{ background: 'rgba(8,8,16,0.55)' }}>
                  <div className="border-t border-white/[0.06] pt-3 space-y-1">
                    {weekWords.map(({ date, word }) => {
                      const isToday = date === todayChicago()
                      const d = new Date(date + 'T12:00:00')
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
                      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      const isEditing = editingDate === date && !isToday
                      return (
                        <div
                          key={date}
                          className={`rounded-xl px-4 py-2.5 flex items-center gap-3 transition-colors ${
                            isToday ? 'bg-white/[0.07] border border-white/10' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="w-14 shrink-0">
                            <p className={`text-[11px] font-semibold ${isToday ? 'text-white/70' : 'text-white/40'}`}>{dayName}</p>
                            <p className="text-[10px] text-white/25 mt-0.5">{monthDay}</p>
                          </div>
                          {isEditing ? (
                            <form onSubmit={e => { e.preventDefault(); saveEdit(date) }} className="flex-1 flex gap-2 items-center">
                              <input
                                autoFocus
                                value={editInput}
                                onChange={e => setEditInput(e.target.value)}
                                placeholder="Enter word…"
                                maxLength={32}
                                className="flex-1 bg-black/30 border border-white/20 rounded-lg px-3 py-1.5 text-[13px] text-white/90 placeholder-white/25 outline-none focus:border-white/40 transition-all"
                              />
                              <button
                                type="submit"
                                disabled={editSaving || !editInput.trim()}
                                className="text-[11px] px-3 py-1.5 rounded-lg disabled:opacity-40 shrink-0"
                                style={{ background: 'rgba(59,112,128,0.5)', border: '1px solid rgba(59,112,128,0.7)', color: '#a8cfd8' }}
                              >
                                {editSaving ? '…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDate(null)}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg text-white/35 hover:text-white/60 shrink-0"
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                ✕
                              </button>
                            </form>
                          ) : (
                            <>
                              <p className={`flex-1 text-[13px] capitalize ${word ? (isToday ? 'text-white/70 font-medium' : 'text-white/60') : 'text-white/20 italic'}`}>
                                {word || '—'}
                              </p>
                              {!isToday && (
                                <button
                                  onClick={() => startEdit(date, word)}
                                  className="text-[11px] text-white/25 hover:text-white/55 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.06] shrink-0"
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>


            {/* Today's visitors — from Slack */}
            <div className="rounded-2xl glass px-6 py-6">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em] mb-4">
                Today&apos;s Visitors
              </p>
              {visitors.length === 0 ? (
                <p className="text-[13px] text-white/25 italic">No visitors added yet today</p>
              ) : (
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                  {visitors.map(v => (
                    <div key={v.id} className="glass-row rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                      <p className="text-[13px] text-white/85 font-medium capitalize">{v.name}</p>
                      <p className="text-[11px] text-white/25 shrink-0 tabular-nums">{timeAgo(v.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
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
                        row.is_injection ? 'badge-injection'
                        : row.granted && row.granted_by === 'visitor' ? 'badge-visitor'
                        : row.granted ? 'badge-granted'
                        : 'badge-denied'
                      }`}
                    >
                      {row.is_injection ? 'Injection'
                        : row.granted && row.granted_by === 'visitor' ? 'Visitor'
                        : row.granted ? 'Granted'
                        : 'Denied'}
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
                    {!row.granted && row.word_expected && (
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
