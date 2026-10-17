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
 * Compara dos FEN y devuelve, de forma heurística, qué piezas "se movieron"
 * de una casilla a otra — pensado solo para animación (deslizamiento visual
 * de SalaControl.jsx), nunca para decidir jugadas legales ni nada que
 * dependa de reglas de ajedrez reales.
 *
 * Empareja cada casilla que quedó vacía con una casilla que ganó una pieza
 * del MISMO tipo/color (maneja así una jugada simple y también el enroque,
 * que vacía y ocupa dos pares de casillas a la vez). Si sobra algún cambio
 * sin pareja de la misma letra, lo empareja igual como probable promoción
 * (peón que vacía su casilla y una dama/torre/alfil/caballo que aparece).
 *
 * Una casilla que tenía una pieza y ahora tiene OTRA distinta (captura
 * directa, sin pasar por "vacía" en este diff) cuenta solo como "ocupada"
 * por la pieza nueva — la que estaba antes ahí fue capturada, no se movió a
 * ningún lado, así que no hace falta encontrarle pareja.
 *
 * Devuelve `[]` (nada que animar, se cae al salto instantáneo de siempre)
 * cuando:
 *   - no cambió ninguna casilla,
 *   - cambiaron demasiadas a la vez (`> límiteCambios`) — típico de cargar
 *     una partida nueva o una posición escaneada por cámara, no de una
 *     jugada — animar ahí sería ruido, no ayuda,
 *   - queda una casilla "ocupada" sin explicar al terminar (algo no encaja
 *     con el patrón esperado de una jugada) — más vale no animar que animar
 *     mal. Una "vaciada" sin pareja SÍ es normal y esperable (una captura o
 *     una captura al paso: la pieza tomada solo desaparece).
 */
export function detectarMovimientosVisuales(fenAnterior, fenNuevo, limiteCambios = 4) {
  if (!fenAnterior || !fenNuevo || fenAnterior === fenNuevo) return [];

  const matrizAnterior = fenAMatriz(fenAnterior);
  const matrizNueva = fenAMatriz(fenNuevo);
  const vaciadas = []; // { casilla, pieza } — piezas que dejaron de estar ahí
  const ocupadas = []; // { casilla, pieza } — piezas que aparecieron ahí

  for (let fila = 0; fila < 8; fila++) {
    for (let columna = 0; columna < 8; columna++) {
      const antes = matrizAnterior[fila]?.[columna] ?? null;
      const despues = matrizNueva[fila]?.[columna] ?? null;
      if (antes === despues) continue;
      const casilla = nombreCasilla(fila, columna);
      if (antes && !despues) {
        vaciadas.push({ casilla, pieza: antes });
      } else if (despues) {
        // Cubre "estaba vacía y ahora tiene pieza" y "tenía una pieza y
        // ahora tiene otra" (captura directa) por igual.
        ocupadas.push({ casilla, pieza: despues });
      }
    }
  }

  const totalCambios = vaciadas.length + ocupadas.length;
  if (totalCambios === 0 || totalCambios > limiteCambios) return [];

  const ocupadasRestantes = [...ocupadas];
  const movimientos = [];
  const sinPareja = [];

  for (const origen of vaciadas) {
    const indice = ocupadasRestantes.findIndex((o) => o.pieza === origen.pieza);
    if (indice === -1) {
      sinPareja.push(origen);
      continue;
    }
    const [destino] = ocupadasRestantes.splice(indice, 1);
    if (origen.casilla !== destino.casilla) {
      movimientos.push({ casillaOrigen: origen.casilla, casillaDestino: destino.casilla, pieza: destino.pieza });
    }
  }

  // Sobras: probablemente una promoción (el peón "vaciado" no matchea por
  // letra con la pieza nueva). Si sobra justo un origen y un destino, se
  // asume que es esa jugada — mostrar la pieza YA promocionada volando es
  // una simplificación aceptable para una animación, no para el motor.
  if (sinPareja.length === 1 && ocupadasRestantes.length === 1) {
    const [origen] = sinPareja;
    const [destino] = ocupadasRestantes;
    if (origen.casilla !== destino.casilla) {
      movimientos.push({ casillaOrigen: origen.casilla, casillaDestino: destino.casilla, pieza: destino.pieza });
    }
  } else if (ocupadasRestantes.length > 0) {
    // Queda una casilla ocupada sin ninguna explicación razonable (no es una
    // promoción 1-a-1) — no encaja con el patrón esperado de una jugada,
    // mejor no animar nada que animar algo incorrecto. Un `sinPareja` sobrante
    // por sí solo (sin `ocupadasRestantes`) es normal — son piezas
    // capturadas, no necesitan destino.
    return [];
  }

  return movimientos;
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

/**
 * Convierte una jugada UCI ("e7e5") en las coordenadas de una flecha sobre el tablero, en un
 * lienzo de 8x8 con las blancas abajo (x: columna a-h, y: fila 8 arriba → 1 abajo), centradas
 * en cada casilla. Con las blancas abajo, la flecha de las negras baja y la de las blancas sube.
 * Devuelve `null` si la jugada no es válida (por ejemplo, el backend viejo sin UCI).
 */
export function flechaDeUci(uci) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8]/.test(uci)) return null;
  const centro = (letra, numero) => ({
    x: 'abcdefgh'.indexOf(letra) + 0.5,
    y: 8 - Number(numero) + 0.5,
  });
  const origen = centro(uci[0], uci[1]);
  const destino = centro(uci[2], uci[3]);
  return { x1: origen.x, y1: origen.y, x2: destino.x, y2: destino.y };
}

