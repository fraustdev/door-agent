import { NextResponse } from 'next/server'

export async function PUT(req: Request) {
  const apiUrl = process.env.DOOR_AGENT_API_URL
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiUrl) return NextResponse.json({ error: 'DOOR_AGENT_API_URL not configured' }, { status: 500 })

  const body = await req.json()
  const res = await fetch(`${apiUrl}/word`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-dashboard-key': apiKey } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
