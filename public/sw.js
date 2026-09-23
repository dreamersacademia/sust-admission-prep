// Deliberately does almost nothing — no caching of pages or API
// responses. An exam app must never risk showing a stale cached exam or
// result page; the whole "no bypass, strict duration" design this app
// is built around would be undermined by a service worker quietly
// serving an old version. This exists ONLY to satisfy the technical
// "installable PWA" requirement — real offline support is a separate,
// deliberate decision to make later if actually needed.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // no-op — every request goes to the network exactly as if there were
  // no service worker at all
});