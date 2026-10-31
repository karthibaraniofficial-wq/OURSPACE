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
 * Retrieves server-side Google OAuth client credentials
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
 * Returns OAuth authorization URL for administrator to connect their central Google AI Pro account
 */
export function getGoogleAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthCredentials();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in server environment variables.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    access_type: 'offline',
    prompt: 'consent', // Forces refresh token issuance
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens, saving refresh token to server store
 */
export async function handleOAuthCallback(code: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    return { success: false, error: 'Google OAuth credentials missing on server.' };
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
      return { success: false, error: data.error_description || data.error || 'Failed to exchange OAuth code.' };
    }

    const { access_token, refresh_token, expires_in } = data;

    // Cache access token in memory
    memoryTokenCache = {
      accessToken: access_token,
      expiresAt: Date.now() + (expires_in - 60) * 1000,
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

    // Persist refresh token to server-only Firestore collection `_admin_config/drive_oauth`
    if (isFirebaseConfigured() && refresh_token) {
      try {
        const db = getFirebaseFirestore();
        await setDoc(
          doc(db, '_admin_config', 'drive_oauth'),
          {
            refreshToken: refresh_token,
            accountEmail: accountEmail || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('[GoogleDrive] Warning: Could not save refresh token to Firestore:', dbErr);
      }
    }

    return { success: true, email: accountEmail };
  } catch (err: any) {
    return { success: false, error: err.message || 'OAuth token exchange network failure.' };
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

  // 2. Resolve refresh token (env var takes precedence, followed by Firestore admin config)
  const { clientId, clientSecret, configuredRefreshToken } = getGoogleOAuthCredentials();
  let refreshToken = configuredRefreshToken;

  if (!refreshToken && isFirebaseConfigured()) {
    try {
      const db = getFirebaseFirestore();
      const snap = await getDoc(doc(db, '_admin_config', 'drive_oauth'));
      if (snap.exists()) {
        refreshToken = snap.data().refreshToken || '';
      }
    } catch {}
  }

  if (!refreshToken) {
    throw new Error(
      'Central Google Drive is not connected. Administrator must authorize via /dashboard/admin/storage.'
    );
  }

  // 3. Request fresh access token
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
    throw new Error(
      `Google Drive token refresh failed: ${data.error_description || data.error || 'Unknown error'}`
    );
  }

  memoryTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000,
  };

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

  const res = await fetch(`${GOOGLE_DRIVE_UPLOAD_BASE}?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': totalBytes.toString(),
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to initiate Drive resumable upload session: ${res.status} ${err}`);
  }

  const uploadUrl = res.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Google Drive did not return a resumable upload Location header.');
  }

  return { uploadUrl };
}

/**
 * Forwards an upload chunk buffer to the Google Drive resumable upload session
 */
export async function forwardChunkToDrive(
  uploadUrl: string,
  chunkBuffer: Buffer | Uint8Array,
  rangeStart: number,
  rangeEnd: number,
  totalBytes: number
): Promise<{ isComplete: boolean; file?: any; nextRangeStart?: number }> {
  const contentLength = rangeEnd - rangeStart + 1;
  const contentRange = `bytes ${rangeStart}-${rangeEnd}/${totalBytes}`;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': contentLength.toString(),
      'Content-Range': contentRange,
    },
    body: chunkBuffer as any,
  });

  if (res.status === 200 || res.status === 201) {
    // Upload finished! File metadata returned
    const file = await res.json();
    return { isComplete: true, file };
  }

  if (res.status === 308) {
    // Resume Incomplete (standard Google Drive response for chunk received)
    const rangeHeader = res.headers.get('Range');
    let nextStart = rangeEnd + 1;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=0-(\d+)/);
      if (match) {
        nextStart = parseInt(match[1], 10) + 1;
      }
    }
    return { isComplete: false, nextRangeStart: nextStart };
  }

  const errText = await res.text();
  throw new Error(`Drive chunk upload failed with HTTP ${res.status}: ${errText}`);
}

/**
 * Fetches file metadata from Google Drive
 */
export async function getDriveFileMetadata(fileId: string): Promise<any> {
  const accessToken = await getValidDriveAccessToken();
  const res = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size,md5Checksum,createdTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Drive file not found or inaccessible: ${res.status}`);
  }

  return await res.json();
}

/**
 * Streams or downloads file bytes directly from Google Drive (for authenticated media gateway)
 */
export async function fetchDriveMediaStream(
  fileId: string,
  rangeHeader?: string | null
): Promise<{ status: number; headers: Record<string, string>; body: ReadableStream<Uint8Array> | null }> {
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
  res.headers.forEach((val, key) => {
    responseHeaders[key] = val;
  });

  return {
    status: res.status,
    headers: responseHeaders,
    body: res.body,
  };
}

/**
 * Deletes a file from Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const accessToken = await getValidDriveAccessToken();
  await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Retrieves the central Google Account storage quota details from Drive API
 */
export async function getCentralGoogleAccountStorage(): Promise<{
  limitBytes: number | null;
  usageBytes: number | null;
  usageInDriveBytes: number | null;
  usageInDriveTrashBytes: number | null;
}> {
  try {
    const accessToken = await getValidDriveAccessToken();
    const res = await fetch(`${GOOGLE_DRIVE_API_BASE}/about?fields=storageQuota,user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const quota = data.storageQuota || {};
      return {
        limitBytes: quota.limit ? parseInt(quota.limit, 10) : null,
        usageBytes: quota.usage ? parseInt(quota.usage, 10) : null,
        usageInDriveBytes: quota.usageInDrive ? parseInt(quota.usageInDrive, 10) : null,
        usageInDriveTrashBytes: quota.usageInDriveTrash ? parseInt(quota.usageInDriveTrash, 10) : null,
      };
    }
  } catch {}

  return {
    limitBytes: null,
    usageBytes: null,
    usageInDriveBytes: null,
    usageInDriveTrashBytes: null,
  };
}
