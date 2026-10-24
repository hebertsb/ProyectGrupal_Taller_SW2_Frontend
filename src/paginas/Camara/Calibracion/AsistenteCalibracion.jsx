import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';
import CapaEsquinas from './CapaEsquinas';
import GuiaAlineacion from './GuiaAlineacion';
import { ESQUINAS_ORDEN, GUIA_ESQUINAS } from './esquinas';
import useAsistenteCalibracion from './useAsistenteCalibracion';

export { EVENTO_CALIBRACION_CAMBIO } from './useAsistenteCalibracion';

const PASOS = ['Congelar foto', 'Marcar esquinas', 'Revisar la grilla', 'Guardar'];

function textoFecha(iso) {
  const fecha = iso ? new Date(iso) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleString('es') : null;
}

/**
 * Asistente de calibración del tablero en 4 pasos: 1) congelar una foto de la cámara fija, 2) marcar a1, h1, h8 y a8 (arrastrables,
 * con lupa), 3) revisar la grilla 8x8 sobre el tablero enderezado, 4) guardar. Al guardar el backend registra la resolución, la
 * cámara y la foto de referencia, que sirven para saber si la calibración sigue vigente. En reposo muestra el estado y deja
 * exportar/importar las esquinas, quitar la calibración y comprobar que la cámara no se movió.
 *
 * `onEnCursoChange(true|false)` avisa al padre mientras el asistente está abierto (para pausar la vista en vivo).
 */
