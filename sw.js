/* Pizarra de Apuntes: funciona sin internet.
   - La página se pide primero a internet (para recibir siempre la versión nueva) y, si no hay conexión, se usa la copia guardada.
   - Librerías y fuentes se guardan la primera vez que se usan y luego se leen del dispositivo. */
const VERSION = 'pizarra-v15';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'lib/jspdf.umd.min.js', 'lib/pdf.min.js', 'lib/pdf.worker.min.js'
];
const EXTRA = ['lib/html2canvas.min.js', 'lib/jszip.min.js', 'lib/docx-preview.min.js', 'lib/xlsx.full.min.js', 'lib/pptxgen.bundle.js', 'lib/qrcode.js'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    cache.addAll(EXTRA).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isPage(req) { return req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname); }

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // el reconocedor de escritura siempre va a internet
  if (url.hostname === 'inputtools.google.com') return;

  if (url.origin === location.origin && isPage(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(req, { signal: ctrl.signal, cache: 'no-cache' });
        clearTimeout(t);
        if (res.ok) cache.put('index.html', res.clone());
        return res;
      } catch (e) {
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  const cacheable = url.origin === location.origin || ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(url.hostname);
  if (!cacheable) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { if (url.hostname === 'fonts.googleapis.com') event.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
