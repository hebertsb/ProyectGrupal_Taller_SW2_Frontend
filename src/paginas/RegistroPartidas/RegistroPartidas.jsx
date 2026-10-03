import { useEffect, useState } from 'react';
import { listarPartidas, obtenerPartida, obtenerDemostracionActiva } from '../../api/backend';
import { fechaDesdeIso } from '../../formatoTiempo';

const INTERVALO_SONDEO_DEMOSTRACION_MS = 8000;

const FILTROS = {
  con_jugadas: (p) => p.cantidad_jugadas > 0,
  todas: () => true,
  turing: (p) => p.tipo_oponente === 'modelo',
  stockfish: (p) => p.tipo_oponente === 'motor',
  victorias: (p) => p.resultado === '1-0',
  tablas: (p) => p.resultado === '1/2-1/2',
  derrotas: (p) => p.resultado === '0-1',
};

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

/**
 * Insignia de "Terminada" / "Sin terminar" — campo nuevo y opcional
 * (`estado`: 'en_curso' | 'terminada' | 'abandonada'). `null` si el backend
 * todavía no lo manda, para no mostrar nada en vez de un dato inventado.
 */
function estadoLegible(estado) {
  if (estado === 'terminada') return 'Terminada';
  if (estado === 'en_curso' || estado === 'abandonada') return 'Sin terminar';
  return null;
}

function colorEstado(estado) {
  if (estado === 'terminada') return 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/50';
  return 'bg-slate-800/70 text-slate-300 border border-slate-500/40';
}

function categoriaNivel(n) {
  if (n == null) return 'Intermedio';
  if (n <= 6) return 'Principiante';
  if (n <= 13) return 'Intermedio';
  return 'Avanzado';
}

/**
 * `fechaDesdeIso` (formatoTiempo.js) interpreta como UTC un ISO del backend sin
 * sufijo de zona (bug ya identificado: sin esto la hora se ve adelantada según
 * el huso del navegador) — acá solo se conserva el mismo formato visual de
 * siempre (con segundos), ya sobre esa fecha corregida.
 */
