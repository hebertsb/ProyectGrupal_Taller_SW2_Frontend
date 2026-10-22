/** Utilidades de la captura guiada de piezas: clases del dataset y FEN de piezas con una pieza en ciertas casillas. */

const LETRA = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
const TIPOS = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

export const CLASES_BLANCAS = TIPOS.map((t) => `white-${t}`);
export const CLASES_NEGRAS = TIPOS.map((t) => `black-${t}`);
export const CLASE_VACIA = 'vacia';

export const COLUMNAS = 'abcdefgh';

/** Casilla siguiente en orden a1, b1 … h1, a2 … h8 (vuelve a a1 después de h8). */
export function casillaSiguiente(casilla) {
  const indice = (Number(casilla[1]) - 1) * 8 + COLUMNAS.indexOf(casilla[0]);
  const siguiente = (indice + 1) % 64;
  return `${COLUMNAS[siguiente % 8]}${Math.floor(siguiente / 8) + 1}`;
}

/**
 * FEN de piezas (solo el primer campo) con `clase` (ej. "black-pawn") en cada casilla de `casillas`.
 * Con `vacia` o sin casillas devuelve el tablero vacío.
 */
export function fenConPieza(clase, casillas) {
  const [color, tipo] = clase.split('-');
  const letra = LETRA[tipo] ? (color === 'white' ? LETRA[tipo].toUpperCase() : LETRA[tipo]) : null;
  const ocupadas = new Set(letra ? casillas : []);
  const filas = [];
  for (let fila = 8; fila >= 1; fila -= 1) {
    let texto = '';
    let vacias = 0;
    for (const columna of COLUMNAS) {
      if (ocupadas.has(`${columna}${fila}`)) {
        if (vacias) texto += vacias;
        vacias = 0;
        texto += letra;
      } else {
        vacias += 1;
      }
    }
    if (vacias) texto += vacias;
    filas.push(texto);
  }
  return filas.join('/');
}

const LETRA_DE_CLASE = {
  'white-pawn': 'P', 'white-knight': 'N', 'white-bishop': 'B', 'white-rook': 'R', 'white-queen': 'Q', 'white-king': 'K',
  'black-pawn': 'p', 'black-knight': 'n', 'black-bishop': 'b', 'black-rook': 'r', 'black-queen': 'q', 'black-king': 'k',
};

/** Letra FEN (P, n, …) de una clase del dataset ("white-pawn" → "P"); `null` para "vacia". */
export const letraDeClase = (clase) => LETRA_DE_CLASE[clase] ?? null;

/** FEN completo de la posición reconocida a partir de `[{casilla, clase}]` (las casillas que falten quedan vacías). */
export function fenDeCasillas(casillas) {
  const letras = {};
  casillas.forEach((c) => {
    const letra = letraDeClase(c.clase);
    if (letra) letras[c.casilla] = letra;
  });
  const filas = [];
  for (let fila = 8; fila >= 1; fila -= 1) {
    let texto = '';
    let vacias = 0;
    for (const columna of COLUMNAS) {
      const letra = letras[`${columna}${fila}`];
      if (letra) {
        if (vacias) texto += vacias;
        vacias = 0;
        texto += letra;
      } else {
        vacias += 1;
      }
    }
    if (vacias) texto += vacias;
    filas.push(texto);
  }
  return `${filas.join('/')} w - - 0 1`;
}
