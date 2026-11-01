/**
 * OURSPACE Google Drive Central Media Storage Engine (V2.5.0)
 *
 * Implements server-side Google Drive API v3 integration:
 * - Central administrative Google AI Pro account acts as the single storage repository.
 * - Secure server-side OAuth 2.0 with offline refresh token management.
 * - Least-privilege scope: https://www.googleapis.com/auth/drive.file
 * - Dedicated folder hierarchy:
 *     OURSPACE_STORAGE/
 *       SHARED_MEDIA/{opaqueSpaceId}/...
 *       PRIVATE_LOCKER/{userUid}/...
 *       APP_BACKUPS/...
 * - Resumable chunked upload forwarding with Vercel serverless bounds.
 * - Authenticated media streaming gateway with HTTP Range support.
 */

import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { DriveConnectionStatus, DriveMediaCategory } from '@ourspace/types';
import {
  MAX_OURSPACE_STORAGE_BYTES,
  getStorageWarningLevel,
  getDriveFolderPath,
} from '@ourspace/shared';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// In-memory token cache
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let memoryTokenCache: CachedToken | null = null;

// Folder ID lookup cache to prevent redundant Drive API list queries
const folderIdCache = new Map<string, string>();

/**
 * Retrieves server-side Google OAuth client credentials from environment
 */
export function getGoogleOAuthCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://ourspace-app-two.vercel.app'}/api/drive/callback`,
    configuredRefreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
    configuredRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '',
  };
}

/**
 * Resolves effective credentials by checking environment variables first,
 * followed by server-stored credentials in Firestore `_admin_config/drive_oauth`.
 */
export async function getEffectiveGoogleCredentials() {
  const envCreds = getGoogleOAuthCredentials();
  let firestoreDoc: Record<string, any> | null = null;

  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseFirestore();
      const snap = await getDoc(doc(db, '_admin_config', 'drive_oauth'));
      if (snap.exists()) {
        firestoreDoc = snap.data();
      }
    } catch (err) {
      console.warn('[GoogleDrive] Could not fetch _admin_config/drive_oauth:', err);
    }
  }

  return {
    clientId: envCreds.clientId || firestoreDoc?.clientId || '',
    clientSecret: envCreds.clientSecret || firestoreDoc?.clientSecret || '',
    redirectUri: envCreds.redirectUri,
    refreshToken: envCreds.configuredRefreshToken || firestoreDoc?.refreshToken || '',
    accessToken: (firestoreDoc?.accessToken as string) || null,
    accessTokenExpiresAt: Number(firestoreDoc?.accessTokenExpiresAt || 0),
    accountEmail: (firestoreDoc?.accountEmail as string) || null,
    configuredRootFolderId: envCreds.configuredRootFolderId || 'OURSPACE_STORAGE',
    hasFirestoreDoc: Boolean(firestoreDoc),
  };
}

/**
 * Returns OAuth authorization URL for administrator to connect their central Google account
 */
export function getGoogleAuthorizationUrl(state: string, clientIdOverride?: string): string {
  const { clientId, redirectUri } = getGoogleOAuthCredentials();
  const effectiveClientId = clientIdOverride || clientId;
  if (!effectiveClientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in server environment variables.');
  }

  const params = new URLSearchParams({
    client_id: effectiveClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    access_type: 'offline',
    prompt: 'consent select_account', // Forces Google to show consent screen and issue refresh token
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens, saving tokens to Firestore store
 */
export async function handleOAuthCallback(code: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const creds = await getEffectiveGoogleCredentials();
  const { clientId, clientSecret, redirectUri } = creds;
  if (!clientId || !clientSecret) {
    return { success: false, error: 'Google OAuth credentials (Client ID or Client Secret) are missing on the server.' };
  }

  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      const desc = data.error_description || data.error || 'Failed to exchange authorization code.';
      console.error('[GoogleDrive] OAuth code exchange failed:', data);
      return { success: false, error: desc };
    }

    const { access_token, refresh_token, expires_in } = data;
    const expiresAt = Date.now() + ((expires_in || 3600) - 60) * 1000;

    // Cache access token in memory
    memoryTokenCache = {
      accessToken: access_token,
      expiresAt,
    };

    // Retrieve account info
    let accountEmail: string | undefined;
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        accountEmail = userData.email;
      }
    } catch {}

    // Persist tokens to server Firestore collection `_admin_config/drive_oauth`
    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        const payload: Record<string, unknown> = {
          accessToken: access_token,
          accessTokenExpiresAt: expiresAt,
          accountEmail: accountEmail || null,
          updatedAt: new Date().toISOString(),
        };
        if (refresh_token) {
          payload.refreshToken = refresh_token;
        }
        await setDoc(doc(db, '_admin_config', 'drive_oauth'), payload, { merge: true });
      } catch (dbErr: any) {
        console.error('[GoogleDrive] Failed to persist tokens to Firestore:', dbErr);
        return {
          success: false,
          error: `Google authorized, but failed to save credentials into database: ${dbErr?.message || dbErr}`,
        };
      }
    }

    return { success: true, email: accountEmail };
  } catch (err: any) {
    return { success: false, error: err.message || 'OAuth token exchange network failure.' };
  }
}

