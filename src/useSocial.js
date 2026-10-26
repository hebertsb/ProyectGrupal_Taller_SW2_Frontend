import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerAvisosSociales } from './api/backend';

/** Cada cuánto se consultan los avisos con la pantalla a la vista, y cada cuánto si está oculta (el servidor da por desconectado a quien pasa de 45 s). */
const INTERVALO_VISIBLE_MS = 3500;
const INTERVALO_OCULTA_MS = 15000;

/**
 * Los avisos de lo social del jugador: retos que le hicieron, cómo va su reto o su búsqueda de rival, y cuántas solicitudes de amistad tiene.
 * Consulta cada pocos segundos mientras `activo` y devuelve `{ avisos, refrescar }`; consultar es también la señal de que está en línea.
 * Un final de reto o de búsqueda (aceptado, rechazado, encontrado…) llega UNA sola vez en `avisos`: quien lo use tiene que actuar en ese
 * momento. Los errores de red se ignoran: la próxima consulta lo vuelve a intentar.
 */
export default function useSocial(activo) {
  const [avisos, setAvisos] = useState(null);
  const consultarRef = useRef(() => {});

  useEffect(() => {
    if (!activo) {
      setAvisos(null);
      consultarRef.current = () => {};
      return undefined;
    }
    let cancelado = false;
    let temporizador;
    let enCurso = false;
    let repetir = false;
    const consultar = async () => {
      clearTimeout(temporizador);
      if (cancelado) return;
      if (enCurso) {
        repetir = true;
        return;
      }
      enCurso = true;
      try {
        const datos = await obtenerAvisosSociales();
        if (!cancelado) setAvisos(datos);
      } catch {
        // sin red o sesión vencida: la próxima consulta lo reintenta
      }
      enCurso = false;
      if (!cancelado) temporizador = setTimeout(consultar, repetir ? 0 : document.visibilityState === 'visible' ? INTERVALO_VISIBLE_MS : INTERVALO_OCULTA_MS);
      repetir = false;
    };
    consultarRef.current = consultar;
    consultar();
    const alVolver = () => {
      if (document.visibilityState === 'visible') consultar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo]);

  /** Vuelve a consultar ya (por ejemplo, justo después de mandar un reto). */
  const refrescar = useCallback(() => consultarRef.current(), []);
  return { avisos, refrescar };
}
