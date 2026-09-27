import { useEffect, useState, useMemo } from 'react';
import { analisisCompletoPartida, listarPartidas } from '../../api/backend';
import {
  caidaDeJugada,
  clasificarJugada,
  comoMejorarPorCategoria,
  ESTILO_CATEGORIA,
  winPercent,
} from '../../aprendizaje';

function resultadoLegible(resultado) {
  if (resultado === '1-0') return 'Victoria (1-0)';
  if (resultado === '0-1') return 'Derrota (0-1)';
  if (resultado === '1/2-1/2') return 'Tablas (½ - ½)';
  return 'En curso';
}

function colorResultado(resultado) {
  if (resultado === '1-0') return 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/50';
  if (resultado === '0-1') return 'bg-rose-950/70 text-rose-300 border border-rose-500/50';
  if (resultado === '1/2-1/2') return 'bg-amber-950/70 text-amber-300 border border-amber-500/50';
  return 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50';
}

function barraResultadoColor(resultado) {
  if (resultado === '1-0') return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
  if (resultado === '0-1') return 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.6)]';
  if (resultado === '1/2-1/2') return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
  return 'bg-cyan-400 shadow-[0_0_10px_rgba(0,229,255,0.6)]';
}

function oponenteLegible(tipoOponente) {
  return tipoOponente === 'modelo' ? 'Turing IA' : 'Stockfish 16';
}

function categoriaNivel(n) {
  if (n == null) return 'Intermedio';
  if (n <= 6) return 'Principiante';
  if (n <= 13) return 'Intermedio';
  return 'Avanzado';
}

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatearCp(cp) {
  if (cp == null) return '—';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
}

/**
 * Tarjeta individual para seleccionar una partida a analizar.
 * Mantiene la misma consistencia visual rica y ordenada de Registro de Partidas.
 */
