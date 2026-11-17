/**
 * Reglas puras del onboarding educativo (HU12, CU07), separadas del componente para poder probarlas
 * sin navegador: la marca de «ya visto», la prueba final de la torre y el avance entre tarjetas.
 */

/** Casilla de la torre blanca al empezar la prueba final: a1 (fila 7, columna 0). */
export const CASILLA_INICIAL_TORRE = [7, 0];

/** Casilla del rey negro en la prueba final: e8 (fila 0, columna 4). */
export const CASILLA_REY_NEGRO = [0, 4];

/** `true` si las dos casillas, dadas como `[fila, columna]`, son la misma. */
export const mismaCasilla = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Clave con la que se recuerda, por usuario y en este navegador, que ya vio el onboarding. */
export function claveCompletado(usuarioId) {
  return `onboarding_completado_${usuarioId ?? 'anon'}`;
}

/** `true` si este usuario ya vio (o saltó) el onboarding en este navegador. */
export function onboardingCompletado(usuarioId) {
  try {
    return localStorage.getItem(claveCompletado(usuarioId)) === '1';
  } catch {
    return false;
  }
}

/** Marca el onboarding como visto; si el navegador no deja guardar, el tutorial puede volver a aparecer y no es crítico. */
export function marcarOnboardingCompletado(usuarioId) {
  try {
    localStorage.setItem(claveCompletado(usuarioId), '1');
  } catch {
    // Modo privado o cuota llena.
  }
}

/** Jugadas legales de la torre desde a1 en este tablero: por su fila (la primera) y por su columna (a). */
export const DESTINOS_TORRE = [
  ...Array.from({ length: 7 }, (_, i) => [7, i + 1]),
  ...Array.from({ length: 7 }, (_, i) => [i, 0]),
];

/** `true` si la torre llega a esa casilla en una jugada. */
export const esDestinoTorre = (casilla) => DESTINOS_TORRE.some((d) => mismaCasilla(d, casilla));

/** Da jaque si la torre queda en la fila del rey (la octava) o en su columna (e): el camino está libre. */
export const daJaque = ([fila, columna]) => fila === CASILLA_REY_NEGRO[0] || columna === CASILLA_REY_NEGRO[1];

/** Porcentaje de la barra de progreso al estar en la tarjeta `indice` (desde 0) de `total`. */
export const porcentajeAvance = (indice, total) => Math.round(((indice + 1) / total) * 100);
