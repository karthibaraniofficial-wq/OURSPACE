import { NextRequest, NextResponse } from 'next/server';
import { getDriveFileMetadata } from '@/lib/drive/googleDriveService';
import { commitStorageQuota } from '@/lib/storage/storageLedger';
import { serverUploadSessions } from '../session/route';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uploadSessionId, driveFileId, manifest } = body;

    if (!uploadSessionId) {
      return NextResponse.json({ error: 'Missing uploadSessionId.' }, { status: 400 });
    }

    // Resolve upload session
    let session = serverUploadSessions.get(uploadSessionId);
    if (!session && isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, 'uploadSessions', uploadSessionId));
        if (snap.exists()) {
          session = snap.data() as any;
        }
      } catch {}
    }

    if (!session) {
      return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 404 });
    }

    const resolvedFileId = driveFileId || `drive_${uploadSessionId}`;
    let verifiedBytes = session.fileSize;

    // Verify actual file size on Google Drive if real file
    if (!session.driveUploadUrl.startsWith('mock-drive-session://') && driveFileId) {
      try {
        const metadata = await getDriveFileMetadata(driveFileId);
        if (metadata && metadata.size) {
          verifiedBytes = parseInt(metadata.size, 10);
        }
      } catch (metaErr) {
        console.warn('[GoogleDrive] Metadata verification warning:', metaErr);
      }
    }

    // Commit 250 GB storage quota reservation
    await commitStorageQuota(session.reservationId, verifiedBytes, session.category as any);

    // Save media metadata to Firestore
    if (isFirebaseConfigured() && session.spaceId) {
      try {
        const db = getFirebaseFirestore();
        const mediaRef = doc(db, 'privateSpaces', session.spaceId, 'mediaFiles', resolvedFileId);

        await setDoc(mediaRef, {
          id: resolvedFileId,
          spaceId: session.spaceId,
          uploadedBy: session.userId,
          fileName: session.fileName,
          fileSize: verifiedBytes,
          fileType: manifest?.file_type || 'application/octet-stream',
          mediaCategory: manifest?.media_category || 'image',
          storageProvider: 'GOOGLE_DRIVE',
          driveFileId: resolvedFileId,
          iv: manifest?.iv || null,
          wrappedKey: manifest?.wrapped_key || null,
          ciphertextSha256: manifest?.ciphertext_sha256 || null,
          isE2EE: Boolean(manifest?.is_e2ee),
          createdAt: serverTimestamp(),
        });
      } catch (saveErr) {
        console.warn('[MediaFinalize] Firestore metadata save error:', saveErr);
      }
    }

    // Cleanup session
    serverUploadSessions.delete(uploadSessionId);

    return NextResponse.json({
      success: true,
      fileId: resolvedFileId,
      downloadUrl: `/api/media/${resolvedFileId}`,
      verifiedBytes,
      fileName: session.fileName,
      category: session.category,
    });
  } catch (err: any) {
    console.error('[Upload Finalize Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to finalize media upload.' },
      { status: 500 }
    );
  }
}
