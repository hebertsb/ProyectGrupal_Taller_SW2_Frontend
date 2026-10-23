import { useState } from 'react';

/**
 * Foto de una persona dentro de un círculo. Si no tiene foto, o la imagen no carga, muestra un ícono
 * en su lugar (así nunca queda un hueco ni la imagen rota). `clase` fija el tamaño (ej. `w-9 h-9`).
 */
export default function AvatarUsuario({ url = null, icono = 'person', clase = 'w-9 h-9' }) {
  const [rota, setRota] = useState(false);
  return (
    <div
      className={`${clase} rounded-full bg-surface-bright flex items-center justify-center text-primary overflow-hidden shrink-0`}
    >
      {url && !rota ? (
        <img src={url} alt="" className="w-full h-full object-cover" onError={() => setRota(true)} />
      ) : (
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {icono}
        </span>
      )}
    </div>
  );
}
