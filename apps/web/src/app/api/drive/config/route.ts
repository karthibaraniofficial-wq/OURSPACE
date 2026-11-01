import { NextRequest, NextResponse } from 'next/server';
import {
  saveAdminDriveCredentials,
  disconnectAdminDrive,
  getEffectiveGoogleCredentials,
} from '@/lib/drive/googleDriveService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, refreshToken, clientId, clientSecret } = body;

    if (action === 'disconnect') {
      await disconnectAdminDrive();
      return NextResponse.json({ success: true, message: 'Google Drive disconnected.' });
    }

    if (action === 'save') {
      const result = await saveAdminDriveCredentials({
        refreshToken,
        clientId,
        clientSecret,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, email: result.email });
    }

    return NextResponse.json({ success: false, error: 'Invalid action provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update Google Drive configuration.' },
      { status: 500 }
    );
  }
}
