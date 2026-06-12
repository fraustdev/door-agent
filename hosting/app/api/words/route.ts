import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getWeekDates(): string[] {
  const chicagoStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const [year, month, day] = chicagoStr.split('-').map(Number)
  const today = new Date(year, month - 1, day)
  const daysFromMonday = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toLocaleDateString('en-CA')
  })
}

export async function GET() {
  const supabase = getClient()
  const dates = getWeekDates()
  const { data, error } = await supabase
    .from('words')
    .select('date, word')
    .in('date', dates)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data as { date: string; word: string }[]
  return NextResponse.json(
    dates.map(date => ({ date, word: rows.find(r => r.date === date)?.word ?? '' }))
  )
}

export async function PUT(req: Request) {
  const supabase = getClient()
  const { date, word } = await req.json()
  if (!date || !word) return NextResponse.json({ error: 'date and word required' }, { status: 400 })
  const { error } = await supabase
    .from('words')
    .upsert({ date, word: word.toLowerCase().trim() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, date, word: word.toLowerCase().trim() })
}
