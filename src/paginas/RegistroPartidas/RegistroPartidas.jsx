import { useEffect, useState } from 'react';
import { listarPartidas, obtenerPartida } from '../../api/backend';

const FILTROS = {
  todas: () => true,
  victorias: (p) => p.resultado === '1-0',
  tablas: (p) => p.resultado === '1/2-1/2',
  derrotas: (p) => p.resultado === '0-1',
};

function resultadoLegible(resultado) {
  if (resultado === '1-0') return 'Ganaste (1-0)';
  if (resultado === '0-1') return 'Ganó el motor (0-1)';
  if (resultado === '1/2-1/2') return 'Tablas (½ - ½)';
  return 'En curso';
}

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function RegistroPartidas({ alIrASalaControl, alIrARazonamiento }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState(null);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    listarPartidas()
      .then(setHistorial)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!seleccionadaId) {
      setDetalle(null);
      return;
    }
    obtenerPartida(seleccionadaId)
      .then(setDetalle)
      .catch((err) => setError(err.message));
  }, [seleccionadaId]);

  const partidasFiltradas = historial
    .filter(FILTROS[filtro])
    .filter((p) => !busqueda || p.id.includes(busqueda) || p.fen.toLowerCase().includes(busqueda.toLowerCase()));

  const conteos = {
    todas: historial.length,
    victorias: historial.filter(FILTROS.victorias).length,
    tablas: historial.filter(FILTROS.tablas).length,
    derrotas: historial.filter(FILTROS.derrotas).length,
  };

  return (
    <div className="flex flex-col w-full gap-space-md p-space-lg animate-in fade-in duration-500">
      {/* Franja superior */}
      <section className="bg-surface-container-lowest/80 backdrop-blur-md rounded-lg p-space-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md w-full lg:w-auto">
          <div className="flex items-center gap-space-xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.7)]"></span>
            <span className="font-mono-micro text-mono-micro tracking-widest text-primary font-semibold uppercase">REGISTRO // BACKEND EN MEMORIA</span>
          </div>
          <div className="hidden sm:block h-3 w-px bg-surface-variant"></div>
          <div className="flex items-center gap-space-sm font-mono-micro text-mono-micro text-on-surface-variant">
            <span>PARTIDAS: <strong className="text-on-surface font-mono-metric text-mono-metric font-medium">{historial.length}</strong> GUARDADAS</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-space-sm w-full lg:w-auto">
          <div className="inline-flex items-center bg-surface-container-low p-space-2xs rounded-lg gap-space-2xs">
            {[
              ['todas', 'Todas'],
              ['victorias', 'Victorias'],
              ['tablas', 'Tablas'],
              ['derrotas', 'Derrotas'],
            ].map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                onClick={() => setFiltro(clave)}
                className={
                  filtro === clave
                    ? 'px-space-sm py-space-2xs rounded text-on-primary bg-primary-container font-mono-micro text-mono-micro tracking-wider font-semibold transition-all shadow-[0_0_10px_rgba(0,229,255,0.35)]'
                    : 'px-space-sm py-space-2xs rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-mono-micro text-mono-micro tracking-wider transition-all'
                }
              >
                {etiqueta} ({conteos[clave]})
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-space-xs top-1/2 -translate-y-1/2 text-[16px] text-outline">search</span>
            <input
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className="bg-surface-container-low text-on-surface placeholder:text-outline font-mono-micro text-mono-micro pl-7 pr-space-sm py-space-2xs rounded-lg focus:outline-none focus:bg-surface-container transition-all w-40 sm:w-52"
              placeholder="Buscar por id o FEN..."
              type="text"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md w-full">
        {/* Columna Izquierda: Lista real */}
        <div className="xl:col-span-5 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-space-xs">
            <span className="font-mono-micro text-mono-micro text-outline tracking-widest uppercase">REGISTRO CRONOLÓGICO</span>
          </div>

          {cargando && <span className="font-mono-micro text-mono-micro text-outline px-space-xs">Cargando…</span>}

          {!cargando && partidasFiltradas.length === 0 && (
            <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center flex flex-col items-center gap-space-xs">
              <span className="material-symbols-outlined text-[28px] text-outline">history_edu</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay partidas que coincidan.</p>
              <button
                onClick={alIrASalaControl}
                className="mt-space-xs px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm font-medium"
                type="button"
              >
                Ir a Sala de Control a jugar una
              </button>
            </div>
          )}

          {partidasFiltradas.map((partida) => {
            const activa = seleccionadaId === partida.id;
            return (
              <article
                key={partida.id}
                onClick={() => setSeleccionadaId(partida.id)}
                className={`cursor-pointer rounded-lg p-space-sm shadow-md transition-all relative overflow-hidden group ${activa ? 'bg-surface-container-low/90' : 'bg-surface-container-lowest hover:bg-surface-container-low/60 shadow-sm'}`}
              >
                {activa && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.8)]"></div>}
                <div className={`flex flex-col gap-space-xs ${activa ? 'pl-space-xs' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className={`font-mono-metric text-mono-metric font-medium ${activa ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary transition-colors'}`}>
                        #{partida.id.slice(0, 6)}
                      </span>
                      <span className="text-surface-variant">•</span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-medium">
                        Stockfish · nivel {partida.nivel} · {partida.tipo}
                      </h3>
                    </div>
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface font-mono-micro text-mono-micro tracking-wider">
                      {resultadoLegible(partida.resultado)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-space-sm font-mono-micro text-mono-micro text-on-surface-variant pt-space-2xs">
                    <span>{fechaLegible(partida.creada_en)}</span>
                    <span className="text-surface-variant">/</span>
                    <span>{partida.cantidad_jugadas} jugadas</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Columna Derecha: Inspector real */}
        {detalle && (
          <div className="xl:col-span-7 flex flex-col gap-space-md animate-in slide-in-from-right-4 duration-300">
            <div className="bg-surface-container-low/90 rounded-lg p-space-md shadow-md flex flex-col gap-space-md">
              <div className="flex items-start justify-between pb-space-xs">
                <div>
                  <div className="flex items-center gap-space-xs font-mono-micro text-mono-micro text-primary-fixed-dim uppercase tracking-wider mb-space-2xs">
                    <span>INSPECTOR DE PARTIDA</span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                    #{detalle.id.slice(0, 6)} — {resultadoLegible(detalle.resultado)}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="font-mono-micro text-mono-micro text-outline block">CREADA</span>
                  <span className="font-mono-metric text-mono-metric text-on-surface">{fechaLegible(detalle.creada_en)}</span>
                </div>
              </div>

              <div className="bg-surface-container rounded-lg p-space-sm flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">FEN actual</span>
                <span className="font-mono-micro text-mono-micro text-primary-fixed-dim break-all">{detalle.fen}</span>
              </div>

              <div className="flex flex-col gap-space-xs">
                <span className="font-mono-micro text-mono-micro text-outline tracking-wider uppercase">Movimientos ({detalle.jugadas.length})</span>
                <div className="flex flex-col gap-1 font-mono-label text-mono-label max-h-72 overflow-y-auto bg-surface-container rounded-lg p-space-sm">
                  {detalle.jugadas.length === 0 && (
                    <span className="font-mono-micro text-mono-micro text-outline px-2 py-1">Sin jugadas todavía.</span>
                  )}
                  {detalle.jugadas.map((san, indice) => (
                    <div key={indice} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-container-high text-on-surface-variant">
                      <span className="text-outline w-6">{indice + 1}.</span>
                      <span>{san}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-space-sm pt-space-xs border-t border-outline-variant/20">
                <button
                  onClick={() => alIrASalaControl?.(detalle.id)}
                  className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm font-semibold flex items-center gap-space-xs hover:brightness-110 transition-all"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">play_circle</span>
                  <span>Cargar en Sala de Control</span>
                </button>
                <button
                  onClick={alIrARazonamiento}
                  className="px-space-sm py-space-xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono-micro text-mono-micro uppercase tracking-wider transition-all flex items-center gap-space-2xs"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">psychology</span>
                  <span>Ver Razonamiento Neuronal</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="bg-surface-container-lowest/80 backdrop-blur-sm rounded-lg px-space-md py-space-xs flex items-center justify-center font-mono-micro text-mono-micro text-outline mt-auto">
        <span>Registro real del backend, guardado mientras el proceso sigue corriendo — no sobrevive un reinicio (persistencia real es HU8/HU11, alcance de tesis).</span>
      </footer>
    </div>
  );
}
