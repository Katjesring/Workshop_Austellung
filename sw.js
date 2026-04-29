const CACHE = 'zeitkapsel-v1';
const CACHE_TYPES = ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
    const url = e.request.url;
    if (!CACHE_TYPES.some(ext => url.includes(ext))) return;

    e.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(response => {
                    cache.put(e.request, response.clone());
                    return response;
                });
            })
        )
    );
});
