import { useState } from 'react';

const CLAVE_DESCARTADO = 'aviso_doble_factor_descartado';

function yaDescartado() {
  try {
    return window.sessionStorage.getItem(CLAVE_DESCARTADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Franja que invita a los facilitadores a activar la verificación en dos pasos. Si el servidor la exige a la cuenta
 * (`obligatorio`), no se puede descartar; si no, se puede cerrar y vuelve a aparecer en la próxima sesión.
 */
export default function AvisoDobleFactor({ obligatorio, alActivar }) {
  const [descartado, setDescartado] = useState(yaDescartado);
  if (descartado && !obligatorio) return null;

  function descartar() {
    try {
      window.sessionStorage.setItem(CLAVE_DESCARTADO, '1');
    } catch {
      // sin sessionStorage: se cierra igual hasta recargar
    }
    setDescartado(true);
  }

  return (
    <div role="region" aria-label="Verificación en dos pasos" className="w-full px-space-lg py-space-sm bg-primary/10 border-b border-primary/30 flex flex-wrap items-center justify-between gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-center gap-space-xs min-w-0">
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">phonelink_lock</span>
        <span>
          <strong>{obligatorio ? 'Activá la verificación en dos pasos para seguir.' : 'Protegé tu cuenta.'}</strong>{' '}
          {obligatorio ? 'El servidor la exige a tu cuenta.' : 'Activá la verificación en dos pasos con una app de códigos.'}
        </span>
      </p>
      <div className="flex items-center gap-space-xs">
        <button type="button" onClick={alActivar} className="px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium">
          Activar ahora
        </button>
        {!obligatorio && (
          <button type="button" onClick={descartar} aria-label="Cerrar este aviso" className="min-w-10 min-h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
