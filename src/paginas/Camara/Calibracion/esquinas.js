/** Orden fijo de las esquinas exteriores del área de juego (8x8, sin borde de madera). */
export const ESQUINAS_ORDEN = ['a1', 'h1', 'h8', 'a8'];

export const GUIA_ESQUINAS = {
  a1: 'esquina a1 (la de la torre blanca del lado de la columna a)',
  h1: 'esquina h1 (la de la torre blanca del lado de la columna h)',
  h8: 'esquina h8 (la de la torre negra del lado de la columna h)',
  a8: 'esquina a8 (la de la torre negra del lado de la columna a)',
};

/**
 * Convierte un clic (clientX/clientY) a píxeles de la imagen original, teniendo en cuenta el letterbox de
 * object-fit: contain. Devuelve null si el clic cae fuera del área real de la imagen.
 */
export function clicAPixelesImagen(rect, natural, clientX, clientY) {
  const escala = Math.min(rect.width / natural.ancho, rect.height / natural.alto);
  const anchoVisible = natural.ancho * escala;
  const altoVisible = natural.alto * escala;
  const izquierda = rect.left + (rect.width - anchoVisible) / 2;
  const arriba = rect.top + (rect.height - altoVisible) / 2;
  const x = (clientX - izquierda) / escala;
  const y = (clientY - arriba) / escala;
  if (x < 0 || y < 0 || x > natural.ancho || y > natural.alto) return null;
  return [Math.round(x), Math.round(y)];
}

/** Índice del punto más cercano a `punto` si está a menos de `radioPx` (en píxeles de la imagen); si no, -1. */
export function indiceDePuntoCercano(puntos, punto, radioPx) {
  let mejor = -1;
  let mejorDistancia = radioPx;
  puntos.forEach(([x, y], i) => {
    const distancia = Math.hypot(x - punto[0], y - punto[1]);
    if (distancia <= mejorDistancia) {
      mejor = i;
      mejorDistancia = distancia;
    }
  });
  return mejor;
}

/** Valida el JSON de esquinas {a1,h1,h8,a8 -> [x,y]}; devuelve las esquinas o lanza Error en español. */
export function validarEsquinas(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new Error('El archivo no tiene el formato esperado: tiene que ser un objeto con a1, h1, h8 y a8.');
  }
  const esquinas = {};
  for (const clave of ESQUINAS_ORDEN) {
    const par = datos[clave];
    if (!Array.isArray(par) || par.length !== 2 || !par.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error(`Falta la esquina «${clave}» o no es un par numérico [x, y].`);
    }
    esquinas[clave] = [par[0], par[1]];
  }
  return esquinas;
}

/** Convierte la lista de 4 puntos marcados en el objeto `{a1, h1, h8, a8}` que espera el backend. */
export function puntosAEsquinas(puntos) {
  return Object.fromEntries(ESQUINAS_ORDEN.map((clave, i) => [clave, puntos[i]]));
}

/**
 * Líneas de una grilla 8x8 sobre el tablero calibrado, para dibujarla encima de la imagen de la cámara. `esquinas` es `{a1, h1, h8, a8 -> [x, y]}` en
 * píxeles de la foto. Se ajusta la homografía del cuadrado unidad (a1 en (0,0), h1 en (1,0), h8 en (1,1), a8 en (0,1)) a las 4 esquinas, así
 * las líneas respetan la perspectiva. Devuelve `{contorno: [[x, y] x4], lineas: [[[x1, y1], [x2, y2]] x18]}` (9 verticales y 9 horizontales,
 * contando los bordes), o `null` si las esquinas no dan una homografía válida (puntos alineados o repetidos).
 */
export function grillaDeEsquinas(esquinas) {
  const origen = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const destino = ESQUINAS_ORDEN.map((clave) => esquinas?.[clave]);
  if (destino.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) return null;
  // Sistema 8x8 de la homografía con h33 = 1: x = (h0 u + h1 v + h2) / (h6 u + h7 v + 1), y = (h3 u + h4 v + h5) / (h6 u + h7 v + 1).
  const filas = [];
  origen.forEach(([u, v], i) => {
    const [x, y] = destino[i];
    filas.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    filas.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  });
  for (let columna = 0; columna < 8; columna += 1) {
    let pivote = columna;
    for (let f = columna + 1; f < 8; f += 1) if (Math.abs(filas[f][columna]) > Math.abs(filas[pivote][columna])) pivote = f;
    if (Math.abs(filas[pivote][columna]) < 1e-9) return null;
    [filas[columna], filas[pivote]] = [filas[pivote], filas[columna]];
    for (let f = 0; f < 8; f += 1) {
      if (f === columna) continue;
      const factor = filas[f][columna] / filas[columna][columna];
      for (let c = columna; c < 9; c += 1) filas[f][c] -= factor * filas[columna][c];
    }
  }
  const h = filas.map((fila, i) => fila[8] / fila[i]);
  const proyectar = (u, v) => {
    const w = h[6] * u + h[7] * v + 1;
    return [(h[0] * u + h[1] * v + h[2]) / w, (h[3] * u + h[4] * v + h[5]) / w];
  };
  const lineas = [];
  for (let k = 0; k <= 8; k += 1) {
    lineas.push([proyectar(k / 8, 0), proyectar(k / 8, 1)]);
    lineas.push([proyectar(0, k / 8), proyectar(1, k / 8)]);
  }
  return { contorno: origen.map(([u, v]) => proyectar(u, v)), lineas };
}
