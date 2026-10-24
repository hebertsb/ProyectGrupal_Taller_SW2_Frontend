import { useEffect, useState } from 'react';

/**
 * Devuelve `url` solo si esa imagen se puede cargar; mientras se prueba, o si el archivo no existe, devuelve `null`. Sirve
 * para las ilustraciones sugeridas de las ideas de medalla, que se van sumando a `public/ideas-medallas/` y pueden faltar:
 * donde falta no se muestra nada en vez de una imagen rota. Con `url` nula no hace nada.
 */
export function useImagenCargable(url) {
  const [cargada, setCargada] = useState(null);

  useEffect(() => {
    if (!url) {
      setCargada(null);
      return undefined;
    }
    let vigente = true;
    const prueba = new Image();
    prueba.onload = () => {
      if (vigente) setCargada(url);
    };
    prueba.onerror = () => {
      if (vigente) setCargada(null);
    };
    prueba.src = url;
    return () => {
      vigente = false;
    };
  }, [url]);

  return url && cargada === url ? url : null;
}
