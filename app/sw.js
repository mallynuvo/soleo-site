/* sw.js — Service Worker של Soleo (PWA).
   עיקרון על: לעולם לא מגישים קוד ישן. HTML/JS/CSS/נתונים תמיד מהרשת —
   ה-SW לא מתערב בהם בכלל (fall-through לרשת), כך שכל דיפלוי מגיע מיד.
   cache-first רק לנכסים סטטיים שלא משתנים (אייקונים/תמונות/פונטים). */

const SW_VERSION = 'soleo-sw-v1';
const STATIC_CACHE = SW_VERSION + '-static';

/* רק סיומות של נכסים סטטיים נכנסות למטמון */
const STATIC_RE = /\.(png|jpe?g|svg|gif|webp|ico|woff2?|ttf)$/i;

self.addEventListener('install', () => {
  /* גרסה חדשה נכנסת לפעולה מיד — בלי להמתין לסגירת טאבים */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    /* ניקוי מטמונים של גרסאות קודמות */
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  /* מטפלים רק בנכסים סטטיים מאותו origin; כל השאר — ישר לרשת (ברירת המחדל של הדפדפן) */
  if (url.origin !== self.location.origin || !STATIC_RE.test(url.pathname)) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res && res.ok) {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(req, res.clone());
      } catch { /* מטמון מלא/פרטי — לא חוסם את התשובה */ }
    }
    return res;
  })());
});
