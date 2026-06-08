'use client'

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DayStat } from '../lib/types'

function GlassTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const granted = payload.find(p => p.name === 'granted')?.value ?? 0
  const denied  = payload.find(p => p.name === 'denied')?.value ?? 0
  const locked  = payload.find(p => p.name === 'locked')?.value ?? 0
  return (
    <div style={{
      background: 'rgba(10,10,20,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '10px 14px',
      backdropFilter: 'blur(24px)',
      minWidth: '120px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      {granted > 0 && <p style={{ color: '#cfffb3', fontSize: '13px', marginBottom: '2px' }}>✓ {granted} granted</p>}
      {denied  > 0 && <p style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '2px' }}>✗ {denied} denied</p>}
      {locked  > 0 && <p style={{ color: '#fcec52', fontSize: '13px' }}>⊘ {locked} locked</p>}
      {granted + denied + locked === 0 && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No activity</p>}
    </div>
  )
}

export default function WeeklyChart({ stats }: { stats: DayStat[] }) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={stats} barSize={28} barGap={4} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
          dy={6}
        />
        <Tooltip
          content={<GlassTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 6 }}
        />
        <Bar dataKey="granted" stackId="a" fill="#ADE25D" radius={[0, 0, 4, 4]}>
          {stats.map(entry => (
            <Cell key={entry.date} fill={entry.date === today ? '#ADE25D' : 'rgba(173,226,93,0.55)'} />
          ))}
        </Bar>
        <Bar dataKey="denied" stackId="a" fill="rgba(239,68,68,0.75)" radius={[0, 0, 0, 0]}>
          {stats.map(entry => (
            <Cell key={entry.date} fill={entry.date === today ? 'rgba(239,68,68,0.95)' : 'rgba(239,68,68,0.6)'} />
          ))}
        </Bar>
        <Bar dataKey="locked" stackId="a" fill="#FCEC52" radius={[4, 4, 0, 0]}>
          {stats.map(entry => (
            <Cell key={entry.date} fill={entry.date === today ? '#FCEC52' : 'rgba(252,236,82,0.55)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
