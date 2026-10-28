// Entrada de la landing estática (`landing.html`): la misma página que ve la app sin sesión, sin login ni backend.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from '../paginas/Landing/Landing';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
