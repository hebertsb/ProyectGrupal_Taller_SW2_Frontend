import { useState, useEffect, useCallback, useRef } from 'react';
import { listarPartidas, obtenerPartida, estadoModelo } from '../../api/backend';
import { fenAMatriz, rutaImagenPieza, POSICION_INICIAL_FEN } from '../../ajedrez';
import { clasificarJugada, caidaDeJugada, comoMejorarPorCategoria, ESTILO_CATEGORIA } from '../../aprendizaje';
import { useRazonamiento } from '../../contexto/ContextoRazonamiento';
import CerebroNeuronal from './CerebroNeuronal';
import CerebroRed from './CerebroRed';

const PRESETS_FEN = [
  { etiqueta: 'Siciliana', fen: 'r1bqk2r/pp2bppp/2n1p3/3p4/3P4/2PB1N2/P4PPP/RNBQ1RK1 w kq - 1 14' },
  { etiqueta: 'Española', fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
  { etiqueta: 'Final Torres', fen: '4r1k1/5ppp/8/8/8/8/4RPPP/6K1 w - - 0 1' },
];

/** Leyenda del cerebro — cada color mapea a un dato REAL, nada conceptual. */
const LEYENDA_CEREBRO = [
  {
    color: 'bg-neon-cyan',
    texto: 'text-neon-cyan',
    titulo: 'Saliencia',
    detalle: 'Qué casillas del tablero importaron para la decisión (gradiente real por casilla).',
  },
  {
    color: 'bg-neon-purple',
    texto: 'text-neon-purple',
    titulo: 'Atención por bloque',
    detalle: 'Fuerza de activación de cada bloque residual SE, de más superficial a más profundo.',
  },
  {
    color: 'bg-neon-lime',
    texto: 'text-neon-lime',
    titulo: 'Jugada elegida',
    detalle: 'Corteza motora — pulsa más fuerte cuanto mayor la confianza de la jugada top-1.',
  },
  {
    color: 'bg-neon-orange',
    texto: 'text-neon-orange',
    titulo: 'Comparación Stockfish',
    detalle: 'Halo de referencia de calidad — Stockfish nunca decide la jugada, solo compara.',
  },
  {
    color: 'bg-on-surface-variant',
    texto: 'text-on-surface-variant',
    titulo: 'Analizando',
    detalle: 'Inferencia en curso — las partículas se ven pálidas y a la deriva mientras el modelo calcula.',
  },
];

function formatearCp(cp) {
  if (cp == null) return '—';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
}

/**
 * A diferencia de `formatearCp` (donde `null` = "sin dato" → "—"), en
 * `candidatas_detalladas` el backend devuelve `evaluacion_stockfish_cp: null`
 * específicamente cuando esa línea es mate forzado según Stockfish — se
 * muestra explícito en vez de confundirlo con "no hay dato".
 */
function formatearEvalCandidata(cp) {
  if (cp === null || cp === undefined) return 'Mate';
  return formatearCp(cp);
}

/**
 * Etiqueta de qué tan de acuerdo está Stockfish con una candidata puntual, a partir de
 * `diferencia_cp` (cuánto peor es esa candidata respecto de la mejor jugada de Stockfish
 * en la posición). El backend no define un corte oficial, así que se usa un criterio
 * simple en centipeones: diferencias chicas se tratan como ruido de evaluación (Stockfish
 * también la aprueba), diferencias moderadas como "sigue siendo sólida", y diferencias
 * grandes en una candidata con bandera de riesgo táctico confirman que Turing hizo bien en
 * no jugarla.
 */
function etiquetaRelacionStockfish(diferenciaCp, tieneRiesgoTactico) {
  const magnitud = Math.abs(diferenciaCp ?? 0);
  if (magnitud <= 20) return { texto: 'Coincide con Stockfish', clase: 'text-neon-lime' };
  if (magnitud <= 75) return { texto: 'También sólida', clase: 'text-neon-cyan' };
  if (tieneRiesgoTactico) return { texto: 'Confirma el riesgo', clase: 'text-error' };
  return { texto: 'Stockfish prefiere otra', clase: 'text-neon-orange' };
}

/**
 * El backend genera `creada_en` en UTC, pero en algunos entornos el string
 * llega sin sufijo de zona horaria (ej. "2026-09-26T00:11:56.174" en vez de
 * "...174+00:00") — sin el sufijo, `new Date(...)` lo interpreta como hora
 * LOCAL del navegador en vez de UTC, mostrando una hora varias horas
 * adelantada. Si no trae offset explícito, se asume UTC (agregando "Z") y se
 * formatea siempre en huso horario de Bolivia, sin depender de cómo esté
 * configurado el reloj del sistema del navegador.
 */
function formatearFechaBolivia(iso) {
  const tieneOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const fecha = new Date(tieneOffset ? iso : `${iso}Z`);
  return fecha.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * El humano siempre juega blancas (ver `Partida`, backend). `resultado` viene
 * en notación PGN ("1-0", "0-1", "1/2-1/2") — se traduce a algo legible.
 */
function resultadoPartida(p) {
  if (!p.terminada) return { etiqueta: 'En curso', clase: 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30' };
  if (p.resultado === '1-0') return { etiqueta: 'Ganaste', clase: 'text-neon-lime bg-neon-lime/10 border-neon-lime/30' };
  if (p.resultado === '0-1') return { etiqueta: 'Perdiste', clase: 'text-error bg-error/10 border-error/30' };
  if (p.resultado === '1/2-1/2') return { etiqueta: 'Empate', clase: 'text-on-surface-variant bg-surface-container-high border-outline-variant/30' };
  return { etiqueta: 'Terminada', clase: 'text-on-surface-variant bg-surface-container-high border-outline-variant/30' };
}

function colorSaliencia(valor, alfa = 1) {
  const v = Math.max(0, Math.min(1, valor));
  const r = Math.round(255 * v);
  const g = Math.round(255 * (1 - v));
  return `rgba(${r}, ${g}, 0, ${alfa})`;
}

/** Top-N casillas por saliencia real (índice en orden chess.SQUARES: a1..h1,a2..h2,...,a8..h8). */
function casillasCalientes(saliencia, cantidad = 3) {
  return saliencia
    .map((valor, indice) => ({ valor, casilla: `${'abcdefgh'[indice % 8]}${Math.floor(indice / 8) + 1}` }))
    .filter((c) => c.valor > 0.01)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, cantidad);
}

let logIdSeq = 0;

export default function RazonamientoNeuronal() {
  const { ultimaInferencia, estaAnalizando, dispararInferencia } = useRazonamiento() ?? {};

  const [partidaId, setPartidaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [partida, setPartida] = useState(null);
  const [cargandoPartida, setCargandoPartida] = useState(false);
  const [fenActual, setFenActual] = useState(() => ultimaInferencia?.fen ?? POSICION_INICIAL_FEN);
  const [estadoModeloData, setEstadoModeloData] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  // Arranca cerrado siempre — mostrarlo automáticamente cada vez que no hay una
  // inferencia todavía en memoria (ej. recién recargada la página) tapaba la pantalla
  // con la lista completa de partidas jugadas en cada reload. El botón "Elegir partida
  // jugada" (icono history, más abajo) lo vuelve a abrir cuando el usuario lo pide.
  const [mostrarSelector, setMostrarSelector] = useState(false);
  // Panel "Candidatas de Turing" — arranca expandido para que la defensa lo vea completo
  // de entrada; el usuario lo puede colapsar a la barra resumen para no alargar la pantalla.
  const [candidatasAbiertas, setCandidatasAbiertas] = useState(true);
  // Selector de vista del "Mapa de Activación Neuronal" — dos lentes sobre el mismo dato
  // real (mismas props a ambas), 'organico' (partículas) es el default histórico.
  const [vistaCerebro, setVistaCerebro] = useState('organico');

  const analizandoPrevRef = useRef(false);

  const agregarLog = useCallback((mensaje, tipo = 'INFO') => {
    const entrada = { id: ++logIdSeq, hora: new Date().toLocaleTimeString('es-BO', { hour12: false }), mensaje, tipo };
    setLogs((prev) => [...prev.slice(-24), entrada]);
  }, []);

  useEffect(() => {
    agregarLog('Consola lista — en espera de pulsos sinápticos.', 'HUD');
    setCargandoEstado(true);
    estadoModelo()
      .then((data) => {
        setEstadoModeloData(data);
        agregarLog(
          data?.disponible
            ? `Modelo cargado v${data.version} (${data.dispositivo}).`
            : 'Modelo no disponible — falta checkpoint local.',
          data?.disponible ? 'MODEL' : 'WARN'
        );
      })
      .catch(() => {
        setEstadoModeloData({ disponible: false });
        agregarLog('No se pudo consultar el estado del modelo.', 'ERROR');
      })
      .finally(() => setCargandoEstado(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!partidaId) return;
    setCargandoPartida(true);
    setError(null);
    obtenerPartida(partidaId)
      .then((p) => {
        setPartida(p);
        setFenActual(p.fen ?? POSICION_INICIAL_FEN);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargandoPartida(false));
  }, [partidaId]);

  useEffect(() => {
    if (!partidaId) {
      setCargandoHistorial(true);
      listarPartidas()
        .then(setHistorial)
        .catch((err) => setError(err.message))
        .finally(() => setCargandoHistorial(false));
    }
  }, [partidaId]);

  // Dispara inferencia real solo si todavía no tenemos el dato para esta posición exacta
  // (evita refetch innecesario cuando `fenActual` arrancó con el valor de la última
  // inferencia en vivo, ver useState de arriba).
  useEffect(() => {
    if (!fenActual || !estadoModeloData?.disponible || !dispararInferencia) return;
    if (ultimaInferencia?.fen === fenActual) return;
    dispararInferencia(fenActual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fenActual, estadoModeloData?.disponible]);

  // Logs de eventos reales — se derivan de los cambios del contexto compartido en vez de
  // envolver el fetch acá (la inferencia puede venir de Sala de Control, no solo de este panel).
  useEffect(() => {
    if (estaAnalizando && !analizandoPrevRef.current) {
      agregarLog('Inferencia solicitada al modelo propio…', 'FORWARD');
    }
    analizandoPrevRef.current = estaAnalizando;
  }, [estaAnalizando, agregarLog]);

  useEffect(() => {
    if (!ultimaInferencia) return;
    agregarLog(
      `Respuesta recibida en ${ultimaInferencia.latencia_ms.toFixed(1)}ms — jugada elegida ${ultimaInferencia.jugada_elegida}.`,
      'BEST'
    );
    // Solo cuando cambia la referencia (nueva respuesta real), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimaInferencia]);

  function elegirPartida(id) {
    setError(null);
    setPartidaId(id);
    setMostrarSelector(false);
  }

  function cambiarPartida() {
    setPartidaId(null);
    setPartida(null);
    setFenActual(POSICION_INICIAL_FEN);
    setError(null);
    setMostrarSelector(true);
  }

  function usarPosicionInicial() {
    setFenActual(POSICION_INICIAL_FEN);
    setPartidaId(null);
    setPartida(null);
    setError(null);
  }

  function usarPreset(fen, etiqueta) {
    setFenActual(fen);
    setPartidaId(null);
    setPartida(null);
    setError(null);
    agregarLog(`Preset cargado: ${etiqueta}.`, 'FEN');
  }

  function sincronizarConPartidaViva() {
    if (!ultimaInferencia) return;
    setFenActual(ultimaInferencia.fen);
    setPartidaId(null);
    setPartida(null);
    setMostrarSelector(false);
    agregarLog('Sincronizado con la última inferencia en vivo de Sala de Control.', 'SYNC');
  }

  function copiarFen() {
    navigator.clipboard?.writeText(fenActual).then(() => agregarLog('FEN copiado al portapapeles.', 'CLIPBOARD'));
  }

  function limpiarConsola() {
    setLogs([]);
  }

  // Solo se muestran datos que corresponden EXACTAMENTE a `fenActual` — si la última
  // inferencia real fue disparada para otra posición (ej. una jugada en Sala de Control
  // mientras acá se estaba explorando otro FEN), no se mezcla con la vista actual.
  const inferenciaVigente = ultimaInferencia && ultimaInferencia.fen === fenActual ? ultimaInferencia : null;
  const hayInferenciaVivaDistinta = Boolean(ultimaInferencia) && ultimaInferencia.fen !== fenActual;

  const candidatas = inferenciaVigente?.candidatas ?? [];
  const saliencia = inferenciaVigente?.saliencia ?? Array(64).fill(0);
  const atencionPorBloque = inferenciaVigente?.atencion_por_bloque ?? [];
  const matriz = fenAMatriz(fenActual);
  const campos = fenActual.split(' ');
  const turno = campos[1] === 'b' ? 'Negras' : 'Blancas';
  const numeroJugada = campos[5] ?? '1';
  const dispositivo = estadoModeloData?.dispositivo ?? '—';
  const versionModelo = estadoModeloData?.disponible ? `v${estadoModeloData.version}` : '—';
  const fechaEntrenamiento = estadoModeloData?.disponible ? estadoModeloData.fecha_entrenamiento : '—';
  const latenciaMs = inferenciaVigente?.latencia_ms ?? null;
  const latenciaFormateada = latenciaMs !== null ? `${latenciaMs.toFixed(1)} ms` : estaAnalizando ? '…' : '—';
  const top1 = candidatas[0] ?? null;
  const sumaProbabilidades = candidatas.reduce((acc, c) => acc + (c.probabilidad ?? 0), 0);
  const calientes = casillasCalientes(saliencia, 3);
  const cmp = inferenciaVigente?.comparacion_stockfish ?? null;
  // Eval del modelo derivada de la comparación con Stockfish (misma cuenta que en el
  // diagnóstico pedagógico): eval_stockfish - diferencia = eval de la jugada del modelo.
  const evalModelo = cmp ? cmp.evaluacion_cp - cmp.diferencia_cp : null;
  // Detalle táctico de las 3 candidatas reales de la red (verificado por Turing) + la
  // evaluación puntual de Stockfish para cada una — ver panel "Candidatas de Turing".
  const candidatasDetalladas = inferenciaVigente?.candidatas_detalladas ?? [];
  // `elegida: true` no siempre cae en la posición 0 del array (Turing descarta la mejor
  // puntuada si el rival queda con mate en 1) — nunca se asume la primera.
  const candidataElegidaDetalle = candidatasDetalladas.find((c) => c.elegida) ?? null;
  const relacionResumen = cmp
    ? etiquetaRelacionStockfish(
        cmp.diferencia_cp,
        Boolean(candidataElegidaDetalle?.rival_tiene_mate_en_1 || candidataElegidaDetalle?.pieza_colgada)
      )
    : null;
  // Partidas sin ninguna jugada son restos de partidas creadas por error (nunca
  // llegaron a jugarse) — no aportan nada para analizar, así que no ensucian la lista.
  const historialConJugadas = historial.filter((p) => p.cantidad_jugadas > 0);
  const partidasVaciasOcultas = historial.length - historialConJugadas.length;

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] p-3 lg:p-4 flex flex-col gap-3 max-w-[1920px] mx-auto animate-in fade-in duration-500">
      <div className="relative z-30 flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-neon-lime/10 border border-neon-lime/30 text-neon-lime font-mono-micro text-mono-micro">
        <span className="material-symbols-outlined text-[16px]">verified</span>
        <span>
          MÓDULO 5 · HU6 AMPLIADA — panel conectado en vivo al modelo propio (candidatas, saliencia, atención por
          bloque, comparación Stockfish y el cerebro de partículas son datos reales de /aprendizaje/inferencia).
        </span>
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm animate-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {hayInferenciaVivaDistinta && (
        <button
          type="button"
          onClick={sincronizarConPartidaViva}
          className="flex items-center justify-between gap-2 px-space-md py-space-xs rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono-micro text-[11px] text-left hover:bg-primary/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">sync_alt</span>
            Hay una inferencia en vivo más reciente (jugada {ultimaInferencia.jugada_elegida} en Sala de Control) para otra posición.
          </span>
          <span className="underline shrink-0">Sincronizar</span>
        </button>
      )}

      {/* Selector de posición real (historial de partidas jugadas) */}
      {mostrarSelector && !partidaId && !cargandoPartida && (
        <section className="bg-surface-container/70 border border-outline-variant/30 rounded-xl p-3 shadow-md flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-neon-cyan text-[18px]">history</span>
              <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Seleccionar posición</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={usarPosicionInicial}
                className="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-primary font-mono-micro text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[14px]">home</span>
                Posición inicial
              </button>
              <button
                type="button"
                onClick={() => setMostrarSelector(false)}
                className="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-mono-micro text-[10px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Ocultar
              </button>
            </div>
          </div>
          {cargandoHistorial && <span className="font-mono-micro text-[10px] text-outline px-1">Cargando partidas…</span>}
          {!cargandoHistorial && historialConJugadas.length === 0 && !error && (
            <p className="font-body-sm text-[12px] text-on-surface-variant px-1">
              Todavía no hay partidas jugadas. Usá la posición inicial, un preset, o jugá una en Sala de Control.
            </p>
          )}
          {partidasVaciasOcultas > 0 && (
            <p className="font-mono-micro text-[9px] text-outline px-1">
              {partidasVaciasOcultas} partida{partidasVaciasOcultas === 1 ? '' : 's'} sin jugadas (creada{partidasVaciasOcultas === 1 ? '' : 's'} y nunca jugada{partidasVaciasOcultas === 1 ? '' : 's'}) no se muestra{partidasVaciasOcultas === 1 ? '' : 'n'} acá.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5">
            {historialConJugadas.map((p) => {
              const resultado = resultadoPartida(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => elegirPartida(p.id)}
                  className="text-left rounded-lg p-2 bg-surface-container-lowest hover:bg-surface-container-low transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono-micro text-[10px] text-on-surface font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary">
                        {p.tipo_oponente === 'modelo' ? 'psychology' : 'smart_toy'}
                      </span>
                      {p.tipo_oponente === 'modelo' ? 'Turing' : 'Stockfish'} · Nv.{p.nivel}
                    </span>
                    <span className={`font-mono-micro text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded border ${resultado.clase}`}>
                      {resultado.etiqueta}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-micro text-[9px] text-on-surface-variant">
                      {p.cantidad_jugadas} jugada{p.cantidad_jugadas === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono-micro text-[9px] text-outline">{formatearFechaBolivia(p.creada_en)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {partidaId && cargandoPartida && (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono-micro text-[11px] text-outline">Cargando partida…</span>
        </div>
      )}

      {(!partidaId || partida) && !cargandoPartida && (
        <>
          {/* ===== KPIs del modelo ===== */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 bg-surface-container/80 p-2.5 rounded-xl border border-outline-variant/30 shadow-lg">
            <div className="flex flex-col justify-center px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Turing</span>
                <span className={`w-2 h-2 rounded-full ${estadoModeloData?.disponible ? 'bg-neon-cyan animate-ping' : 'bg-error'}`} />
              </div>
              <span className={`font-mono-metric text-[13px] font-bold truncate ${estadoModeloData?.disponible ? 'text-neon-cyan' : 'text-error'}`}>
                {cargandoEstado ? 'VERIFICANDO…' : estadoModeloData?.disponible ? 'ONLINE / INFERENCIA' : 'SIN CHECKPOINT'}
              </span>
            </div>
            <div className="flex flex-col justify-center px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
              <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Versión weights</span>
              <div className="flex items-center justify-between">
                <span className="font-mono-metric text-[13px] font-semibold text-on-surface">{versionModelo}</span>
                <span className="font-mono-micro text-[9px] text-secondary truncate">{fechaEntrenamiento}</span>
              </div>
            </div>
            <div className="flex flex-col justify-center px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
              <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Latencia inferencia</span>
              <span className="font-mono-metric text-[13px] font-bold text-neon-lime">{latenciaFormateada}</span>
            </div>
            <div className="flex flex-col justify-center px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
              <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Confianza top-1</span>
              <div className="flex items-center justify-between">
                <span className="font-mono-metric text-[13px] font-bold text-secondary-fixed">
                  {top1 ? `${(top1.probabilidad * 100).toFixed(1)}%` : '—'}
                </span>
                <span className="font-mono-micro text-[9px] text-outline">
                  {candidatas.length ? `Top-${candidatas.length}: ${(sumaProbabilidades * 100).toFixed(1)}%` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20">
              <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Dispositivo</span>
              <span className="font-mono-metric text-[13px] font-bold text-tertiary-container">{dispositivo}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end col-span-2 sm:col-span-1 lg:col-span-1">
              <button
                type="button"
                onClick={() => fenActual && dispararInferencia?.(fenActual)}
                disabled={estaAnalizando || !estadoModeloData?.disponible}
                title="Ejecutar inferencia real del modelo sobre la posición actual"
                className="flex-1 h-full min-h-[38px] px-2 rounded-lg bg-neon-cyan text-on-primary font-headline-sm text-[12px] font-bold flex items-center justify-center gap-1 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_0_12px_rgba(0,229,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[16px]">{estaAnalizando ? 'sync' : 'bolt'}</span>
                {estaAnalizando ? 'Infiriendo…' : 'Inferencia'}
              </button>
              {partidaId ? (
                <button
                  type="button"
                  onClick={cambiarPartida}
                  title="Elegir otra partida"
                  className="h-full min-h-[38px] px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all border border-outline-variant/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={usarPosicionInicial}
                    title="Posición inicial"
                    className="h-full min-h-[38px] px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all border border-outline-variant/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">home</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarSelector(true)}
                    title="Elegir partida jugada"
                    className="h-full min-h-[38px] px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all border border-outline-variant/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                  </button>
                </>
              )}
            </div>
          </section>

          {!estadoModeloData?.disponible && !cargandoEstado && (
            <div className="p-2.5 rounded-lg bg-error-container/30 border border-error/30 text-error font-body-sm text-[12px]">
              Modelo no disponible en este entorno — falta el checkpoint local. Entrená uno en la pestaña Aprendizaje o copiá el checkpoint a esta máquina.
            </div>
          )}

          {/* ===== Layout central de 3 columnas ===== */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Columna izquierda: entrada posicional FEN */}
            <div className="lg:col-span-3 flex flex-col gap-2.5 bg-surface-container/70 p-3 rounded-xl border border-outline-variant/30 shadow-md justify-between">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neon-cyan text-[18px]">grid_view</span>
                  <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Entrada Posicional FEN</h2>
                </div>
                <span className="font-mono-micro text-[10px] text-neon-cyan bg-primary/10 px-1.5 py-0.5 rounded">
                  {turno} (T{numeroJugada})
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-full max-w-[280px] aspect-square bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/40 shadow-inner">
                  <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded overflow-hidden text-center select-none" role="img" aria-label={`Tablero: ${fenActual}`}>
                    {matriz.map((fila, filaIdx) =>
                      fila.map((pieza, colIdx) => {
                        const esClara = (filaIdx + colIdx) % 2 === 0;
                        const valorSaliencia = saliencia[(7 - filaIdx) * 8 + colIdx] ?? 0;
                        const letra = 'abcdefgh'[colIdx];
                        const numero = 8 - filaIdx;
                        const nombreCas = `${letra}${numero}`;
                        const tieneSaliencia = valorSaliencia > 0.12;
                        return (
                          <div
                            key={`${filaIdx}-${colIdx}`}
                            role="img"
                            aria-label={`${nombreCas}: ${pieza ?? 'vacía'}, saliencia ${(valorSaliencia * 100).toFixed(0)}%`}
                            title={`${nombreCas}: ${pieza ?? 'vacía'} · saliencia ${(valorSaliencia * 100).toFixed(0)}%`}
                            className={`relative flex items-center justify-center text-[16px] ${esClara ? 'bg-surface-container-high' : 'bg-surface-container'} ${tieneSaliencia ? 'ring-2 ring-inset' : ''}`}
                            style={tieneSaliencia ? { '--tw-ring-color': colorSaliencia(valorSaliencia) } : undefined}
                          >
                            {colIdx === 0 && <span className="absolute top-0 left-0.5 text-[8px] font-mono text-outline">{numero}</span>}
                            {filaIdx === 7 && <span className="absolute bottom-0 right-0.5 text-[7px] font-mono text-outline">{letra}</span>}
                            {pieza && (
                              <img src={rutaImagenPieza(pieza)} alt="" className="w-6 h-6 pointer-events-none drop-shadow" draggable="false" />
                            )}
                            {tieneSaliencia && (
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background: `radial-gradient(circle at center, ${colorSaliencia(valorSaliencia, 0.5)}, transparent 70%)`,
                                  opacity: 0.5 + 0.4 * valorSaliencia,
                                }}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono-micro text-[10px] text-outline uppercase font-semibold">Cadena FEN activa</span>
                  <span className="font-mono-micro text-[9px] text-neon-cyan">64 casillas mapeadas</span>
                </div>
                <div className="flex items-center gap-1 bg-surface-container-lowest p-1.5 rounded-lg border border-outline-variant/30">
                  <input
                    className="w-full bg-transparent font-mono-label text-[10px] text-primary outline-none select-all truncate"
                    readOnly
                    type="text"
                    value={fenActual}
                    aria-label="Cadena FEN activa"
                  />
                  <button
                    type="button"
                    onClick={copiarFen}
                    title="Copiar FEN"
                    className="px-1.5 py-1 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-[10px] font-mono flex items-center gap-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-0.5">
                  {PRESETS_FEN.map((preset) => (
                    <button
                      key={preset.etiqueta}
                      type="button"
                      onClick={() => usarPreset(preset.fen, preset.etiqueta)}
                      className="px-1.5 py-1 rounded bg-surface-container-lowest hover:bg-surface-container-high text-[10px] font-mono text-on-surface-variant text-center border border-outline-variant/20 truncate focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {preset.etiqueta}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => fenActual && dispararInferencia?.(fenActual)}
                  disabled={estaAnalizando || !estadoModeloData?.disponible}
                  className="w-full py-2 rounded-lg bg-neon-cyan text-on-primary font-headline-sm text-[12px] font-bold flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_0_12px_rgba(0,229,255,0.35)] mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  Disparar Pulso Sináptico
                </button>
              </div>
            </div>

            {/* Columna central: cerebro de partículas — 100% real */}
            <div className="lg:col-span-7 flex flex-col gap-2 bg-surface-container/90 p-3.5 rounded-xl border border-neon-cyan/40 shadow-[0_0_35px_rgba(0,229,255,0.15)] relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-outline-variant/30 pb-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-80" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-cyan" />
                  </div>
                  <h1 className="font-headline-sm text-[15px] lg:text-[16px] font-bold text-on-surface tracking-wider uppercase">
                    Mapa de Activación Neuronal
                  </h1>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Selector de vista — 'organico' (partículas) vs 'red' (nodos y aristas).
                      Ambas reciben exactamente las mismas props/datos reales, solo cambia
                      cuál se dibuja; ver CerebroNeuronal.jsx / CerebroRed.jsx. */}
                  <div
                    className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30"
                    role="group"
                    aria-label="Vista del mapa de activación neuronal"
                  >
                    <button
                      type="button"
                      onClick={() => setVistaCerebro('organico')}
                      title="Vista orgánica — nube de partículas"
                      aria-label="Vista orgánica (nube de partículas)"
                      aria-pressed={vistaCerebro === 'organico'}
                      className={`p-1 rounded flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        vistaCerebro === 'organico'
                          ? 'bg-neon-cyan text-on-primary'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">blur_on</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaCerebro('red')}
                      title="Vista de red — nodos y conexiones"
                      aria-label="Vista de red (nodos y conexiones)"
                      aria-pressed={vistaCerebro === 'red'}
                      className={`p-1 rounded flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        vistaCerebro === 'red'
                          ? 'bg-neon-cyan text-on-primary'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">hub</span>
                    </button>
                  </div>
                  <span className="font-mono-micro text-[10px] text-neon-lime bg-neon-lime/10 px-2 py-0.5 rounded border border-neon-lime/30 shrink-0">
                    100% datos reales
                  </span>
                </div>
              </div>

              <div className="relative flex-1 min-h-[360px]">
                {vistaCerebro === 'organico' ? (
                  <CerebroNeuronal
                    saliencia={saliencia}
                    atencionPorBloque={atencionPorBloque}
                    jugadaElegida={inferenciaVigente?.jugada_elegida ?? null}
                    probabilidadTop1={top1?.probabilidad ?? 0}
                    diferenciaCp={cmp?.diferencia_cp ?? 0}
                    analizando={estaAnalizando}
                  />
                ) : (
                  <CerebroRed
                    saliencia={saliencia}
                    atencionPorBloque={atencionPorBloque}
                    jugadaElegida={inferenciaVigente?.jugada_elegida ?? null}
                    probabilidadTop1={top1?.probabilidad ?? 0}
                    diferenciaCp={cmp?.diferencia_cp ?? 0}
                    analizando={estaAnalizando}
                  />
                )}

                {inferenciaVigente?.jugada_elegida && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-surface-container-lowest/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neon-lime/60 shadow-[0_0_18px_rgba(118,255,3,0.35)] max-w-[90%] pointer-events-none">
                    <div className="w-2 h-2 rounded-full bg-neon-lime shrink-0" />
                    <div className="flex flex-col text-center">
                      <span className="font-mono-micro text-[10px] uppercase text-neon-lime font-bold tracking-wider">Selección Motora (real)</span>
                      <span className="font-mono-micro text-[11px] text-on-surface font-semibold">
                        {inferenciaVigente.jugada_elegida}
                        {top1 ? ` (${(top1.probabilidad * 100).toFixed(0)}% conf.)` : ''}
                        {evalModelo != null ? ` · ${formatearCp(evalModelo)}` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Leyenda obligatoria — qué representa cada color, todo real */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 border-t border-outline-variant/20">
                {LEYENDA_CEREBRO.map((item) => (
                  <div key={item.titulo} className="flex items-start gap-1.5 p-1.5 rounded-lg bg-surface-container-lowest/60">
                    <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${item.color}`} />
                    <div className="flex flex-col">
                      <span className={`font-mono-micro text-[9px] font-bold uppercase ${item.texto}`}>{item.titulo}</span>
                      <span className="font-mono-micro text-[8px] text-on-surface-variant leading-snug">{item.detalle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna derecha: atención por bloque (real) + saliencia (real) */}
            <div className="lg:col-span-2 flex flex-col gap-2.5 bg-surface-container/70 p-3 rounded-xl border border-outline-variant/30 shadow-md justify-between">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neon-purple text-[18px]">blur_on</span>
                  <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Atención</h2>
                </div>
                <span className="font-mono-micro text-[10px] text-neon-lime font-semibold bg-neon-lime/10 px-1.5 py-0.5 rounded">real</span>
              </div>

              {/* Atención por bloque real (SE-ResNet) — hasta 8 bloques; se oculta con gracia si el checkpoint no los tiene */}
              <div className="flex flex-col gap-1 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase font-medium">Bloques SE</span>
                  <span className="font-mono-micro text-[9px] text-neon-purple font-bold">
                    {atencionPorBloque.length ? `${atencionPorBloque.length} bloques` : 'N/D'}
                  </span>
                </div>
                {atencionPorBloque.length > 0 ? (
                  <div className="flex items-end justify-between gap-1 h-14 pt-1" aria-label="Activación real por bloque residual">
                    {atencionPorBloque.map((valor, indice) => (
                      <div key={indice} className="flex-1 flex flex-col items-center gap-0.5" title={`Bloque ${indice + 1}: ${(valor * 100).toFixed(0)}%`}>
                        <div className="w-full bg-surface-container-low rounded-t h-10 flex items-end overflow-hidden">
                          <div
                            className="w-full bg-neon-purple rounded-t"
                            style={{ height: `${Math.max(4, valor * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono-micro text-[7px] text-outline">{indice + 1}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="font-mono-micro text-[9px] text-outline py-2 text-center">
                    Checkpoint sin bloques SE (v1-v3) — sin dato para esta capa.
                  </span>
                )}
              </div>

              {/* Mini-heatmap real: top casillas por saliencia */}
              <div className="flex flex-col gap-1 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="font-mono-micro text-[10px] text-on-surface-variant uppercase font-medium">Casillas Calientes</span>
                  <span className="font-mono-micro text-[9px] text-neon-cyan font-bold">
                    {calientes.length ? calientes.map((c) => c.casilla).join(' • ') : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-0.5 aspect-[8/8] w-full p-1 bg-surface-container-low rounded" role="img" aria-label="Mini-heatmap de saliencia por casilla">
                  {Array.from({ length: 64 }).map((_, posicion) => {
                    const fila = Math.floor(posicion / 8);
                    const col = posicion % 8;
                    const rango = 8 - fila;
                    const indiceSaliencia = (rango - 1) * 8 + col;
                    const valor = saliencia[indiceSaliencia] ?? 0;
                    const nombreCas = `${'abcdefgh'[col]}${rango}`;
                    const esCaliente = calientes.some((c) => c.casilla === nombreCas);
                    return (
                      <div
                        key={posicion}
                        title={`${nombreCas}: ${(valor * 100).toFixed(0)}%`}
                        className={`rounded-[2px] flex items-center justify-center text-[6px] font-mono font-bold ${esCaliente ? 'text-on-primary' : 'text-transparent'}`}
                        style={{ background: valor > 0.01 ? colorSaliencia(valor, esCaliente ? 1 : 0.35) : undefined, opacity: valor > 0.01 ? 1 : 0.15 }}
                      >
                        {esCaliente ? nombreCas : ''}
                      </div>
                    );
                  })}
                </div>
                <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-surface-container-high via-neon-purple to-neon-cyan" />
              </div>
            </div>
          </section>

          {/* ===== Candidatas de Turing: detalle táctico de las 3 candidatas reales de la red
              + evaluación puntual de Stockfish para cada una — colapsable, real ===== */}
          <section className="bg-surface-container/70 border border-outline-variant/30 rounded-xl shadow-md overflow-hidden">
            <button
              type="button"
              onClick={() => setCandidatasAbiertas((v) => !v)}
              aria-expanded={candidatasAbiertas}
              aria-controls="panel-candidatas-turing"
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-container-high/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-neon-cyan text-[18px] shrink-0">compare_arrows</span>
                <span className="flex flex-col min-w-0 text-left">
                  <span className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">
                    Candidatas de Turing
                  </span>
                  <span className="font-mono-label text-[11px] text-on-surface-variant truncate">
                    {inferenciaVigente ? (
                      <>
                        Turing jugó <span className="text-neon-cyan font-semibold">{inferenciaVigente.jugada_elegida}</span>
                        {top1 ? ` (${(top1.probabilidad * 100).toFixed(1)}%)` : ''}
                        {cmp && (
                          <>
                            {' · '}Stockfish <span className="text-tertiary-container font-semibold">{cmp.jugada_motor}</span>{' '}
                            {formatearCp(cmp.evaluacion_cp)}
                            {relacionResumen && (
                              <>
                                {' · '}
                                <span className={relacionResumen.clase}>{relacionResumen.texto}</span>
                              </>
                            )}
                          </>
                        )}
                      </>
                    ) : estaAnalizando ? (
                      'Analizando…'
                    ) : (
                      'Ejecutá una inferencia para ver las candidatas de Turing'
                    )}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-mono-micro text-[10px] text-neon-lime bg-neon-lime/10 px-1.5 py-0.5 rounded border border-neon-lime/30 hidden sm:inline">
                  real
                </span>
                <span
                  className="material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-200"
                  style={{ transform: candidatasAbiertas ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </span>
            </button>

            {candidatasAbiertas && (
              <div id="panel-candidatas-turing" className="px-3 pb-3 pt-2 border-t border-outline-variant/20">
                {candidatasDetalladas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {candidatasDetalladas.map((c, indice) => {
                      const tieneRiesgoTactico = c.rival_tiene_mate_en_1 || c.pieza_colgada;
                      const relacion = etiquetaRelacionStockfish(c.diferencia_cp, tieneRiesgoTactico);
                      return (
                        <div
                          key={c.jugada ?? indice}
                          className={`flex flex-col gap-2 p-2.5 rounded-lg border ${
                            c.elegida
                              ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_14px_rgba(0,229,255,0.2)]'
                              : 'bg-surface-container-lowest border-outline-variant/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-micro text-[9px] text-outline uppercase font-semibold">
                              {indice + 1}º de la red
                            </span>
                            {c.elegida && (
                              <span className="px-1.5 py-0.5 rounded font-mono-micro text-[9px] font-bold uppercase text-neon-cyan bg-neon-cyan/15 border border-neon-cyan/40">
                                Elegida
                              </span>
                            )}
                          </div>

                          <div className="flex items-end justify-between">
                            <span className={`font-headline-sm text-[19px] font-bold ${c.elegida ? 'text-neon-cyan' : 'text-on-surface'}`}>
                              {c.jugada}
                            </span>
                            <span className="font-mono-metric text-[12px] font-semibold text-secondary-fixed">
                              {(c.probabilidad * 100).toFixed(1)}%
                            </span>
                          </div>

                          <ul className="flex flex-col gap-1">
                            {/* Solo se muestra cuando es true — con false en cada candidata (el caso
                                normal, casi siempre) la lista se llenaba de una X neutra sin aportar
                                nada; acá si aparece es porque de verdad da mate, vale la pena resaltarlo. */}
                            {c.da_jaque_mate && (
                              <li className="flex items-center gap-1.5 font-mono-label text-[10px] text-neon-lime font-bold">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Da jaque mate
                              </li>
                            )}
                            {/* Texto dinámico (no solo el ícono/color) — con el mismo texto fijo en
                                los dos estados, un ✓ verde al lado de "Rival con mate en 1" se leía
                                como "sí, hay mate del rival" en vez de "no, se verificó que no lo hay". */}
                            <li
                              className={`flex items-center gap-1.5 font-mono-label text-[10px] ${
                                c.rival_tiene_mate_en_1 ? 'text-error font-bold' : 'text-neon-lime'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {c.rival_tiene_mate_en_1 ? 'cancel' : 'check_circle'}
                              </span>
                              {c.rival_tiene_mate_en_1 ? '¡Mate del rival en 1!' : 'Sin mate del rival'}
                            </li>
                            <li
                              className={`flex items-center gap-1.5 font-mono-label text-[10px] ${
                                c.pieza_colgada ? 'text-error font-bold' : 'text-neon-lime'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {c.pieza_colgada ? 'cancel' : 'check_circle'}
                              </span>
                              {c.pieza_colgada ? 'Pieza colgada' : 'Pieza defendida'}
                            </li>
                          </ul>

                          <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/20">
                            <span className="font-mono-micro text-[9px] text-outline uppercase">Stockfish tras esta jugada</span>
                            <span className="font-mono-micro text-[10px] font-semibold text-tertiary-container">
                              {formatearEvalCandidata(c.evaluacion_stockfish_cp)}
                            </span>
                          </div>
                          <span className={`font-mono-micro text-[9px] font-semibold uppercase self-end ${relacion.clase}`}>
                            {relacion.texto}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-on-surface-variant font-body-sm text-[12px] py-4">
                    {estaAnalizando ? 'Calculando candidatas…' : 'Ejecutá una inferencia para ver el detalle de las candidatas'}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ===== Fila inferior: diagnóstico + terminal ===== */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Diagnóstico Pedagógico — real */}
            <div className="lg:col-span-7 flex flex-col justify-between p-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 shadow-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[20px]">psychology</span>
                  <h3 className="font-headline-sm text-[13px] font-semibold text-on-surface">Diagnóstico Pedagógico y Corrección</h3>
                </div>
              </div>
              {cmp ? (
                (() => {
                  const jugadaSintetica = {
                    jugada_san: inferenciaVigente.jugada_elegida,
                    mejor_jugada_motor: cmp.jugada_motor,
                    evaluacion_cp: evalModelo,
                    evaluacion_mejor_cp: cmp.evaluacion_cp,
                    mate_en: null,
                    mate_en_mejor: null,
                  };
                  const categoria = clasificarJugada(jugadaSintetica);
                  const caida = caidaDeJugada(jugadaSintetica);
                  const estilo = ESTILO_CATEGORIA[categoria];
                  return (
                    <>
                      <div className="flex items-center justify-between my-2">
                        <span className={`flex items-center gap-1 font-mono-micro text-[10px] ${estilo.texto}`}>
                          <span className="material-symbols-outlined text-[16px]">{estilo.icono}</span>
                          {estilo.etiqueta}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-mono-micro text-[10px] font-bold uppercase border ${estilo.texto} ${estilo.fondo} border-current/30`}>
                          {caida > 0.5 ? `−${caida.toFixed(1)}%` : 'Óptima'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20">
                          <span className="font-mono-micro text-[9px] text-outline uppercase">Modelo eligió</span>
                          <p className="font-body-sm text-[11px] text-on-surface mt-1 leading-relaxed">
                            <strong>{inferenciaVigente.jugada_elegida}</strong>
                            {top1 ? ` con ${(top1.probabilidad * 100).toFixed(1)}% de confianza.` : '.'}
                          </p>
                        </div>
                        <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2">
                          <span className="material-symbols-outlined text-neon-lime text-[16px] shrink-0 mt-0.5">lightbulb</span>
                          <p className="font-mono-label text-[10px] text-on-surface-variant leading-snug">
                            {comoMejorarPorCategoria(categoria)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 mt-1.5 border-t border-outline-variant/20 font-mono-micro text-[10px]">
                        <span className="text-outline uppercase">Recomendación Stockfish:</span>
                        <span className="text-neon-cyan font-bold font-mono">{cmp.jugada_motor} ({formatearCp(cmp.evaluacion_cp)})</span>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm text-[12px] py-4">
                  {estaAnalizando ? 'Analizando…' : 'Ejecutá una inferencia para ver el diagnóstico'}
                </div>
              )}
            </div>

            {/* Terminal & Logs — eventos reales del componente y del contexto compartido */}
            <div className="lg:col-span-5 flex flex-col justify-between p-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 shadow-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-outline text-[18px]">terminal</span>
                  <h4 className="font-headline-sm text-[13px] font-medium text-on-surface">Terminal &amp; Logs</h4>
                </div>
                <button
                  type="button"
                  onClick={limpiarConsola}
                  title="Limpiar consola"
                  className="text-outline hover:text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                </button>
              </div>
              <div className="my-1.5 p-2 bg-surface-container-lowest rounded-lg font-mono-micro text-[10px] flex flex-col gap-1 h-28 overflow-y-auto border border-outline-variant/20 select-text">
                {logs.length === 0 && <div className="text-outline">[sin eventos]</div>}
                {logs.map((log) => (
                  <div key={log.id} className="text-on-surface-variant">
                    <span className="text-outline">[{log.hora}]</span>{' '}
                    <span className={log.tipo === 'ERROR' ? 'text-error' : log.tipo === 'BEST' ? 'text-neon-lime' : 'text-neon-cyan'}>
                      [{log.tipo}]
                    </span>{' '}
                    {log.mensaje}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 font-mono-micro text-[9px] text-outline">
                <span>eventos del componente (real)</span>
                <span className={estadoModeloData?.disponible ? 'text-neon-cyan' : 'text-error'}>
                  {estadoModeloData?.disponible ? 'MODELO OK' : 'SIN MODELO'}
                </span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
