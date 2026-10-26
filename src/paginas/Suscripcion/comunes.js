import { fechaDesdeIso } from '../../formatoTiempo';

/** Textos y colores del estado de una suscripción (`prueba`, `activa` o `vencida`). */
export const ESTADOS = {
  prueba: { texto: 'Prueba gratis', clase: 'bg-tertiary-container text-tertiary', icono: 'hourglass_top' },
  activa: { texto: 'Activa', clase: 'bg-primary-container text-primary', icono: 'check_circle' },
  vencida: { texto: 'Vencida', clase: 'bg-error-container text-error', icono: 'error' },
};

export const ESTADOS_PAGO = {
  pendiente: { texto: 'Esperando confirmación', clase: 'bg-tertiary-container text-tertiary' },
  confirmado: { texto: 'Confirmado', clase: 'bg-primary-container text-primary' },
  rechazado: { texto: 'Rechazado', clase: 'bg-error-container text-error' },
};

export const NOMBRE_DEL_CICLO = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' };

export const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const BASE_BOTON =
  'flex items-center justify-center gap-1 px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
export const BOTON_PRINCIPAL = `${BASE_BOTON} bg-primary text-on-primary font-medium hover:brightness-110`;
export const BOTON_NEUTRO = `${BASE_BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
export const BOTON_PELIGRO = `${BASE_BOTON} bg-error/10 hover:bg-error/20 text-error`;
export const CLASE_ETIQUETA = 'font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant';

/** `1350` → `Bs 1.350`. */
export function bs(monto) {
  const numero = Number(monto) || 0;
  return `Bs ${numero.toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;
}

/** Una fecha ISO del servidor, en formato corto del lugar. */
export function fechaCorta(iso) {
  return fechaDesdeIso(iso)?.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';
}

export function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}
