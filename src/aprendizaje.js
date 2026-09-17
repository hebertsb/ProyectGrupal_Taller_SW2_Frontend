/**
 * Utilidades puras para la vista de Aprendizaje: clasificación de jugadas a
 * partir del análisis completo que devuelve el backend. Sin JSX, sin fetch —
 * solo cálculo, para poder probarlas sin backend ni DOM (mismo criterio que
 * ajedrez.js).
 */

/**
 * Probabilidad estimada de ganar (0-100) a partir de una evaluación en
 * centipawns o de un mate forzado, desde la perspectiva de quien tiene el
 * turno en esa jugada. Fórmula pública de Lichess (win rate model) — no
 * cambiarla sin motivo, ya está validada.
 */
export function winPercent(evaluacionCp, mateEn) {
  if (mateEn !== null && mateEn !== undefined) {
    return mateEn > 0 ? 100 : 0;
  }
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evaluacionCp)) - 1);
}

export const CATEGORIAS = {
  MEJOR: "mejor",
  BUENA: "buena",
  INEXACTITUD: "inexactitud",
  ERROR: "error",
  BLUNDER: "blunder",
};

/**
 * Clasifica una jugada del análisis completo según cuánto bajó el
 * winPercent respecto a la mejor jugada posible en esa posición, siempre en
 * la perspectiva de quien la jugó (evaluacion_cp/evaluacion_mejor_cp ya
 * vienen en esa perspectiva, no hace falta invertir signos acá).
 */
export function clasificarJugada(jugada) {
  if (jugada.jugada_san === jugada.mejor_jugada_motor) {
    return CATEGORIAS.MEJOR;
  }
  const caida = caidaDeJugada(jugada);
  if (caida >= 30) return CATEGORIAS.BLUNDER;
  if (caida >= 20) return CATEGORIAS.ERROR;
  if (caida >= 10) return CATEGORIAS.INEXACTITUD;
  return CATEGORIAS.BUENA;
}

/** Caída de winPercent entre la mejor jugada posible y la jugada real (siempre >= 0). */
export function caidaDeJugada(jugada) {
  const winPercentMejor = winPercent(jugada.evaluacion_mejor_cp, jugada.mate_en_mejor);
  const winPercentReal = winPercent(jugada.evaluacion_cp, jugada.mate_en);
  return Math.max(0, winPercentMejor - winPercentReal);
}

/** Color/ícono/etiqueta de cada categoría — mismos tokens Tailwind del resto del proyecto (ver index.css). */
export const ESTILO_CATEGORIA = {
  [CATEGORIAS.MEJOR]: {
    etiqueta: "Mejor jugada",
    texto: "text-primary",
    fondo: "bg-primary-container/20",
    icono: "stars",
  },
  [CATEGORIAS.BUENA]: {
    etiqueta: "Buena",
    texto: "text-primary",
    fondo: "bg-surface-container",
    icono: "check_circle",
  },
  [CATEGORIAS.INEXACTITUD]: {
    etiqueta: "Inexactitud",
    texto: "text-secondary",
    fondo: "bg-secondary-container/20",
    icono: "help",
  },
  [CATEGORIAS.ERROR]: {
    etiqueta: "Error",
    texto: "text-tertiary-fixed-dim",
    fondo: "bg-tertiary-container/20",
    icono: "warning",
  },
  [CATEGORIAS.BLUNDER]: {
    etiqueta: "Blunder",
    texto: "text-error",
    fondo: "bg-error-container/30",
    icono: "report",
  },
};

/** Texto corto de "cómo mejorar" por categoría — plantillas fijas, no generación libre. */
export function comoMejorarPorCategoria(categoria) {
  switch (categoria) {
    case CATEGORIAS.MEJOR:
      return "Esta fue la jugada más fuerte según el análisis del motor — nada que corregir acá.";
    case CATEGORIAS.BUENA:
      return "Jugada sólida, sin pérdida relevante de ventaja. Seguí buscando la idea más precisa cuando el reloj lo permita.";
    case CATEGORIAS.INEXACTITUD:
      return "Había una jugada algo mejor disponible, pero la diferencia es chica — no es grave.";
    case CATEGORIAS.ERROR:
      return "Esta jugada cede una ventaja apreciable. Revisá si dejaste una pieza peor colocada o ignoraste una amenaza del rival.";
    case CATEGORIAS.BLUNDER:
      return "Revisá si dejaste una pieza sin defender, permitiste una combinación táctica o abriste un jaque — acá se perdió la mayor parte de la ventaja.";
    default:
      return "";
  }
}