function fechaLegible(iso) {
  const fecha = fechaDesdeIso(iso);
  if (!fecha) return iso;
  try {
    return fecha.toLocaleString('es-BO', {
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

/**
 * Componente individual para la tarjeta de partida.
 * Diseñado con 3 filas limpias, tamaño de labels aumentado, tipografía más legible y amplia separación.
 */
function TarjetaPartida({ partida, activa, alSeleccionar, esFacilitador, modoGrid = false }) {
  const esTuring = partida.tipo_oponente === 'modelo';

  return (
    <article
      onClick={alSeleccionar}
      className={`cursor-pointer rounded-2xl p-5 sm:p-6 transition-all relative overflow-hidden group border min-h-[110px] ${
        activa
          ? 'bg-[#1e2232] border-cyan-400 shadow-[0_0_24px_rgba(0,229,255,0.3)] ring-2 ring-cyan-400/60'
          : 'bg-[#151722] hover:bg-[#1a1e2d] border-white/10 hover:border-cyan-400/50 shadow-md hover:shadow-xl'
      }`}
    >
      <div className="flex items-stretch gap-4">
        {/* Indicador de acento vertical estilizado y más grueso */}
        <div className={`w-2 min-h-[78px] rounded-full shrink-0 ${barraResultadoColor(partida.resultado)}`} />

        <div className="flex-1 flex flex-col gap-3.5 min-w-0 justify-between">
          {/* Fila 1: ID de partida grande y Resultado destacado */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`font-mono text-base sm:text-lg font-bold tracking-tight ${activa ? 'text-cyan-300' : 'text-white group-hover:text-cyan-300 transition-colors'}`}>
              #{partida.id.slice(0, 8)}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
              {estadoLegible(partida.estado) && (
                <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] sm:text-xs font-bold tracking-wide ${colorEstado(partida.estado)}`}>
                  {estadoLegible(partida.estado)}
                </span>
              )}
              <span className={`px-3.5 py-1 rounded-full font-mono text-xs font-bold tracking-wide ${colorResultado(partida.resultado)}`}>
                {resultadoLegible(partida.resultado)}
              </span>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/10 font-mono text-xs sm:text-sm text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-slate-500">schedule</span>
              {fechaLegible(partida.creada_en)}
            </span>

            <div className="flex flex-wrap items-center gap-2.5">
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
              {typeof partida.jugadas_jugador === 'number' && (
                <span className="font-medium text-slate-400" title="Jugadas hechas por el jugador (sin contar las del rival)">
                  (jugador: {partida.jugadas_jugador})
                </span>
              )}
              {modoGrid && (
                <span className="material-symbols-outlined text-[18px] text-cyan-400 group-hover:translate-x-1.5 transition-transform ml-1">
                  arrow_forward
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function RegistroPartidas({
  alIrASalaControl,
  alIrARazonamiento,
  alIrAAprendizaje,
  alIrAPanelAprendizaje = null,
  alVerDemostracion,
  esFacilitador = false,
  usuario = null,
}) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('con_jugadas');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [demoActiva, setDemoActiva] = useState(null);
  const [modoVista, setModoVista] = useState('grid'); // 'grid' | 'split'

  useEffect(() => {
    listarPartidas()
      .then(setHistorial)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  // Banner "tu facilitador está transmitiendo"
  useEffect(() => {
    if (esFacilitador) {
      setDemoActiva(null);
      return;
    }
    let cancelado = false;
    const sondear = () => {
      obtenerDemostracionActiva()
        .then((datos) => { if (!cancelado) setDemoActiva(datos); })
        .catch(() => { if (!cancelado) setDemoActiva(null); });
    };
    sondear();
    const intervalo = setInterval(sondear, INTERVALO_SONDEO_DEMOSTRACION_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [esFacilitador]);

  // Cargar detalle de partida seleccionada con manejo silencioso de permisos
  useEffect(() => {
    if (!seleccionadaId) {
      setDetalle(null);
      return;
    }
    obtenerPartida(seleccionadaId)
      .then((datos) => {
        setDetalle(datos);
        setError(null);
      })
      .catch((err) => {
        if (err.status === 403 || err.message?.includes('pertenece a otro usuario')) {
          setSeleccionadaId(null);
          setDetalle(null);
          setError(null);
        } else {
          setError(err.message);
        }
      });
  }, [seleccionadaId]);

  function elegirPartida(id) {
    setSeleccionadaId(id);
    setModoVista('split');
  }

  // Doble capa de seguridad: filtrar partidas por usuario en el cliente
  const partidasDelUsuario = historial.filter((p) => {
    if (esFacilitador) return true;
    if (p.es_demostracion) return true;
    if (usuario?.id) return p.usuario_id === usuario.id;
    return true;
  });

  const partidasFiltradas = partidasDelUsuario
    .filter(FILTROS[filtro] || FILTROS.todas)
    .filter((p) => !busqueda || p.id.includes(busqueda) || p.fen.toLowerCase().includes(busqueda.toLowerCase()));

  // Auto-seleccionar la primera partida en modo split si ninguna está activa
  useEffect(() => {
    if (modoVista === 'split' && partidasFiltradas.length > 0) {
      const existe = partidasFiltradas.some((p) => p.id === seleccionadaId);
      if (!existe) {
        setSeleccionadaId(partidasFiltradas[0].id);
      }
    }
  }, [modoVista, partidasFiltradas, seleccionadaId]);

  const conteos = {
    con_jugadas: partidasDelUsuario.filter(FILTROS.con_jugadas).length,
    todas: partidasDelUsuario.length,
    turing: partidasDelUsuario.filter(FILTROS.turing).length,
    stockfish: partidasDelUsuario.filter(FILTROS.stockfish).length,
    victorias: partidasDelUsuario.filter(FILTROS.victorias).length,
    tablas: partidasDelUsuario.filter(FILTROS.tablas).length,
    derrotas: partidasDelUsuario.filter(FILTROS.derrotas).length,
  };

  return (
    <div className="flex flex-col w-full gap-space-lg p-space-lg animate-in fade-in duration-500">
      {/* Banner de transmisión en vivo — solo jugador */}
      {demoActiva && (
        <div className="flex items-center justify-between gap-space-sm px-space-md py-space-sm rounded-xl bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-space-sm">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="font-body-sm text-body-sm text-on-surface">
              Tu facilitador está mostrando una partida en vivo
            </span>
          </div>
          <button
            onClick={() => alVerDemostracion?.(demoActiva.id)}
            className="px-space-md py-space-2xs rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:brightness-110 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shrink-0"
            type="button"
          >
            Ver
          </button>
        </div>
      )}

      {/* Franja superior: título, contador y conmutador de vista */}
      <section className="bg-surface-container-lowest/80 backdrop-blur-md rounded-xl p-space-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md shadow-sm border border-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md w-full lg:w-auto">
          <div className="flex items-center gap-space-xs shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_10px_rgba(0,229,255,0.8)]"></span>
            <span className="font-mono text-sm tracking-wider text-primary font-bold uppercase">
              REGISTRO DE PARTIDAS // {esFacilitador ? 'VISTA GENERAL' : 'MIS PARTIDAS'}
            </span>
          </div>
          <div className="hidden sm:block h-3.5 w-px bg-surface-variant"></div>
          <div className="flex items-center gap-space-sm font-mono text-xs text-on-surface-variant">
            <span>
              TOTAL: <strong className="text-white font-bold">{partidasDelUsuario.length}</strong> {esFacilitador ? 'EN SISTEMA' : 'JUGADAS POR VOS'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-space-sm w-full lg:w-auto">
          {/* Selector de modo de vista: Cuadrícula vs Inspector Dividido */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setModoVista('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                modoVista === 'grid'
                  ? 'bg-primary text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-on-surface-variant hover:text-white'
              }`}
              title="Ver todas las partidas en cuadrícula amplia"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>Cuadrícula</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModoVista('split');
                if (!seleccionadaId && partidasFiltradas.length > 0) {
                  setSeleccionadaId(partidasFiltradas[0].id);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                modoVista === 'split'
                  ? 'bg-primary text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-on-surface-variant hover:text-white'
              }`}
              title="Ver vista dividida con panel de inspección técnica"
            >
              <span className="material-symbols-outlined text-[16px]">view_sidebar</span>
              <span>Inspector</span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-space-xs top-1/2 -translate-y-1/2 text-[16px] text-outline">search</span>
            <input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className="bg-surface-container-low text-on-surface placeholder:text-outline font-mono text-xs pl-8 pr-space-sm py-1.5 rounded-lg focus:outline-none focus:bg-surface-container transition-all w-48 sm:w-60 border border-white/5"
              placeholder="Buscar por ID o FEN..."
              type="text"
            />
          </div>
        </div>
      </section>

      {/* Barra de pestañas de filtros con conteos */}
      <div className="flex items-center gap-2 flex-wrap bg-surface-container-low p-2 rounded-xl border border-white/5">
        {[
          { id: 'con_jugadas', label: 'Con Jugadas', count: conteos.con_jugadas },
          { id: 'todas', label: 'Todas', count: conteos.todas },
          { id: 'turing', label: 'vs Turing IA', count: conteos.turing, icon: 'psychology' },
          { id: 'stockfish', label: 'vs Stockfish', count: conteos.stockfish, icon: 'smart_toy' },
          { id: 'victorias', label: 'Victorias', count: conteos.victorias },
          { id: 'tablas', label: 'Tablas', count: conteos.tablas },
          { id: 'derrotas', label: 'Derrotas', count: conteos.derrotas },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFiltro(item.id)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all flex items-center gap-1.5 ${
              filtro === item.id
                ? 'bg-primary text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'text-on-surface-variant hover:text-white hover:bg-surface-container/60'
            }`}
          >
            {item.icon && <span className="material-symbols-outlined text-[15px]">{item.icon}</span>}
            <span>{item.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              filtro === item.id ? 'bg-black/25 text-black' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      {cargando && (
        <div className="w-full py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-outline">Cargando partidas del historial…</span>
        </div>
      )}

      {!cargando && partidasFiltradas.length === 0 && (
        <div className="rounded-xl p-space-xl bg-surface-container-lowest text-center flex flex-col items-center gap-space-sm border border-white/5 my-4">
          <span className="material-symbols-outlined text-[40px] text-outline">history_edu</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            No hay partidas que coincidan con este filtro
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            Probá seleccionando "Todas" o disputá una nueva partida en el tablero principal.
          </p>
          <button
            onClick={alIrASalaControl}
            className="mt-space-xs px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm font-semibold hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">sports_esports</span>
            Ir a Sala de Control a jugar una
          </button>
        </div>
      )}

      {/* VISTA 1: CUADRÍCULA AMPLIA (Máximo espacio y separación) */}
      {!cargando && partidasFiltradas.length > 0 && modoVista === 'grid' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs text-outline tracking-wider uppercase font-semibold">
              MOSTRANDO {partidasFiltradas.length} PARTIDAS EN CUADRÍCULA
            </span>
            <span className="font-mono text-xs text-slate-400">
              Hacé clic en cualquier tarjeta para abrir su inspector detallado
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
            {partidasFiltradas.map((partida) => (
              <TarjetaPartida
                key={partida.id}
                partida={partida}
                activa={seleccionadaId === partida.id}
                alSeleccionar={() => elegirPartida(partida.id)}
                esFacilitador={esFacilitador}
                modoGrid={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* VISTA 2: INSPECTOR DIVIDIDO (Lista izquierda bien ancha y separada + Inspector a la derecha) */}
      {!cargando && partidasFiltradas.length > 0 && modoVista === 'split' && (
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
          {/* Columna Izquierda: Lista de partidas con ancho confortable y amplio */}
          <div className="w-full lg:w-[480px] xl:w-[540px] shrink-0 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs sm:text-sm text-outline tracking-wider uppercase font-semibold">
                HISTORIAL ({partidasFiltradas.length})
              </span>
              <button
                onClick={() => setModoVista('grid')}
                className="font-mono text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-semibold transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                Ver en cuadrícula
              </button>
            </div>

            <div className="flex flex-col gap-4 max-h-[860px] overflow-y-auto pr-2">
              {partidasFiltradas.map((partida) => (
                <TarjetaPartida
                  key={partida.id}
                  partida={partida}
                  activa={seleccionadaId === partida.id}
                  alSeleccionar={() => setSeleccionadaId(partida.id)}
                  esFacilitador={esFacilitador}
                  modoGrid={false}
                />
              ))}
            </div>
          </div>

          {/* Columna Derecha: Inspector técnico detallado */}
          <div className="flex-1 min-w-0 w-full sticky top-4">
            {!detalle ? (
              <div className="flex flex-col items-center justify-center p-space-xl rounded-2xl bg-surface-container-lowest/90 border border-dashed border-outline-variant/40 min-h-[460px] text-center gap-space-sm shadow-sm">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 border border-primary/20">
                  <span className="material-symbols-outlined text-[36px]">manage_search</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Seleccioná una partida para inspeccionar
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                  Elegí cualquier partida de la lista lateral para ver su detalle técnico, movimientos SAN jugada por jugada, FEN actual y opciones pedagógicas.
                </p>
              </div>
            ) : (
              <div className="bg-[#151722] rounded-2xl p-space-lg shadow-xl border border-white/10 flex flex-col gap-space-md animate-in slide-in-from-right-4 duration-300">
                {/* Cabecera del Inspector */}
                <div className="flex items-start justify-between pb-space-xs border-b border-outline-variant/20 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 uppercase tracking-wider mb-1">
                      <span className="material-symbols-outlined text-[16px]">troubleshoot</span>
                      <span>INSPECTOR DETALLADO DE PARTIDA</span>
                    </div>
                    <h2 className="font-headline-lg text-headline-lg text-white font-bold tracking-tight">
                      #{detalle.id.slice(0, 8)}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {estadoLegible(detalle.estado) && (
                        <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold ${colorEstado(detalle.estado)}`}>
                          {estadoLegible(detalle.estado)}
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold ${colorResultado(detalle.resultado)}`}>
                        {resultadoLegible(detalle.resultado)}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        detalle.tipo_oponente === 'modelo' ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-500/30' : 'bg-slate-700/60 text-slate-200 border border-slate-500/40'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {detalle.tipo_oponente === 'modelo' ? 'psychology' : 'smart_toy'}
                        </span>
                        {oponenteLegible(detalle.tipo_oponente)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-xs border border-white/5">
                        Nivel {detalle.nivel} ({categoriaNivel(detalle.nivel)})
                      </span>
                      {esFacilitador && detalle.usuario_nombre && (
                        <span className="flex items-center gap-1 font-mono text-xs text-primary px-2.5 py-0.5 rounded-full bg-surface-container">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          {detalle.usuario_nombre}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-[11px] text-outline block">FECHA Y HORA</span>
                    <span className="font-mono text-xs text-white flex items-center gap-1 justify-end mt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                      {fechaLegible(detalle.creada_en)}
                    </span>
                  </div>
                </div>

                {/* FEN actual */}
                <div className="bg-[#1b1e2a] rounded-xl p-space-sm flex flex-col gap-1 border border-white/5">
                  <span className="font-mono text-xs text-outline uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
                    Posición FEN Actual
                  </span>
                  <span className="font-mono text-xs text-cyan-300 break-all select-all">
                    {detalle.fen}
                  </span>
                </div>

                {/* Movimientos Registrados */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-outline tracking-wider uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">format_list_numbered</span>
                      Movimientos Registrados ({detalle.jugadas.length})
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {detalle.jugadas.length === 0 ? 'Sin jugadas' : `${Math.ceil(detalle.jugadas.length / 2)} turnos jugados`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 font-mono max-h-72 overflow-y-auto bg-[#1b1e2a] rounded-xl p-space-sm border border-white/5">
                    {detalle.jugadas.length === 0 && (
                      <div className="py-6 text-center text-outline font-mono text-xs">
                        Esta partida aún no tiene jugadas registradas.
                      </div>
                    )}
                    {detalle.jugadas.map((san, indice) => (
                      <div
                        key={indice}
                        className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 w-10 font-mono text-xs">
                            {Math.floor(indice / 2) + 1}{indice % 2 === 0 ? '.' : '...'}
                          </span>
                          <span className="font-bold text-white font-mono text-sm px-2 py-0.5 rounded bg-black/30">
                            {san}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: indice % 2 === 0 ? '#ffffff' : '#64748b' }}></span>
                          {indice % 2 === 0 ? 'Blancas (Vos)' : (detalle.tipo_oponente === 'modelo' ? 'Turing IA' : 'Stockfish')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botones de acción integrados */}
                <div className="flex flex-wrap items-center gap-space-sm pt-space-xs border-t border-outline-variant/20">
                  <button
                    onClick={() => alIrASalaControl?.(detalle.id)}
                    className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm font-semibold flex items-center gap-space-xs hover:brightness-110 transition-all shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">sports_esports</span>
                    <span>Cargar en Sala de Control</span>
                  </button>

                  <button
                    onClick={() => alIrAAprendizaje?.(detalle.id)}
                    className="px-space-sm py-space-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-space-2xs border border-white/5"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">troubleshoot</span>
                    <span>Análisis Jugada a Jugada</span>
                  </button>

                  {alIrAPanelAprendizaje && !esFacilitador && (
                    <button
                      onClick={() => alIrAPanelAprendizaje(detalle.id)}
                      className="px-space-sm py-space-xs rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-space-2xs border border-secondary/30"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">school</span>
                      <span>Tutor Pedagógico Turing</span>
                    </button>
                  )}

                  <button
                    onClick={alIrARazonamiento}
                    className="px-space-sm py-space-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-space-2xs border border-white/5"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">psychology</span>
                    <span>Ver Razonamiento Neuronal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="bg-surface-container-lowest/80 backdrop-blur-sm rounded-xl px-space-md py-space-xs flex items-center justify-center font-mono text-xs text-outline mt-auto border border-white/5">
        <span>Registro sincronizado con el backend en memoria y filtrado por usuario autenticado.</span>
      </footer>
    </div>
  );
}
