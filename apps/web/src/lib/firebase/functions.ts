import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './firebase';

export async function callFirebaseFunction<TReq = unknown, TRes = unknown>(
  functionName: string,
  data: TReq
): Promise<TRes> {
  const functions = getFunctions(getFirebaseApp());
  const callable = httpsCallable<TReq, TRes>(functions, functionName);
  const result = await callable(data);
  return result.data;
}