function TarjetaPartidaAprendizaje({ partida, alSeleccionar, esFacilitador }) {
  const esTuring = partida.tipo_oponente === 'modelo';

  return (
    <article
      onClick={alSeleccionar}
      className="cursor-pointer rounded-2xl p-5 sm:p-6 transition-all relative overflow-hidden group border min-h-[110px] bg-[#151722] hover:bg-[#1a1e2d] border-white/10 hover:border-cyan-400/50 shadow-md hover:shadow-xl flex flex-col justify-between gap-3 text-left"
    >
      <div className="flex items-stretch gap-4">
        {/* Indicador de acento vertical estilizado y más grueso */}
        <div className={`w-2 min-h-[78px] rounded-full shrink-0 ${barraResultadoColor(partida.resultado)}`} />

        <div className="flex-1 flex flex-col gap-3.5 min-w-0 justify-between">
          {/* Fila 1: ID de partida grande y Resultado destacado */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
              #{partida.id.slice(0, 8)}
            </span>
            <span className={`px-3.5 py-1 rounded-full font-mono text-xs font-bold shrink-0 tracking-wide ${colorResultado(partida.resultado)}`}>
              {resultadoLegible(partida.resultado)}
            </span>
          </div>

          {/* Fila 2: Oponente y Nivel más grandes y claros */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap font-mono">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm ${
              esTuring ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-500/30' : 'bg-slate-700/60 text-slate-200 border border-slate-500/40'
            }`}>
              <span className="material-symbols-outlined text-[18px]">{esTuring ? 'psychology' : 'smart_toy'}</span>
              <span>{oponenteLegible(partida.tipo_oponente)}</span>
            </span>

            <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-slate-200 font-medium">
              Nivel {partida.nivel} · <strong className="text-secondary font-bold">{categoriaNivel(partida.nivel)}</strong>
            </span>
          </div>

          {/* Fila 3: Fecha, Jugadas y Alumno con mayor tamaño de texto y badges */}
          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 font-mono text-xs sm:text-sm text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-slate-500">schedule</span>
              {fechaLegible(partida.creada_en)}
            </span>

            <div className="flex items-center gap-2.5">
              {esFacilitador && partida.usuario_nombre && (
                <span className="flex items-center gap-1.5 text-primary font-semibold px-2.5 py-1 rounded-lg bg-surface-container border border-primary/20">
                  <span className="material-symbols-outlined text-[15px]">person</span>
                  {partida.usuario_nombre}
                </span>
              )}
              <span className={`font-bold px-3 py-1 rounded-lg ${
                partida.cantidad_jugadas > 0
                  ? 'bg-cyan-500/20 text-[#00e5ff] border border-cyan-500/40'
                  : 'bg-white/5 text-slate-500'
              }`}>
                {partida.cantidad_jugadas} {partida.cantidad_jugadas === 1 ? 'jugada' : 'jugadas'}
              </span>
              <span className="material-symbols-outlined text-[18px] text-cyan-400 group-hover:translate-x-1.5 transition-transform ml-1">
                arrow_forward
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Vista de Análisis Jugada por Jugada:
 * - Filtro amigable por usuario (los alumnos solo ven sus partidas y demos).
 * - Chips de filtrado ("Con Jugadas" por defecto, "Todas", "vs Turing IA", "vs Stockfish").
 * - Tarjetas enriquecidas con oponente, dificultad, resultado, fecha exacta y cantidad de jugadas.
 * - Desglose pedagógico de cada jugada (Qué, Por qué, Cómo mejorar).
 * - Gráfica interactiva de curva de efectividad.
 */
export default function Aprendizaje({
  partidaIdInicial,
  alCargarPartida,
  alIrASalaControl,
  usuario = null,
  esFacilitador = false,
}) {
  const [partidaId, setPartidaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [analisis, setAnalisis] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [error, setError] = useState(null);
  const [plySeleccionado, setPlySeleccionado] = useState(0);
  const [filtro, setFiltro] = useState('con_jugadas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (partidaIdInicial) {
      setPartidaId(partidaIdInicial);
      alCargarPartida?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaIdInicial]);

  useEffect(() => {
    if (partidaId) return;
    setCargandoHistorial(true);
    listarPartidas()
      .then(setHistorial)
      .catch((err) => setError(err.message))
      .finally(() => setCargandoHistorial(false));
  }, [partidaId]);

  useEffect(() => {
    if (!partidaId) return;
    setError(null);
    setCargandoAnalisis(true);
    setAnalisis(null);
    setPlySeleccionado(0);
    analisisCompletoPartida(partidaId)
      .then(setAnalisis)
      .catch((err) => setError(err.message))
      .finally(() => setCargandoAnalisis(false));
  }, [partidaId]);

  function elegirPartida(id) {
    setError(null);
    setPartidaId(id);
  }

  function cambiarPartida() {
    setPartidaId(null);
    setAnalisis(null);
    setError(null);
  }

  // Filtrado de partidas por usuario
  const partidasDelUsuario = useMemo(() => {
    return historial.filter((p) => {
      if (esFacilitador) return true;
      if (p.es_demostracion) return true;
      if (!usuario?.id) return true;
      return p.usuario_id === usuario.id;
    });
  }, [historial, esFacilitador, usuario?.id]);

  // Conteos en tiempo real
  const conteos = useMemo(() => {
    return {
      con_jugadas: partidasDelUsuario.filter((p) => p.cantidad_jugadas > 0).length,
      todas: partidasDelUsuario.length,
      turing: partidasDelUsuario.filter((p) => p.tipo_oponente === 'modelo').length,
      stockfish: partidasDelUsuario.filter((p) => p.tipo_oponente === 'motor').length,
    };
  }, [partidasDelUsuario]);

  // Partidas filtradas para renderizar
  const partidasFiltradas = useMemo(() => {
    return partidasDelUsuario.filter((p) => {
      if (filtro === 'con_jugadas' && !(p.cantidad_jugadas > 0)) return false;
      if (filtro === 'turing' && p.tipo_oponente !== 'modelo') return false;
      if (filtro === 'stockfish' && p.tipo_oponente !== 'motor') return false;

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideId = p.id.toLowerCase().includes(q);
        const coincideOponente = oponenteLegible(p.tipo_oponente).toLowerCase().includes(q);
        const coincideAlumno = p.usuario_nombre?.toLowerCase().includes(q);
        if (!coincideId && !coincideOponente && !coincideAlumno) return false;
      }
      return true;
    });
  }, [partidasDelUsuario, filtro, busqueda]);

  const partidaSeleccionada = useMemo(() => {
    return historial.find((p) => p.id === partidaId) || null;
  }, [historial, partidaId]);

  const jugadas = analisis?.jugadas ?? [];
  const jugadaActual = jugadas[plySeleccionado] ?? null;
  const categoriaActual = jugadaActual ? clasificarJugada(jugadaActual) : null;

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      {/* Franja superior */}
      <section className="bg-surface-container-lowest/80 backdrop-blur-md rounded-2xl p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md shadow-sm border border-white/5">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_10px_rgba(0,229,255,0.7)]" />
          <span className="font-mono-micro text-mono-micro tracking-widest text-primary font-semibold uppercase">
            APRENDIZAJE // ANÁLISIS JUGADA POR JUGADA
          </span>
          {partidaId && (
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                #{partidaId.slice(0, 8)}
              </span>
              {partidaSeleccionada && (
                <>
                  <span className="px-2 py-0.5 rounded-lg bg-surface-container text-slate-300">
                    {oponenteLegible(partidaSeleccionada.tipo_oponente)} · Nivel {partidaSeleccionada.nivel}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${colorResultado(partidaSeleccionada.resultado)}`}>
                    {resultadoLegible(partidaSeleccionada.resultado)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {partidaId && (
          <button
            onClick={cambiarPartida}
            className="px-space-md py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-white hover:text-primary font-mono-micro text-mono-micro uppercase tracking-wider transition-colors flex items-center gap-space-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary border border-white/5"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Elegir otra partida
          </button>
        )}
      </section>

      {error && (
        <div className="px-space-md py-space-xs rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Selector de partida cuando no hay una elegida */}
      {!partidaId && (
        <section className="flex flex-col gap-space-md">
          {/* Barra de descripción y filtros */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-sm bg-surface-container-lowest/60 p-space-md rounded-2xl border border-white/5">
            {/* Filtros Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'con_jugadas', etiqueta: 'Con Jugadas', count: conteos.con_jugadas },
                { id: 'todas', etiqueta: 'Todas', count: conteos.todas },
                { id: 'turing', etiqueta: 'vs Turing IA', count: conteos.turing },
                { id: 'stockfish', etiqueta: 'vs Stockfish', count: conteos.stockfish },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFiltro(btn.id)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all flex items-center gap-2 border ${
                    filtro === btn.id
                      ? 'bg-cyan-500/20 text-[#00e5ff] border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.2)] font-bold'
                      : 'bg-surface-container/60 hover:bg-surface-container text-slate-300 border-white/5'
                  }`}
                >
                  <span>{btn.etiqueta}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filtro === btn.id ? 'bg-[#00e5ff] text-black font-extrabold' : 'bg-white/10 text-slate-400'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative min-w-[220px]">
              <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar partida..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-surface-container/80 text-xs font-mono text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {cargandoHistorial && (
            <div className="p-space-lg text-center font-mono text-xs text-outline">
              Cargando historial de partidas...
            </div>
          )}

          {!cargandoHistorial && partidasFiltradas.length === 0 && !error && (
            <div className="rounded-2xl p-space-xl bg-[#151722] border border-white/10 text-center flex flex-col items-center gap-space-sm max-w-lg mx-auto shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[28px] text-primary">school</span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-white font-semibold">
                No se encontraron partidas
              </h4>
              <p className="font-body-sm text-body-sm text-slate-400">
                {filtro === 'con_jugadas' && conteos.todas > 0
                  ? `Tienes ${conteos.todas} partidas registradas, pero aún ninguna con jugadas. Jugá una partida en Sala de Control para comenzar a analizar.`
                  : 'No hay partidas que coincidan con los filtros seleccionados.'}
              </p>
              <div className="flex items-center gap-space-xs pt-space-xs flex-wrap justify-center">
                {filtro !== 'todas' && (
                  <button
                    type="button"
                    onClick={() => setFiltro('todas')}
                    className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-mono text-slate-300 transition-colors"
                  >
                    Ver todas las partidas ({conteos.todas})
                  </button>
                )}
                {alIrASalaControl && (
                  <button
                    type="button"
                    onClick={alIrASalaControl}
                    className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                  >
                    Ir a Sala de Control
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grid de partidas */}
          {!cargandoHistorial && partidasFiltradas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {partidasFiltradas.map((partida) => (
                <TarjetaPartidaAprendizaje
                  key={partida.id}
                  partida={partida}
                  alSeleccionar={() => elegirPartida(partida.id)}
                  esFacilitador={esFacilitador}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {partidaId && cargandoAnalisis && (
        <div className="p-space-xl text-center flex flex-col items-center gap-space-sm font-mono text-xs text-outline">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Analizando jugadas de la partida con el motor táctico...</span>
        </div>
      )}

      {partidaId && !cargandoAnalisis && analisis && jugadas.length === 0 && (
        <div className="rounded-2xl p-space-xl bg-[#151722] border border-white/10 text-center flex flex-col items-center gap-space-md max-w-xl mx-auto shadow-2xl animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[32px] text-cyan-400">history_toggle_off</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-headline-sm text-headline-sm text-white font-semibold">
              Esta partida no tiene jugadas registradas
            </h3>
            <p className="font-body-sm text-body-sm text-slate-400 leading-relaxed">
              La partida #{partidaId.slice(0, 8)} se creó pero concluyó con 0 movimientos. Para generar el árbol de evaluación táctica y la curva de efectividad, la partida debe contener movimientos.
            </p>
          </div>
          <div className="flex items-center gap-space-sm pt-space-xs flex-wrap justify-center">
            <button
              onClick={cambiarPartida}
              className="px-space-md py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-2 border border-white/5"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Elegir otra partida
            </button>
            {alIrASalaControl && (
              <button
                onClick={alIrASalaControl}
                className="px-space-md py-space-xs rounded-xl bg-primary text-on-primary font-mono text-xs uppercase tracking-wider font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">sports_esports</span>
                Ir a Sala de Control
              </button>
            )}
          </div>
        </div>
      )}

      {partidaId && !cargandoAnalisis && analisis && jugadas.length > 0 && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md w-full items-start">
            {/* Columna de jugadas */}
            <div className="xl:col-span-4 flex flex-col gap-space-xs">
              <div className="flex items-center justify-between px-space-xs">
                <span className="font-mono-micro text-mono-micro text-outline tracking-widest uppercase">
                  Jugadas analizadas ({jugadas.length})
                </span>
                <span className="font-mono-micro text-mono-micro text-primary">
                  {Math.ceil(jugadas.length / 2)} turnos
                </span>
              </div>
              <div className="bg-[#151722] border border-white/10 rounded-2xl p-space-xs flex flex-col gap-1 max-h-[540px] overflow-y-auto">
                {jugadas.map((jugada, indice) => {
                  const categoria = clasificarJugada(jugada);
                  const estilo = ESTILO_CATEGORIA[categoria];
                  const activa = indice === plySeleccionado;
                  return (
                    <button
                      key={jugada.numero_ply}
                      type="button"
                      onClick={() => setPlySeleccionado(indice)}
                      aria-current={activa}
                      className={`flex items-center justify-between gap-space-xs px-space-sm py-2 rounded-xl text-left transition-all border ${
                        activa
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,229,255,0.2)] font-semibold'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-space-xs">
                        <span className="font-mono text-xs text-slate-400 w-9">
                          {Math.ceil(jugada.numero_ply / 2)}
                          {jugada.color === 'blanco' ? '.' : '...'}
                        </span>
                        <span className={`font-mono text-sm ${activa ? 'text-cyan-300 font-bold' : 'text-white'}`}>
                          {jugada.jugada_san}
                        </span>
                      </span>
                      <span className={`flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full ${estilo.fondo} ${estilo.texto}`}>
                        <span className="material-symbols-outlined text-[13px]">{estilo.icono}</span>
                        {estilo.etiqueta}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de detalle de la jugada */}
            <div className="xl:col-span-8 flex flex-col gap-space-sm">
              {jugadaActual && (
                <div className={`rounded-2xl p-space-md sm:p-space-lg shadow-xl flex flex-col gap-space-md border border-white/10 ${ESTILO_CATEGORIA[categoriaActual].fondo}`}>
                  <div className="flex items-center justify-between flex-wrap gap-space-xs pb-3 border-b border-white/10">
                    <div className="flex items-center gap-space-xs">
                      <span className={`material-symbols-outlined text-[24px] ${ESTILO_CATEGORIA[categoriaActual].texto}`}>
                        {ESTILO_CATEGORIA[categoriaActual].icono}
                      </span>
                      <h2 className="font-headline-sm text-headline-sm text-white font-bold tracking-tight">
                        Jugada {Math.ceil(jugadaActual.numero_ply / 2)}{jugadaActual.color === 'blanco' ? '.' : '...'} — {jugadaActual.jugada_san}
                      </h2>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider font-bold bg-surface-container-lowest/80 border border-white/10 ${ESTILO_CATEGORIA[categoriaActual].texto}`}
                    >
                      {ESTILO_CATEGORIA[categoriaActual].etiqueta}
                    </span>
                  </div>

                  {/* Qué */}
                  <div className="bg-[#151722]/80 backdrop-blur-md rounded-xl p-space-sm sm:p-space-md flex flex-col gap-1.5 border border-white/5">
                    <span className="font-mono text-[11px] text-cyan-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">flag</span>
                      ¿Qué ocurrió?
                    </span>
                    <p className="font-body-sm text-body-sm text-slate-200 leading-relaxed">
                      {jugadaActual.jugada_san === jugadaActual.mejor_jugada_motor ? (
                        <>
                          Jugaste <strong className="text-white font-mono">{jugadaActual.jugada_san}</strong> — la mejor jugada posible en esta posición según el motor de evaluación.
                        </>
                      ) : (
                        <>
                          Jugaste <strong className="text-rose-300 font-mono">{jugadaActual.jugada_san}</strong>; la sugerencia óptima del motor era{' '}
                          <strong className="text-emerald-300 font-mono">{jugadaActual.mejor_jugada_motor}</strong>.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Por qué */}
                  <div className="bg-[#151722]/80 backdrop-blur-md rounded-xl p-space-sm sm:p-space-md flex flex-col gap-1.5 border border-white/5">
                    <span className="font-mono text-[11px] text-cyan-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">analytics</span>
                      ¿Por qué?
                    </span>
                    <div className="font-body-sm text-body-sm text-slate-200 leading-relaxed">
                      <TextoPorQue jugada={jugadaActual} />
                    </div>
                  </div>

                  {/* Cómo mejorar */}
                  <div className="bg-[#151722]/80 backdrop-blur-md rounded-xl p-space-sm sm:p-space-md flex flex-col gap-1.5 border border-white/5">
                    <span className="font-mono text-[11px] text-cyan-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">psychology</span>
                      ¿Cómo mejorar?
                    </span>
                    <p className="font-body-sm text-body-sm text-slate-200 leading-relaxed">{comoMejorarPorCategoria(categoriaActual)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Curva de efectividad */}
          <CurvaEfectividad jugadas={jugadas} plySeleccionado={plySeleccionado} onSeleccionar={setPlySeleccionado} />
        </>
      )}
    </div>
  );
}

function TextoPorQue({ jugada }) {
  const wpMejor = winPercent(jugada.evaluacion_mejor_cp, jugada.mate_en_mejor);
  const wpReal = winPercent(jugada.evaluacion_cp, jugada.mate_en);
  const caida = caidaDeJugada(jugada);
  const esMejor = jugada.jugada_san === jugada.mejor_jugada_motor;
  const primeraVariante = jugada.variantes_candidatas?.[0];

  return (
    <>
      {esMejor || caida < 0.5
        ? 'No hubo pérdida relevante de efectividad respecto a la mejor jugada del motor.'
        : `La efectividad bajó de ${wpMejor.toFixed(0)}% a ${wpReal.toFixed(0)}% (-${caida.toFixed(0)} puntos).`}
      {!esMejor && primeraVariante && (
        <>
          {' '}
          La línea que el motor prefería era <strong className="text-white font-mono">{primeraVariante.jugada}</strong>
          {primeraVariante.mate_en != null
            ? ` (mate en ${Math.abs(primeraVariante.mate_en)})`
            : ` (${formatearCp(primeraVariante.evaluacion_cp)})`}
          .
        </>
      )}
    </>
  );
}

/**
 * SVG interactivo con el winPercent de cada jugada.
 */
function CurvaEfectividad({ jugadas, plySeleccionado, onSeleccionar }) {
  const ancho = 900;
  const alto = 160;
  const paddingX = 16;
  const paso = jugadas.length > 1 ? (ancho - paddingX * 2) / (jugadas.length - 1) : 0;

  const puntos = jugadas.map((jugada, indice) => {
    const wp = winPercent(jugada.evaluacion_cp, jugada.mate_en);
    const x = jugadas.length > 1 ? paddingX + indice * paso : ancho / 2;
    const y = alto - (wp / 100) * alto;
    return { x, y, wp, jugada, categoria: clasificarJugada(jugada) };
  });

  const lineaPath = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const anchoFranja = paso || 40;

  return (
    <section className="bg-[#151722] border border-white/10 backdrop-blur-xl rounded-2xl p-space-md shadow-xl flex flex-col gap-space-sm">
      <div className="flex items-center justify-between flex-wrap gap-space-xs">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-bold">
          <span className="material-symbols-outlined text-[16px] text-primary">show_chart</span>
          Curva de efectividad táctica
        </span>
        <div className="flex items-center gap-space-md font-mono text-[11px] text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error"></span>Blunder
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim"></span>Error
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Buena / Mejor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary/40"></span>Mate forzado
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-40" preserveAspectRatio="none" role="img" aria-label="Curva de efectividad por jugada">
        {puntos.map((p) =>
          p.jugada.mate_en == null ? null : (
            <rect
              key={`franja-${p.jugada.numero_ply}`}
              x={p.x - anchoFranja / 2}
              y={0}
              width={anchoFranja}
              height={alto}
              className={p.jugada.mate_en > 0 ? 'fill-primary/20' : 'fill-error/20'}
            />
          )
        )}
        <line
          x1={paddingX}
          y1={alto / 2}
          x2={ancho - paddingX}
          y2={alto / 2}
          className="stroke-white/10"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path d={lineaPath} fill="none" className="stroke-cyan-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {puntos.map((p, i) => {
          const esExtremo = p.categoria === 'blunder' || p.categoria === 'error';
          const claseColor =
            p.categoria === 'blunder' ? 'fill-error' : p.categoria === 'error' ? 'fill-tertiary-fixed-dim' : 'fill-primary';
          const seleccionado = i === plySeleccionado;
          return (
            <circle
              key={p.jugada.numero_ply}
              cx={p.x}
              cy={p.y}
              r={esExtremo ? 5.5 : seleccionado ? 5 : 3.5}
              className={`cursor-pointer focus:outline-none focus-visible:stroke-white transition-all ${claseColor} ${
                seleccionado ? 'stroke-white stroke-2 shadow-[0_0_8px_rgba(0,229,255,0.8)]' : ''
              }`}
              opacity={esExtremo || seleccionado ? 1 : 0.65}
              tabIndex={0}
              role="button"
              aria-label={`Jugada ${p.jugada.numero_ply}, ${p.jugada.jugada_san}, ${
                p.jugada.mate_en != null ? `mate en ${Math.abs(p.jugada.mate_en)}` : `${p.wp.toFixed(0)} por ciento de efectividad`
              }`}
              onClick={() => onSeleccionar(i)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') onSeleccionar(i);
              }}
            >
              <title>
                {`Jugada ${p.jugada.numero_ply} · ${p.jugada.jugada_san}: ${
                  p.jugada.mate_en != null ? `Mate en ${Math.abs(p.jugada.mate_en)}` : `${p.wp.toFixed(0)}%`
                }`}
              </title>
            </circle>
          );
        })}
      </svg>
    </section>
  );
}
