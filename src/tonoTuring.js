/**
 * Tonos con los que Turing (el tutor) les habla a los jugadores. Es la única fuente de textos y etiquetas de los tres
 * tonos: la usan Configuración de Enseñanza (el tono del perfil del facilitador) y Mis cursos (el tono propio de cada
 * curso). Funciones puras, sin DOM.
 */

/** Mismos 3 valores que `PresetEnsenanza` en `backend/esquemas/auth_esquema.py`. */
export const PRESETS_TONO = [
  {
    id: 'infantil',
    nombre: 'Infantil',
    titulo: 'Modo Infantil',
    icono: 'child_care',
    descripcion: 'Frases cortas, con ánimo y sin números — para los más chicos.',
    ejemplo: '¡Cuidado! Tu torre en d5 quedó sola y el rival te la puede comer gratis.',
  },
  {
    id: 'estandar',
    nombre: 'Estándar',
    titulo: 'Modo Estándar',
    icono: 'balance',
    descripcion: 'El equilibrio de siempre: claro, ni muy infantil ni muy técnico.',
    ejemplo: 'Dejaste tu torre en d5 bajo ataque rival sin defensores suficientes.',
  },
  {
    id: 'adultos',
    nombre: 'Adultos',
    titulo: 'Modo Adultos',
    icono: 'school',
    descripcion: 'Vocabulario técnico y directo — para quien ya conoce los términos.',
    ejemplo: 'Pieza colgada: torre en d5 sin defensa suficiente ante el ataque rival.',
  },
];

/** Tono que usa Turing cuando ni el curso ni el facilitador eligieron uno (el mismo que el backend). */
export const TONO_POR_DEFECTO = 'estandar';

/** Valor que el backend entiende en `PATCH /cursos/{id}` como "este curso vuelve a heredar el tono del facilitador". */
export const TONO_HEREDADO = 'facilitador';

/** Presets de tono por `id`, para buscar el texto de un tono sin recorrer la lista. */
const PRESET_POR_ID = new Map(PRESETS_TONO.map((preset) => [preset.id, preset]));

/** Datos del tono (`nombre`, `descripcion`, …) o `null` si el `id` no es uno de los tres. */
export function buscarTono(id) {
  return PRESET_POR_ID.get(id) ?? null;
}

/** El `id` del tono propio de un curso para usarlo en un selector: `''` si hereda (o si el valor no se conoce). */
export function tonoPropioDeCurso(curso) {
  return PRESET_POR_ID.has(curso?.preset_ensenanza) ? curso.preset_ensenanza : '';
}

/**
 * Tono que realmente se usa en un curso y de dónde sale: `{ id, nombre, origen }`, con `origen`:
 * - `'curso'`: el curso tiene tono propio (`preset_ensenanza`).
 * - `'perfil'`: hereda el que eligió el facilitador en su perfil (`preset_efectivo`).
 * - `'defecto'`: nadie eligió uno, se usa `TONO_POR_DEFECTO`.
 */
export function tonoVigenteCurso(curso) {
  if (PRESET_POR_ID.has(curso?.preset_ensenanza)) {
    return { id: curso.preset_ensenanza, nombre: PRESET_POR_ID.get(curso.preset_ensenanza).nombre, origen: 'curso' };
  }
  if (PRESET_POR_ID.has(curso?.preset_efectivo)) {
    return { id: curso.preset_efectivo, nombre: PRESET_POR_ID.get(curso.preset_efectivo).nombre, origen: 'perfil' };
  }
  return { id: TONO_POR_DEFECTO, nombre: PRESET_POR_ID.get(TONO_POR_DEFECTO).nombre, origen: 'defecto' };
}
