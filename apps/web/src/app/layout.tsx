import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OURSPACE — Private Couple Communication & Connection Platform',
  description:
    'A secure, synchronized private digital sanctuary for two. Real-time chat, HD audio/video calling, shared memories, media vault, and reminders.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f43f5e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-cream-50 dark:bg-[#0F0E13] text-stone-900 dark:text-zinc-100 antialiased selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
