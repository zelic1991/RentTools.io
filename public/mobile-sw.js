self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// V1 deliberately has no offline cache and no write queue. The worker exists
// only to support installation on browsers that still require a service worker
// for Add-to-Home-Screen eligibility.
