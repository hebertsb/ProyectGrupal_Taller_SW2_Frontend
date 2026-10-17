import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearPartida,
  guardarCalibracionTablero,
  moverPartidaDesdeFoto,
  obtenerCalibracionTablero,
  obtenerPartida,
  obtenerEstadoBrazo,
  obtenerEstadoVision,
  obtenerFotoVision,
  quitarCalibracionTablero,
  reconocerTablero,
} from '../../api/backend';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';
import CapaCalibracion, { ESQUINAS_ORDEN, GUIA_ESQUINAS } from './CapaCalibracion';

const INTERVALO_FOTO_MS = 1500;
const INTERVALO_BRAZO_MS = 5000;

const CLASE_TARJETA =
  'w-full min-w-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col gap-space-sm';
const CLASE_BOTON =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_BOTON_PRIMARIO =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Valida el JSON de esquinas {a1,h1,h8,a8 -> [x,y]}; devuelve las esquinas o lanza Error en español. */
function validarEsquinas(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new Error('El archivo no tiene el formato esperado: tiene que ser un objeto con a1, h1, h8 y a8.');
  }
  const esquinas = {};
  for (const clave of ESQUINAS_ORDEN) {
    const par = datos[clave];
    if (
      !Array.isArray(par) ||
      par.length !== 2 ||
      !par.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      throw new Error(`Falta la esquina «${clave}» o no es un par numérico [x, y].`);
    }
    esquinas[clave] = [par[0], par[1]];
  }
  return esquinas;
}

/**
 * Pantalla de facilitador: cámara fija en vivo (sondeo de fotos), reconocimiento
 * del tablero a partir de la foto actual, y estado del brazo. Todo el acceso al
 * backend pasa por api/backend.js; los sondeos son setTimeout recursivos (nunca
 * dos peticiones solapadas) y se cancelan al desmontar.
 */
