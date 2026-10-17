import { useCallback, useEffect, useRef, useState } from 'react';
import {
  borrarCapturaDataset,
  guardarFotoDataset,
  obtenerEstadoReentrenamiento,
  obtenerResumenDataset,
  obtenerUrlControlDataset,
  reentrenarClasificador,
  subirFotoTablero,
} from '../../api/backend';
import SubirFotosPieza from './SubirFotosPieza';
import { reducirImagen } from '../../imagen';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';
import { aplicarJugadaUciAFen, colocacionValida, POSICION_INICIAL_FEN, sanAUci } from '../../ajedrez';

const CUENTA_REGRESIVA_S = 3;
const INTERVALO_ESTADO_MS = 2000;
const META_MUESTRAS = 1500;
const MINIMO_REENTRENAR = 300;

const CLASE_TARJETA =
  'w-full min-w-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col gap-space-sm';
const CLASE_BOTON =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_BOTON_PRIMARIO =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_CAMPO =
  'min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_AVISO =
  'aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words';

const MENSAJES_ESTADO = {
  inactivo: 'Sin reentrenamiento en curso.',
  en_curso: 'Reentrenando… esto puede tardar unos minutos.',
  terminado: 'Reentrenamiento terminado. El clasificador ya usa tus fotos.',
  error: 'El reentrenamiento falló. Revisá el registro.',
};

/** Mensaje en español para un error al sacar o guardar una foto del dataset. */
function mensajeErrorFoto(error) {
  if (error.status === 503) return 'La cámara no está disponible. Revisá que esté conectada y probá de nuevo.';
  if (error.status === 422) {
    return `No se pudo usar la foto: ${error.message}. Revisá que el tablero esté completo y a la vista, sin la mano encima.`;
  }
  return error.message;
}

/**
 * Pantalla de facilitador para juntar muestras etiquetadas del tablero real y reentrenar el
 * clasificador de piezas. Reemplaza al script de terminal `training/sesion_captura.py`. El tablero
 * muestra la posición que hay que tener armada en el tablero físico; la jugada se escribe en SAN.
 * Todo el acceso al backend pasa por api/backend.js.
 */
