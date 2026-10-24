import { useCallback, useEffect, useRef, useState } from 'react';
import { estadoDeLasCamaras } from '../../api/backend';

export const EVENTO_CAMARAS_CAMBIO = 'camaras-cambio';
const INTERVALO_MS = 5000;

const SIN_DATOS = { configuradas: ['principal'], calibradas: [], fuentes: {}, rotaciones: {}, secundaria_configurada: false, usar_secundaria: false };

/**
 * Qué cámaras están en uso (la principal y, solo si se la encendió, la secundaria) y cuáles tienen el tablero calibrado. Se actualiza cada
 * 5 s y apenas alguien avisa con `EVENTO_CAMARAS_CAMBIO` (el selector de cámaras o el asistente de calibración). No abre ninguna cámara.
 */
export default function useCamarasConfiguradas() {
  const [estado, setEstado] = useState(SIN_DATOS);
  const montadoRef = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const datos = await estadoDeLasCamaras();
      if (montadoRef.current) setEstado(datos);
    } catch {
      /* sin sesión de facilitador o sin backend: se queda con lo último */
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    recargar();
    const intervalo = setInterval(recargar, INTERVALO_MS);
    window.addEventListener(EVENTO_CAMARAS_CAMBIO, recargar);
    return () => {
      montadoRef.current = false;
      clearInterval(intervalo);
      window.removeEventListener(EVENTO_CAMARAS_CAMBIO, recargar);
    };
  }, [recargar]);

  return { ...estado, tieneSecundaria: estado.configuradas.includes('secundaria'), recargar };
}