export default function CamaraBrazo({ partidaActivaId = null, onPartidaActivaChange, onEntrenarCamara }) {
  // --- Cámara ---
  const [estadoVision, setEstadoVision] = useState(null);
  const [errorVision, setErrorVision] = useState(null);
  const [urlFoto, setUrlFoto] = useState(null);
  const [errorFoto, setErrorFoto] = useState(null);
  const [pausada, setPausada] = useState(false);
  const [grilla, setGrilla] = useState(false);
  const blobFotoRef = useRef(null);
  const urlFotoRef = useRef(null);
  const grillaRef = useRef(grilla);
  grillaRef.current = grilla;

  // --- Calibración del tablero ---
  const [calibracion, setCalibracion] = useState(null);
  const [errorCalibracion, setErrorCalibracion] = useState(null);
  const [calibrando, setCalibrando] = useState(false);
  const [puntos, setPuntos] = useState([]);
  const [ocupadoCalibracion, setOcupadoCalibracion] = useState(false);
  const entradaImportarRef = useRef(null);
  const montadoRef = useRef(true);

  // --- Reconocimiento ---
  const [reconociendo, setReconociendo] = useState(false);
  const [fenReconocido, setFenReconocido] = useState(null);
  const [errorReconocer, setErrorReconocer] = useState(null);
  const entradaFotoRef = useRef(null);
  const [fotoSubidaUrl, setFotoSubidaUrl] = useState(null);
  const fotoSubidaUrlRef = useRef(null);

  // --- Movimiento físico y uso de la posición reconocida (sobre la partida activa de Sala de Control) ---
  const [detectando, setDetectando] = useState(false);
  const [resultadoMovimiento, setResultadoMovimiento] = useState(null);
  const [errorMovimiento, setErrorMovimiento] = useState(null);
  const [usandoPosicion, setUsandoPosicion] = useState(false);
  const [errorUsar, setErrorUsar] = useState(null);
  const [posicionUsada, setPosicionUsada] = useState(false);

  // --- Brazo ---
  const [estadoBrazo, setEstadoBrazo] = useState(null);
  const [errorBrazo, setErrorBrazo] = useState(null);

  function reemplazarUrlFoto(urlNueva) {
    if (urlFotoRef.current) URL.revokeObjectURL(urlFotoRef.current);
    urlFotoRef.current = urlNueva;
    setUrlFoto(urlNueva);
  }

  // Sondeo de foto + estado de la cámara.
  useEffect(() => {
    if (pausada || calibrando) return undefined;
    let cancelado = false;
    let temporizador = null;

    async function ciclo() {
      try {
        const [foto, estado] = await Promise.all([
          obtenerFotoVision(grillaRef.current),
          obtenerEstadoVision().catch((e) => {
            if (!cancelado) setErrorVision(e.message);
            return null;
          }),
        ]);
        if (cancelado) {
          URL.revokeObjectURL(foto.url);
          return;
        }
        blobFotoRef.current = foto.blob;
        reemplazarUrlFoto(foto.url);
        setErrorFoto(null);
        if (estado) {
          setEstadoVision(estado);
          setErrorVision(null);
        }
      } catch (e) {
        if (cancelado) return;
        setErrorFoto(e.message);
        obtenerEstadoVision()
          .then((estado) => {
            if (!cancelado) {
              setEstadoVision(estado);
              setErrorVision(null);
            }
          })
          .catch((err) => {
            if (!cancelado) setErrorVision(err.message);
          });
      }
      if (!cancelado) temporizador = setTimeout(ciclo, INTERVALO_FOTO_MS);
    }
    ciclo();

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [pausada, calibrando]);

  // Calibración actual al montar.
  useEffect(() => {
    montadoRef.current = true;
    obtenerCalibracionTablero()
      .then((c) => {
        if (montadoRef.current) setCalibracion(c);
      })
      .catch((e) => {
        if (montadoRef.current) setErrorCalibracion(e.message);
      });
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Al desmontar, liberar la última foto.
  useEffect(
    () => () => {
      if (urlFotoRef.current) URL.revokeObjectURL(urlFotoRef.current);
      urlFotoRef.current = null;
      if (fotoSubidaUrlRef.current) URL.revokeObjectURL(fotoSubidaUrlRef.current);
      fotoSubidaUrlRef.current = null;
    },
    []
  );

  // Sondeo del brazo.
  useEffect(() => {
    let cancelado = false;
    let temporizador = null;
    async function ciclo() {
      try {
        const estado = await obtenerEstadoBrazo();
        if (!cancelado) {
          setEstadoBrazo(estado);
          setErrorBrazo(null);
        }
      } catch (e) {
        if (!cancelado) setErrorBrazo(e.message);
      }
      if (!cancelado) temporizador = setTimeout(ciclo, INTERVALO_BRAZO_MS);
    }
    ciclo();
    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  const reconocer = useCallback(async () => {
    setReconociendo(true);
    setErrorReconocer(null);
    try {
      // Con grilla activa la foto actual es la de depuración: para reconocer
      // se manda la cámara original (sin foto subida, el backend captura una).
      const archivo =
        blobFotoRef.current && !grillaRef.current
          ? new File([blobFotoRef.current], 'tablero.jpg', { type: 'image/jpeg' })
          : null;
      const { fen } = await reconocerTablero('w', archivo);
      setFenReconocido(fen);
      setPosicionUsada(false);
    } catch (e) {
      setErrorReconocer(e.message);
    } finally {
      setReconociendo(false);
    }
  }, []);

  // Reconoce una imagen elegida del equipo (misma llamada que usa Sala de Control).
  async function seleccionarFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    if (fotoSubidaUrlRef.current) URL.revokeObjectURL(fotoSubidaUrlRef.current);
    const url = URL.createObjectURL(archivo);
    fotoSubidaUrlRef.current = url;
    setFotoSubidaUrl(url);
    setReconociendo(true);
    setErrorReconocer(null);
    setFenReconocido(null);
    try {
      const { fen } = await reconocerTablero('w', archivo);
      if (!montadoRef.current) return;
      setFenReconocido(fen);
      setPosicionUsada(false);
    } catch (err) {
      if (montadoRef.current) setErrorReconocer(err.message);
    } finally {
      if (montadoRef.current) setReconociendo(false);
    }
  }

  // Detecta la jugada hecha en el tablero físico y la aplica a la partida activa.
  async function detectarMovimiento() {
    if (!partidaActivaId) return;
    setDetectando(true);
    setErrorMovimiento(null);
    setResultadoMovimiento(null);
    try {
      const datos = await moverPartidaDesdeFoto(partidaActivaId);
      if (!montadoRef.current) return;
      const jugadas = datos.jugadas ?? [];
      const detectada = datos.jugada_motor ? jugadas[jugadas.length - 2] : jugadas[jugadas.length - 1];
      setResultadoMovimiento({
        jugada: detectada ?? null,
        respuesta: datos.jugada_motor ?? null,
        fen: datos.fen,
        terminada: Boolean(datos.terminada),
        resultado: datos.resultado ?? null,
      });
    } catch (err) {
      if (montadoRef.current) setErrorMovimiento(err.message);
    } finally {
      if (montadoRef.current) setDetectando(false);
    }
  }

  // Abre en Sala de Control una partida nueva desde el FEN reconocido, con el mismo nivel,
  // rival y reloj de la partida activa (esos ajustes viven en Sala de Control).
  async function usarPosicion() {
    if (!fenReconocido || !partidaActivaId) return;
    setUsandoPosicion(true);
    setErrorUsar(null);
    try {
      const actual = await obtenerPartida(partidaActivaId);
      const nueva = await crearPartida(
        actual.nivel,
        fenReconocido,
        actual.tipo_oponente || undefined,
        actual.control_tiempo_ms ?? 0
      );
      if (!montadoRef.current) return;
      onPartidaActivaChange?.(nueva.id);
      setPosicionUsada(true);
    } catch (err) {
      if (montadoRef.current) setErrorUsar(err.message);
    } finally {
      if (montadoRef.current) setUsandoPosicion(false);
    }
  }

  // Congela una foto original (sin grilla) y arranca la toma de las 4 esquinas.
  async function iniciarCalibracion() {
    setOcupadoCalibracion(true);
    setErrorCalibracion(null);
    try {
      const foto = await obtenerFotoVision(false);
      if (!montadoRef.current) {
        URL.revokeObjectURL(foto.url);
        return;
      }
      blobFotoRef.current = foto.blob;
      reemplazarUrlFoto(foto.url);
      setGrilla(false);
      setPuntos([]);
      setCalibrando(true);
    } catch (e) {
      if (montadoRef.current) setErrorCalibracion(`No se pudo congelar la foto: ${e.message}`);
    } finally {
      if (montadoRef.current) setOcupadoCalibracion(false);
    }
  }

  function cancelarCalibracion() {
    setCalibrando(false);
    setPuntos([]);
    setErrorCalibracion(null);
  }

  // Ejecuta una operación de calibración con estado de carga y error visibles.
  async function ejecutarCalibracion(operacion, alExito) {
    setOcupadoCalibracion(true);
    setErrorCalibracion(null);
    try {
      const resultado = await operacion();
      if (!montadoRef.current) return;
      setCalibracion(resultado);
      alExito?.();
    } catch (e) {
      if (montadoRef.current) setErrorCalibracion(e.message);
    } finally {
      if (montadoRef.current) setOcupadoCalibracion(false);
    }
  }

  function guardarPuntos() {
    const esquinas = Object.fromEntries(ESQUINAS_ORDEN.map((clave, i) => [clave, puntos[i]]));
    ejecutarCalibracion(
      () => guardarCalibracionTablero(esquinas),
      () => {
        setCalibrando(false);
        setPuntos([]);
        setGrilla(true); // para verificar la calibración sobre la grilla
        setPausada(false);
      }
    );
  }

  function exportarEsquinas() {
    if (!calibracion?.esquinas) return;
    const blob = new Blob([JSON.stringify(calibracion.esquinas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'esquinas_tablero.json';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importarEsquinas(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setErrorCalibracion(null);
    let esquinas;
    try {
      let datos;
      try {
        datos = JSON.parse(await archivo.text());
      } catch {
        throw new Error('El archivo no es un JSON válido.');
      }
      esquinas = validarEsquinas(datos);
    } catch (err) {
      setErrorCalibracion(err.message);
      return;
    }
    ejecutarCalibracion(() => guardarCalibracionTablero(esquinas), () => setGrilla(true));
  }

  function quitarCalibracion() {
    if (!window.confirm('¿Quitar la calibración del tablero? Se vuelve a la detección automática.')) return;
    ejecutarCalibracion(quitarCalibracionTablero);
  }

  const camaraNoDisponible = estadoVision && estadoVision.disponible === false;

  return (
    <div className="w-full min-w-0 flex flex-col gap-space-md px-4 py-4 md:px-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-headline-md text-headline-md text-on-surface">Cámara y Brazo</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Controlá la cámara fija, probá el reconocimiento del tablero y mirá el estado del brazo.
        </p>
        {onEntrenarCamara && (
          <button type="button" className={`${CLASE_BOTON} self-start mt-space-xs`} onClick={onEntrenarCamara}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">model_training</span>
              Entrenar cámara
            </span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        {/* 1. Cámara en vivo */}
        <section className={CLASE_TARJETA} aria-labelledby="titulo-camara">
          <h3 id="titulo-camara" className="font-body-md text-body-md text-on-surface font-medium">
            Cámara en vivo
          </h3>
          <div className="flex flex-wrap gap-space-xs">
            <button
              type="button"
              className={CLASE_BOTON}
              onClick={() => setPausada((p) => !p)}
              aria-pressed={pausada}
              disabled={calibrando}
            >
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">{pausada ? 'play_arrow' : 'pause'}</span>
                {pausada ? 'Reanudar' : 'Pausar'}
              </span>
            </button>
            <label className="min-h-[44px] flex items-center gap-2 px-space-xs font-body-sm text-body-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                role="switch"
                className="w-5 h-5 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                checked={grilla}
                disabled={calibrando}
                onChange={(e) => setGrilla(e.target.checked)}
              />
              {grilla ? 'Vista: grilla de depuración' : 'Vista: original'}
            </label>
          </div>

          <div className="w-full aspect-[4/3] bg-surface-container rounded-lg overflow-hidden flex items-center justify-center">
            {calibrando && urlFoto ? (
              <CapaCalibracion
                url={urlFoto}
                puntos={puntos}
                onAgregar={(p) => setPuntos((prev) => (prev.length < ESQUINAS_ORDEN.length ? [...prev, p] : prev))}
              />
            ) : urlFoto ? (
              <img
                src={urlFoto}
                alt={grilla ? 'Foto de la cámara con la grilla de depuración' : 'Foto actual de la cámara fija'}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant px-space-md text-center">
                {errorFoto ? 'Sin imagen de la cámara' : 'Esperando la primera foto…'}
              </span>
            )}
          </div>

          {/* Calibración del tablero */}
          <div className="flex flex-col gap-space-xs border-t border-outline-variant pt-space-sm" aria-labelledby="titulo-calibracion" role="group">
            <div className="flex flex-wrap items-center justify-between gap-space-xs">
              <h4 id="titulo-calibracion" className="font-body-sm text-body-sm text-on-surface font-medium">
                Calibración del tablero
              </h4>
              <span
                className={`font-body-sm text-body-sm ${calibracion?.calibrada ? 'text-on-surface' : 'text-on-surface-variant'}`}
                role="status"
              >
                {calibracion == null
                  ? '—'
                  : calibracion.calibrada
                    ? 'Tablero calibrado'
                    : 'Sin calibrar (detección automática)'}
              </span>
            </div>

            {calibrando ? (
              <>
                <p className="font-body-sm text-body-sm text-on-surface" role="status" aria-live="polite">
                  {puntos.length < ESQUINAS_ORDEN.length
                    ? `Clic ${puntos.length + 1} de 4: ${GUIA_ESQUINAS[ESQUINAS_ORDEN[puntos.length]]}. Tocá la esquina exterior de las casillas, sin el borde de madera.`
                    : 'Listo: las 4 esquinas están marcadas. Guardá o reiniciá los clics.'}
                </p>
                <div className="flex flex-wrap gap-space-xs">
                  <button
                    type="button"
                    className={CLASE_BOTON}
                    onClick={() => setPuntos([])}
                    disabled={ocupadoCalibracion || puntos.length === 0}
                  >
                    Reiniciar clics
                  </button>
                  <button
                    type="button"
                    className={CLASE_BOTON_PRIMARIO}
                    onClick={guardarPuntos}
                    disabled={ocupadoCalibracion || puntos.length !== ESQUINAS_ORDEN.length}
                  >
                    {ocupadoCalibracion ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className={CLASE_BOTON} onClick={cancelarCalibracion} disabled={ocupadoCalibracion}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={iniciarCalibracion} disabled={ocupadoCalibracion}>
                  {ocupadoCalibracion ? 'Trabajando…' : 'Calibrar tablero'}
                </button>
                <button
                  type="button"
                  className={CLASE_BOTON}
                  onClick={exportarEsquinas}
                  disabled={ocupadoCalibracion || !calibracion?.esquinas}
                >
                  Exportar .json
                </button>
                <button
                  type="button"
                  className={CLASE_BOTON}
                  onClick={() => entradaImportarRef.current?.click()}
                  disabled={ocupadoCalibracion}
                >
                  Importar .json
                </button>
                <input
                  ref={entradaImportarRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Importar esquinas del tablero desde un archivo .json"
                  onChange={importarEsquinas}
                />
                <button
                  type="button"
                  className={CLASE_BOTON}
                  onClick={quitarCalibracion}
                  disabled={ocupadoCalibracion || !calibracion?.calibrada}
                >
                  Quitar calibración
                </button>
              </div>
            )}

            {errorCalibracion && (
              <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
                {errorCalibracion}
              </p>
            )}
          </div>

          {pausada && !calibrando && (
            <p className="font-mono-micro text-mono-micro text-on-surface-variant" role="status">
              Sondeo en pausa: la imagen no se actualiza.
            </p>
          )}
          {errorFoto && (
            <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
              No se pudo traer la foto: {errorFoto}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-space-sm gap-y-1 font-body-sm text-body-sm">
            <dt className="text-on-surface-variant">Fuente</dt>
            <dd className="text-on-surface break-words">{estadoVision?.fuente ?? '—'}</dd>
            <dt className="text-on-surface-variant">Disponible</dt>
            <dd className={camaraNoDisponible ? 'text-error' : 'text-on-surface'}>
              {estadoVision ? (estadoVision.disponible ? 'Sí' : 'No') : '—'}
            </dd>
            <dt className="text-on-surface-variant">Resolución</dt>
            <dd className="text-on-surface">
              {estadoVision?.ancho && estadoVision?.alto ? `${estadoVision.ancho} × ${estadoVision.alto}` : '—'}
            </dd>
            <dt className="text-on-surface-variant">Latencia</dt>
            <dd className="text-on-surface">
              {estadoVision?.latencia_ms != null ? `${Math.round(estadoVision.latencia_ms)} ms` : '—'}
            </dd>
          </dl>
          {camaraNoDisponible && (
            <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
              La cámara no está disponible{estadoVision.error ? `: ${estadoVision.error}` : '.'}
            </p>
          )}
          {errorVision && (
            <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
              No se pudo leer el estado de la cámara: {errorVision}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-space-md min-w-0">
          {/* 2. Reconocimiento */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-reconocer">
            <h3 id="titulo-reconocer" className="font-body-md text-body-md text-on-surface font-medium">
              Reconocimiento del tablero
            </h3>
            <div className="flex flex-wrap gap-space-xs">
              <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={reconocer} disabled={reconociendo}>
                {reconociendo ? 'Reconociendo…' : 'Reconocer tablero'}
              </button>
              <button
                type="button"
                className={CLASE_BOTON}
                onClick={() => entradaFotoRef.current?.click()}
                disabled={reconociendo}
                title="Subí una foto ya sacada (por ejemplo de la galería del celular) en vez de usar la cámara en vivo"
              >
                Subir foto del tablero
              </button>
              <input
                ref={entradaFotoRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-label="Subir una foto del tablero para reconocerla"
                onChange={seleccionarFoto}
              />
            </div>
            {fotoSubidaUrl && (
              <img
                src={fotoSubidaUrl}
                alt="Foto del tablero que subiste"
                className="w-full max-h-48 object-contain bg-surface-container rounded-lg"
              />
            )}
            {errorReconocer && (
              <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
                {errorReconocer}
              </p>
            )}
            {fenReconocido && (
              <>
                <p className="font-mono-micro text-mono-micro text-on-surface break-all select-all" aria-label="FEN reconocido">
                  {fenReconocido}
                </p>
                <div className="w-full flex justify-center">
                  <TableroSoloLectura fen={fenReconocido} />
                </div>
                <div>
                  <button
                    type="button"
                    className={CLASE_BOTON_PRIMARIO}
                    onClick={usarPosicion}
                    disabled={usandoPosicion || !partidaActivaId}
                  >
                    {usandoPosicion ? 'Abriendo…' : 'Usar esta posición'}
                  </button>
                </div>
                {!partidaActivaId && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant" role="status">
                    Para usar esta posición primero abrí una partida en Sala de Control: se crea una nueva con el mismo nivel y rival.
                  </p>
                )}
                {posicionUsada && (
                  <p className="font-body-sm text-body-sm text-on-surface" role="status">
                    Listo: la posición quedó como partida nueva en Sala de Control.
                  </p>
                )}
                {errorUsar && (
                  <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
                    {errorUsar}
                  </p>
                )}
              </>
            )}
          </section>

          {/* 2b. Movimiento físico */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-movimiento">
            <h3 id="titulo-movimiento" className="font-body-md text-body-md text-on-surface font-medium">
              Movimiento físico
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Mové una pieza en el tablero físico y tocá el botón: se compara la foto con la posición de la partida activa.
            </p>
            <div>
              <button
                type="button"
                className={CLASE_BOTON_PRIMARIO}
                onClick={detectarMovimiento}
                disabled={detectando || !partidaActivaId}
              >
                {detectando ? 'Detectando…' : 'Detecté un movimiento físico'}
              </button>
            </div>
            {!partidaActivaId && (
              <p className="font-body-sm text-body-sm text-on-surface-variant" role="status">
                No hay una partida activa: abrí o creá una en Sala de Control para comparar contra su posición.
              </p>
            )}
            {errorMovimiento && (
              <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
                {errorMovimiento}
              </p>
            )}
            {resultadoMovimiento && (
              <div className="flex flex-col gap-space-xs" role="status">
                <p className="font-body-sm text-body-sm text-on-surface break-words">
                  Jugada detectada: <strong>{resultadoMovimiento.jugada ?? '—'}</strong>
                  {resultadoMovimiento.respuesta ? ` · respuesta del rival: ${resultadoMovimiento.respuesta}` : ''}
                  {resultadoMovimiento.terminada
                    ? ` · partida terminada${resultadoMovimiento.resultado ? ` (${resultadoMovimiento.resultado})` : ''}`
                    : ''}
                </p>
                <p className="font-mono-micro text-mono-micro text-on-surface break-all select-all" aria-label="FEN tras el movimiento">
                  {resultadoMovimiento.fen}
                </p>
                <div className="w-full flex justify-center">
                  <TableroSoloLectura fen={resultadoMovimiento.fen} />
                </div>
              </div>
            )}
          </section>

          {/* 3. Brazo */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-brazo">
            <h3 id="titulo-brazo" className="font-body-md text-body-md text-on-surface font-medium">
              Brazo
            </h3>
            {errorBrazo && (
              <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
                No se pudo leer el estado del brazo: {errorBrazo}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-space-sm gap-y-1 font-body-sm text-body-sm">
              <dt className="text-on-surface-variant">Modo</dt>
              <dd className="text-on-surface">
                {estadoBrazo ? (estadoBrazo.modo === 'real' ? 'Real' : 'Simulado') : '—'}
              </dd>
              <dt className="text-on-surface-variant">Conectado</dt>
              <dd className="text-on-surface">
                {!estadoBrazo
                  ? '—'
                  : estadoBrazo.modo === 'simulado' || estadoBrazo.conectado == null
                    ? 'No aplica'
                    : estadoBrazo.conectado
                      ? 'Sí'
                      : 'No'}
              </dd>
              <dt className="text-on-surface-variant">Host</dt>
              <dd className="text-on-surface break-all">{estadoBrazo?.host || '—'}</dd>
              <dt className="text-on-surface-variant">Última jugada</dt>
              <dd className="text-on-surface break-words">{estadoBrazo?.ultima_jugada || 'Ninguna todavía'}</dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
