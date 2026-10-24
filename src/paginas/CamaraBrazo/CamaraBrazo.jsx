import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearPartida,
  moverPartidaDesdeFoto,
  obtenerPartida,
  obtenerEstadoBrazo,
  obtenerEstadoVision,
  obtenerFotoVision,
  reconocerTablero,
} from '../../api/backend';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';
import EntrenarCamara from '../EntrenarCamara/EntrenarCamara';
import AsistenteCalibracion from '../Camara/Calibracion/AsistenteCalibracion';
import EntrenamientoPiezas from '../Camara/Piezas/EntrenamientoPiezas';
import ProbadorPiezas from '../Camara/Piezas/ProbadorPiezas';
import useFlujoVivo from '../Camara/useFlujoVivo';
import PanelBrazo from '../Camara/Brazo/PanelBrazo';
import SelectorCamara from '../Camara/SelectorCamara';
import LenteYAltura from '../Camara/Calibracion/LenteYAltura';
import VerificacionUnificada from '../Camara/Calibracion/VerificacionUnificada';
import useCamarasConfiguradas from '../Camara/useCamarasConfiguradas';

const INTERVALO_FOTO_MS = 400;
const INTERVALO_ESTADO_MS = 3000;
const INTERVALO_BRAZO_MS = 5000;

const PESTANAS = [
  { id: 'camara', etiqueta: 'Cámara y calibración', icono: 'videocam' },
  { id: 'piezas', etiqueta: 'Entrenamiento de piezas', icono: 'model_training' },
  { id: 'probador', etiqueta: 'Probar piezas', icono: 'center_focus_strong' },
  { id: 'brazo', etiqueta: 'Control del brazo', icono: 'precision_manufacturing' },
  { id: 'probar', etiqueta: 'Reconocer y brazo', icono: 'smart_toy' },
];

const CLASE_TARJETA =
  'w-full min-w-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col gap-space-sm';
const CLASE_BOTON =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_BOTON_PRIMARIO =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Pantalla de facilitador: cámara fija en vivo (sondeo de fotos), reconocimiento
 * del tablero a partir de la foto actual, y estado del brazo. Todo el acceso al
 * backend pasa por api/backend.js; los sondeos son setTimeout recursivos (nunca
 * dos peticiones solapadas) y se cancelan al desmontar.
 */
