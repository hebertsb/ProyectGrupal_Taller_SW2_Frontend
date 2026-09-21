import { useState, useEffect, useCallback, useRef } from 'react';
import { listarPartidas, obtenerPartida, estadoModelo, inferenciaModelo } from '../../api/backend';
import { fenAMatriz, rutaImagenPieza, POSICION_INICIAL_FEN } from '../../ajedrez';
import { clasificarJugada, caidaDeJugada, comoMejorarPorCategoria, ESTILO_CATEGORIA } from '../../aprendizaje';
import AvisoVistaPrevia from '../../componentes/AvisoVistaPrevia';
import CerebroHolografico from './CerebroHolografico';

const PRESETS_FEN = [
  { etiqueta: 'Siciliana', fen: 'r1bqk2r/pp2bppp/2n1p3/3p4/3P4/2PB1N2/P4PPP/RNBQ1RK1 w kq - 1 14' },
  { etiqueta: 'Española', fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
  { etiqueta: 'Final Torres', fen: '4r1k1/5ppp/8/8/8/8/4RPPP/6K1 w - - 0 1' },
];

function formatearCp(cp) {
  if (cp == null) return '—';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
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
  const [partidaId, setPartidaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [partida, setPartida] = useState(null);
  const [cargandoPartida, setCargandoPartida] = useState(false);
  const [fenActual, setFenActual] = useState(POSICION_INICIAL_FEN);
  const [inferencia, setInferencia] = useState(null);
  const [cargandoInferencia, setCargandoInferencia] = useState(false);
  const [latenciaMs, setLatenciaMs] = useState(null);
  const [estadoModeloData, setEstadoModeloData] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [mostrarSelector, setMostrarSelector] = useState(true);

  const cerebroRef = useRef(null);

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

  const ejecutarInferencia = useCallback(async (fen) => {
    setCargandoInferencia(true);
    setError(null);
    agregarLog(`Inferencia solicitada — FEN ${fen.split(' ')[0]}…`, 'FORWARD');
    try {
      const data = await inferenciaModelo(fen);
      setInferencia(data);
      setLatenciaMs(data.latencia_ms);
      cerebroRef.current?.dispararPulso();
      agregarLog(`Respuesta recibida en ${data.latencia_ms.toFixed(1)}ms — jugada elegida ${data.jugada_elegida}.`, 'BEST');
    } catch (err) {
      setError(err.message);
      setInferencia(null);
      setLatenciaMs(null);
      agregarLog(`Error de inferencia: ${err.message}`, 'ERROR');
    } finally {
      setCargandoInferencia(false);
    }
  }, [agregarLog]);

  useEffect(() => {
    if (fenActual && estadoModeloData?.disponible) {
      ejecutarInferencia(fenActual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fenActual, estadoModeloData?.disponible]);

  function elegirPartida(id) {
    setError(null);
    setPartidaId(id);
    setMostrarSelector(false);
  }

  function cambiarPartida() {
    setPartidaId(null);
    setPartida(null);
    setFenActual(POSICION_INICIAL_FEN);
    setInferencia(null);
    setLatenciaMs(null);
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

  function copiarFen() {
    navigator.clipboard?.writeText(fenActual).then(() => agregarLog('FEN copiado al portapapeles.', 'CLIPBOARD'));
  }

  function limpiarConsola() {
    setLogs([]);
  }

  const candidatas = inferencia?.candidatas ?? [];
  const saliencia = inferencia?.saliencia ?? Array(64).fill(0);
  const matriz = fenAMatriz(fenActual);
  const campos = fenActual.split(' ');
  const turno = campos[1] === 'b' ? 'Negras' : 'Blancas';
  const numeroJugada = campos[5] ?? '1';
  const dispositivo = estadoModeloData?.dispositivo ?? '—';
  const versionModelo = estadoModeloData?.disponible ? `v${estadoModeloData.version}` : '—';
  const fechaEntrenamiento = estadoModeloData?.disponible ? estadoModeloData.fecha_entrenamiento : '—';
  const latenciaFormateada = latenciaMs !== null ? `${latenciaMs.toFixed(1)} ms` : cargandoInferencia ? '…' : '—';
  const top1 = candidatas[0] ?? null;
  const sumaProbabilidades = candidatas.reduce((acc, c) => acc + (c.probabilidad ?? 0), 0);
  const calientes = casillasCalientes(saliencia, 3);
  const cmp = inferencia?.comparacion_stockfish ?? null;
  // Eval del modelo derivada de la comparación con Stockfish (misma cuenta que en el
  // diagnóstico pedagógico): eval_stockfish - diferencia = eval de la jugada del modelo.
  const evalModelo = cmp ? cmp.evaluacion_cp - cmp.diferencia_cp : null;

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] p-3 lg:p-4 flex flex-col gap-3 max-w-[1920px] mx-auto animate-in fade-in duration-500">
      <AvisoVistaPrevia
        hu="Módulo 5 · HU6 ampliada"
        descripcionCorta="Candidatas, saliencia, comparación Stockfish, KPIs y estado del modelo son reales; el cerebro 3D, la atención multi-cabezal, el histograma de gradientes y la terminal son ilustrativos"
      />

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm animate-in slide-in-from-top-2 duration-300">
          {error}
        </div>
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
          {!cargandoHistorial && historial.length === 0 && !error && (
            <p className="font-body-sm text-[12px] text-on-surface-variant px-1">
              Todavía no hay partidas jugadas. Usá la posición inicial, un preset, o jugá una en Sala de Control.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5">
            {historial.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegirPartida(p.id)}
                className="text-left rounded-lg p-2 bg-surface-container-lowest hover:bg-surface-container-low transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-metric text-[12px] text-primary font-medium">#{p.id.slice(0, 6)}</span>
                  <span className="font-mono-micro text-[9px] text-on-surface-variant">{p.cantidad_jugadas} jugadas</span>
                </div>
                <div className="font-mono-micro text-[9px] text-outline mt-0.5">
                  {new Date(p.creada_en).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
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
                <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase">Estado modelo</span>
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
                onClick={() => fenActual && ejecutarInferencia(fenActual)}
                disabled={cargandoInferencia || !estadoModeloData?.disponible}
                title="Ejecutar inferencia real del modelo sobre la posición actual"
                className="flex-1 h-full min-h-[38px] px-2 rounded-lg bg-neon-cyan text-on-primary font-headline-sm text-[12px] font-bold flex items-center justify-center gap-1 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_0_12px_rgba(0,229,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[16px]">{cargandoInferencia ? 'sync' : 'bolt'}</span>
                {cargandoInferencia ? 'Infiriendo…' : 'Inferencia'}
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
                <button
                  type="button"
                  onClick={usarPosicionInicial}
                  title="Posición inicial"
                  className="h-full min-h-[38px] px-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all border border-outline-variant/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">home</span>
                </button>
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
                  onClick={() => fenActual && ejecutarInferencia(fenActual)}
                  disabled={cargandoInferencia || !estadoModeloData?.disponible}
                  className="w-full py-2 rounded-lg bg-neon-cyan text-on-primary font-headline-sm text-[12px] font-bold flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_0_12px_rgba(0,229,255,0.35)] mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  Disparar Pulso Sináptico
                </button>
              </div>
            </div>

            {/* Columna central: cerebro holográfico (decorativo) */}
            <div className="lg:col-span-7 flex flex-col gap-2 bg-surface-container/90 p-3.5 rounded-xl border border-neon-cyan/40 shadow-[0_0_35px_rgba(0,229,255,0.15)] relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-outline-variant/30 pb-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-80" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-cyan" />
                  </div>
                  <h1 className="font-headline-sm text-[15px] lg:text-[16px] font-bold text-on-surface tracking-wider uppercase flex items-center gap-2">
                    Mapa de Activación Neuronal
                    <span className="text-neon-cyan font-mono text-[12px]">— visualización conceptual</span>
                  </h1>
                </div>
                <span className="font-mono-micro text-[10px] text-tertiary-container bg-tertiary-container/15 px-2 py-0.5 rounded border border-tertiary-container/30 shrink-0">
                  Visualización ilustrativa
                </span>
              </div>

              <div className="relative flex-1">
                <CerebroHolografico ref={cerebroRef} />

                {/* Callouts perimetrales — decorativos, la arquitectura real no tiene lóbulos ni cabezales */}
                <div className="hidden xl:flex absolute bottom-16 left-4 z-20 items-start gap-2 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-neon-blue/60 shadow-[0_0_15px_rgba(0,112,243,0.35)] max-w-[220px]">
                  <div className="w-2 h-2 rounded-full bg-neon-blue mt-1 animate-pulse shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-mono-micro text-[10px] uppercase text-neon-blue font-bold tracking-wider">Entrada FEN</span>
                    <span className="font-mono-micro text-[10px] text-on-surface">Lóbulo Occipital · Tokenización</span>
                  </div>
                </div>
                <div className="hidden xl:flex absolute bottom-16 right-4 z-20 items-start gap-2 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-neon-cyan/60 shadow-[0_0_15px_rgba(0,229,255,0.35)] max-w-[220px]">
                  <div className="w-2 h-2 rounded-full bg-neon-cyan mt-1 animate-pulse shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-mono-micro text-[10px] uppercase text-neon-cyan font-bold tracking-wider">Extracción de Características</span>
                    <span className="font-mono-micro text-[10px] text-on-surface">Corteza Parietal · CNN</span>
                  </div>
                </div>
                <div className="hidden xl:flex absolute top-2 left-4 z-20 items-start gap-2 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-neon-purple/60 shadow-[0_0_15px_rgba(124,77,255,0.4)] max-w-[220px]">
                  <div className="w-2 h-2 rounded-full bg-neon-purple mt-1 animate-ping shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-mono-micro text-[10px] uppercase text-neon-purple font-bold tracking-wider">Atención Multicabezal</span>
                    <span className="font-mono-micro text-[10px] text-on-surface">Corteza Prefrontal · conceptual</span>
                  </div>
                </div>
                <div className="hidden xl:flex absolute top-2 right-4 z-20 items-start gap-2 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-neon-orange/60 shadow-[0_0_15px_rgba(255,145,0,0.4)] max-w-[220px]">
                  <div className="w-2 h-2 rounded-full bg-neon-orange mt-1 animate-pulse shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-mono-micro text-[10px] uppercase text-neon-orange font-bold tracking-wider">Evaluación de Posición</span>
                    <span className="font-mono-micro text-[10px] text-on-surface">Lóbulo Temporal · conceptual</span>
                  </div>
                </div>

                {/* Callout inferior — este sí con datos reales de la última inferencia */}
                {inferencia?.jugada_elegida && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-surface-container-lowest/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neon-lime/60 shadow-[0_0_18px_rgba(118,255,3,0.35)] max-w-[90%]">
                    <div className="w-2 h-2 rounded-full bg-neon-lime shrink-0" />
                    <div className="flex flex-col text-center">
                      <span className="font-mono-micro text-[10px] uppercase text-neon-lime font-bold tracking-wider">Selección Motora (real)</span>
                      <span className="font-mono-micro text-[11px] text-on-surface font-semibold">
                        {inferencia.jugada_elegida}
                        {top1 ? ` (${(top1.probabilidad * 100).toFixed(0)}% conf.)` : ''}
                        {evalModelo != null ? ` · ${formatearCp(evalModelo)}` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha: Atención (mayormente decorativa, heatmap real) */}
            <div className="lg:col-span-2 flex flex-col gap-2.5 bg-surface-container/70 p-3 rounded-xl border border-outline-variant/30 shadow-md justify-between">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neon-purple text-[18px]">blur_on</span>
                  <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Atención</h2>
                </div>
                <span className="font-mono-micro text-[10px] text-secondary font-semibold bg-secondary-container/40 px-1.5 py-0.5 rounded">conceptual</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col bg-surface-container-lowest p-1.5 rounded-lg border border-outline-variant/20">
                  <span className="font-mono-micro text-[9px] text-outline uppercase">Activación</span>
                  <span className="font-mono-metric text-[13px] font-bold text-neon-cyan">—</span>
                  <span className="font-mono-micro text-[8px] text-outline-variant">Sin dato real</span>
                </div>
                <div className="flex flex-col bg-surface-container-lowest p-1.5 rounded-lg border border-outline-variant/20">
                  <span className="font-mono-micro text-[9px] text-outline uppercase">Sinapsis</span>
                  <span className="font-mono-metric text-[13px] font-bold text-secondary-fixed">—</span>
                  <span className="font-mono-micro text-[8px] text-secondary">Sin dato real</span>
                </div>
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

              <div className="flex flex-col gap-1 bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                <div className="flex items-center justify-between font-mono-micro text-[10px]">
                  <span className="text-outline uppercase">Gradientes</span>
                  <span className="text-neon-lime font-bold">conceptual</span>
                </div>
                <div className="h-12 w-full flex items-end justify-between gap-1 pt-1" aria-hidden="true">
                  {[28, 45, 62, 85, 100, 72, 52, 38, 48].map((alto, i) => (
                    <div key={i} className="w-full bg-neon-cyan/40 rounded-t" style={{ height: `${alto}%` }} />
                  ))}
                </div>
                <div className="flex items-center justify-between font-mono-micro text-[8px] text-outline">
                  <span>L1</span>
                  <span>L7</span>
                  <span>L12</span>
                </div>
              </div>

              <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant font-mono-micro text-[10px] flex items-start gap-1.5">
                <span className="material-symbols-outlined text-neon-cyan text-[15px] shrink-0 mt-0.5">info</span>
                <span>Panel ilustrativo — la red real (CNN simple) no tiene cabezales de atención multicapa.</span>
              </div>
            </div>
          </section>

          {/* ===== Fila inferior: diagnóstico + candidatas + terminal ===== */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Diagnóstico Pedagógico — real */}
            <div className="lg:col-span-5 flex flex-col justify-between p-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 shadow-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[20px]">psychology</span>
                  <h3 className="font-headline-sm text-[13px] font-semibold text-on-surface">Diagnóstico Pedagógico y Corrección</h3>
                </div>
              </div>
              {cmp ? (
                (() => {
                  const jugadaSintetica = {
                    jugada_san: inferencia.jugada_elegida,
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
                            <strong>{inferencia.jugada_elegida}</strong>
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
                  {cargandoInferencia ? 'Analizando…' : 'Ejecutá una inferencia para ver el diagnóstico'}
                </div>
              )}
            </div>

            {/* Jugadas Candidatas — real */}
            <div className="lg:col-span-4 flex flex-col justify-between p-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 shadow-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-neon-cyan text-[18px]">compare_arrows</span>
                  <h3 className="font-headline-sm text-[13px] font-semibold text-on-surface">Jugadas Candidatas</h3>
                </div>
                <span className="font-mono-micro text-[10px] text-outline">Modelo vs Stockfish</span>
              </div>
              {candidatas.length > 0 ? (
                <div className="overflow-x-auto my-1">
                  <table className="w-full text-left font-mono-label text-[11px] border-collapse">
                    <thead>
                      <tr className="text-on-surface-variant font-mono-micro text-[9px] uppercase border-b border-outline-variant/20">
                        <th className="py-1">Jugada</th>
                        <th className="py-1">Eval</th>
                        <th className="py-1">Confianza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {candidatas.map((c, i) => (
                        <tr key={c.jugada ?? i} className="hover:bg-surface-container-low transition-colors">
                          <td className={`py-1.5 flex items-center gap-1 ${i === 0 ? 'font-bold text-neon-cyan' : 'text-on-surface-variant'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-neon-cyan animate-pulse' : 'bg-outline'}`} />
                            {i + 1}. {c.jugada} {i === 0 ? '(IA)' : ''}
                          </td>
                          <td className={`py-1.5 ${i === 0 ? 'text-neon-cyan font-bold' : 'text-outline'}`}>
                            {i === 0 && evalModelo != null ? formatearCp(evalModelo) : '—'}
                          </td>
                          <td className="py-1.5">
                            <div className="w-16 bg-surface-container-lowest h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${i === 0 ? 'bg-neon-cyan' : 'bg-outline'}`} style={{ width: `${(c.probabilidad * 100).toFixed(1)}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cmp && (
                        <tr className="hover:bg-surface-container-low transition-colors">
                          <td className="py-1.5 font-semibold text-tertiary-container flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container" />
                            {cmp.jugada_motor} (SF)
                          </td>
                          <td className="py-1.5 text-tertiary-container font-semibold">{formatearCp(cmp.evaluacion_cp)}</td>
                          <td className="py-1.5 text-outline">—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm text-[12px] py-4">
                  {cargandoInferencia ? 'Calculando candidatas…' : 'Sin candidatas disponibles'}
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20 font-mono-micro text-[9px] text-outline">
                <span>{candidatas.length ? `Top-${candidatas.length} candidatas reales` : ''}</span>
                <span>{latenciaFormateada}</span>
              </div>
            </div>

            {/* Terminal & Logs — eventos reales del componente */}
            <div className="lg:col-span-3 flex flex-col justify-between p-3 rounded-xl bg-surface-container/70 border border-outline-variant/30 shadow-md">
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
