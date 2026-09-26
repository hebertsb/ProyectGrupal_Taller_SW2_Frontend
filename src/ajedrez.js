export const POSICION_INICIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const PIEZA_A_SIMBOLO = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

const LETRA_A_TIPO = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};

export function fenAMatriz(fen) {
  const filasFen = fen.split(" ")[0].split("/");
  return filasFen.map((filaFen) => {
    const fila = [];
    for (const caracter of filaFen) {
      if (/[1-8]/.test(caracter)) {
        fila.push(...Array(Number(caracter)).fill(null));
      } else {
        fila.push(caracter);
      }
    }
    return fila;
  });
}

export function nombreCasilla(fila, columna) {
  const letra = "abcdefgh"[columna];
  const numero = 8 - fila;
  return `${letra}${numero}`;
}

export function claseDePieza(caracterFen) {
  const color = caracterFen === caracterFen.toUpperCase() ? "white-piece" : "black-piece";
  const tipo = LETRA_A_TIPO[caracterFen.toLowerCase()];
  return `chess-piece ${color} ${tipo}`;
}

/**
 * Ruta del ícono SVG de la pieza (set "cburnett", el mismo que usa lichess.org —
 * Colin M.L. Burnett, GPLv2+ — ver frontend/public/piezas/). Ej.: "K" -> "/piezas/wK.svg".
 */
export function rutaImagenPieza(caracterFen) {
  const color = caracterFen === caracterFen.toUpperCase() ? "w" : "b";
  return `/piezas/${color}${caracterFen.toUpperCase()}.svg`;
}

export function turnoDeFen(fen) {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function piezaEnCasilla(fen, casilla) {
  const matriz = fenAMatriz(fen);
  const columna = "abcdefgh".indexOf(casilla[0]);
  const fila = 8 - Number(casilla[1]);
  return matriz[fila]?.[columna] ?? null;
}

export function esPromocionDePeon(fen, origen, destino) {
  const matriz = fenAMatriz(fen);
  const columna = "abcdefgh".indexOf(origen[0]);
  const fila = 8 - Number(origen[1]);
  const pieza = matriz[fila]?.[columna];
  const promocionBlancas = pieza === "P" && origen[1] === "7" && destino.endsWith("8");
  const promocionNegras = pieza === "p" && origen[1] === "2" && destino.endsWith("1");
  return promocionBlancas || promocionNegras;
}

export function extraerCasillaDestino(san) {
  const coincidencia = san.replace(/[+#]/g, "").match(/[a-h][1-8](?:=[QRBN])?$/);
  return coincidencia ? coincidencia[0].slice(0, 2) : null;
}

/**
 * Casillas de movimiento ILUSTRATIVAS para una pieza parada sola en un
 * mini-tablero vacío (Panel de Aprendizaje, "Aprendé cada pieza") — reglas
 * simplificadas por tipo de pieza, sin capturas ni jaques ni reglas
 * especiales (enroque, al paso). No es el motor real: solo sirve para
 * mostrar de un vistazo hacia dónde se mueve cada pieza. `fila`/`columna`
 * van de 0 a 7 (igual que las filas de `fenAMatriz`, fila 0 = octava fila).
 */
export function casillasIlustrativas(tipoPieza, fila, columna) {
  const dentroDelTablero = (f, c) => f >= 0 && f < 8 && c >= 0 && c < 8;
  const resultado = [];
  const agregar = (f, c) => {
    if (dentroDelTablero(f, c)) resultado.push([f, c]);
  };

  switch (tipoPieza) {
    case "peon":
      // Ilustrativo: un paso "hacia adelante" (hacia fila 0, como las blancas en `fenAMatriz`).
      agregar(fila - 1, columna);
      break;
    case "caballo":
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([df, dc]) =>
        agregar(fila + df, columna + dc)
      );
      break;
    case "alfil":
      for (let d = 1; d < 8; d++) {
        agregar(fila - d, columna - d);
        agregar(fila - d, columna + d);
        agregar(fila + d, columna - d);
        agregar(fila + d, columna + d);
      }
      break;
    case "torre":
      for (let d = 0; d < 8; d++) {
        if (d !== fila) agregar(d, columna);
        if (d !== columna) agregar(fila, d);
      }
      break;
    case "dama":
      return [...casillasIlustrativas("torre", fila, columna), ...casillasIlustrativas("alfil", fila, columna)];
    case "rey":
      for (let df = -1; df <= 1; df++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (df !== 0 || dc !== 0) agregar(fila + df, columna + dc);
        }
      }
      break;
    default:
      break;
  }
  return resultado;
}
