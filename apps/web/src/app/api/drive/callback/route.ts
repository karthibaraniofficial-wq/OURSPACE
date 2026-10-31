import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback } from '@/lib/drive/googleDriveService';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ourspace-app-two.vercel.app';

  if (error) {
    return NextResponse.redirect(`${appBaseUrl}/dashboard/admin/storage?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${appBaseUrl}/dashboard/admin/storage?error=${encodeURIComponent('No authorization code provided by Google.')}`
    );
  }

  const result = await handleOAuthCallback(code);
  if (!result.success) {
    return NextResponse.redirect(
      `${appBaseUrl}/dashboard/admin/storage?error=${encodeURIComponent(result.error || 'OAuth token exchange failed')}`
    );
  }

  return NextResponse.redirect(`${appBaseUrl}/dashboard/admin/storage?connected=true&email=${encodeURIComponent(result.email || '')}`);
}
