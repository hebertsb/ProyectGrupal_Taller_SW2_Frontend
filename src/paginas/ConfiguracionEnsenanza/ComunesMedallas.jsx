/**
 * Piezas visuales que comparten los componentes de "Crear medallas propias": clases de botones y campos (las mismas que
 * usan FiguritasMedallas.jsx y PanelCursos.jsx), avisos de error / listo / atención, el indicador de carga y el número
 * que une cada campo del formulario con su marcador en el boceto.
 */

const BOTON_BASE =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-sm min-h-11 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
export const BOTON_PRINCIPAL = `${BOTON_BASE} bg-primary text-on-primary font-medium hover:bg-primary-fixed`;
export const BOTON_SECUNDARIO = `${BOTON_BASE} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
export const BOTON_PELIGRO = `${BOTON_BASE} bg-error/10 hover:bg-error/20 text-error`;

export const CLASE_INPUT =
  'w-full px-space-sm py-space-xs min-h-11 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
export const CLASE_ETIQUETA = 'font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant';
export const CLASE_AYUDA = 'm-0 font-mono-micro text-mono-micro text-on-surface-variant';

/** Colores del giro sobre un botón principal (fondo `primary`). */
export const GIRO_SOBRE_PRINCIPAL = 'border-on-primary/30 border-t-on-primary';

/** Giro de "cargando" (se detiene con `prefers-reduced-motion`). `colores` son las clases de borde del giro. */
export function Giro({ colores = 'border-primary/30 border-t-primary' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-4 h-4 shrink-0 border-2 rounded-full animate-spin motion-reduce:animate-none ${colores}`}
    />
  );
}

export function Cargando({ texto }) {
  return (
    <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
      <Giro />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

/** Error con `role="alert"` para que un lector de pantalla lo anuncie. El mensaje del backend va tal cual. */
export function AvisoError({ mensaje, icono = 'error' }) {
  return (
    <div
      role="alert"
      className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-start gap-space-xs"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        {icono}
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

export function AvisoListo({ mensaje }) {
  return (
    <div
      role="status"
      className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-start gap-space-xs"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        check_circle
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

/** Texto de ayuda con ícono de información. */
export function CajaInfo({ children }) {
  return (
    <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container border border-outline-variant/30">
      <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5" aria-hidden="true">
        info
      </span>
      <div className="min-w-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{children}</div>
    </div>
  );
}

export function BotonReintentar({ alTocar, deshabilitado = false }) {
  return (
    <button type="button" onClick={alTocar} disabled={deshabilitado} className={`${BOTON_SECUNDARIO} self-start`}>
      <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
        refresh
      </span>
      Reintentar
    </button>
  );
}

/**
 * Número 1 a 4 en un círculo: el mismo que lleva el marcador de esa parte en el boceto, para que se relacionen. Es
 * decorativo: el nombre del campo ya dice de qué se trata.
 */
export function NumeroCampo({ numero }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-primary text-on-primary font-mono-micro text-mono-micro font-semibold"
    >
      {numero}
    </span>
  );
}