export default function AsistenteCalibracion({ camara = 'principal', onEnCursoChange }) {
  const {
    estado, paso, foto, puntos, setPuntos, vistaUrl, resultado, comprobacion, ocupado, error,
    entradaImportarRef, ir, cerrar, congelar, previsualizar, guardar, exportar, importar, quitar, comprobar,
  } = useAsistenteCalibracion(camara, onEnCursoChange);

  const etiquetaEstado =
    estado == null
      ? '—'
      : !estado.calibrada
        ? 'Sin calibrar (detección automática)'
        : estado.vigente === true
          ? 'Calibración vigente'
          : estado.vigente === false
            ? 'Calibración vencida'
            : 'Calibrada, sin poder verificar';
  const colorEstado = estado?.calibrada && estado.vigente === true ? 'text-on-surface' : 'text-on-surface-variant';
  const completos = puntos.length === ESQUINAS_ORDEN.length;

  return (
    <div className="flex flex-col gap-space-xs border-t border-outline-variant pt-space-sm" role="group" aria-labelledby="titulo-calibracion">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <h4 id="titulo-calibracion" className="font-body-sm text-body-sm text-on-surface font-medium">
          Paso 1 · Calibración del tablero — cámara {camara}
        </h4>
        <span className={`font-body-sm text-body-sm ${colorEstado}`} role="status">
          {etiquetaEstado}
        </span>
      </div>

      {paso > 0 && (
        <ol className="flex flex-wrap gap-x-space-sm gap-y-1 list-none p-0 m-0 font-mono-micro text-mono-micro" aria-label="Pasos de la calibración">
          {PASOS.map((nombre, i) => (
            <li key={nombre} aria-current={paso === i + 1 ? 'step' : undefined} className={paso === i + 1 ? 'text-primary font-medium' : 'text-on-surface-variant'}>
              {i + 1}. {nombre}
            </li>
          ))}
        </ol>
      )}

      {paso === 0 && (
        <>
          {estado?.calibrada && estado.vigente !== true && estado.motivo_no_vigente && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{estado.motivo_no_vigente}</p>
          )}
          {estado?.calibrada && textoFecha(estado.fecha) && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Calibrada el {textoFecha(estado.fecha)} · {estado.resolucion?.join('×')} px · cámara «{estado.fuente}»
            </p>
          )}
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => ir(1)} disabled={ocupado}>
              Calibrar tablero
            </button>
            <button type="button" className={CLASE_BOTON} onClick={comprobar} disabled={ocupado || !estado?.calibrada}>
              {ocupado ? 'Trabajando…' : 'Comprobar que la cámara no se movió'}
            </button>
            <button type="button" className={CLASE_BOTON} onClick={exportar} disabled={ocupado || !estado?.esquinas}>
              Exportar .json
            </button>
            <button type="button" className={CLASE_BOTON} onClick={() => entradaImportarRef.current?.click()} disabled={ocupado}>
              Importar .json
            </button>
            <input
              ref={entradaImportarRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Importar esquinas del tablero desde un archivo .json"
              onChange={importar}
            />
            <button type="button" className={CLASE_BOTON} onClick={quitar} disabled={ocupado || !estado?.calibrada}>
              Quitar calibración
            </button>
          </div>
          {comprobacion && (
            <p
              className={`font-body-sm text-body-sm break-words ${comprobacion.movida === true ? 'text-error' : 'text-on-surface-variant'}`}
              role="status"
            >
              {comprobacion.mensaje}
            </p>
          )}
        </>
      )}

      {paso === 1 && (
        <>
          <p className="font-body-sm text-body-sm text-on-surface">
            Dejá el tablero completo y a la vista, sin manos encima, con la cámara en su posición definitiva.
            {estado?.esquinas
              ? ' Mové el trípode hasta que el tablero encaje en la grilla amarilla (las líneas blancas sobre las de las casillas) y, cuando esté bien, congelá la foto.'
              : ' Cuando el tablero se vea completo, congelá la foto.'}
          </p>
          <GuiaAlineacion camara={camara} esquinas={estado?.esquinas} resolucion={estado?.resolucion} />
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={congelar} disabled={ocupado}>
              {ocupado ? 'Sacando la foto…' : 'Congelar foto'}
            </button>
            <button type="button" className={CLASE_BOTON} onClick={cerrar} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {paso === 2 && foto && (
        <>
          <p className="font-body-sm text-body-sm text-on-surface" role="status" aria-live="polite">
            {completos
              ? 'Listo: las 4 esquinas están marcadas. Podés arrastrarlas para afinar (con la lupa) o seguir.'
              : `Toque ${puntos.length + 1} de 4: ${GUIA_ESQUINAS[ESQUINAS_ORDEN[puntos.length]]}. Tocá la esquina exterior de las casillas, sin el borde de madera.`}
          </p>
          <div className="w-full aspect-[4/3] bg-surface-container rounded-lg overflow-hidden">
            <CapaEsquinas url={foto.url} puntos={puntos} onCambiar={setPuntos} deshabilitada={ocupado} />
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={previsualizar} disabled={ocupado || !completos}>
              {ocupado ? 'Calculando…' : 'Ver la grilla'}
            </button>
            <button type="button" className={CLASE_BOTON} onClick={() => setPuntos([])} disabled={ocupado || puntos.length === 0}>
              Reiniciar esquinas
            </button>
            <button type="button" className={CLASE_BOTON} onClick={congelar} disabled={ocupado}>
              Otra foto
            </button>
            <button type="button" className={CLASE_BOTON} onClick={cerrar} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {paso === 3 && vistaUrl && (
        <>
          <p className="font-body-sm text-body-sm text-on-surface">
            Así se ve el tablero enderezado. Las líneas rojas tienen que coincidir con los bordes de las casillas, de a1 (abajo a la
            izquierda) a h8.
          </p>
          <img src={vistaUrl} alt="Tablero enderezado con la grilla 8x8 dibujada" className="w-full max-w-[480px] mx-auto rounded-lg border border-outline-variant" />
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => ir(4)} disabled={ocupado}>
              La grilla coincide, seguir
            </button>
            <button type="button" className={CLASE_BOTON} onClick={() => ir(2)} disabled={ocupado}>
              Ajustar las esquinas
            </button>
            <button type="button" className={CLASE_BOTON} onClick={cerrar} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {paso === 4 && (
        <>
          {resultado ? (
            <div className="flex flex-col gap-space-xs" role="status">
              <p className="font-body-sm text-body-sm text-on-surface">
                Calibración guardada ({resultado.resolucion?.join('×')} px, cámara «{resultado.fuente}»). Ya es la vigente.
              </p>
              {resultado.advertencias?.length > 0 && (
                <ul className="list-disc pl-5 font-body-sm text-body-sm text-on-surface-variant">
                  {resultado.advertencias.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              )}
              <div>
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={cerrar}>
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-body-sm text-body-sm text-on-surface">
                Al guardar, esta foto queda como referencia: si después se mueve la cámara o el tablero, se avisa antes de jugar.
              </p>
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={guardar} disabled={ocupado}>
                  {ocupado ? 'Guardando…' : 'Guardar calibración'}
                </button>
                <button type="button" className={CLASE_BOTON} onClick={() => ir(3)} disabled={ocupado}>
                  Volver a la grilla
                </button>
                <button type="button" className={CLASE_BOTON} onClick={cerrar} disabled={ocupado}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
