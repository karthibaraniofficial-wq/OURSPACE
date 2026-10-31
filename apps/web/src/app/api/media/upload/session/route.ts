import { NextRequest, NextResponse } from 'next/server';
import {
  resolveDestinationDriveFolder,
  createDriveResumableUploadSession,
} from '@/lib/drive/googleDriveService';
import { reserveStorageQuota, StorageQuotaExceededError } from '@/lib/storage/storageLedger';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';

function extractFirebaseUid(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (token === 'authorized-space-member' || token === 'mock-token') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.iss && payload.iss.includes('securetoken.google.com') && payload.sub) {
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;
      return payload.sub as string;
    }
  } catch {}
  return null;
}

// In-memory session cache for fast serverless chunk routing
export const serverUploadSessions = new Map<
  string,
  {
    uploadSessionId: string;
    driveUploadUrl: string;
    spaceId: string;
    userId: string;
    category: string;
    fileName: string;
    fileSize: number;
    reservationId: string;
    expiresAt: number;
  }
>();

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const isProd = process.env.NODE_ENV === 'production';
    const verifiedUid = extractFirebaseUid(authHeader);

    const body = await req.json();
    const { spaceId, category, fileName, fileSize, mimeType, userId } = body;

    const authoritativeUid = verifiedUid || userId;
    if (isProd && !authoritativeUid) {
      return NextResponse.json({ error: 'Unauthorized: Valid authentication token required.' }, { status: 401 });
    }

    if (!fileName || !fileSize || fileSize <= 0) {
      return NextResponse.json({ error: 'Invalid file metadata (fileName and fileSize are required).' }, { status: 400 });
    }

    const uploadSessionId = `upsess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const reservationId = `res_${uploadSessionId}`;

    // 1. Atomically reserve 250 GB storage quota
    try {
      await reserveStorageQuota(reservationId, fileSize, spaceId || 'general', authoritativeUid || 'user', category || 'CHAT_IMAGES');
    } catch (quotaErr) {
      if (quotaErr instanceof StorageQuotaExceededError) {
        return NextResponse.json(
          {
            error: quotaErr.message,
            code: 'STORAGE_QUOTA_EXCEEDED',
            availableBytes: quotaErr.availableBytes,
            requestedBytes: quotaErr.requestedBytes,
          },
          { status: 403 }
        );
      }
      throw quotaErr;
    }

    // 2. Resolve destination folder in Google Drive (OURSPACE_STORAGE/...)
    let parentFolderId: string;
    let driveUploadUrl = '';

    try {
      parentFolderId = await resolveDestinationDriveFolder(category || 'CHAT_IMAGES', spaceId, authoritativeUid);

      // 3. Initiate Google Drive resumable upload session
      const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}.enc`;
      const session = await createDriveResumableUploadSession(
        cleanFileName,
        'application/octet-stream',
        parentFolderId,
        fileSize
      );
      driveUploadUrl = session.uploadUrl;
    } catch (driveErr: any) {
      console.warn('[GoogleDrive] Drive session creation failed, using dev/fallback session:', driveErr.message);
      // In dev mode or when credentials pending, allow session creation with fallback
      if (isProd) {
        return NextResponse.json(
          { error: `Central Google Drive error: ${driveErr.message}` },
          { status: 503 }
        );
      }
      driveUploadUrl = `mock-drive-session://${uploadSessionId}`;
    }

    const sessionRecord = {
      uploadSessionId,
      driveUploadUrl,
      spaceId: spaceId || 'general',
      userId: authoritativeUid || 'user',
      category: category || 'CHAT_IMAGES',
      fileName,
      fileSize,
      reservationId,
      expiresAt: Date.now() + 3600_000,
    };

    serverUploadSessions.set(uploadSessionId, sessionRecord);

    if (isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, 'uploadSessions', uploadSessionId), sessionRecord);
      } catch {}
    }

    // Return session info to client (Google Drive internal upload URI is kept strictly server-side!)
    return NextResponse.json({
      success: true,
      uploadSessionId,
      chunkSize: 4 * 1024 * 1024, // 4MB chunks (within Vercel 4.5MB request limit)
      totalBytes: fileSize,
    });
  } catch (err: any) {
    console.error('[Upload Session Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize upload session.' },
      { status: 500 }
    );
  }
}
