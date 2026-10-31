import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_GIFS = [
  {
    id: 'gif-1',
    title: 'Love Hug',
    url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif',
  },
  {
    id: 'gif-2',
    title: 'Warm Hug',
    url: 'https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif',
  },
  {
    id: 'gif-3',
    title: 'Sweet Kiss',
    url: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
  },
  {
    id: 'gif-4',
    title: 'Heart Eyes',
    url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
  },
  {
    id: 'gif-5',
    title: 'I Miss You',
    url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif',
  },
  {
    id: 'gif-6',
    title: 'Happy Dance',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || 'love';
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  if (!apiKey || apiKey.includes('your_giphy_api_key')) {
    return NextResponse.json({
      data: FALLBACK_GIFS,
      source: 'fallback',
      message: 'Add NEXT_PUBLIC_GIPHY_API_KEY to .env for live GIPHY catalog',
    });
  }

  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
        q
      )}&limit=20&rating=g`
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ data: FALLBACK_GIFS, source: 'fallback' });
  }
}
