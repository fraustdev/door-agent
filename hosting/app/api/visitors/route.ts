import { NextResponse } from 'next/server'

export async function GET() {
  const apiUrl = process.env.DOOR_AGENT_API_URL
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiUrl) return NextResponse.json({ error: 'DOOR_AGENT_API_URL not configured' }, { status: 500 })

  const res = await fetch(`${apiUrl}/visitors`, {
    headers: apiKey ? { 'x-dashboard-key': apiKey } : {},
    cache: 'no-store',
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })
  return NextResponse.json(await res.json())
}
