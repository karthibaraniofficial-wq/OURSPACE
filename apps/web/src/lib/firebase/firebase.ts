import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

export interface FirebaseConfigStatus {
  isConfigured: boolean;
  isProduction: boolean;
  projectId: string | null;
  storageBucket: string | null;
  missingFields: string[];
  errors: string[];
}

const rawApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const rawAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const rawProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const rawStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const rawMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const rawAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const rawMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

const isProd = process.env.NODE_ENV === 'production';

// Strict validation helper
export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const missingFields: string[] = [];
  const errors: string[] = [];

  if (!rawApiKey || rawApiKey.includes('MockKey') || rawApiKey.includes('your-api-key')) {
    missingFields.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  }
  if (!rawAuthDomain) missingFields.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!rawProjectId) missingFields.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!rawStorageBucket) missingFields.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!rawMessagingSenderId) missingFields.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!rawAppId) missingFields.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  // Verify consistency if project ID exists
  if (rawProjectId) {
    if (rawAuthDomain && !rawAuthDomain.includes(rawProjectId)) {
      errors.push(`authDomain (${rawAuthDomain}) does not match projectId (${rawProjectId})`);
    }
    if (rawStorageBucket && !rawStorageBucket.includes(rawProjectId)) {
      errors.push(`storageBucket (${rawStorageBucket}) does not match projectId (${rawProjectId})`);
    }
  }

  const isConfigured = missingFields.length === 0 && errors.length === 0;

  return {
    isConfigured,
    isProduction: isProd,
    projectId: rawProjectId || null,
    storageBucket: rawStorageBucket || null,
    missingFields,
    errors,
  };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfigStatus().isConfigured;
}

// In production, NEVER silently fall back to mock project values.
// In development without credentials, provide mock values only to allow local component rendering.
export const firebaseConfig = {
  apiKey: rawApiKey || (isProd ? '' : 'AIzaSyMockKeyForDev123456789'),
  authDomain: rawAuthDomain || (isProd ? '' : 'ourspace-dev.firebaseapp.com'),
  projectId: rawProjectId || (isProd ? '' : 'ourspace-dev'),
  storageBucket: rawStorageBucket || (isProd ? '' : 'ourspace-dev.appspot.com'),
  messagingSenderId: rawMessagingSenderId || (isProd ? '' : '123456789012'),
  appId: rawAppId || (isProd ? '' : '1:123456789012:web:mockAppIdForDev'),
  measurementId: rawMeasurementId,
};

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApp();
    return cachedApp;
  }

  const status = getFirebaseConfigStatus();
  if (isProd && !status.isConfigured) {
    const errorDetails = [
      status.missingFields.length > 0 ? `Missing: ${status.missingFields.join(', ')}` : '',
      status.errors.length > 0 ? `Errors: ${status.errors.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    console.error(`[Firebase Configuration Error] Production configuration is invalid: ${errorDetails}`);
  }

  cachedApp = initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorageInstance(customBucket?: string): FirebaseStorage {
  const app = getFirebaseApp();
  const bucketName = customBucket || firebaseConfig.storageBucket;
  if (bucketName && !bucketName.includes('ourspace-dev')) {
    // Normalize bucket URL with gs:// scheme if not present
    const normalizedBucket = bucketName.startsWith('gs://') ? bucketName : `gs://${bucketName}`;
    return getStorage(app, normalizedBucket);
  }
  return getStorage(app);
}

export function getFirebaseFunctions(region = 'us-central1'): Functions {
  return getFunctions(getFirebaseApp(), region);
}
