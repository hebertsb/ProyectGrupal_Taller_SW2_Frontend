import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerMedallas } from './api/backend';
import { EVENTO_MEDALLAS_NUEVAS, pedirRevisionMedallas } from './medallas';

/**
 * Carga las medallas del usuario (`GET /usuario/medallas`) al montarse y las vuelve a pedir cuando el notificador avisa
 * que hay medallas nuevas (así el álbum y el perfil no quedan desactualizados). Devuelve `{datos, cargando, error,
 * recargar}`; `datos` es la respuesta del backend o `null` mientras no llegó.
 *
 * Pedir las medallas hace que el backend otorgue las que correspondan, y quien las pide no es el que las avisa: si la
 * respuesta trae `nuevas`, se le pide al notificador que las revise para que el jugador se entere. Con
 * `pedirAviso: false` (por ejemplo un facilitador mirando el catálogo) eso no se hace.
 */
export default function useMedallas({ pedirAviso = true } = {}) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const vigenteRef = useRef(true);
  const numeroDePedidoRef = useRef(0);

  const cargar = useCallback(
    async ({ silencioso = false, avisar = pedirAviso } = {}) => {
      const numero = ++numeroDePedidoRef.current;
      if (!silencioso) setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));
      try {
        const datos = await obtenerMedallas();
        // Un pedido más nuevo (o un desmontaje) deja sin efecto la respuesta de uno viejo.
        if (!vigenteRef.current || numero !== numeroDePedidoRef.current) return;
        setEstado({ datos, cargando: false, error: null });
        if (avisar && Array.isArray(datos?.nuevas) && datos.nuevas.length > 0) pedirRevisionMedallas();
      } catch (error) {
        if (!vigenteRef.current || numero !== numeroDePedidoRef.current) return;
        // Un refresco silencioso que falla no pisa lo que ya se está mostrando.
        setEstado((anterior) => ({ ...anterior, cargando: false, error: silencioso ? anterior.error : error }));
      }
    },
    [pedirAviso]
  );

  useEffect(() => {
    vigenteRef.current = true;
    cargar();
    return () => {
      vigenteRef.current = false;
    };
  }, [cargar]);

  useEffect(() => {
    // Refresco silencioso (sin parpadeo de "cargando") y sin volver a pedir el aviso: ya lo está gestionando el notificador.
    const alHaberNuevas = () => cargar({ silencioso: true, avisar: false });
    window.addEventListener(EVENTO_MEDALLAS_NUEVAS, alHaberNuevas);
    return () => window.removeEventListener(EVENTO_MEDALLAS_NUEVAS, alHaberNuevas);
  }, [cargar]);

  const recargar = useCallback(() => cargar(), [cargar]);

  return { datos: estado.datos, cargando: estado.cargando, error: estado.error, recargar };
}
