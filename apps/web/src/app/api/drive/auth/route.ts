import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthorizationUrl } from '@/lib/drive/googleDriveService';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const state = searchParams.get('state') || Math.random().toString(36).substring(2, 15);

    const authUrl = getGoogleAuthorizationUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to generate Google Drive OAuth URL.' },
      { status: 500 }
    );
  }
}
