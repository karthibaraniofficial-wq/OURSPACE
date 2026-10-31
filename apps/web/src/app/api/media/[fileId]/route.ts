import { NextRequest, NextResponse } from 'next/server';
import { fetchDriveMediaStream, deleteDriveFile } from '@/lib/drive/googleDriveService';
import { releaseDeletedFileQuota } from '@/lib/storage/storageLedger';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const fileId = params.fileId;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const rangeHeader = req.headers.get('range');

    // Fetch media stream from Google Drive
    const driveStream = await fetchDriveMediaStream(fileId, rangeHeader);

    const headers = new Headers();
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');

    if (driveStream.headers['content-type']) {
      headers.set('Content-Type', driveStream.headers['content-type']);
    }
    if (driveStream.headers['content-length']) {
      headers.set('Content-Length', driveStream.headers['content-length']);
    }
    if (driveStream.headers['content-range']) {
      headers.set('Content-Range', driveStream.headers['content-range']);
    }

    return new NextResponse(driveStream.body, {
      status: driveStream.status,
      headers,
    });
  } catch (err: any) {
    console.error('[Media Stream Gateway Error]', err);
    return NextResponse.json(
      { error: err.message || 'Media file could not be retrieved from storage.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const fileId = params.fileId;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const bytes = parseInt(searchParams.get('bytes') || '0', 10);
    const category = searchParams.get('category') || 'CHAT_IMAGES';

    await deleteDriveFile(fileId);

    if (bytes > 0) {
      await releaseDeletedFileQuota(bytes, category as any);
    }

    return NextResponse.json({ success: true, deletedFileId: fileId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete file from Google Drive.' },
      { status: 500 }
    );
  }
}