/**
 * Aplica una jugada UCI ("e2e4", "e7e8q") a un FEN y devuelve el FEN resultante, solo para DIBUJAR
 * la jugada del jugador al instante mientras el servidor la confirma. No valida que sea legal: eso lo
 * hace el backend, y si la rechaza la pantalla vuelve al tablero anterior. Resuelve las jugadas
 * especiales (enroque, captura al paso, coronación) y pasa el turno; no actualiza derechos de enroque,
 * contadores ni casilla de captura al paso, que acá no se usan.
 */
export function aplicarJugadaUciAFen(fen, uci) {
  if (typeof fen !== 'string' || typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return fen;
  const [colocacion, turno, ...resto] = fen.split(' ');
  const tablero = colocacion.split('/').map((fila) =>
    [...fila].flatMap((caracter) => (/\d/.test(caracter) ? Array(Number(caracter)).fill('') : [caracter]))
  );
  const aCoordenadas = (casilla) => [8 - Number(casilla[1]), 'abcdefgh'.indexOf(casilla[0])];
  const [filaOrigen, colOrigen] = aCoordenadas(uci.slice(0, 2));
  const [filaDestino, colDestino] = aCoordenadas(uci.slice(2, 4));
  const pieza = tablero[filaOrigen][colOrigen];
  if (!pieza) return fen;

  const esPeon = pieza.toLowerCase() === 'p';
  const esRey = pieza.toLowerCase() === 'k';
  // Captura al paso: un peón se mueve en diagonal a una casilla vacía y se lleva al peón que quedó al lado.
  if (esPeon && colOrigen !== colDestino && !tablero[filaDestino][colDestino]) tablero[filaOrigen][colDestino] = '';
  // Enroque: el rey se mueve dos columnas y la torre salta al otro lado.
  if (esRey && Math.abs(colDestino - colOrigen) === 2) {
    const [colTorre, colTorreDestino] = colDestino > colOrigen ? [7, colDestino - 1] : [0, colDestino + 1];
    tablero[filaOrigen][colTorreDestino] = tablero[filaOrigen][colTorre];
    tablero[filaOrigen][colTorre] = '';
  }
  tablero[filaOrigen][colOrigen] = '';
  const coronacion = uci[4];
  tablero[filaDestino][colDestino] = coronacion ? (pieza === pieza.toUpperCase() ? coronacion.toUpperCase() : coronacion) : pieza;

  const nuevaColocacion = tablero
    .map((fila) => fila.reduce((texto, celda) => (celda === '' ? (/\d$/.test(texto) ? texto.slice(0, -1) + (Number(texto.slice(-1)) + 1) : texto + '1') : texto + celda), ''))
    .join('/');
  return [nuevaColocacion, turno === 'w' ? 'b' : 'w', ...resto].join(' ');
}


const VECTORES_PIEZA = {
  n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  k: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};

/**
 * Traduce una jugada en notación SAN ("e4", "Nf3", "exd5", "O-O", "e8=Q") a UCI ("e2e4") para el
 * FEN dado, usando solo geometría de movimiento y casillas bloqueadas. No verifica clavadas ni
 * jaques (el facilitador mueve piezas reales, así que la jugada ya es legal): sirve para dibujar y
 * etiquetar. Devuelve `{ uci }` o `{ error }` con un mensaje en español.
 */
export function sanAUci(fen, san) {
  const limpio = String(san ?? '').trim().replace(/[+#!?]+$/g, '').replace(/0/g, 'O');
  if (!limpio) return { error: 'Escribí una jugada.' };
  const blancas = turnoDeFen(fen) === 'w';
  const matriz = fenAMatriz(fen);
  const colorPropio = (pieza) => pieza && (pieza === pieza.toUpperCase()) === blancas;
  const en = (fila, col) => (fila >= 0 && fila < 8 && col >= 0 && col < 8 ? matriz[fila][col] : undefined);

  if (/^O-O(-O)?$/.test(limpio)) {
    const fila = blancas ? 7 : 0;
    if (en(fila, 4)?.toLowerCase() !== 'k' || !colorPropio(en(fila, 4))) return { error: 'El rey no está en su casilla inicial para enrocar.' };
    return { uci: nombreCasilla(fila, 4) + nombreCasilla(fila, limpio === 'O-O' ? 6 : 2) };
  }

  const m = limpio.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([QRBN]))?$/);
  if (!m) return { error: `No entiendo «${san}». Usá notación como e4, Nf3, exd5 u O-O.` };
  const tipo = (m[1] ?? 'P').toLowerCase();
  const colOrigen = m[2] ? 'abcdefgh'.indexOf(m[2]) : null;
  const filaOrigen = m[3] ? 8 - Number(m[3]) : null;
  const destCol = 'abcdefgh'.indexOf(m[4][0]);
  const destFila = 8 - Number(m[4][1]);
  if (colorPropio(en(destFila, destCol))) return { error: `En ${m[4]} ya hay una pieza propia.` };

  const candidatas = [];
  for (let f = 0; f < 8; f++) {
    for (let c = 0; c < 8; c++) {
      const pieza = en(f, c);
      if (!pieza || !colorPropio(pieza) || pieza.toLowerCase() !== tipo) continue;
      if (colOrigen !== null && c !== colOrigen) continue;
      if (filaOrigen !== null && f !== filaOrigen) continue;
      if (llegaPieza(tipo, f, c, destFila, destCol, blancas, en, limpio.includes('x'))) candidatas.push([f, c]);
    }
  }
  if (candidatas.length === 0) return { error: `Ninguna pieza puede hacer «${san}» en esta posición.` };
  if (candidatas.length > 1) return { error: `«${san}» es ambigua: indicá la columna o fila de origen (ej. Nbd2).` };
  const [f, c] = candidatas[0];
  let uci = nombreCasilla(f, c) + nombreCasilla(destFila, destCol);
  if (tipo === 'p' && (destFila === 0 || destFila === 7)) uci += (m[5] ?? 'Q').toLowerCase();
  return { uci };
}

function llegaPieza(tipo, f, c, destFila, destCol, blancas, en, esCaptura) {
  const df = destFila - f;
  const dc = destCol - c;
  if (tipo === 'p') {
    const paso = blancas ? -1 : 1;
    if (dc === 0) {
      if (en(destFila, destCol)) return false;
      if (df === paso) return true;
      const filaInicial = blancas ? 6 : 1;
      return f === filaInicial && df === 2 * paso && !en(f + paso, c);
    }
    // Captura en diagonal (la captura al paso llega a casilla vacía; se acepta).
    return esCaptura && Math.abs(dc) === 1 && df === paso;
  }
  if (tipo === 'n' || tipo === 'k') {
    return VECTORES_PIEZA[tipo].some(([vf, vc]) => vf === df && vc === dc);
  }
  for (const [vf, vc] of VECTORES_PIEZA[tipo]) {
    let ff = f + vf;
    let cc = c + vc;
    while (ff >= 0 && ff < 8 && cc >= 0 && cc < 8) {
      if (ff === destFila && cc === destCol) return true;
      if (en(ff, cc)) break;
      ff += vf;
      cc += vc;
    }
  }
  return false;
}

/** Parte de piezas de un FEN (sin turno ni derechos) o `null` si no es una colocación válida de 8x8. */
export function colocacionValida(texto) {
  const colocacion = String(texto ?? '').trim().split(/\s+/)[0];
  const filas = colocacion.split('/');
  if (filas.length !== 8) return null;
  for (const fila of filas) {
    if (!/^[pnbrqkPNBRQK1-8]+$/.test(fila)) return null;
    const ancho = [...fila].reduce((suma, ch) => suma + (/\d/.test(ch) ? Number(ch) : 1), 0);
    if (ancho !== 8) return null;
  }
  return colocacion;
}
