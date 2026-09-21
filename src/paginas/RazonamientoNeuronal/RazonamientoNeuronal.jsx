import { useState, useEffect, useCallback } from 'react';
import { listarPartidas, obtenerPartida, estadoModelo, inferenciaModelo } from '../../api/backend';
import { fenAMatriz, rutaImagenPieza } from '../../ajedrez';
import { clasificarJugada, caidaDeJugada, comoMejorarPorCategoria, ESTILO_CATEGORIA } from '../../aprendizaje';
import AvisoVistaPrevia from '../../componentes/AvisoVistaPrevia';

const POSICION_INICIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function formatearCp(cp) {
  if (cp == null) return '—';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
}

function colorSaliencia(valor) {
  const v = Math.max(0, Math.min(1, valor));
  const r = Math.round(255 * v);
  const g = Math.round(255 * (1 - v));
  return `rgb(${r}, ${g}, 0)`;
}

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

  useEffect(() => {
    setCargandoEstado(true);
    estadoModelo()
      .then(setEstadoModeloData)
      .catch(() => setEstadoModeloData({ disponible: false }))
      .finally(() => setCargandoEstado(false));
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
    try {
      const data = await inferenciaModelo(fen);
      setInferencia(data);
      setLatenciaMs(data.latencia_ms);
    } catch (err) {
      setError(err.message);
      setInferencia(null);
      setLatenciaMs(null);
    } finally {
      setCargandoInferencia(false);
    }
  }, []);

  useEffect(() => {
    if (fenActual && estadoModeloData?.disponible) {
      ejecutarInferencia(fenActual);
    }
  }, [fenActual, estadoModeloData?.disponible, ejecutarInferencia]);

  function elegirPartida(id) {
    setError(null);
    setPartidaId(id);
  }

  function cambiarPartida() {
    setPartidaId(null);
    setPartida(null);
    setFenActual(POSICION_INICIAL_FEN);
    setInferencia(null);
    setLatenciaMs(null);
    setError(null);
  }

  function usarPosicionInicial() {
    setFenActual(POSICION_INICIAL_FEN);
    setPartidaId(null);
    setPartida(null);
    setError(null);
  }

  const candidatas = inferencia?.candidatas ?? [];
  const saliencia = inferencia?.saliencia ?? Array(64).fill(0);
  const matriz = fenAMatriz(fenActual);
  const turno = fenActual.split(' ')[1] === 'b' ? 'Negras' : 'Blancas';
  const dispositivo = estadoModeloData?.dispositivo ?? '—';
  const versionModelo = estadoModeloData?.disponible ? `v${estadoModeloData.version}` : '—';
  const fechaEntrenamiento = estadoModeloData?.disponible ? estadoModeloData.fecha_entrenamiento : '—';
  const latenciaFormateada = latenciaMs !== null ? `${latenciaMs.toFixed(1)} ms` : cargandoInferencia ? '...' : '—';

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden flex flex-col justify-between p-space-lg select-none animate-in fade-in duration-500">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(rgba(195, 245, 255, 0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }}></div>

      <AvisoVistaPrevia
        hu="Módulo 5 · HU6 ampliada"
        descripcionCorta="Candidatas, saliencia, comparación Stockfish y estado del modelo son reales; el resto del grafo (atención multi-cabezal, MCTS, morfología 3D) es diagrama conceptual"
      />

      {/* Header Telemetry Strip — datos reales */}
      <div className="relative z-20 flex items-center justify-between backdrop-blur-xl bg-surface-container-low/70 px-space-md py-space-xs rounded-xl shadow-lg shadow-surface-container-lowest/50">
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-xs">
            <span className={`w-2 h-2 rounded-full ${estadoModeloData?.disponible ? 'bg-primary animate-ping' : 'bg-error'}`}></span>
            <span className="font-mono-metric text-mono-metric text-on-surface font-medium tracking-tight">INFERENCIA NEURONAL</span>
            <span className="font-mono-micro text-mono-micro text-outline uppercase px-space-2xs py-0.5 rounded bg-surface-container-high">
              {estadoModeloData?.disponible ? 'en vivo' : 'sin modelo'}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-surface-container-highest"></div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Latencia</span>
              <span className="font-mono-label text-mono-label text-primary font-medium">
                {latenciaFormateada}
              </span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Dispositivo</span>
              <span className="font-mono-label text-mono-label text-primary-fixed-dim font-medium">{dispositivo}</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Versión</span>
              <span className="font-mono-label text-mono-label text-secondary font-medium">{versionModelo}</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Turno</span>
              <span className="font-mono-label text-mono-label text-tertiary-fixed-dim font-medium">{turno}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => fenActual && ejecutarInferencia(fenActual)}
            disabled={cargandoInferencia || !estadoModeloData?.disponible}
            className="flex items-center gap-space-2xs px-space-sm py-1.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-body-sm font-body-sm transition-all shadow-md shadow-primary-container/20 active:scale-95 font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">{cargandoInferencia ? 'sync' : 'bolt'}</span>
            <span>{cargandoInferencia ? 'Inferencia…' : 'Reinferir'}</span>
          </button>
          {partidaId && (
            <button onClick={cambiarPartida} className="flex items-center gap-space-2xs px-space-sm py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-sm font-body-sm transition-all shadow-sm active:scale-95">
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              <span>Elegir otra partida</span>
            </button>
          )}
          <button onClick={usarPosicionInicial} className="flex items-center gap-space-2xs px-space-sm py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-sm font-body-sm transition-all shadow-sm active:scale-95">
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Posición Inicial</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="relative z-20 px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm animate-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {/* Selector de posición (reusando patrón de Aprendizaje.jsx) */}
      {!partidaId && !cargandoPartida && (
        <section className="relative z-10 bg-surface-container-lowest/80 backdrop-blur-md rounded-xl p-space-md shadow-xl flex flex-col gap-space-md animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.7)]"></span>
              <span className="font-mono-micro text-mono-micro tracking-widest text-primary font-semibold uppercase">SELECCIONAR POSICIÓN</span>
            </div>
            <button onClick={usarPosicionInicial} className="px-space-sm py-space-2xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono-micro text-mono-micro uppercase tracking-wider transition-colors flex items-center gap-space-2xs">
              <span className="material-symbols-outlined text-[15px]">home</span>
              Posición inicial
            </button>
          </div>
          {cargandoHistorial && (
            <span className="font-mono-micro text-mono-micro text-outline px-space-xs">Cargando partidas…</span>
          )}
          {!cargandoHistorial && historial.length === 0 && !error && (
            <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center flex flex-col items-center gap-space-xs">
              <span className="material-symbols-outlined text-[28px] text-outline">school</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Todavía no hay partidas jugadas. Usá la posición inicial o jugá una en Sala de Control.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-sm">
            {historial.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegirPartida(p.id)}
                className="text-left rounded-lg p-space-sm bg-surface-container-lowest hover:bg-surface-container-low shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-metric text-mono-metric text-primary font-medium">#{p.id.slice(0, 6)}</span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant">{p.cantidad_jugadas} jugadas</span>
                </div>
                <div className="font-mono-micro text-mono-micro text-outline mt-space-2xs">
                  {new Date(p.creada_en).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {partidaId && cargandoPartida && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <span className="font-mono-micro text-mono-micro text-outline px-space-xs">Cargando partida…</span>
        </div>
      )}

      {/* Main Visual Stage */}
      {(!partidaId || partida) && !cargandoPartida && (
        <div className="relative z-10 flex-1 grid grid-cols-12 gap-space-lg mt-space-md min-h-0">
          {/* Left: Tablero 8x8 real + Candidatas + Diagnóstico Pedagógico */}
          <div className="col-span-7 flex flex-col gap-space-md min-w-0">
            {/* Tablero 8x8 con piezas reales */}
            <div className="rounded-xl bg-surface-container-lowest/80 backdrop-blur-md p-space-md shadow-2xl shadow-surface-container-lowest flex items-center justify-center">
              <div className="grid grid-cols-8 grid-rows-8 gap-0.5 w-64 h-64 max-w-full" role="img" aria-label={`Tablero: ${fenActual}`}>
                {matriz.map((fila, filaIdx) =>
                  fila.map((pieza, colIdx) => {
                    const esClara = (filaIdx + colIdx) % 2 === 0;
                    // matriz[0] es la fila 8 (arriba); saliencia viene ordenada
                    // a1..h1,a2..h2,...,a8..h8 (chess.SQUARES) — hay que invertir la fila.
                    const valorSaliencia = saliencia[(7 - filaIdx) * 8 + colIdx] ?? 0;
                    const nombreCas = `abcdefgh`[colIdx] + (8 - filaIdx);
                    const tieneSaliencia = valorSaliencia > 0.1;
                    return (
                      <div
                        key={`${filaIdx}-${colIdx}`}
                        className={`relative w-full h-full rounded-sm flex items-center justify-center ${
                          esClara ? 'bg-surface-container' : 'bg-surface-container-high'
                        } ${tieneSaliencia ? 'ring-2 ring-inset' : ''}`}
                        style={tieneSaliencia ? { '--tw-ring-color': colorSaliencia(valorSaliencia) } : {}}
                        title={`${nombreCas}: ${pieza ?? 'vacía'} · saliencia ${(valorSaliencia * 100).toFixed(0)}%`}
                      >
                        {pieza && (
                          <img
                            src={rutaImagenPieza(pieza)}
                            alt={pieza}
                            className="w-10 h-10 pointer-events-none drop-shadow-lg"
                            draggable="false"
                          />
                        )}
                        {tieneSaliencia && (
                          <div
                            className="absolute inset-0 rounded-sm pointer-events-none"
                            style={{
                              background: `radial-gradient(circle at center, ${colorSaliencia(valorSaliencia)}80, transparent 70%)`,
                              opacity: 0.6 + 0.4 * valorSaliencia,
                            }}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Candidatas + Diagnóstico Pedagógico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
              {/* Candidatas reales */}
              <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col">
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[16px] text-primary">analytics</span>
                    <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Candidatas del Modelo</span>
                  </div>
                  <span className="font-mono-micro text-mono-micro text-outline">Top-{candidatas.length}</span>
                </div>
                {candidatas.length > 0 ? (
                  <div className="flex flex-col gap-space-sm flex-1 overflow-y-auto">
                    {candidatas.map((c, i) => (
                      <div
                        key={c.jugada ?? i}
                        className={`flex flex-col gap-1 p-space-xs rounded-lg transition-colors ${
                          i === 0 ? 'bg-primary-container/20 ring-1 ring-inset ring-primary/30' : 'bg-surface-container/30 hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-space-xs">
                            <span className={`font-mono-label text-mono-label font-medium ${i === 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{c.jugada ?? '—'}</span>
                          </div>
                          <span className="font-mono-metric text-mono-metric font-medium text-primary">
                            {(c.probabilidad * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full shadow-[0_0_8px_rgba(0,229,255,0.8)]"
                            style={{ width: `${(c.probabilidad * 100).toFixed(1)}%`, background: i === 0 ? 'linear-gradient(90deg, #00e5ff, #cdbdff)' : 'linear-gradient(90deg, #cdbdff, #ffb778)' }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-space-lg text-on-surface-variant font-body-sm">
                    {cargandoInferencia ? 'Calculando candidatas…' : 'Sin candidatas disponibles'}
                  </div>
                )}
              </div>

              {/* Diagnóstico Pedagógico — reusando aprendizaje.js */}
              <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col">
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[16px] text-secondary">school</span>
                    <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Diagnóstico Pedagógico</span>
                  </div>
                  <span className="font-mono-micro text-mono-micro text-outline">vs Stockfish</span>
                </div>
                {inferencia?.comparacion_stockfish ? (
                  (() => {
                    const cmp = inferencia.comparacion_stockfish;
                    const jugadaModelo = inferencia.jugada_elegida;
                    const jugadaStockfish = cmp.jugada_motor;
                    // La comparación es puramente informativa (oráculo, no valida la
                    // jugada del modelo — ver regla 1 de CLAUDE.md). Se arma un objeto
                    // "jugada" sintético con la misma forma que usa aprendizaje.js para
                    // no reinventar la heurística de clasificación por texto.
                    const jugadaSintetica = {
                      jugada_san: jugadaModelo,
                      mejor_jugada_motor: jugadaStockfish,
                      evaluacion_cp: cmp.evaluacion_cp - cmp.diferencia_cp,
                      evaluacion_mejor_cp: cmp.evaluacion_cp,
                      mate_en: null,
                      mate_en_mejor: null,
                    };
                    const categoria = clasificarJugada(jugadaSintetica);
                    const caida = caidaDeJugada(jugadaSintetica);
                    const estilo = ESTILO_CATEGORIA[categoria];
                    return (
                      <div className={`flex-1 flex flex-col gap-space-sm ${estilo.fondo} rounded-lg p-space-md`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-space-xs">
                            <span className={`material-symbols-outlined text-[18px] ${estilo.texto}`}>{estilo.icono}</span>
                            <span className="font-headline-sm text-headline-sm text-on-surface">{estilo.etiqueta}</span>
                          </div>
                          <span className={`px-space-sm py-space-2xs rounded-lg font-mono-micro text-mono-micro uppercase tracking-wider bg-surface-container-lowest/60 ${estilo.texto}`}>
                            {caida > 0.5 ? `−${caida.toFixed(1)}%` : 'Óptima'}
                          </span>
                        </div>
                        <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                          <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Modelo eligió</span>
                          <p className="font-body-sm text-body-sm text-on-surface">
                            <strong>{jugadaModelo}</strong>
                          </p>
                        </div>
                        <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                          <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Stockfish prefiere</span>
                          <p className="font-body-sm text-body-sm text-on-surface">
                            <strong>{jugadaStockfish}</strong> (eval {formatearCp(cmp.evaluacion_cp)}, diferencia {cmp.diferencia_cp} cp)
                          </p>
                        </div>
                        <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                          <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Cómo mejorar</span>
                          <p className="font-body-sm text-body-sm text-on-surface">{comoMejorarPorCategoria(categoria)}</p>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center text-on-surface-variant font-body-sm">
                    {cargandoInferencia ? 'Analizando…' : 'Ejecutá una inferencia para ver el diagnóstico'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Heatmap 8x8 + Telemetría real + Grafo conceptual */}
          <div className="col-span-5 flex flex-col gap-space-md min-w-0">
            {/* Heatmap 8x8 Saliencia real */}
            <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col">
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                  <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Heatmap de Saliencia</span>
                </div>
                <span className="font-mono-micro text-mono-micro text-outline">Capa final</span>
              </div>
              <div className="relative aspect-square w-full max-w-xs mx-auto rounded-lg bg-surface-container-lowest p-2 grid grid-cols-8 grid-rows-8 gap-1 items-center justify-center">
                {Array.from({ length: 64 }).map((_, posicion) => {
                  // posicion recorre la grilla visual (fila 0 = arriba = rango 8). La
                  // saliencia del backend viene ordenada a1..h1,a2..h2,...,a8..h8
                  // (chess.SQUARES), así que hay que invertir la fila para leerla.
                  const fila = Math.floor(posicion / 8);
                  const col = posicion % 8;
                  const rango = 8 - fila;
                  const indiceSaliencia = (rango - 1) * 8 + col;
                  const valor = saliencia[indiceSaliencia] ?? 0;
                  const esClara = (fila + col) % 2 === 0;
                  return (
                    <div
                      key={posicion}
                      className={`w-full h-full rounded-sm flex items-center justify-center font-mono-micro text-mono-micro ${esClara ? 'bg-surface-container' : 'bg-surface-container-high'}`}
                      style={{
                        background: `linear-gradient(135deg, ${esClara ? '#191b22' : '#282a30'} 0%, ${colorSaliencia(valor)}CC 100%)`,
                        opacity: 0.3 + 0.7 * valor,
                      }}
                      title={`${'abcdefgh'[col]}${rango}: ${(valor * 100).toFixed(1)}%`}
                    >
                      {valor > 0.3 && <span className="text-on-surface font-medium">{Math.round(valor * 100)}%</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-space-xs text-on-surface-variant font-mono-micro text-mono-micro">
                <span>Máx: {saliencia.length ? (Math.max(...saliencia) * 100).toFixed(1) : 0}%</span>
                <span className="text-primary font-medium">Casillas más influyentes</span>
              </div>
            </div>

            {/* Telemetría real + Estado modelo */}
            <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim">memory_monitor</span>
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Telemetría del Modelo</span>
              </div>
              <div className="grid grid-cols-2 gap-space-sm text-on-surface-variant font-mono-micro text-mono-micro">
                <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm">
                  <span className="uppercase tracking-wider">Dispositivo</span>
                  <div className="font-mono-label text-mono-label text-on-surface font-medium">{dispositivo}</div>
                </div>
                <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm">
                  <span className="uppercase tracking-wider">Versión</span>
                  <div className="font-mono-label text-mono-label text-on-surface font-medium">{versionModelo}</div>
                </div>
                <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm">
                  <span className="uppercase tracking-wider">Entrenado</span>
                  <div className="font-mono-label text-mono-label text-on-surface font-medium">{fechaEntrenamiento}</div>
                </div>
                <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm">
                  <span className="uppercase tracking-wider">Latencia última</span>
                  <div className="font-mono-label text-mono-label text-primary font-medium">{latenciaFormateada}</div>
                </div>
                <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm">
                  <span className="uppercase tracking-wider">Estado</span>
                  <div className={`font-mono-label text-mono-label font-medium ${estadoModeloData?.disponible ? 'text-primary' : 'text-error'}`}>
                    {estadoModeloData?.disponible ? 'Disponible' : 'Sin checkpoint'}
                  </div>
                </div>
              </div>
              {!estadoModeloData?.disponible && !cargandoEstado && (
                <div className="mt-space-sm p-space-sm rounded-lg bg-error-container/30 border border-error/30 text-error font-body-sm text-body-sm">
                  Modelo no disponible en este entorno — falta el checkpoint local. Entrená uno en la pestaña Aprendizaje o copiá el checkpoint a esta máquina.
                </div>
              )}
            </div>

            {/* Grafo conceptual (decorativo) — con AvisoVistaPrevia */}
            <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col flex-1 min-h-0">
              <AvisoVistaPrevia
                hu="Módulo 5 · HU6 ampliada"
                descripcionCorta="Diagrama conceptual: atención multi-cabezal, MCTS y cerebro 3D son ilustrativos"
              />
              <div className="flex-1 flex items-center justify-center text-on-surface-variant/40 font-mono-micro text-mono-micro">
                <div className="text-center space-y-2">
                  <span className="material-symbols-outlined text-[48px] text-primary/30">hub</span>
                  <p>Grafo Neural Conceptual</p>
                  <p className="text-xs">Atención Multi-Cabezal · MCTS · Morfología 3D</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to { stroke-dashoffset: -100; }
        }
        .animation-paused { animation-play-state: paused !important; }
      `}} />
    </div>
  );
}