/**
 * Ambient type definitions for packages with non-standard distribution or hoisted dependencies
 */

declare module 'livekit-client' {
  export class Room {
    constructor(options?: any);
    connect(url: string, token: string, options?: any): Promise<void>;
    disconnect(): Promise<void>;
    localParticipant: any;
    remoteParticipants: Map<string, any>;
    on(event: any, handler: Function): this;
    off(event: any, handler: Function): this;
    state: any;
    name: string;
    canPlaybackAudio: boolean;
    startAudio(): Promise<void>;
  }
  export const RoomEvent: Record<string, any>;
  export const Track: {
    Source: {
      Camera: string;
      Microphone: string;
      ScreenShare: string;
      ScreenShareAudio: string;
      Unknown: string;
    };
    Kind: {
      Audio: string;
      Video: string;
      Unknown: string;
    };
  };
  export const ConnectionState: Record<string, any>;
  export type RemoteTrack = any;
  export type RemoteTrackPublication = any;
  export type RemoteParticipant = any;
}

declare module 'firebase/functions' {
  import { FirebaseApp } from 'firebase/app';
  export interface Functions {
    app: FirebaseApp;
    customDomain: string | null;
    region: string;
  }
  export function getFunctions(app?: FirebaseApp, regionOrCustomDomain?: string): Functions;
  export function httpsCallable<RequestData = unknown, ResponseData = unknown>(
    functions: Functions,
    name: string,
    options?: any
  ): (data?: RequestData) => Promise<{ data: ResponseData }>;
  export function connectFunctionsEmulator(functions: Functions, host: string, port: number): void;
}

declare module 'firebase/messaging' {
  import { FirebaseApp } from 'firebase/app';
  export interface Messaging {
    app: FirebaseApp;
  }
  export function getMessaging(app?: FirebaseApp): Messaging;
  export function getToken(messaging: Messaging, options?: any): Promise<string>;
  export function onMessage(messaging: Messaging, nextOrObserver: any): () => void;
  export function isSupported(): Promise<boolean>;
}

declare module 'tailwind-merge' {
  export function twMerge(...classLists: any[]): string;
}
