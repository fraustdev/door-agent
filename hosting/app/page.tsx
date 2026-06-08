'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AccessLogRow, StatusData } from '../lib/types'

type DoorState = 'idle' | 'confirm' | 'opening' | 'done' | 'error'

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connError, setConnError] = useState(false)

  // Word editing
  const [editingWord, setEditingWord] = useState(false)
  const [wordInput, setWordInput] = useState('')
  const [wordSaving, setWordSaving] = useState(false)
  const [wordFeedback, setWordFeedback] = useState<'saved' | 'error' | null>(null)
  const wordInputRef = useRef<HTMLInputElement>(null)

  // Door trigger
  const [doorState, setDoorState] = useState<DoorState>('idle')
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [lr, sr] = await Promise.all([fetch('/api/logs'), fetch('/api/status')])
      if (lr.ok) setLogs(await lr.json())
      if (sr.ok) setStatus(await sr.json())
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

  const handleDoorClick = () => {
    if (doorState === 'idle') {
      setDoorState('confirm')
      confirmTimerRef.current = setTimeout(() => setDoorState('idle'), 3000)
    } else if (doorState === 'confirm') {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      triggerDoor()
    }
  }

  const triggerDoor = async () => {
    setDoorState('opening')
    try {
      const res = await fetch('/api/door', { method: 'POST' })
      setDoorState(res.ok ? 'done' : 'error')
    } catch {
      setDoorState('error')
    }
    setTimeout(() => setDoorState('idle'), 3000)
  }

  const stats = todayStats(logs)

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse at 12% 48%, rgba(139,92,246,0.32) 0%, transparent 48%),
          radial-gradient(ellipse at 88% 16%, rgba(59,130,246,0.26) 0%, transparent 46%),
          radial-gradient(ellipse at 52% 90%, rgba(20,184,166,0.2) 0%, transparent 46%),
          #080810
        `,
      }}
    >
      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg select-none"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.3) 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 16px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            🚪
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/95 tracking-tight leading-none">
              Door Agent
            </h1>
            <p className="text-[11px] text-white/35 mt-0.5 tracking-wide">2389.ai · Office access control</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Door trigger */}
          <button
            onClick={handleDoorClick}
            disabled={doorState === 'opening'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 select-none disabled:opacity-60"
            style={
              doorState === 'confirm'
                ? { background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.6)', color: '#fcd34d', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }
                : doorState === 'done'
                ? { background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.6)', color: '#6ee7b7', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }
                : doorState === 'error'
                ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }
                : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)' }
            }
          >
            <span>
              {doorState === 'idle' && '🔓'}
              {doorState === 'confirm' && '⚠️'}
              {doorState === 'opening' && '⏳'}
              {doorState === 'done' && '✓'}
              {doorState === 'error' && '✗'}
            </span>
            <span>
              {doorState === 'idle' && 'Open Door'}
              {doorState === 'confirm' && 'Tap again to confirm'}
              {doorState === 'opening' && 'Opening…'}
              {doorState === 'done' && 'Door opened'}
              {doorState === 'error' && 'Failed — retry'}
            </span>
          </button>

          {/* Status */}
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

      <div className="px-8 py-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'Today',
              value: stats.total,
              sub: 'total attempts',
              cls: 'stat-total',
              valueColor: 'text-violet-200',
            },
            {
              label: 'Granted',
              value: stats.granted,
              sub: 'doors opened',
              cls: 'stat-granted',
              valueColor: 'text-emerald-200',
            },
            {
              label: 'Denied',
              value: stats.denied,
              sub: 'failed attempts',
              cls: 'stat-denied',
              valueColor: 'text-red-200',
            },
            {
              label: 'Locked Out',
              value: status?.lockouts.length ?? 0,
              sub: 'active lockouts',
              cls: 'stat-locked',
              valueColor: 'text-amber-200',
            },
          ].map(({ label, value, sub, cls, valueColor }) => (
            <div key={label} className={`rounded-2xl px-5 py-5 ${cls}`}>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.12em] mb-3">
                {label}
              </p>
              <p className={`text-[52px] font-[200] leading-none ${valueColor}`}>{value}</p>
              <p className="text-[11px] text-white/30 mt-2.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left panel */}
          <div className="space-y-4">
            {/* Word of the day */}
            <div className="rounded-2xl glass px-6 py-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
                  Word of the Day
                </p>
                {!editingWord && (
                  <button
                    onClick={startEditWord}
                    className="text-[11px] text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
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
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-[20px] font-light text-white/90 placeholder-white/20 outline-none focus:border-violet-400/50 focus:bg-white/8 transition-all capitalize"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={wordSaving || !wordInput.trim()}
                      className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40"
                      style={{ background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}
                    >
                      {wordSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingWord(false); setWordFeedback(null) }}
                      className="px-4 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/60 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
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
                    <p className="text-[11px] text-emerald-400/80 mb-2">✓ Word updated</p>
                  )}
                  {status?.currentWord ? (
                    <>
                      <p
                        className="text-[38px] font-[300] leading-none capitalize text-white/95"
                        style={{ textShadow: '0 0 40px rgba(139,92,246,0.5)' }}
                      >
                        {status.currentWord}
                      </p>
                      <p className="text-[11px] text-white/30 mt-4">
                        Callers must speak this word to enter
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-white/25 italic">Not available</p>
                  )}
                </div>
              )}
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
          </div>

          {/* Access log */}
          <div className="col-span-2 rounded-2xl glass px-6 py-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-[0.12em]">
                Access Log
              </p>
              <p className="text-[10px] text-white/20">Last 50 attempts · auto-refreshes every 5s</p>
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[520px] pr-0.5">
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
