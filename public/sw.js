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
  // Los pedidos a otros dominios (las fuentes de Google, el acceso con Google) se dejan al navegador: si el service
  // worker los hace con fetch(), se rigen por `connect-src` de la política de seguridad, que no los permite, y fallan
  // (los íconos se veían como texto: «light_mode», «logout»...). Sin respondWith, el navegador los pide normalmente.
  if (new URL(evento.request.url).origin !== self.location.origin) return;
  evento.respondWith(fetch(evento.request));
});
