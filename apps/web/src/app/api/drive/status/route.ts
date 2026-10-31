import { NextRequest, NextResponse } from 'next/server';
import {
  getValidDriveAccessToken,
  getCentralGoogleAccountStorage,
  getGoogleOAuthCredentials,
} from '@/lib/drive/googleDriveService';
import { getStorageLedger, reconcileStorageLedger } from '@/lib/storage/storageLedger';
import type { DriveConnectionStatus } from '@ourspace/types';
import { MAX_OURSPACE_STORAGE_BYTES } from '@ourspace/shared';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shouldReconcile = searchParams.get('reconcile') === 'true';

    // 1. Check Google Drive API connection
    let isConnected = false;
    let driveError: string | null = null;
    let googleStorage = {
      limitBytes: null as number | null,
      usageBytes: null as number | null,
      usageInDriveBytes: null as number | null,
      usageInDriveTrashBytes: null as number | null,
    };

    try {
      const token = await getValidDriveAccessToken();
      if (token) {
        isConnected = true;
        googleStorage = await getCentralGoogleAccountStorage();
      }
    } catch (err: any) {
      driveError = err.message || 'Drive connection error';
    }

    // 2. Retrieve authoritative OURSPACE 250 GB storage ledger
    const ledger = shouldReconcile ? await reconcileStorageLedger() : await getStorageLedger();

    const { configuredRootFolderId } = getGoogleOAuthCredentials();

    const statusResponse: DriveConnectionStatus = {
      is_connected: isConnected,
      account_email: null,
      root_folder_id: configuredRootFolderId || 'OURSPACE_STORAGE',
      total_drive_capacity_bytes: googleStorage.limitBytes,
      total_drive_used_bytes: googleStorage.usageBytes,
      ourspace_used_bytes: ledger.verified_used_bytes + ledger.reserved_upload_bytes,
      ourspace_max_bytes: MAX_OURSPACE_STORAGE_BYTES,
      warning_level: ledger.warning_level,
      last_token_refresh_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      status: statusResponse,
      ledger,
      googleAccountStorage: googleStorage,
      error: driveError,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to query Drive storage status.' },
      { status: 500 }
    );
  }
}
