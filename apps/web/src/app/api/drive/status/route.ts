import { NextRequest, NextResponse } from 'next/server';
import {
  getValidDriveAccessToken,
  getCentralGoogleAccountStorage,
  getEffectiveGoogleCredentials,
} from '@/lib/drive/googleDriveService';
import { getStorageLedger, reconcileStorageLedger } from '@/lib/storage/storageLedger';
import type { DriveConnectionStatus } from '@ourspace/types';
import { MAX_OURSPACE_STORAGE_BYTES } from '@ourspace/shared';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shouldReconcile = searchParams.get('reconcile') === 'true';

    const creds = await getEffectiveGoogleCredentials();

    // 1. Check Google Drive API connection
    let isConnected = false;
    let driveError: string | null = null;
    let accountEmail: string | null = creds.accountEmail;
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
        const resStorage = await getCentralGoogleAccountStorage();
        googleStorage = {
          limitBytes: resStorage.limitBytes,
          usageBytes: resStorage.usageBytes,
          usageInDriveBytes: resStorage.usageInDriveBytes,
          usageInDriveTrashBytes: resStorage.usageInDriveTrashBytes,
        };
        if (resStorage.email) {
          accountEmail = resStorage.email;
        }
      }
    } catch (err: any) {
      driveError = err.message || 'Drive connection error';
    }

    // 2. Retrieve authoritative OURSPACE 250 GB storage ledger
    const ledger = shouldReconcile ? await reconcileStorageLedger() : await getStorageLedger();

    const statusResponse: DriveConnectionStatus = {
      is_connected: isConnected,
      account_email: accountEmail,
      root_folder_id: creds.configuredRootFolderId || 'OURSPACE_STORAGE',
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
      diagnostics: {
        has_client_id: Boolean(creds.clientId),
        client_id_preview: creds.clientId ? `${creds.clientId.slice(0, 16)}...` : null,
        has_client_secret: Boolean(creds.clientSecret),
        is_secret_from_database: creds.isSecretFromDatabase,
        has_refresh_token: Boolean(creds.refreshToken),
        has_active_token: Boolean(creds.accessToken && creds.accessTokenExpiresAt > Date.now()),
        has_firestore_doc: creds.hasFirestoreDoc,
        redirect_uri: creds.redirectUri,
      },
      error: driveError,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to query Drive storage status.' },
      { status: 500 }
    );
  }
}
