import { useEffect, useState } from 'react';
import './SalaControl.css';
import {
  analizarPosicion,
  backendEnLinea,
  crearPartida,
  moverPartida,
  obtenerPartida,
  reconocerTablero,
  urlFotoCamara,
} from '../../api/backend';
import { claseDePieza, esPromocionDePeon, fenAMatriz, nombreCasilla, turnoDeFen } from '../../ajedrez';

const NIVEL_MAX = 20;

export default function SalaControl({ partidaIdInicial, alCargarPartida }) {
  const [partidaId, setPartidaId] = useState(null);
  const [fen, setFen] = useState(null);
  const [nivel, setNivel] = useState(NIVEL_MAX);
  const [terminada, setTerminada] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [casillaOrigen, setCasillaOrigen] = useState(null);
  const [jugadas, setJugadas] = useState([]);
  const [analisis, setAnalisis] = useState(null);
  const [evaluacionesHistorial, setEvaluacionesHistorial] = useState([]);
  const [backendConectado, setBackendConectado] = useState(null);
  const [fotoKey, setFotoKey] = useState(0);
  const [fenReconocido, setFenReconocido] = useState(null);
  const [cargando, setCargando] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (partidaIdInicial) {
      cargarPartidaExistente(partidaIdInicial);
      alCargarPartida?.();
    } else {
      manejarNuevaPartida();
    }
    const intervalo = setInterval(async () => {
      setBackendConectado(await backendEnLinea());
    }, 5000);
    backendEnLinea().then(setBackendConectado);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaIdInicial]);

  async function actualizarAnalisis(fenActual) {
    try {
      const datos = await analizarPosicion(fenActual, nivel);
      setAnalisis(datos);
      if (typeof datos.evaluacion_cp === 'number') {
        setEvaluacionesHistorial((previas) => [...previas.slice(-9), datos.evaluacion_cp]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function cargarPartidaExistente(id) {
    setError(null);
    setCargando('nueva');
    try {
      const partida = await obtenerPartida(id);
      setPartidaId(partida.id);
      setFen(partida.fen);
      setNivel(partida.nivel);
      setTerminada(partida.terminada);
      setResultado(partida.resultado);
      setJugadas(partida.jugadas);
      setCasillaOrigen(null);
      setEvaluacionesHistorial([]);
      if (!partida.terminada) {
        await actualizarAnalisis(partida.fen);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function manejarNuevaPartida() {
    setError(null);
    setCargando('nueva');
    try {
      const partida = await crearPartida(nivel);
      setPartidaId(partida.id);
      setFen(partida.fen);
      setTerminada(false);
      setResultado(null);
      setJugadas(partida.jugadas);
      setCasillaOrigen(null);
      setEvaluacionesHistorial([]);
      await actualizarAnalisis(partida.fen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function manejarClicCasilla(casilla) {
    if (!partidaId || terminada) return;
    if (!casillaOrigen) {
      setCasillaOrigen(casilla);
      return;
    }
    const origen = casillaOrigen;
    setCasillaOrigen(null);
    if (origen === casilla) return;

    const jugadaUci = origen + casilla + (esPromocionDePeon(fen, origen, casilla) ? 'q' : '');
    setError(null);
    setCargando('mover');
    try {
      const datos = await moverPartida(partidaId, jugadaUci);
      setFen(datos.fen);
      setTerminada(datos.terminada);
      setResultado(datos.resultado);
      setJugadas(datos.jugadas);
      if (!datos.terminada) {
        await actualizarAnalisis(datos.fen);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function manejarReevaluar() {
    if (!fen) return;
    setCargando('reevaluar');
    try {
      await actualizarAnalisis(fen);
    } finally {
      setCargando(null);
    }
  }

  async function manejarReconocerTablero() {
    setCargando('reconocer');
    setError(null);
    setFenReconocido(null);
    try {
      const datos = await reconocerTablero(fen ? turnoDeFen(fen) : 'w');
      setFenReconocido(datos.fen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  function actualizarFoto() {
    setFotoKey((valor) => valor + 1);
  }

  const matriz = fen ? fenAMatriz(fen) : null;
  const turnoActual = fen ? turnoDeFen(fen) : 'w';
  const porcentajeVentaja = calcularPorcentajeBarra(analisis);

  return (
    <div className="w-full px-space-lg py-space-md flex flex-col gap-space-lg max-w-[1720px] mx-auto animate-in fade-in duration-500">
      {/* SUB-BARRA DE ESTADO SUPERIOR */}
      <div className="flex items-center justify-between px-space-md py-space-xs rounded-xl bg-surface-container-low/70 shadow-md flex-wrap gap-2">
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-2xs">
            <span className={`w-2 h-2 rounded-full ${partidaId && !terminada ? 'bg-primary-container animate-pulse shadow-[0_0_8px_#00e5ff]' : 'bg-outline'}`}></span>
            <span className="font-mono-micro text-mono-micro tracking-widest text-primary uppercase font-medium">
              {partidaId ? `PARTIDA ${partidaId.slice(0, 8)}` : 'SIN PARTIDA'}
            </span>
          </div>
          <div className="h-3 w-[1px] bg-surface-variant"></div>
          <span className="font-mono-label text-mono-label text-on-surface-variant">STOCKFISH · NIVEL {nivel}</span>
        </div>
        <div className="flex items-center gap-space-lg">
          {terminada ? (
            <span className="font-mono-metric text-mono-metric text-primary font-medium">TERMINADA — {resultado}</span>
          ) : (
            <div className="flex items-center gap-space-xs font-mono-metric text-mono-metric">
              <span className="text-on-surface-variant font-mono-micro text-mono-micro uppercase">TURNO:</span>
              <span className="text-primary font-medium">{turnoActual === 'w' ? 'BLANCAS (VOS)' : 'NEGRAS (MOTOR)'}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* COLUMNA IZQUIERDA: CÁMARA REAL Y ESTADO DEL BRAZO (simulado, sin hardware) */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-primary">videocam</span> CÁMARA FIJA
              </span>
              <button
                onClick={actualizarFoto}
                className="font-mono-micro text-mono-micro text-primary-fixed-dim px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                ACTUALIZAR
              </button>
            </div>
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center">
              {fotoKey === 0 ? (
                <span className="font-mono-micro text-mono-micro text-on-surface-variant px-space-sm text-center">
                  Sin captura todavía — tocá ACTUALIZAR
                </span>
              ) : (
                <img
                  className="absolute inset-0 w-full h-full object-cover"
                  alt="Foto de la cámara fija sobre el tablero"
                  src={urlFotoCamara()}
                  onError={() => setError('No se pudo obtener la foto de la cámara — ¿está conectada?')}
                />
              )}
            </div>
            <button
              onClick={manejarReconocerTablero}
              disabled={cargando === 'reconocer'}
              className="w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              {cargando === 'reconocer' ? 'RECONOCIENDO…' : 'RECONOCER TABLERO (HU1)'}
            </button>
            {fenReconocido && (
              <div className="bg-surface-container-lowest p-2 rounded-lg font-mono-micro text-mono-micro text-primary-fixed-dim break-all">
                FEN reconocido: {fenReconocido}
              </div>
            )}
          </div>

          {/* ESTADO DEL BRAZO — honesto: no hay hardware real conectado todavía */}
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-primary">precision_manufacturing</span> BRAZO ROBÓTICO
              </span>
            </div>
            <div className="bg-surface-container-lowest p-3 rounded-lg flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro text-outline uppercase">Estado</span>
              <span className="font-mono-micro text-mono-micro px-2 py-0.5 rounded bg-primary/10 text-primary uppercase font-medium">
                SIN HARDWARE — SOLO SIMULADO
              </span>
            </div>
            <div className="bg-surface-container-lowest p-1.5 rounded-lg flex items-center">
              <button
                disabled
                title="El kit físico todavía no llegó — ver CLAUDE.md"
                className="flex-1 py-1 text-center font-mono-micro text-mono-micro rounded text-outline cursor-not-allowed"
              >
                FÍSICO (ROBOT)
              </button>
              <button className="flex-1 py-1 text-center font-mono-micro text-mono-micro rounded bg-primary text-on-primary font-medium shadow-sm">
                SIMULADOR
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA CENTRAL: TABLERO REAL */}
        <div className="xl:col-span-6 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[660px] flex items-center justify-center">
            {analisis && (
              <div className="absolute -left-7 top-6 bottom-6 w-3 rounded-full bg-surface-container-high overflow-hidden shadow-inner flex flex-col justify-end p-0.5">
                <div
                  className="w-full bg-gradient-to-t from-primary-container to-primary rounded-full transition-all duration-700 shadow-[0_0_8px_#00e5ff]"
                  style={{ height: `${porcentajeVentaja}%` }}
                ></div>
                <span className="absolute -left-11 top-1/2 -translate-y-1/2 font-mono-micro text-mono-micro font-medium text-primary bg-surface-container-lowest/90 px-1 py-0.5 rounded shadow">
                  {formatearEvaluacion(analisis)}
                </span>
              </div>
            )}

            <div
              className="w-full aspect-square p-5 sm:p-7 rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.7)] relative flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #422617 0%, #2c180e 25%, #4a2b1b 50%, #20110a 75%, #3d2215 100%)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8), 0 20px 40px -10px #000',
              }}
            >
              <div
                className="w-full h-full rounded-lg p-2.5 sm:p-3 relative flex items-center justify-center shadow-inner"
                style={{ background: 'linear-gradient(180deg, #1b0e08 0%, #2d180f 100%)' }}
              >
                <div className="w-full h-full grid grid-cols-8 grid-rows-8 rounded shadow-2xl overflow-hidden relative">
                  {matriz &&
                    matriz.map((fila, indiceFila) =>
                      fila.map((pieza, indiceColumna) => {
                        const casilla = nombreCasilla(indiceFila, indiceColumna);
                        const clara = (indiceFila + indiceColumna) % 2 === 0;
                        const seleccionada = casilla === casillaOrigen;
                        return (
                          <button
                            key={casilla}
                            type="button"
                            onClick={() => manejarClicCasilla(casilla)}
                            aria-label={`Casilla ${casilla}${pieza ? ', pieza ' + pieza : ', vacía'}`}
                            className={`relative flex items-center justify-center ${clara ? 'bg-[#b89772]' : 'bg-[#543423]'} ${seleccionada ? 'ring-2 ring-inset ring-primary' : ''}`}
                          >
                            {pieza && <div className={claseDePieza(pieza)}></div>}
                          </button>
                        );
                      })
                    )}
                </div>

                <div className="absolute left-1 top-2 bottom-2 flex flex-col justify-around font-mono-micro text-[9px] text-[#e0cfba]/40 pointer-events-none font-bold select-none">
                  <span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                </div>
                <div className="absolute bottom-0.5 left-4 right-4 flex justify-around font-mono-micro text-[9px] text-[#e0cfba]/40 pointer-events-none font-bold select-none">
                  <span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[660px] mt-space-md flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-space-md p-space-sm rounded-xl bg-surface-container-low shadow-xl flex-wrap">
              <div className="flex items-center gap-space-sm pl-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                <div className="flex flex-col">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase">JUGADA SUGERIDA</span>
                  <span className="font-mono-metric text-mono-metric text-on-surface font-semibold tracking-tight">
                    {analisis?.jugada ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-space-xs">
                <label className="font-mono-micro text-mono-micro text-outline uppercase" htmlFor="nivelSelect">Nivel</label>
                <select
                  id="nivelSelect"
                  value={nivel}
                  onChange={(evento) => setNivel(Number(evento.target.value))}
                  className="bg-surface-container-high rounded-lg px-2 py-1 font-mono-label text-mono-label text-on-surface"
                >
                  {Array.from({ length: NIVEL_MAX + 1 }, (_, valor) => valor).map((valor) => (
                    <option key={valor} value={valor}>{valor}</option>
                  ))}
                </select>
                <button
                  onClick={manejarReevaluar}
                  disabled={cargando === 'reevaluar' || !fen}
                  className="px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span> REEVALUAR
                </button>
                <button
                  onClick={manejarNuevaPartida}
                  disabled={cargando === 'nueva'}
                  className="px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-lg font-medium shadow-[0_0_16px_rgba(0,229,255,0.35)] hover:shadow-[0_0_24px_rgba(0,229,255,0.6)] hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                  NUEVA PARTIDA
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ANÁLISIS REAL DE STOCKFISH E HISTORIAL */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">neurology</span>
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-medium">STOCKFISH</span>
              </div>
              <span className={`font-mono-micro text-mono-micro px-1.5 py-0.5 rounded ${backendConectado ? 'text-primary bg-primary/10' : 'text-error bg-error-container'}`}>
                {backendConectado === null ? 'VERIFICANDO…' : backendConectado ? 'BACKEND CONECTADO' : 'BACKEND SIN CONEXIÓN'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">VENTAJA</span>
                <span className="font-mono-metric text-mono-metric text-primary font-medium mt-0.5">{formatearEvaluacion(analisis)}</span>
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">PROF.</span>
                <span className="font-mono-metric text-mono-metric text-on-surface font-medium mt-0.5">{analisis?.profundidad ?? '—'}</span>
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">NODOS</span>
                <span className="font-mono-metric text-mono-metric text-on-surface font-medium mt-0.5">{formatearNodos(analisis?.nodos)}</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3 rounded-lg flex flex-col gap-1.5">
              <span className="font-mono-micro text-mono-micro text-outline uppercase">CURVA DE VENTAJA (esta sesión)</span>
              <SparklineEvaluacion valores={evaluacionesHistorial} />
            </div>

            {analisis?.variacion_principal?.length > 0 && (
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">LÍNEA PRINCIPAL (PV)</span>
                <span className="font-mono-micro text-mono-micro text-primary-fixed-dim leading-relaxed break-words">
                  {analisis.variacion_principal.join(' ')}
                </span>
              </div>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm flex-1">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">format_list_numbered</span> MOVIMIENTOS DE ESTA PARTIDA
            </span>
            <div className="flex flex-col gap-1 font-mono-label text-mono-label max-h-64 overflow-y-auto">
              {jugadas.length === 0 && (
                <span className="font-mono-micro text-mono-micro text-outline px-2 py-1">Todavía no se jugó ninguna jugada.</span>
              )}
              {agruparJugadasPorRonda(jugadas).map((ronda) => (
                <div key={ronda.numero} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant">
                  <span className="text-outline w-6">{ronda.numero}.</span>
                  <span className="w-20">{ronda.blancas}</span>
                  <span className="w-20">{ronda.negras ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function agruparJugadasPorRonda(jugadas) {
  const rondas = [];
  for (let i = 0; i < jugadas.length; i += 2) {
    rondas.push({ numero: i / 2 + 1, blancas: jugadas[i], negras: jugadas[i + 1] });
  }
  return rondas.reverse();
}

function calcularPorcentajeBarra(analisis) {
  if (!analisis) return 50;
  if (analisis.mate_en != null) return analisis.mate_en > 0 ? 95 : 5;
  const cp = analisis.evaluacion_cp ?? 0;
  const acotado = Math.max(-800, Math.min(800, cp));
  return 50 + (acotado / 800) * 45;
}

function formatearEvaluacion(analisis) {
  if (!analisis) return '—';
  if (analisis.mate_en != null) return `M${Math.abs(analisis.mate_en)}`;
  if (analisis.evaluacion_cp == null) return '—';
  const valor = (analisis.evaluacion_cp / 100).toFixed(2);
  return analisis.evaluacion_cp > 0 ? `+${valor}` : valor;
}

function formatearNodos(nodos) {
  if (nodos == null) return '—';
  if (nodos >= 1_000_000) return `${(nodos / 1_000_000).toFixed(1)}M`;
  if (nodos >= 1_000) return `${(nodos / 1_000).toFixed(1)}K`;
  return String(nodos);
}

function SparklineEvaluacion({ valores }) {
  if (!valores || valores.length < 2) {
    return <span className="font-mono-micro text-mono-micro text-outline">Jugá para ver la curva</span>;
  }
  const minimo = Math.min(...valores, -100);
  const maximo = Math.max(...valores, 100);
  const rango = maximo - minimo || 1;
  const puntos = valores
    .map((valor, indice) => {
      const x = (indice / (valores.length - 1)) * 160;
      const y = 36 - ((valor - minimo) / rango) * 36;
      return `${x} ${y}`;
    })
    .join(' L ');
  return (
    <div className="w-full h-11 flex items-end pt-1">
      <svg className="w-full h-full text-primary overflow-visible" fill="none" viewBox="0 0 160 36">
        <path d={`M ${puntos}`} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
      </svg>
    </div>
  );
}
