/**
 * OURSPACE V2.4.2 — Legacy Media Recovery Utility
 * Safely inspects, audits, and recovers legacy attachments in Firestore.
 * Supports Base64/Data-URL migration to Firebase Storage with Dry-Run mode.
 */

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';
import { uploadMediaToFirebaseStorage, resolveMediaDownloadUrl } from './storage';
import { logMediaDiagnostic } from '@/lib/diagnostics/mediaDiagnostics';
import type { Message, MessageAttachment } from '@ourspace/types';

export type AttachmentStatus =
  | 'VALID_STORAGE'
  | 'DATA_URL'
  | 'EXPIRED_SIGNED_URL'
  | 'BLOB_URL'
  | 'ORPHANED_PATH'
  | 'CORRUPTED';

export interface AuditAttachmentResult {
  messageId: string;
  senderId: string;
  createdAt: string;
  attachmentId: string;
  fileName: string;
  status: AttachmentStatus;
  details: string;
  isRecoverable: boolean;
}

export interface MediaRecoveryReport {
  spaceId: string;
  totalMessagesScanned: number;
  totalAttachmentsScanned: number;
  healthyCount: number;
  recoverableCount: number;
  unrecoverableCount: number;
  auditItems: AuditAttachmentResult[];
}

/**
 * Scan all messages in a space conversation to audit media health.
 */
export async function auditSpaceMediaAttachments(spaceId: string): Promise<MediaRecoveryReport> {
  const db = getFirestoreInstance();
  const msgsRef = collection(db, 'privateSpaces', spaceId, 'conversations', 'main', 'messages');
  const snapshot = await getDocs(msgsRef);

  const report: MediaRecoveryReport = {
    spaceId,
    totalMessagesScanned: snapshot.size,
    totalAttachmentsScanned: 0,
    healthyCount: 0,
    recoverableCount: 0,
    unrecoverableCount: 0,
    auditItems: [],
  };

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Partial<Message>;
    const attachments = (data.attachments || []) as MessageAttachment[];

    attachments.forEach((att) => {
      report.totalAttachmentsScanned += 1;
      const attPath = att.storage_path || att.file_path || '';
      const attUrl = att.download_url || att.signed_url || '';

      let status: AttachmentStatus = 'VALID_STORAGE';
      let details = 'Valid Firebase Storage reference';
      let isRecoverable = false;

      if (attUrl.startsWith('data:') || (attPath && attPath.startsWith('data:'))) {
        status = 'DATA_URL';
        details = 'Base64 data embedded directly in document; can be migrated to Cloud Storage.';
        isRecoverable = true;
      } else if (attUrl.startsWith('blob:') || (attPath && attPath.startsWith('blob:'))) {
        status = 'BLOB_URL';
        details = 'Temporary browser Blob URL; ephemeral and not recoverable across sessions.';
        isRecoverable = false;
      } else if (attPath && attPath.startsWith('spaces/')) {
        status = 'VALID_STORAGE';
        details = 'Canonical Cloud Storage path present.';
      } else if (attUrl && attUrl.startsWith('https://firebasestorage.googleapis.com')) {
        status = 'VALID_STORAGE';
        details = 'Valid Firebase Storage download URL.';
      } else if (attUrl && attUrl.startsWith('http')) {
        status = 'EXPIRED_SIGNED_URL';
        details = 'Legacy remote URL without canonical storage path.';
        isRecoverable = false;
      } else {
        status = 'CORRUPTED';
        details = 'No valid URL or Storage path found.';
        isRecoverable = false;
      }

      if (status === 'VALID_STORAGE') {
        report.healthyCount += 1;
      } else if (isRecoverable) {
        report.recoverableCount += 1;
      } else {
        report.unrecoverableCount += 1;
      }

      report.auditItems.push({
        messageId: docSnap.id,
        senderId: data.sender_id || 'unknown',
        createdAt: data.created_at || new Date().toISOString(),
        attachmentId: att.id || 'unknown',
        fileName: att.file_name || 'unnamed',
        status,
        details,
        isRecoverable,
      });
    });
  });

  return report;
}

/**
 * Safely convert a base64 Data URL to a File object.
 */
function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
}

/**
 * Migrate recoverable Data URL attachments to Firebase Storage.
 * @param dryRun If true, previews changes without writing to Firestore or Storage.
 */
export async function migrateRecoverableAttachments(
  spaceId: string,
  dryRun = true
): Promise<{
  successCount: number;
  failureCount: number;
  migratedLog: Array<{ messageId: string; fileName: string; newStoragePath?: string }>;
}> {
  const audit = await auditSpaceMediaAttachments(spaceId);
  const recoverable = audit.auditItems.filter((i) => i.isRecoverable);

  const result = {
    successCount: 0,
    failureCount: 0,
    migratedLog: [] as Array<{ messageId: string; fileName: string; newStoragePath?: string }>,
  };

  if (dryRun) {
    recoverable.forEach((item) => {
      result.migratedLog.push({
        messageId: item.messageId,
        fileName: item.fileName,
        newStoragePath: `[DRY-RUN] spaces/${spaceId}/images/${item.senderId}/${item.fileName}`,
      });
    });
    result.successCount = recoverable.length;
    return result;
  }

  const db = getFirestoreInstance();

  for (const item of recoverable) {
    try {
      const msgRef = doc(db, 'privateSpaces', spaceId, 'conversations', 'main', 'messages', item.messageId);
      // Fetch fresh message
      const snapshot = await getDocs(
        collection(db, 'privateSpaces', spaceId, 'conversations', 'main', 'messages')
      );
      const targetDoc = snapshot.docs.find((d) => d.id === item.messageId);
      if (!targetDoc) continue;

      const data = targetDoc.data() as Message;
      const attachments = (data.attachments || []) as MessageAttachment[];

      let updated = false;
      const newAttachments: MessageAttachment[] = [];

      for (const att of attachments) {
        const dataUrlCandidate = att.download_url || att.signed_url || att.file_path;
        if (dataUrlCandidate && dataUrlCandidate.startsWith('data:')) {
          const file = dataUrlToFile(dataUrlCandidate, att.file_name || `recovered_${Date.now()}.jpg`);
          const uploadRes = await uploadMediaToFirebaseStorage(
            spaceId,
            'image',
            file,
            undefined,
            item.senderId
          );

          newAttachments.push({
            ...att,
            storage_path: uploadRes.storagePath,
            file_path: uploadRes.storagePath,
            download_url: uploadRes.downloadUrl,
            signed_url: uploadRes.downloadUrl,
            file_size: uploadRes.fileSize,
            file_type: uploadRes.fileType,
          });
          updated = true;
          result.migratedLog.push({
            messageId: item.messageId,
            fileName: att.file_name,
            newStoragePath: uploadRes.storagePath,
          });
        } else {
          newAttachments.push(att);
        }
      }

      if (updated) {
        await updateDoc(msgRef, {
          attachments: newAttachments,
          updated_at: new Date().toISOString(),
        });
        result.successCount += 1;
      }
    } catch (err) {
      result.failureCount += 1;
      console.error(`[Media Recovery] Failed to migrate message ${item.messageId}:`, err);
    }
  }

  return result;
}
