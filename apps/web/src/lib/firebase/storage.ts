import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { getFirebaseStorageInstance } from './firebase';

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export async function uploadMediaToFirebaseStorage(
  spaceId: string,
  category: 'image' | 'video' | 'document' | 'audio',
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  // Validate file size (50MB)
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File size exceeds the 50MB limit.');
  }

  const storage = getFirebaseStorageInstance();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `spaces/${spaceId}/${category}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(Math.round(progress));
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          downloadUrl,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
      }
    );
  });
}

export async function deleteMediaFromFirebaseStorage(storagePath: string): Promise<void> {
  const storage = getFirebaseStorageInstance();
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
}
