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
