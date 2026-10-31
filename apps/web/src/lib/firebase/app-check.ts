import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { getFirebaseApp } from './firebase';

let appCheckInstance: AppCheck | null = null;

export function initAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || appCheckInstance) return appCheckInstance;

  try {
    appCheckInstance = initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheckInstance;
  } catch (err) {
    console.warn('App Check initialization skipped:', err);
    return null;
  }
}
