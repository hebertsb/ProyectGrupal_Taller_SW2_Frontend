/** Tipos de institución que acepta el backend (`tipo`), con el texto que se muestra y un ícono. */
export const TIPOS_INSTITUCION = [
  { valor: 'academia', etiqueta: 'Academia o asociación', icono: 'school' },
  { valor: 'colegio', etiqueta: 'Colegio', icono: 'domain' },
  { valor: 'organizador', etiqueta: 'Organizador de torneos', icono: 'emoji_events' },
];

export function datosDelTipo(valor) {
  return TIPOS_INSTITUCION.find((t) => t.valor === valor) ?? { valor, etiqueta: valor, icono: 'apartment' };
}

export function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

export const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const BASE_BOTON =
  'flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
export const BOTON_NEUTRO = `${BASE_BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
export const BOTON_PELIGRO = `${BASE_BOTON} bg-error/10 hover:bg-error/20 text-error`;
export const BOTON_PRINCIPAL = `${BASE_BOTON} bg-primary text-on-primary hover:bg-primary-fixed font-medium`;
export const CLASE_ETIQUETA = 'font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant';
