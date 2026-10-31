import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const authHeader = req.headers.get('authorization');

    // In production, reject unauthenticated calls
    if (isProd && !authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to mint LiveKit call tokens.' },
        { status: 401 }
      );
    }

    const { roomName, participantName, participantId } = await req.json();

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || apiKey.startsWith('APIxxxx') || !serverUrl) {
      if (isProd) {
        return NextResponse.json(
          { error: 'LiveKit credentials are not configured on the production server.' },
          { status: 503 }
        );
      }

      // Safe fallback in development/demo mode
      return NextResponse.json(
        {
          configured: false,
          message:
            'LiveKit Cloud credentials not set in .env. Falling back to built-in direct WebRTC / signaling simulation.',
          server_url: 'wss://mock.livekit.cloud',
          token: 'mock-jwt-token-for-dev',
          room_name: roomName || 'ourspace-room',
        },
        { status: 200 }
      );
    }

    // Dynamic import to avoid build errors if server SDK is optional
    const { AccessToken } = await import('livekit-server-sdk');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId || 'user-' + Math.random().toString(36).substring(2, 7),
      name: participantName || 'Partner',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      configured: true,
      token,
      room_name: roomName,
      server_url: serverUrl,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
