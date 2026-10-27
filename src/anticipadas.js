/**
 * Jugadas ANTICIPADAS («premoves»): mientras el rival piensa, el jugador deja armadas sus próximas jugadas y se hacen solas apenas le toca. Acá está la parte que no
 * depende de la pantalla: qué casillas puede elegir una pieza al anticipar y cómo se ve el tablero con las anticipadas ya hechas.
 *
 * Como todavía no se sabe qué va a jugar el rival, una anticipada solo mira cómo se MUEVE la pieza, sin revisar lo que haya en el camino ni si deja al rey en jaque (los
 * deslizantes ignoran todo lo que se interponga, el peón puede «capturar» en diagonal una casilla vacía). Recién cuando llega el turno se comprueba si es legal de verdad con
 * el servidor: si no lo es, las anticipadas se descartan. No se puede anticipar sobre una casilla donde el propio jugador tiene una pieza.
 */
export const MAXIMO_ANTICIPADAS = 7;

const COLUMNAS = 'abcdefgh';

/** `'e4'` → `[fila, columna]` en la matriz de `fenAMatriz` (la fila 0 es la 8). */
export function indicesDeCasilla(casilla) {
  return [8 - Number(casilla[1]), COLUMNAS.indexOf(casilla[0])];
}

function casillaDeIndices(fila, columna) {
  return `${COLUMNAS[columna]}${8 - fila}`;
}

const esBlanca = (pieza) => pieza === pieza.toUpperCase();

/** Si `pieza` (un carácter del FEN) es del color `color` (`'blancas'` o `'negras'`). */
export function esDelColor(pieza, color) {
  return Boolean(pieza) && (color === 'blancas' ? esBlanca(pieza) : !esBlanca(pieza));
}

const SALTOS_CABALLO = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const DIAGONALES = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const RECTAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Las casillas a las que se puede anticipar la pieza de `origen` en `matriz` (ver el comienzo del módulo). `[]` si no hay una pieza de `color` ahí. */
export function destinosAnticipados(matriz, origen, color) {
  const [fila, columna] = indicesDeCasilla(origen);
  const pieza = matriz[fila]?.[columna];
  if (!esDelColor(pieza, color)) return [];
  const destinos = [];
  const agregar = (f, c) => {
    if (f < 0 || f > 7 || c < 0 || c > 7) return;
    if (esDelColor(matriz[f][c], color)) return; // nunca sobre una pieza propia
    destinos.push(casillaDeIndices(f, c));
  };
  const rayos = (direcciones) => {
    for (const [df, dc] of direcciones) for (let paso = 1; paso < 8; paso += 1) agregar(fila + df * paso, columna + dc * paso);
  };
  switch (pieza.toLowerCase()) {
    case 'n':
      SALTOS_CABALLO.forEach(([df, dc]) => agregar(fila + df, columna + dc));
      break;
    case 'b':
      rayos(DIAGONALES);
      break;
    case 'r':
      rayos(RECTAS);
      break;
    case 'q':
      rayos(DIAGONALES);
      rayos(RECTAS);
      break;
    case 'k':
      [...DIAGONALES, ...RECTAS].forEach(([df, dc]) => agregar(fila + df, columna + dc));
      // Enroque: el rey que sigue en su casilla de origen puede ir dos casillas al costado (el servidor comprueba si de verdad se puede).
      if (fila === (esBlanca(pieza) ? 7 : 0) && columna === 4) {
        agregar(fila, 6);
        agregar(fila, 2);
      }
      break;
    case 'p': {
      const avance = esBlanca(pieza) ? -1 : 1; // las blancas suben en la matriz hacia la fila 0
      const inicial = esBlanca(pieza) ? 6 : 1;
      agregar(fila + avance, columna);
      if (fila === inicial) agregar(fila + 2 * avance, columna);
      agregar(fila + avance, columna - 1);
      agregar(fila + avance, columna + 1);
      break;
    }
    default:
      break;
  }
  return destinos;
}

/** `true` si la anticipada `origen` → `destino` corona un peón (llega a la última fila): se corona a dama. */
export function coronaAlAnticipar(matriz, origen, destino) {
  const [fila, columna] = indicesDeCasilla(origen);
  const pieza = matriz[fila]?.[columna];
  const [filaDestino] = indicesDeCasilla(destino);
  return pieza?.toLowerCase() === 'p' && ((esBlanca(pieza) && filaDestino === 0) || (!esBlanca(pieza) && filaDestino === 7));
}

/** Una copia de `matriz` con las `cola` de anticipadas (`{ origen, destino }`) ya hechas, para dibujar cómo quedaría el tablero. */
export function matrizConAnticipadas(matriz, cola) {
  const copia = matriz.map((fila) => [...fila]);
  for (const { origen, destino } of cola) {
    const [f1, c1] = indicesDeCasilla(origen);
    const [f2, c2] = indicesDeCasilla(destino);
    let pieza = copia[f1][c1];
    if (!pieza) continue;
    if (coronaAlAnticipar(copia, origen, destino)) pieza = esBlanca(pieza) ? 'Q' : 'q';
    const alPaso = pieza.toLowerCase() === 'p' && c1 !== c2 && !copia[f2][c2]; // peón en diagonal a una casilla vacía: se lleva al que quedó al lado
    const enroque = pieza.toLowerCase() === 'k' && f1 === f2 && Math.abs(c2 - c1) === 2;
    copia[f1][c1] = null;
    copia[f2][c2] = pieza;
    if (alPaso) copia[f1][c2] = null;
    if (enroque) {
      const [torreOrigen, torreDestino] = c2 > c1 ? [7, 5] : [0, 3];
      copia[f1][torreDestino] = copia[f1][torreOrigen];
      copia[f1][torreOrigen] = null;
    }
  }
  return copia;
}
