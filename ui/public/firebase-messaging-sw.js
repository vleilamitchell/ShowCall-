/* global self */
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Initialize app from injected config at build time if available
// You may inline config or fetch from /firebase-config.json
self.firebaseConfig = self.firebaseConfig || null;

// This worker expects the hosting app to preload firebase-config.json in window scope; otherwise push may only work when app is open

try {
  // no-op initialization; the app context is required for messaging to attach
  // In many setups, messaging in SW is optional; we rely on foreground onMessage handler
} catch (e) {}


