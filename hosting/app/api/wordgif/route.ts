import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const word = new URL(req.url).searchParams.get('word')?.trim()
  if (!word) return NextResponse.json({ error: 'word required' }, { status: 400 })

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GIPHY_API_KEY not set' }, { status: 500 })

  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(word)}&limit=5&rating=g&lang=en`,
    { cache: 'no-store' }
  )
  const data = await res.json()
  const gifs: { images: { original: { url: string } } }[] = data.data ?? []
  if (!gifs.length) return NextResponse.json({ url: null })

  // Pick randomly from the first 5 so the card feels fresh each visit
  const gif = gifs[Math.floor(Math.random() * Math.min(gifs.length, 5))]
  return NextResponse.json({ url: gif?.images?.original?.url ?? null })
}
