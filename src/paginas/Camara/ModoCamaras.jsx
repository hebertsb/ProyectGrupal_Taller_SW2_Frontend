import { useState } from 'react';
import { usarCamaraSecundaria } from '../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from './estilos';
import useCamarasConfiguradas, { EVENTO_CAMARAS_CAMBIO } from './useCamarasConfiguradas';

/**
 * Interruptor «con qué cámaras trabajar»: solo la principal o las dos. Con la secundaria apagada, la captura de fotos, el reconocimiento y las
 * vistas en vivo usan únicamente la principal, aunque la secundaria siga configurada y calibrada (no se pierde nada: se vuelve a encender
 * cuando se la necesite). No se muestra si no hay una cámara secundaria elegida.
 */
export default function ModoCamaras() {
  const { secundaria_configurada: hayConfigurada, usar_secundaria: usandoSecundaria } = useCamarasConfiguradas();
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  if (!hayConfigurada) return null;

  async function elegir(activa) {
    if (activa === usandoSecundaria) return;
    setOcupado(true);
    setError(null);
    try {
      await usarCamaraSecundaria(activa);
      window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs" role="group" aria-label="Con qué cámaras trabajar">
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="font-body-sm text-body-sm text-on-surface-variant">Cámaras en uso:</span>
        <button type="button" className={!usandoSecundaria ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={!usandoSecundaria} disabled={ocupado} onClick={() => elegir(false)}>
          Solo la principal
        </button>
        <button type="button" className={usandoSecundaria ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={usandoSecundaria} disabled={ocupado} onClick={() => elegir(true)}>
          Las dos cámaras
        </button>
      </div>
      {!usandoSecundaria && (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
          La secundaria está apagada: no entra en las fotos de entrenamiento ni en el reconocimiento. Sigue configurada y calibrada por si la usas después.
        </p>
      )}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
