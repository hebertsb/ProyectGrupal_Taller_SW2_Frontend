import { useCallback, useEffect, useRef, useState } from 'react';
import { estadoControlBrazo } from './api/backend';

const INTERVALO_MS = 4000;

/**
 * Estado del brazo para la cabecera y el menú (solo la plataforma lo puede consultar). Lo vuelve a pedir cada pocos segundos
 * mientras la pestaña está visible y `activo` es verdadero. `estado` es `null` si todavía no respondió o si el backend no
 * contesta; sin conexión con el brazo el backend devuelve `{ conectado: false, ... }`.
 */
export default function useEstadoBrazo(activo) {
  const [estado, setEstado] = useState(null);
  const montado = useRef(true);

  const refrescar = useCallback(async () => {
    try {
      const datos = await estadoControlBrazo();
      if (montado.current) setEstado(datos);
    } catch {
      if (montado.current) setEstado(null);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    if (!activo) {
      setEstado(null);
      return undefined;
    }
    let cancelado = false;
    let temporizador = null;
    async function ciclo() {
      if (!document.hidden) await refrescar();
      if (!cancelado) temporizador = setTimeout(ciclo, INTERVALO_MS);
    }
    ciclo();
    return () => {
      montado.current = false;
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [activo, refrescar]);

  return { estado, refrescar };
}
