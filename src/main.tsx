import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: solo para que el navegador ofrezca "Instalar" (ver public/sw.js, no guarda nada en caché).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Si falla (ej. navegador viejo), la web sigue funcionando normal, solo sin la opción de instalar.
    });
  });
}