/**
 * Saves and validates manually provided Google Drive credentials directly
 */
export async function saveAdminDriveCredentials(params: {
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{ success: boolean; email?: string; error?: string }> {
  const current = await getEffectiveGoogleCredentials();
  const clientId = params.clientId?.trim() || current.clientId;
  const clientSecret = params.clientSecret?.trim() || current.clientSecret;
  const refreshToken = params.refreshToken?.trim() || current.refreshToken;

  if (!refreshToken) {
    return { success: false, error: 'A valid Google Drive Refresh Token is required.' };
  }
  if (!clientId || !clientSecret) {
    return { success: false, error: 'Google Client ID and Client Secret are required to verify the Refresh Token.' };
  }

  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      return {
        success: false,
        error: `Google verification failed: ${data.error_description || data.error || 'Invalid refresh token'}`,
      };
    }

    const expiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    memoryTokenCache = {
      accessToken: data.access_token,
      expiresAt,
    };

    let accountEmail: string | undefined;
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        accountEmail = u.email;
      }
    } catch {}

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      const payload: Record<string, unknown> = {
        refreshToken,
        accessToken: data.access_token,
        accessTokenExpiresAt: expiresAt,
        accountEmail: accountEmail || null,
        updatedAt: new Date().toISOString(),
      };
      if (params.clientId?.trim()) payload.clientId = params.clientId.trim();
      if (params.clientSecret?.trim()) payload.clientSecret = params.clientSecret.trim();

      await setDoc(doc(db, '_admin_config', 'drive_oauth'), payload, { merge: true });
    }

    return { success: true, email: accountEmail };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error verifying credentials with Google.' };
  }
}

/**
 * Disconnects the central Google account
 */
export async function disconnectAdminDrive(): Promise<void> {
  memoryTokenCache = null;
  folderIdCache.clear();
  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, '_admin_config', 'drive_oauth'),
        {
          refreshToken: null,
          accessToken: null,
          accessTokenExpiresAt: null,
          accountEmail: null,
          disconnectedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[GoogleDrive] Disconnect error:', err);
    }
  }
}

/**
 * Retrieves valid Google Drive access token, automatically refreshing when expired
 */
export async function getValidDriveAccessToken(): Promise<string> {
  // 1. Check memory cache
  if (memoryTokenCache && memoryTokenCache.expiresAt > Date.now()) {
    return memoryTokenCache.accessToken;
  }

  // 2. Resolve credentials & tokens from Firestore and environment
  const creds = await getEffectiveGoogleCredentials();

  // If the access token saved in Firestore is still valid, use it immediately
  if (creds.accessToken && creds.accessTokenExpiresAt > Date.now()) {
    memoryTokenCache = {
      accessToken: creds.accessToken,
      expiresAt: creds.accessTokenExpiresAt,
    };
    return creds.accessToken;
  }

  if (!creds.refreshToken) {
    throw new Error(
      'Central Google Drive is not connected. Administrator must authorize via /dashboard/admin/storage.'
    );
  }

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error(
      'Google Client ID or Client Secret missing. Check environment variables or Storage Manager.'
    );
  }

  // 3. Request fresh access token
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google Drive token refresh failed: ${data.error_description || data.error || 'Unknown error'}`
    );
  }

  const newExpiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  memoryTokenCache = {
    accessToken: data.access_token,
    expiresAt: newExpiresAt,
  };

  // Update fresh access token in Firestore as well
  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseFirestore();
      await setDoc(
        doc(db, '_admin_config', 'drive_oauth'),
        {
          accessToken: data.access_token,
          accessTokenExpiresAt: newExpiresAt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}
  }

  return memoryTokenCache.accessToken;
}

/**
 * Finds or creates a folder under a parent folder in Google Drive
 */
async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const cacheKey = `${parentFolderId || 'root'}:${folderName}`;
  if (folderIdCache.has(cacheKey)) {
    return folderIdCache.get(cacheKey)!;
  }

  // Search for existing folder
  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const folderId = searchData.files[0].id;
      folderIdCache.set(cacheKey, folderId);
      return folderId;
    }
  }

  // Create new folder
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(`Failed to create Google Drive folder '${folderName}': ${JSON.stringify(errData)}`);
  }

  const createData = await createRes.json();
  folderIdCache.set(cacheKey, createData.id);
  return createData.id;
}

/**
 * Resolves or creates the canonical nested destination folder under OURSPACE_STORAGE/
 */
export async function resolveDestinationDriveFolder(
  category: DriveMediaCategory | string,
  spaceId?: string | null,
  userId?: string | null
): Promise<string> {
  const accessToken = await getValidDriveAccessToken();
  const folderPath = getDriveFolderPath(category, spaceId, userId);

  let currentParentId: string | undefined = undefined;

  for (const segment of folderPath) {
    currentParentId = await getOrCreateFolder(accessToken, segment, currentParentId);
  }

  return currentParentId!;
}

/**
 * Initiates a Google Drive Resumable Upload Session
 */
export async function createDriveResumableUploadSession(
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  totalBytes: number
): Promise<{ uploadUrl: string }> {
  const accessToken = await getValidDriveAccessToken();

  const metadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    parents: [parentFolderId],
  };

  const res = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_BASE}?uploadType=resumable&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': totalBytes.toString(),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to initiate Drive resumable upload session: ${errText}`);
  }

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Drive API did not return resumable session Location header.');
  }

  return { uploadUrl };
}

