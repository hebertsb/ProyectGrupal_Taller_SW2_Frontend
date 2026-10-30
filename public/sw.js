// Service worker mínimo, solo para que el navegador ofrezca "Instalar" (acceso directo con ícono y nombre
// propios). A propósito no guarda nada en caché: una partida en curso, el reloj o el tablero nunca deben
// mostrar un dato viejo. Cada pedido va directo a la red, igual que si no hubiera service worker.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evento) => {
  evento.respondWith(fetch(evento.request));
});
