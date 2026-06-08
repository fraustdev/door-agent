import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export interface DayStat {
  date: string
  day: string
  granted: number
  denied: number
  locked: number
  total: number
}

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Build the 7-day window starting from 6 days ago at midnight UTC
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 6)
  since.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('access_log')
    .select('created_at, granted, locked_out')
    .gte('created_at', since.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pre-fill all 7 days with zeros so days with no activity still appear
  const dayMap = new Map<string, { granted: number; denied: number; locked: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    dayMap.set(d.toISOString().slice(0, 10), { granted: 0, denied: 0, locked: 0 })
  }

  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10)
    const bucket = dayMap.get(key)
    if (!bucket) continue
    if (row.locked_out) bucket.locked++
    else if (row.granted) bucket.granted++
    else bucket.denied++
  }

  const result: DayStat[] = Array.from(dayMap.entries()).map(([date, counts]) => {
    // Parse at noon UTC to avoid date-shift on daylight-saving boundaries
    const d = new Date(`${date}T12:00:00Z`)
    const day = d.toLocaleDateString('en-US', { weekday: 'short' })
    return { date, day, ...counts, total: counts.granted + counts.denied + counts.locked }
  })

  return NextResponse.json(result)
}
