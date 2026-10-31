import { NextRequest, NextResponse } from 'next/server';
import { forwardChunkToDrive } from '@/lib/drive/googleDriveService';
import { serverUploadSessions } from '../session/route';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const uploadSessionId = searchParams.get('sessionId') || req.headers.get('x-upload-session-id');

    if (!uploadSessionId) {
      return NextResponse.json({ error: 'Missing uploadSessionId parameter.' }, { status: 400 });
    }

    // Resolve upload session
    let session = serverUploadSessions.get(uploadSessionId);
    if (!session && isFirebaseConfigured()) {
      try {
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, 'uploadSessions', uploadSessionId));
        if (snap.exists()) {
          session = snap.data() as any;
          if (session) serverUploadSessions.set(uploadSessionId, session);
        }
      } catch {}
    }

    if (!session) {
      return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 404 });
    }

    const contentRange = req.headers.get('content-range');
    if (!contentRange) {
      return NextResponse.json({ error: 'Missing Content-Range header.' }, { status: 400 });
    }

    const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (!match) {
      return NextResponse.json({ error: 'Malformed Content-Range header.' }, { status: 400 });
    }

    const rangeStart = parseInt(match[1], 10);
    const rangeEnd = parseInt(match[2], 10);
    const totalBytes = parseInt(match[3], 10);

    const chunkArrayBuffer = await req.arrayBuffer();
    const chunkBuffer = Buffer.from(chunkArrayBuffer);

    // If using mock/dev session
    if (session.driveUploadUrl.startsWith('mock-drive-session://')) {
      const isComplete = rangeEnd + 1 >= totalBytes;
      return NextResponse.json({
        success: true,
        isComplete,
        nextRangeStart: isComplete ? totalBytes : rangeEnd + 1,
        file: isComplete ? { id: `drive_file_${uploadSessionId}`, name: session.fileName } : null,
      });
    }

    // Forward chunk to Google Drive resumable session
    const forwardResult = await forwardChunkToDrive(
      session.driveUploadUrl,
      chunkBuffer,
      rangeStart,
      rangeEnd,
      totalBytes
    );

    return NextResponse.json({
      success: true,
      isComplete: forwardResult.isComplete,
      nextRangeStart: forwardResult.nextRangeStart,
      file: forwardResult.file || null,
    });
  } catch (err: any) {
    console.error('[Chunk Upload Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process media chunk.' },
      { status: 500 }
    );
  }
}
