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