export default function CamaraBrazo({ partidaActivaId = null, onPartidaActivaChange, onEntrenarCamara }) {
  const [pestana, setPestana] = useState('camara');
  // Qué cámara se ve: la principal, la secundaria o las dos juntas. El asistente calibra la que se mira (con «ambas», la principal).
  const { tieneSecundaria, calibradas } = useCamarasConfiguradas();
  const [vistaElegida, setVistaElegida] = useState('principal');
  const vista = tieneSecundaria ? vistaElegida : 'principal';
  const camaraCalibrar = vista === 'secundaria' ? 'secundaria' : 'principal';
  const camaraCalibrarRef = useRef(camaraCalibrar);
  camaraCalibrarRef.current = camaraCalibrar;

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
  const [calibrando, setCalibrando] = useState(false);
  // Video en vivo de la cámara (sin la grilla de depuración, que sigue por fotos sueltas).
  const enVivo = !pausada && !calibrando && pestana === 'camara' && !grilla;
  const { url: urlVivo, error: errorVivo, fps: fpsVivo } = useFlujoVivo({ modo: 'camara', camara: vista, activo: enVivo });

  // --- Calibración del tablero (el asistente avisa mientras está abierto, para pausar la vista en vivo) ---
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
    if (pausada || calibrando || pestana !== 'camara') return undefined;
    let cancelado = false;
    let temporizador = null;

    async function ciclo() {
      try {
        const [foto, estado] = await Promise.all([
          grillaRef.current ? obtenerFotoVision(true, camaraCalibrarRef.current) : Promise.resolve(null),
          obtenerEstadoVision(camaraCalibrarRef.current).catch((e) => {
            if (!cancelado) setErrorVision(e.message);
            return null;
          }),
        ]);
        if (cancelado) {
          if (foto) URL.revokeObjectURL(foto.url);
          return;
        }
        if (foto) {
          blobFotoRef.current = foto.blob;
          reemplazarUrlFoto(foto.url);
        } else {
          blobFotoRef.current = null; // en vivo: el reconocimiento saca su propia foto en el backend
        }
        setErrorFoto(null);
        if (estado) {
          setEstadoVision(estado);
          setErrorVision(null);
        }
      } catch (e) {
        if (cancelado) return;
        setErrorFoto(e.message);
        obtenerEstadoVision(camaraCalibrarRef.current)
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
      if (!cancelado) temporizador = setTimeout(ciclo, grillaRef.current ? INTERVALO_FOTO_MS : INTERVALO_ESTADO_MS);
    }
    ciclo();

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [pausada, calibrando, pestana, camaraCalibrar]);

  useEffect(() => {
    montadoRef.current = true;
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

  const camaraNoDisponible = estadoVision && estadoVision.disponible === false;

  return (
    <div className="w-full min-w-0 flex flex-col gap-space-md px-4 py-4 md:px-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-headline-md text-headline-md text-on-surface">Cámara y Brazo</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Controlá la cámara fija, probá el reconocimiento del tablero y mirá el estado del brazo.
        </p>
        <ol className="list-decimal pl-5 font-body-sm text-body-sm text-on-surface">
          <li>Calibrá el tablero (pestaña «Cámara y calibración»).</li>
          <li>Sacá fotos de cada pieza y color (pestaña «Entrenamiento de piezas») y entrená en Colab.</li>
          <li>Poné una pieza y mirá si la reconoce (pestaña «Probar piezas»).</li>
          <li>Controlá el brazo y probá moverlo (pestaña «Control del brazo»).</li>
          <li>Probá el reconocimiento del tablero y las jugadas (pestaña «Reconocer y brazo»).</li>
        </ol>
      </header>

      <div role="tablist" aria-label="Secciones de cámara y brazo" className="flex flex-wrap gap-space-xs">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => setPestana(p.id)}
            className={`min-h-[44px] px-space-md rounded-xl font-body-sm text-body-sm inline-flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              pestana === p.id ? 'bg-primary text-on-primary' : 'border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{p.icono}</span>
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-camara" aria-labelledby="pestana-camara" hidden={pestana !== 'camara'} className="w-full max-w-3xl">
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

          <div className="relative w-full aspect-[4/3] bg-surface-container rounded-lg overflow-hidden flex items-center justify-center">
            {enVivo && (
              <span
                className={`absolute top-2 left-2 z-10 px-2 py-1 rounded-lg font-mono-micro text-mono-micro ${fpsVivo > 0 ? 'bg-black/60 text-white' : 'bg-error text-on-error'}`}
                role="status"
              >
                {fpsVivo > 0 ? `● EN VIVO · ${fpsVivo} fps` : '○ sin señal'}
              </span>
            )}
            {(grilla ? urlFoto : urlVivo) ? (
              <img
                src={grilla ? urlFoto : urlVivo}
                alt={grilla ? 'Foto de la cámara con la grilla de depuración' : 'Foto actual de la cámara fija'}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant px-space-md text-center">
                {errorFoto || errorVivo ? 'Sin imagen de la cámara' : 'Conectando con la cámara…'}
              </span>
            )}
          </div>

          {tieneSecundaria && (
            <div className="flex flex-wrap items-center gap-space-xs" role="group" aria-label="Qué cámara ver">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Ver:</span>
              {[['principal', 'Principal'], ['secundaria', 'Secundaria'], ['todas', 'Ambas']].map(([id, texto]) => (
                <button key={id} type="button" className={vista === id ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={vista === id} onClick={() => setVistaElegida(id)}>
                  {texto}
                </button>
              ))}
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Calibradas: {calibradas.length ? calibradas.join(' y ') : 'ninguna'}
              </span>
            </div>
          )}
          <SelectorCamara />

          {/* Paso 1: calibración del tablero (asistente en 4 pasos) */}
          <AsistenteCalibracion key={camaraCalibrar} camara={camaraCalibrar} onEnCursoChange={setCalibrando} />

          <LenteYAltura key={`lente-${camaraCalibrar}`} camara={camaraCalibrar} />
          {tieneSecundaria && <VerificacionUnificada />}

          {pausada && !calibrando && (
            <p className="font-mono-micro text-mono-micro text-on-surface-variant" role="status">
              Sondeo en pausa: la imagen no se actualiza.
            </p>
          )}
          {errorVivo && !grilla && (
            <p className="aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words" role="alert">
              Video de la cámara: {errorVivo}
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
      </div>

      <div role="tabpanel" id="panel-piezas" aria-labelledby="pestana-piezas" hidden={pestana !== 'piezas'} className="flex flex-col gap-space-md">
        {pestana === 'piezas' && (
          <>
            <EntrenamientoPiezas />
            <details className="w-full min-w-0">
              <summary className="min-h-[44px] flex items-center cursor-pointer font-body-md text-body-md text-on-surface">
                Otras formas de juntar fotos y reentrenar en este equipo (avanzado)
              </summary>
              <EntrenarCamara incrustada />
            </details>
          </>
        )}
      </div>

      <div role="tabpanel" id="panel-probador" aria-labelledby="pestana-probador" hidden={pestana !== 'probador'}>
        {pestana === 'probador' && <ProbadorPiezas />}
      </div>

      <div role="tabpanel" id="panel-brazo" aria-labelledby="pestana-brazo" hidden={pestana !== 'brazo'}>
        {pestana === 'brazo' && <PanelBrazo />}
      </div>

      <div role="tabpanel" id="panel-probar" aria-labelledby="pestana-probar" hidden={pestana !== 'probar'}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <div className="flex flex-col gap-space-md min-w-0">
          {/* 2. Reconocimiento */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-reconocer">
            <h3 id="titulo-reconocer" className="font-body-md text-body-md text-on-surface font-medium">
              Probar el reconocimiento del tablero
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
              Paso 3 · Reconocimiento de jugadas (movimiento físico)
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
    </div>
  );
}
