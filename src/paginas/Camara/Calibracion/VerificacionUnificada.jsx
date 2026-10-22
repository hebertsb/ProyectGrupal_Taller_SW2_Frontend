import { useState } from 'react';
import { verificarCalibracionUnificada } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';
import useCamarasConfiguradas from '../useCamarasConfiguradas';

const COLORES = {
  bien: 'text-on-surface',
  regular: 'text-on-surface',
  mal: 'text-error',
  orientacion: 'text-error',
};

/**
 * Comprueba que las calibraciones de las DOS cámaras describen el mismo tablero con la misma orientación: toma una foto de cada una, las
 * endereza con sus esquinas y muestra, en una sola imagen, la principal, la secundaria, las dos superpuestas y el mapa de diferencia. Si
 * están bien calibradas, la superposición se ve nítida y la diferencia casi no tiene rojo; si una está girada o corrida, lo dice.
 * Solo aparece cuando hay una cámara secundaria.
 */
export default function VerificacionUnificada() {
  const { tieneSecundaria, calibradas } = useCamarasConfiguradas();
  const [informe, setInforme] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  if (!tieneSecundaria) return null;
  const lista = calibradas.includes('principal') && calibradas.includes('secundaria');

  async function verificar() {
    setOcupado(true);
    setError(null);
    try {
      setInforme(await verificarCalibracionUnificada());
    } catch (e) {
      setInforme(null);
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs border-t border-outline-variant pt-space-sm" role="group" aria-labelledby="titulo-unificada">
      <h4 id="titulo-unificada" className="font-body-sm text-body-sm text-on-surface font-medium m-0">
        Calibración unificada de las dos cámaras
      </h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Calibrá cada cámara (elegila arriba en «Ver») y después comprobá que las dos ven el tablero igual: misma orientación y mismas casillas.
      </p>
      <div>
        <button type="button" className={lista ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} onClick={verificar} disabled={ocupado || !lista}>
          {ocupado ? 'Comprobando…' : 'Verificar calibración unificada'}
        </button>
      </div>
      {!lista && (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">
          Falta calibrar {['principal', 'secundaria'].filter((c) => !calibradas.includes(c)).join(' y ')}.
        </p>
      )}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      {informe && (
        <div className="flex flex-col gap-space-xs">
          <p className={`font-body-sm text-body-sm m-0 ${COLORES[informe.nivel] ?? ''}`} role="status">
            <strong>{informe.ok ? '✓' : '⚠'}</strong> {informe.mensaje}
          </p>
          <img
            src={`data:image/jpeg;base64,${informe.imagen}`}
            alt="Las dos cámaras con el tablero enderezado: arriba la principal y la secundaria, abajo las dos superpuestas y el mapa de diferencia"
            className="w-full max-w-xl h-auto rounded-lg border border-outline-variant"
          />
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Abajo a la izquierda, las dos superpuestas: si coinciden, las líneas del damero se ven nítidas (si hay doble línea, están corridas).
            Abajo a la derecha, la diferencia: lo rojo es lo que no coincide; las piezas siempre aparecen un poco.
          </p>
        </div>
      )}
    </div>
  );
}
