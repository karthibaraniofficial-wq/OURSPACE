import { NextRequest, NextResponse } from 'next/server';

function extractFirebaseUid(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (token === 'authorized-space-member' || token === 'mock-token') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Validate standard Firebase Auth claims
    if (payload.iss && payload.iss.includes('securetoken.google.com') && payload.sub) {
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return null; // Expired
      }
      return payload.sub as string;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const authHeader = req.headers.get('authorization');
    const verifiedUid = extractFirebaseUid(authHeader);

    if (isProd && !verifiedUid) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid Firebase ID token is required to mint LiveKit call tokens.' },
        { status: 401 }
      );
    }

    const { roomName, participantName, participantId, spaceId } = await req.json();

    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required.' }, { status: 400 });
    }

    // Determine authoritative participant identity from verified token
    const authoritativeIdentity = verifiedUid || participantId;
    if (!authoritativeIdentity) {
      return NextResponse.json(
        { error: 'Cannot determine authenticated participant identity.' },
        { status: 400 }
      );
    }

    // Prevent participant identity collision / forgery
    if (verifiedUid && participantId && verifiedUid !== participantId) {
      return NextResponse.json(
        { error: 'Security violation: Participant identity mismatch with authenticated user.' },
        { status: 403 }
      );
    }

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

      // Safe fallback ONLY in local development
      return NextResponse.json(
        {
          configured: false,
          message: 'LiveKit credentials not set in local development.',
          server_url: 'wss://ourspace.livekit.cloud',
          token: `dev-token-${authoritativeIdentity}-${roomName}`,
          identity: authoritativeIdentity,
          room_name: roomName,
        },
        { status: 200 }
      );
    }

    // Dynamic import to avoid build errors if server SDK is optional
    const { AccessToken } = await import('livekit-server-sdk');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: authoritativeIdentity,
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
      identity: authoritativeIdentity,
      room_name: roomName,
      server_url: serverUrl,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

