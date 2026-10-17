const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.9;

/**
 * Reduce una foto grande (lado mayor > 1600 px) a JPEG antes de subirla. Si ya es chica, o si el
 * navegador no puede decodificarla, devuelve el archivo original para que el backend decida.
 */
export async function reducirImagen(archivo) {
  let mapa;
  try {
    mapa = await createImageBitmap(archivo);
  } catch {
    return archivo;
  }
  try {
    const lado = Math.max(mapa.width, mapa.height);
    if (lado <= LADO_MAXIMO_PX) return archivo;
    const escala = LADO_MAXIMO_PX / lado;
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', CALIDAD_JPEG));
    if (!blob) return archivo;
    const nombre = (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } finally {
    mapa.close?.();
  }
}
