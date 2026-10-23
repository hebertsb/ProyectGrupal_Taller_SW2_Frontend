import { useState } from 'react';
import { ajustarEsquinasCalibracion, aplicarOrientacionCalibracion, verificarCalibracionUnificada } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';
import useCamarasConfiguradas from '../useCamarasConfiguradas';

const COLORES = {
  bien: 'text-on-surface',
  regular: 'text-on-surface',
  mal: 'text-error',
  orientacion: 'text-error',
};

/** Una fila por cámara: cuánto se aleja de su propia grilla y, si las esquinas sugeridas lo mejoran, el botón para aplicarlas. */
function FilaCamara({ nombre, datos, ocupado, onAjustar }) {
  if (datos.error_max_casillas == null) {
    return (
      <li className="m-0">
        <span className="capitalize">{nombre}</span>: se ven {datos.esquinas_medidas} esquinas del damero, muy pocas para medir (sacá las piezas).
      </li>
    );
  }
  const sugeridas = datos.sugeridas;
  const mejora = sugeridas?.error_casillas != null && sugeridas.error_casillas < datos.error_max_casillas;
  return (
    <li className="m-0 flex flex-wrap items-center gap-x-space-sm gap-y-space-xs">
      <span className="min-w-0 break-words">
        <span className="capitalize">{nombre}</span>: hasta {datos.error_max_casillas.toFixed(2)} casillas de su grilla (cerca de{' '}
        {datos.peor_esquina}){mejora && <> → {sugeridas.error_casillas.toFixed(2)} con las esquinas ajustadas</>}
      </span>
      {mejora && (
        <button type="button" className={CLASE_BOTON} onClick={() => onAjustar(nombre)} disabled={ocupado}>
          Ajustar esquinas
        </button>
      )}
    </li>
  );
}

/**
 * Comprueba que las calibraciones de las DOS cámaras describen el mismo tablero con la misma orientación: toma una foto de cada una, las
 * endereza con sus esquinas y mide, una por una, las 49 esquinas internas del damero en las dos. Muestra la principal, la secundaria, las dos
 * superpuestas y el mapa de esquinas (verde si coinciden, ámbar o rojo si no), dice qué cámara se aleja más de su grilla y permite ajustar sus
 * esquinas automáticamente. Solo aparece cuando hay una cámara secundaria.
 */
export default function VerificacionUnificada() {
  const { tieneSecundaria, calibradas } = useCamarasConfiguradas();
  const [informe, setInforme] = useState(null);
  const [error, setError] = useState(null);
  const [ajuste, setAjuste] = useState(null);
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

  async function ajustar(camara) {
    setOcupado(true);
    setError(null);
    setAjuste(null);
    try {
      const resultado = await ajustarEsquinasCalibracion(camara);
      setAjuste(`${camara[0].toUpperCase()}${camara.slice(1)}: ${resultado.mensaje}`);
      setInforme(await verificarCalibracionUnificada());
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function corregirOrientacion() {
    setOcupado(true);
    setError(null);
    setAjuste(null);
    try {
      const resultado = await aplicarOrientacionCalibracion();
      setAjuste(`Secundaria: ${resultado.mensaje}`);
      setInforme(await verificarCalibracionUnificada());
    } catch (e) {
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
        Hacelo con el tablero vacío: las piezas tapan las esquinas del damero que se miden.
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
            <strong>{informe.nivel === 'bien' ? '✓' : '⚠'}</strong> {informe.mensaje}
          </p>
          {ajuste && (
            <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
              {ajuste}
            </p>
          )}
          {informe.corregida && (
            <div>
              <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={corregirOrientacion} disabled={ocupado}>
                Aplicar esquinas corregidas a la secundaria
              </button>
            </div>
          )}
          {informe.camaras && informe.nivel !== 'orientacion' && (
            <ul className="font-body-sm text-body-sm text-on-surface-variant m-0 pl-space-md flex flex-col gap-space-xs">
              {Object.entries(informe.camaras).map(([nombre, datos]) => (
                <FilaCamara key={nombre} nombre={nombre} datos={datos} ocupado={ocupado} onAjustar={ajustar} />
              ))}
            </ul>
          )}
          <img
            src={`data:image/jpeg;base64,${informe.imagen}`}
            alt="Las dos cámaras con el tablero enderezado: arriba la principal y la secundaria, abajo las dos superpuestas y el mapa de esquinas"
            className="w-full max-w-xl h-auto rounded-lg border border-outline-variant"
          />
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Abajo a la izquierda, las dos superpuestas: si coinciden, las líneas del damero se ven nítidas (si hay doble línea, están corridas).
            Abajo a la derecha, cada esquina del damero: verde si las dos cámaras la ven en el mismo lugar, ámbar o rojo si no, con una flecha
            (exagerada tres veces) hacia donde la ve la secundaria. Si hay piezas encima se muestra la diferencia entre las dos imágenes.
          </p>
        </div>
      )}
    </div>
  );
}
