import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveGoogleCredentials } from '@/lib/drive/googleDriveService';

export async function GET(req: NextRequest) {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ourspace-app-two.vercel.app';
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state') || Math.random().toString(36).substring(2, 15);

    const creds = await getEffectiveGoogleCredentials();
    if (!creds.clientId) {
      return NextResponse.redirect(
        `${appBaseUrl}/dashboard/admin/storage?error=${encodeURIComponent(
          'Google Client ID is not configured on the server. Please configure GOOGLE_CLIENT_ID or save it in the Storage Manager.'
        )}`
      );
    }

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: creds.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err: any) {
    return NextResponse.redirect(
      `${appBaseUrl}/dashboard/admin/storage?error=${encodeURIComponent(
        err.message || 'Failed to start Google Drive OAuth authorization.'
      )}`
    );
  }
}
