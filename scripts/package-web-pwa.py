#!/usr/bin/env python3
"""
OURSPACE v2.3.0 Web PWA Package Builder
Creates a complete installable Progressive Web App distribution zip bundle.
"""

import os
import zipfile
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIST_DIR = os.path.join(BASE_DIR, "apppackage", "web")
ASSETS_DIR = os.path.join(BASE_DIR, "apppackage", "assets")

os.makedirs(WEB_DIST_DIR, exist_ok=True)

# 1. PWA Manifest
pwa_manifest = {
    "name": "OURSPACE — Two Hearts. One Private Digital World.",
    "short_name": "OURSPACE",
    "description": "Private, real-time sanctuary for couples with messaging, calls, albums, and encrypted locker.",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#FAF8F5",
    "theme_color": "#E11D48",
    "orientation": "portrait-primary",
    "icons": [
        {
            "src": "icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icons/icon-maskable-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
        }
    ],
    "categories": ["social", "lifestyle", "productivity"],
    "shortcuts": [
        {
            "name": "Chat",
            "url": "/dashboard/chat",
            "description": "Open private couple conversation"
        },
        {
            "name": "Memory Albums",
            "url": "/dashboard/albums",
            "description": "View shared memory albums"
        },
        {
            "name": "OUR LOCKER",
            "url": "/dashboard/locker",
            "description": "Access encrypted private vault"
        }
    ]
}

# 2. Service Worker with Cache & Offline Fallback
service_worker = """/**
 * OURSPACE v2.3.0 Service Worker
 * Provides offline caching, network resilience, and background FCM push alerts.
 */

const CACHE_NAME = 'ourspace-shell-v2.3.0';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((networkResponse) => {
          return networkResponse;
        })
      );
    })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'OURSPACE Alert';
  const options = {
    body: data.body || 'You have a new private update from your partner.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/dashboard' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/dashboard')
  );
});
"""

# 3. Romantic Offline HTML Interface
offline_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>OURSPACE — Offline Sanctuary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #FFF1F2 0%, #FAF8F5 50%, #FFE4E6 100%);
      color: #1F2937;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(244, 63, 94, 0.2);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(225, 29, 72, 0.08);
    }
    .heart-badge {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
      background: #FFE4E6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #E11D48;
      font-size: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.75rem;
    }
    p {
      color: #6B7280;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 0.875rem 1.5rem;
      background: #E11D48;
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 0.75rem;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #BE123C;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="heart-badge">♥</div>
    <h1>You're Currently Offline</h1>
    <p>Your private couple memories and conversations are safely preserved. We'll automatically reconnect to your partner once your connection returns.</p>
    <button class="btn" onclick="window.location.reload()">Check Connection</button>
  </div>
</body>
</html>
"""

# Read icons
icon_192_path = os.path.join(ASSETS_DIR, "icons", "android", "icon-192.png")
icon_512_path = os.path.join(ASSETS_DIR, "icons", "android", "icon-512.png")

with open(icon_192_path, "rb") as f:
    icon_192_data = f.read()
with open(icon_512_path, "rb") as f:
    icon_512_data = f.read()

# Package PWA zip
pwa_zip_path = os.path.join(WEB_DIST_DIR, "OURSPACE-Web-PWA-v2.3.0.zip")
with zipfile.ZipFile(pwa_zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(pwa_manifest, indent=2))
    z.writestr("sw.js", service_worker)
    z.writestr("offline.html", offline_html)
    z.writestr("icons/icon-192.png", icon_192_data)
    z.writestr("icons/icon-512.png", icon_512_data)
    z.writestr("icons/icon-maskable-512.png", icon_512_data)

print(f"Successfully generated Web PWA bundle: {pwa_zip_path} ({os.path.getsize(pwa_zip_path)} bytes)")
