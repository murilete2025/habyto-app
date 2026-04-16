const CACHE_NAME = 'habyto-v1.1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/js/firebase-config.js',
  '/js/state.js',
  '/js/ui-controller.js',
  '/js/auth-module.js',
  '/js/diary-module.js',
  '/js/workout-module.js',
  '/js/diet-module.js',
  '/js/dashboard.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Cache First Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (response.status === 200) cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'bebi') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          // Se o app estiver aberto, envia mensagem
          clients[0].postMessage({ type: 'ADD_WATER' });
          clients[0].focus();
        } else {
          // Se o app estiver fechado, precisamos abrir e processar 
          // (ou poderíamos fazer via background sync, mas postMessage é mais simples aqui)
          self.clients.openWindow('/').then(client => {
             // Aguarda carregar e envia
             setTimeout(() => {
                client.postMessage({ type: 'ADD_WATER' });
             }, 3000);
          });
        }
      })
    );
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});
