import { useEffect, useState } from 'react';
import { obtenerEstadoCalibracion } from '../../../api/backend';
import { EVENTO_CALIBRACION_CAMBIO } from './AsistenteCalibracion';
import useCamarasConfiguradas from '../useCamarasConfiguradas';

const INTERVALO_MS = 60000;

/**
 * Franja con el estado de la calibración del tablero ("vigente" / "vencida" / "sin calibrar"), que el facilitador ve en la
 * pantalla de Cámara y Brazo antes de jugar con el robot. Se actualiza cada minuto y apenas el asistente guarda o quita una
 * calibración. Si el backend rechaza la consulta (sin sesión de facilitador) no muestra nada.
 *
 * `onIrACalibrar`: lleva a la pantalla donde está el asistente.
 */
export default function BannerCalibracion({ onIrACalibrar }) {
  const [estado, setEstado] = useState(null);
  const { tieneSecundaria, calibradas } = useCamarasConfiguradas();
  const secundariaSinCalibrar = tieneSecundaria && !calibradas.includes('secundaria');

  useEffect(() => {
    let cancelado = false;
    let temporizador = null;

    async function consultar() {
      try {
        const datos = await obtenerEstadoCalibracion();
        if (!cancelado) setEstado(datos);
      } catch {
        if (!cancelado) setEstado(null);
      }
    }

    async function ciclo() {
      await consultar();
      if (!cancelado) temporizador = setTimeout(ciclo, INTERVALO_MS);
    }

    function alCambiar() {
      if (temporizador) clearTimeout(temporizador);
      ciclo();
    }

    ciclo();
    window.addEventListener(EVENTO_CALIBRACION_CAMBIO, alCambiar);
    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
      window.removeEventListener(EVENTO_CALIBRACION_CAMBIO, alCambiar);
    };
  }, []);

  if (!estado) return null;

  const vigente = estado.calibrada && estado.vigente === true;
  const sinVerificar = estado.calibrada && estado.vigente == null;
  const texto = vigente
    ? 'Calibración del tablero vigente'
    : sinVerificar
      ? 'Calibración del tablero sin verificar'
      : estado.calibrada
        ? 'Calibración del tablero vencida'
        : 'El tablero no está calibrado';
  const color = vigente
    ? 'bg-surface-container text-on-surface'
    : sinVerificar
      ? 'bg-surface-container text-on-surface-variant'
      : 'bg-error-container text-on-error-container';

  return (
    <div className={`w-full px-4 py-2 md:px-6 flex flex-wrap items-center gap-x-space-sm gap-y-1 font-body-sm text-body-sm ${color}`} role="status">
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {vigente ? 'check_circle' : 'warning'}
      </span>
      <span className="font-medium">{texto}</span>
      {secundariaSinCalibrar && <span className="min-w-0 break-words">La cámara secundaria todavía no está calibrada (no se usa hasta calibrarla).</span>}
      {!vigente && estado.motivo_no_vigente && <span className="min-w-0 break-words">{estado.motivo_no_vigente}</span>}
      {(!vigente || secundariaSinCalibrar) && onIrACalibrar && (
        <button
          type="button"
          onClick={onIrACalibrar}
          className="min-h-[44px] px-space-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-lg"
        >
          Ir a calibrar
        </button>
      )}
    </div>
  );
}