export default function EntrenarCamara({ onVolver }) {
  // --- Posición ---
  const [fen, setFen] = useState(POSICION_INICIAL_FEN);
  const [historial, setHistorial] = useState([]);
  const [jugada, setJugada] = useState('');
  const [errorJugada, setErrorJugada] = useState(null);
  const [fenLibre, setFenLibre] = useState('');
  const [errorLibre, setErrorLibre] = useState(null);

  // --- Captura ---
  const [cuenta, setCuenta] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ultimaCaptura, setUltimaCaptura] = useState(null);
  const [urlControl, setUrlControl] = useState(null);
  const [errorFoto, setErrorFoto] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState(null);
  const [subiendoTablero, setSubiendoTablero] = useState(false);
  const urlControlRef = useRef(null);
  const montadoRef = useRef(true);
  const temporizadorCuentaRef = useRef(null);

  // --- Resumen y reentrenamiento ---
  const [resumen, setResumen] = useState(null);
  const [errorResumen, setErrorResumen] = useState(null);
  const [estadoReentreno, setEstadoReentreno] = useState(null);
  const [iniciando, setIniciando] = useState(false);
  const [errorReentreno, setErrorReentreno] = useState(null);

  const reemplazarUrlControl = useCallback((urlNueva) => {
    if (urlControlRef.current) URL.revokeObjectURL(urlControlRef.current);
    urlControlRef.current = urlNueva;
    setUrlControl(urlNueva);
  }, []);

  const cargarResumen = useCallback(async () => {
    try {
      const datos = await obtenerResumenDataset();
      if (!montadoRef.current) return;
      setResumen(datos);
      setErrorResumen(null);
    } catch (e) {
      if (montadoRef.current) setErrorResumen(e.message);
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    cargarResumen();
    obtenerEstadoReentrenamiento()
      .then((estado) => {
        if (montadoRef.current) setEstadoReentreno(estado);
      })
      .catch(() => {});
    return () => {
      montadoRef.current = false;
      if (temporizadorCuentaRef.current) clearTimeout(temporizadorCuentaRef.current);
      if (urlControlRef.current) URL.revokeObjectURL(urlControlRef.current);
      urlControlRef.current = null;
    };
  }, [cargarResumen]);

  // Sondeo del reentrenamiento: setTimeout recursivo mientras esté en curso (nunca dos peticiones solapadas).
  const enCurso = estadoReentreno?.estado === 'en_curso';
  useEffect(() => {
    if (!enCurso) return undefined;
    let cancelado = false;
    let temporizador = null;
    async function ciclo() {
      try {
        const estado = await obtenerEstadoReentrenamiento();
        if (cancelado) return;
        setEstadoReentreno(estado);
        setErrorReentreno(null);
        if (estado.estado !== 'en_curso') return;
      } catch (e) {
        if (cancelado) return;
        setErrorReentreno(e.message);
      }
      temporizador = setTimeout(ciclo, INTERVALO_ESTADO_MS);
    }
    temporizador = setTimeout(ciclo, INTERVALO_ESTADO_MS);
    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [enCurso]);

  // --- Posición ---
  function aplicarJugada(evento) {
    evento.preventDefault();
    const resultado = sanAUci(fen, jugada);
    if (resultado.error) {
      setErrorJugada(resultado.error);
      return;
    }
    setHistorial((h) => [...h, fen]);
    setFen(aplicarJugadaUciAFen(fen, resultado.uci));
    setJugada('');
    setErrorJugada(null);
  }

  function deshacer() {
    if (historial.length === 0) return;
    setFen(historial[historial.length - 1]);
    setHistorial((h) => h.slice(0, -1));
    setErrorJugada(null);
  }

  function reiniciar() {
    setHistorial([]);
    setFen(POSICION_INICIAL_FEN);
    setErrorJugada(null);
    setErrorLibre(null);
  }

  function usarPosicionLibre(evento) {
    evento.preventDefault();
    const colocacion = colocacionValida(fenLibre);
    if (!colocacion) {
      setErrorLibre('El FEN no es válido: pegá solo las 8 filas de piezas, ej. 4k3/8/8/8/8/8/8/4K3.');
      return;
    }
    setHistorial((h) => [...h, fen]);
    setFen(`${colocacion} w - - 0 1`);
    setFenLibre('');
    setErrorLibre(null);
  }

  // --- Foto ---
  async function guardarFoto() {
    setGuardando(true);
    setErrorFoto(null);
    setMensajeFoto(null);
    try {
      const respuesta = await guardarFotoDataset(fen.split(' ')[0]);
      if (!montadoRef.current) return;
      setUltimaCaptura(respuesta);
      setMensajeFoto(`Captura guardada: ${respuesta.guardadas} muestras nuevas.`);
      try {
        reemplazarUrlControl(await obtenerUrlControlDataset());
      } catch (e) {
        if (montadoRef.current) setErrorFoto(`La foto se guardó, pero no se pudo mostrar la imagen de control: ${e.message}`);
      }
      await cargarResumen();
    } catch (e) {
      if (montadoRef.current) setErrorFoto(mensajeErrorFoto(e));
    } finally {
      if (montadoRef.current) setGuardando(false);
    }
  }

  function sacarFoto() {
    setErrorFoto(null);
    setMensajeFoto(null);
    let restante = CUENTA_REGRESIVA_S;
    setCuenta(restante);
    function tic() {
      restante -= 1;
      if (!montadoRef.current) return;
      if (restante > 0) {
        setCuenta(restante);
        temporizadorCuentaRef.current = setTimeout(tic, 1000);
      } else {
        setCuenta(null);
        guardarFoto();
      }
    }
    temporizadorCuentaRef.current = setTimeout(tic, 1000);
  }

  async function subirFotoDeTablero(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    setSubiendoTablero(true);
    setErrorFoto(null);
    setMensajeFoto(null);
    try {
      const foto = await reducirImagen(archivo);
      const respuesta = await subirFotoTablero(fen.split(' ')[0], foto);
      if (!montadoRef.current) return;
      setUltimaCaptura(respuesta);
      setMensajeFoto(`Foto subida: ${respuesta.guardadas} muestras nuevas.`);
      try {
        reemplazarUrlControl(await obtenerUrlControlDataset());
      } catch (e) {
        if (montadoRef.current) setErrorFoto(`La foto se guardó, pero no se pudo mostrar la imagen de control: ${e.message}`);
      }
      await cargarResumen();
    } catch (e) {
      if (!montadoRef.current) return;
      if (e.status === 413) setErrorFoto('La foto es demasiado grande (máximo 10 MB).');
      else if (e.status === 422) {
        setErrorFoto(`No se pudo usar la foto: ${e.message}. Revisá que se vea el tablero completo y que la posición en pantalla sea la que armaste.`);
      } else setErrorFoto(e.message);
    } finally {
      if (montadoRef.current) setSubiendoTablero(false);
    }
  }

  async function borrarCaptura() {
    if (!ultimaCaptura) return;
    setBorrando(true);
    setErrorFoto(null);
    try {
      const respuesta = await borrarCapturaDataset(ultimaCaptura.captura_id);
      if (!montadoRef.current) return;
      setMensajeFoto(`Captura borrada (${respuesta.borradas} muestras).`);
      setUltimaCaptura(null);
      reemplazarUrlControl(null);
      await cargarResumen();
    } catch (e) {
      if (montadoRef.current) setErrorFoto(`No se pudo borrar la captura: ${e.message}`);
    } finally {
      if (montadoRef.current) setBorrando(false);
    }
  }

  // --- Reentrenamiento ---
  async function reentrenar() {
    setIniciando(true);
    setErrorReentreno(null);
    try {
      await reentrenarClasificador();
      if (!montadoRef.current) return;
      setEstadoReentreno({ estado: 'en_curso', log: '' });
    } catch (e) {
      if (!montadoRef.current) return;
      if (e.status === 409) setErrorReentreno('Ya hay un reentrenamiento corriendo. Esperá a que termine.');
      else if (e.status === 400) setErrorReentreno(`Todavía hay pocas muestras para reentrenar: ${e.message}`);
      else setErrorReentreno(e.message);
    } finally {
      if (montadoRef.current) setIniciando(false);
    }
  }

  const total = resumen?.total ?? 0;
  const meta = resumen?.minimo_recomendado ?? META_MUESTRAS;
  const porcentaje = Math.min(100, Math.round((total / meta) * 100));
  const clases = resumen ? Object.entries(resumen.por_clase) : [];
  const minimoPorClase = clases.length > 0 ? meta / clases.length : 0;
  const ocupadaFoto = cuenta !== null || guardando || borrando || subiendoTablero;
  const turnoBlancas = fen.split(' ')[1] !== 'b';

  return (
    <div className="w-full min-w-0 flex flex-col gap-space-md px-4 py-4 md:px-6">
      <header className="flex flex-col gap-1">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="self-start min-h-[44px] inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-lg"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver a Cámara y Brazo
          </button>
        )}
        <h2 className="font-headline-md text-headline-md text-on-surface">Entrenar cámara</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Armá en el tablero físico la posición que ves acá, sacá la foto y avanzá con la jugada. Con suficientes
          fotos podés reentrenar el clasificador de piezas.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        {/* 1. Posición */}
        <section className={CLASE_TARJETA} aria-labelledby="titulo-posicion">
          <h3 id="titulo-posicion" className="font-body-md text-body-md text-on-surface font-medium">
            Posición en el tablero físico
          </h3>
          <TableroSoloLectura fen={fen} className="mx-auto" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Mueven: <strong className="text-on-surface">{turnoBlancas ? 'blancas' : 'negras'}</strong>. Pasos hechos:{' '}
            {historial.length}.
          </p>

          <form onSubmit={aplicarJugada} className="flex flex-col gap-space-xs">
            <label htmlFor="entrenar-jugada" className="font-body-sm text-body-sm text-on-surface">
              Jugada que hiciste en el tablero (e4, Nf3, O-O, exd5)
            </label>
            <div className="flex flex-col sm:flex-row gap-space-xs">
              <input
                id="entrenar-jugada"
                className={CLASE_CAMPO}
                value={jugada}
                onChange={(e) => setJugada(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-invalid={errorJugada ? 'true' : 'false'}
              />
              <button type="submit" className={CLASE_BOTON_PRIMARIO} disabled={!jugada.trim()}>
                Aplicar jugada
              </button>
            </div>
            {errorJugada && (
              <p className={CLASE_AVISO} role="alert">
                {errorJugada}
              </p>
            )}
          </form>

          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON} onClick={deshacer} disabled={historial.length === 0}>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">undo</span>Deshacer
              </span>
            </button>
            <button type="button" className={CLASE_BOTON} onClick={reiniciar}>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>Posición inicial
              </span>
            </button>
          </div>

          <form onSubmit={usarPosicionLibre} className="flex flex-col gap-space-xs">
            <label htmlFor="entrenar-libre" className="font-body-sm text-body-sm text-on-surface">
              Posición libre (FEN de piezas, para varias damas o reyes)
            </label>
            <div className="flex flex-col sm:flex-row gap-space-xs">
              <input
                id="entrenar-libre"
                className={CLASE_CAMPO}
                value={fenLibre}
                onChange={(e) => setFenLibre(e.target.value)}
                placeholder="4k3/8/8/3Q4/8/8/8/4K3"
                autoComplete="off"
                spellCheck="false"
                aria-invalid={errorLibre ? 'true' : 'false'}
              />
              <button type="submit" className={CLASE_BOTON} disabled={!fenLibre.trim()}>
                Usar posición
              </button>
            </div>
            {errorLibre && (
              <p className={CLASE_AVISO} role="alert">
                {errorLibre}
              </p>
            )}
          </form>
        </section>

        <div className="flex flex-col gap-space-md min-w-0">
          {/* 2. Foto */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-foto">
            <h3 id="titulo-foto" className="font-body-md text-body-md text-on-surface font-medium">
              Sacar foto
            </h3>
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={sacarFoto} disabled={ocupadaFoto}>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                {guardando ? 'Guardando…' : 'Sacar foto'}
              </span>
            </button>
            <div className="flex flex-col gap-space-xs">
              <label htmlFor="subir-tablero" className="font-body-sm text-body-sm text-on-surface">
                o subir foto del tablero (usa la posición que ves en pantalla)
              </label>
              <input
                id="subir-tablero"
                type="file"
                accept="image/*"
                onChange={subirFotoDeTablero}
                disabled={ocupadaFoto}
                className="min-h-[44px] w-full min-w-0 font-body-sm text-body-sm text-on-surface disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              {subiendoTablero && <p className="font-body-sm text-body-sm text-on-surface-variant">Subiendo…</p>}
            </div>
            <div aria-live="polite" className="min-h-[1.5rem]">
              {cuenta !== null && (
                <p className="font-body-md text-body-md text-on-surface">
                  Sacá la mano del tablero. Foto en <strong className="text-primary">{cuenta}</strong>…
                </p>
              )}
              {mensajeFoto && cuenta === null && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">{mensajeFoto}</p>
              )}
            </div>
            {errorFoto && (
              <p className={CLASE_AVISO} role="alert">
                {errorFoto}
              </p>
            )}
            {urlControl && (
              <figure className="flex flex-col gap-space-xs m-0">
                <img
                  src={urlControl}
                  alt="Imagen de control: el tablero enderezado con la grilla 8x8 encima"
                  className="w-full max-w-full h-auto rounded-lg border border-outline-variant"
                />
                <figcaption className="font-body-sm text-body-sm text-on-surface-variant">
                  Revisá que la grilla calce con las casillas. Si salió torcida, borrá la captura y repetí.
                </figcaption>
              </figure>
            )}
            {ultimaCaptura && (
              <button type="button" className={CLASE_BOTON} onClick={borrarCaptura} disabled={ocupadaFoto}>
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  {borrando ? 'Borrando…' : 'Borrar esta captura'}
                </span>
              </button>
            )}
          </section>

          {/* 2b. Fotos por pieza */}
          <SubirFotosPieza porClase={resumen?.por_clase} minimoPorClase={minimoPorClase} onSubido={cargarResumen} />

          {/* 3. Progreso */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-progreso">
            <h3 id="titulo-progreso" className="font-body-md text-body-md text-on-surface font-medium">
              Muestras juntadas
            </h3>
            {errorResumen && (
              <p className={CLASE_AVISO} role="alert">
                No se pudo leer el resumen: {errorResumen}
              </p>
            )}
            <p className="font-body-sm text-body-sm text-on-surface">
              <strong>{total}</strong> de {meta} muestras ({resumen?.capturas ?? 0} capturas)
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={meta}
              aria-valuenow={Math.min(total, meta)}
              aria-label="Muestras juntadas sobre la meta"
              className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden"
            >
              <div className="h-full bg-primary-container" style={{ width: `${porcentaje}%` }} />
            </div>
            {clases.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs list-none p-0 m-0">
                {clases.map(([clase, cantidad]) => {
                  const pocas = cantidad < minimoPorClase;
                  return (
                    <li
                      key={clase}
                      className={`flex items-center justify-between gap-1 rounded-lg px-space-xs py-1 font-body-sm text-body-sm min-w-0 ${
                        pocas
                          ? 'border-2 border-dashed border-error text-error bg-surface-container'
                          : 'border border-outline-variant text-on-surface bg-surface-container'
                      }`}
                    >
                      <span className="truncate">{clase}</span>
                      <span className="shrink-0">
                        {pocas && <span className="material-symbols-outlined text-[14px] align-middle" aria-hidden="true">warning</span>}{' '}
                        <strong>{cantidad}</strong>
                        {pocas && <span className="sr-only"> (pocas muestras)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {clases.length > 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Las clases con borde punteado y aviso tienen pocas muestras: armá posiciones que las incluyan.
              </p>
            )}
          </section>

          {/* 4. Reentrenar */}
          <section className={CLASE_TARJETA} aria-labelledby="titulo-reentrenar">
            <h3 id="titulo-reentrenar" className="font-body-md text-body-md text-on-surface font-medium">
              Reentrenar
            </h3>
            <button
              type="button"
              className={CLASE_BOTON_PRIMARIO}
              onClick={reentrenar}
              disabled={total < MINIMO_REENTRENAR || enCurso || iniciando}
            >
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">model_training</span>
                {iniciando ? 'Iniciando…' : enCurso ? 'Reentrenando…' : 'Reentrenar con mis fotos'}
              </span>
            </button>
            {total < MINIMO_REENTRENAR && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Hacen falta al menos {MINIMO_REENTRENAR} muestras para reentrenar (tenés {total}).
              </p>
            )}
            {errorReentreno && (
              <p className={CLASE_AVISO} role="alert">
                {errorReentreno}
              </p>
            )}
            {estadoReentreno && (
              <p className="font-body-sm text-body-sm text-on-surface" role="status">
                {MENSAJES_ESTADO[estadoReentreno.estado] ?? estadoReentreno.estado}
              </p>
            )}
            {estadoReentreno?.log && (
              <pre
                className="m-0 max-h-64 overflow-auto rounded-lg bg-surface-container p-space-xs font-mono-micro text-mono-micro text-on-surface-variant whitespace-pre-wrap break-words"
                aria-label="Registro del reentrenamiento"
              >
                {estadoReentreno.log}
              </pre>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
