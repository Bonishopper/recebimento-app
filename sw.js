'use strict';

const VERSION = 'recebimento-fresh-v2';
const CACHE_NAME = `${VERSION}-shell`;
const APP_PREFIX = 'recebimento-fresh-';
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
const INDEX_PATH = new URL('./index.html', self.registration.scope).pathname;
const ROOT_PATH = new URL('./', self.registration.scope).pathname;
const INDEX_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith(APP_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirstIndex(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INDEX_TIMEOUT_MS);
  try {
    const response = await fetch(request, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Network returned HTTP ${response.status}`);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true }) ||
      await caches.match('./index.html');
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const inScope = requestUrl.pathname.startsWith(new URL(self.registration.scope).pathname);
  if (!inScope) return;

  if (request.mode === 'navigate' ||
      requestUrl.pathname === INDEX_PATH ||
      requestUrl.pathname === ROOT_PATH) {
    event.respondWith(networkFirstIndex(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
