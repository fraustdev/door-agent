import { NextResponse } from 'next/server'

export async function POST() {
  const apiUrl = process.env.DOOR_AGENT_API_URL
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiUrl) return NextResponse.json({ error: 'DOOR_AGENT_API_URL not configured' }, { status: 500 })

  const res = await fetch(`${apiUrl}/door/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-dashboard-key': apiKey } : {}),
    },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