/**
 * Forwards a binary chunk to an active Google Drive resumable upload session
 */
export async function forwardChunkToDrive(
  driveUploadUrl: string,
  chunkBuffer: Buffer | Uint8Array,
  rangeStart: number,
  rangeEnd: number,
  totalBytes: number
): Promise<{ completed: boolean; fileId?: string }> {
  const contentLength = rangeEnd - rangeStart + 1;
  const contentRange = `bytes ${rangeStart}-${rangeEnd}/${totalBytes}`;

  const res = await fetch(driveUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': contentLength.toString(),
      'Content-Range': contentRange,
    },
    body: chunkBuffer as any,
  });

  // 308 Resume Incomplete = Chunk accepted, more chunks needed
  if (res.status === 308) {
    return { completed: false };
  }

  // 200 OK or 201 Created = Upload complete
  if (res.ok) {
    const data = await res.json();
    return { completed: true, fileId: data.id };
  }

  const errText = await res.text();
  throw new Error(`Drive chunk upload failed with HTTP ${res.status}: ${errText}`);
}

/**
 * Retrieves file metadata from Google Drive
 */
export async function getDriveFileMetadata(fileId: string): Promise<any> {
  const accessToken = await getValidDriveAccessToken();
  const res = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size,createdTime,md5Checksum`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Drive metadata lookup failed: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches authenticated media stream from Google Drive with optional Range header
 */
export async function fetchDriveMediaStream(
  fileId: string,
  rangeHeader?: string | null
): Promise<{
  body: ReadableStream<Uint8Array> | null;
  status: number;
  headers: Record<string, string>;
}> {
  const accessToken = await getValidDriveAccessToken();
  const reqHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (rangeHeader) {
    reqHeaders['Range'] = rangeHeader;
  }

  const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: reqHeaders,
  });

  const responseHeaders: Record<string, string> = {};
  ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'].forEach((h) => {
    const val = res.headers.get(h);
    if (val) responseHeaders[h] = val;
  });

  return {
    body: res.body,
    status: res.status,
    headers: responseHeaders,
  };
}

/**
 * Deletes a file permanently from central Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const accessToken = await getValidDriveAccessToken();
  await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Retrieves the central Google Account storage quota and user details from Drive API
 */
export async function getCentralGoogleAccountStorage(): Promise<{
  limitBytes: number | null;
  usageBytes: number | null;
  usageInDriveBytes: number | null;
  usageInDriveTrashBytes: number | null;
  email?: string | null;
}> {
  try {
    const accessToken = await getValidDriveAccessToken();
    const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/about?fields=storageQuota,user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const quota = data.storageQuota || {};
      const user = data.user || {};
      return {
        limitBytes: quota.limit ? parseInt(quota.limit, 10) : null,
        usageBytes: quota.usage ? parseInt(quota.usage, 10) : null,
        usageInDriveBytes: quota.usageInDrive ? parseInt(quota.usageInDrive, 10) : null,
        usageInDriveTrashBytes: quota.usageInDriveTrash ? parseInt(quota.usageInDriveTrash, 10) : null,
        email: user.emailAddress || null,
      };
    }
  } catch {}

  return {
    limitBytes: null,
    usageBytes: null,
    usageInDriveBytes: null,
    usageInDriveTrashBytes: null,
    email: null,
  };
}
