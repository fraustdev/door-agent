import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const word = searchParams.get('word')?.trim()
  if (!word) return NextResponse.json({ url: null })

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) return NextResponse.json({ url: null })

  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/translate?api_key=${apiKey}&s=${encodeURIComponent(word)}&weirdness=5`,
      { cache: 'force-cache' }
    )
    const data = await res.json()
    const url = data?.data?.images?.original?.url ?? null
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ url: null })
  }
}
