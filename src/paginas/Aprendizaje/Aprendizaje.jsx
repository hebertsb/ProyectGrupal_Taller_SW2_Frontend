import { useEffect, useState } from 'react';
import { analisisCompletoPartida, listarPartidas } from '../../api/backend';
import {
  caidaDeJugada,
  clasificarJugada,
  comoMejorarPorCategoria,
  ESTILO_CATEGORIA,
  winPercent,
} from '../../aprendizaje';

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
 * Vista real (no vista previa) de análisis jugada por jugada de una partida
 * ya jugada — consume /partida/{id}/analisis-completo del backend y
 * clasifica cada jugada del lado del cliente (ver aprendizaje.js).
 */
export default function Aprendizaje({ partidaIdInicial, alCargarPartida }) {
  const [partidaId, setPartidaId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [analisis, setAnalisis] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [error, setError] = useState(null);
  const [plySeleccionado, setPlySeleccionado] = useState(0);

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

  const jugadas = analisis?.jugadas ?? [];
  const jugadaActual = jugadas[plySeleccionado] ?? null;
  const categoriaActual = jugadaActual ? clasificarJugada(jugadaActual) : null;

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      {/* Franja superior: selector de partida */}
      <section className="bg-surface-container-lowest/80 backdrop-blur-md rounded-lg p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md shadow-sm">
        <div className="flex items-center gap-space-xs">
          <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.7)]"></span>
          <span className="font-mono-micro text-mono-micro tracking-widest text-primary font-semibold uppercase">
            APRENDIZAJE // ANÁLISIS JUGADA POR JUGADA
          </span>
          {partidaId && (
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Partida #{partidaId.slice(0, 6)}
            </span>
          )}
        </div>
        {partidaId && (
          <button
            onClick={cambiarPartida}
            className="px-space-sm py-space-2xs rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary font-mono-micro text-mono-micro uppercase tracking-wider transition-colors flex items-center gap-space-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
            Elegir otra partida
          </button>
        )}
      </section>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      {/* Selector de partida cuando no hay una elegida */}
      {!partidaId && (
        <section className="flex flex-col gap-space-sm">
          {cargandoHistorial && (
            <span className="font-mono-micro text-mono-micro text-outline px-space-xs">Cargando partidas…</span>
          )}
          {!cargandoHistorial && historial.length === 0 && !error && (
            <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center flex flex-col items-center gap-space-xs">
              <span className="material-symbols-outlined text-[28px] text-outline">school</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Todavía no hay partidas jugadas para analizar. Jugá una en Sala de Control primero.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-sm">
            {historial.map((partida) => (
              <button
                key={partida.id}
                type="button"
                onClick={() => elegirPartida(partida.id)}
                className="text-left rounded-lg p-space-sm bg-surface-container-lowest hover:bg-surface-container-low shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-metric text-mono-metric text-primary font-medium">
                    #{partida.id.slice(0, 6)}
                  </span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                    {partida.cantidad_jugadas} jugadas
                  </span>
                </div>
                <div className="font-mono-micro text-mono-micro text-outline mt-space-2xs">
                  {fechaLegible(partida.creada_en)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {partidaId && cargandoAnalisis && (
        <span className="font-mono-micro text-mono-micro text-outline px-space-xs">Analizando partida…</span>
      )}

      {partidaId && !cargandoAnalisis && analisis && jugadas.length > 0 && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md w-full items-start">
            {/* Columna de jugadas */}
            <div className="xl:col-span-4 flex flex-col gap-space-xs">
              <span className="font-mono-micro text-mono-micro text-outline tracking-widest uppercase px-space-xs">
                Jugadas ({jugadas.length})
              </span>
              <div className="bg-surface-container-lowest rounded-lg p-space-xs flex flex-col gap-1 max-h-[520px] overflow-y-auto">
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
                      className={`flex items-center justify-between gap-space-xs px-space-sm py-space-xs rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        activa ? 'bg-surface-container-high ring-1 ring-inset ring-primary/50' : 'hover:bg-surface-container'
                      }`}
                    >
                      <span className="flex items-center gap-space-xs">
                        <span className="font-mono-micro text-mono-micro text-outline w-9">
                          {Math.ceil(jugada.numero_ply / 2)}
                          {jugada.color === 'blanco' ? '.' : '...'}
                        </span>
                        <span className="font-mono-label text-mono-label text-on-surface">{jugada.jugada_san}</span>
                      </span>
                      <span className={`flex items-center gap-1 font-mono-micro text-mono-micro ${estilo.texto}`}>
                        <span className="material-symbols-outlined text-[14px]">{estilo.icono}</span>
                        {estilo.etiqueta}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de detalle */}
            <div className="xl:col-span-8 flex flex-col gap-space-sm">
              {jugadaActual && (
                <div className={`rounded-xl p-space-md shadow-xl flex flex-col gap-space-md ${ESTILO_CATEGORIA[categoriaActual].fondo}`}>
                  <div className="flex items-center justify-between flex-wrap gap-space-xs">
                    <div className="flex items-center gap-space-xs">
                      <span className={`material-symbols-outlined text-[18px] ${ESTILO_CATEGORIA[categoriaActual].texto}`}>
                        {ESTILO_CATEGORIA[categoriaActual].icono}
                      </span>
                      <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                        Jugada {jugadaActual.numero_ply} — {jugadaActual.jugada_san}
                      </h2>
                    </div>
                    <span
                      className={`px-space-sm py-space-2xs rounded-lg font-mono-micro text-mono-micro uppercase tracking-wider bg-surface-container-lowest/60 ${ESTILO_CATEGORIA[categoriaActual].texto}`}
                    >
                      {ESTILO_CATEGORIA[categoriaActual].etiqueta}
                    </span>
                  </div>

                  {/* Qué */}
                  <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                    <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Qué</span>
                    <p className="font-body-sm text-body-sm text-on-surface">
                      {jugadaActual.jugada_san === jugadaActual.mejor_jugada_motor ? (
                        <>
                          Jugaste <strong>{jugadaActual.jugada_san}</strong> — la mejor jugada posible en esta posición.
                        </>
                      ) : (
                        <>
                          Jugaste <strong>{jugadaActual.jugada_san}</strong>; el motor recomendaba{' '}
                          <strong>{jugadaActual.mejor_jugada_motor}</strong>.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Por qué */}
                  <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                    <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Por qué</span>
                    <p className="font-body-sm text-body-sm text-on-surface">
                      <TextoPorQue jugada={jugadaActual} />
                    </p>
                  </div>

                  {/* Cómo mejorar */}
                  <div className="bg-surface-container-lowest/60 rounded-lg p-space-sm flex flex-col gap-space-2xs">
                    <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Cómo mejorar</span>
                    <p className="font-body-sm text-body-sm text-on-surface">{comoMejorarPorCategoria(categoriaActual)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Curva de efectividad */}
          <CurvaEfectividad jugadas={jugadas} plySeleccionado={plySeleccionado} onSeleccionar={setPlySeleccionado} />
        </>
      )}

      {partidaId && !cargandoAnalisis && analisis && jugadas.length === 0 && (
        <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center text-on-surface-variant font-body-sm text-body-sm">
          Esta partida todavía no tiene jugadas para analizar.
        </div>
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
          La línea que el motor prefería era <strong>{primeraVariante.jugada}</strong>
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
 * SVG de línea a mano (sin librería de charting) con el winPercent de cada
 * jugada. Los tramos con mate forzado se marcan con una franja de color en
 * vez de seguir la curva normal, y su tooltip muestra "Mate en N".
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
    <section className="bg-surface-container-low/80 backdrop-blur-xl rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
      <div className="flex items-center justify-between flex-wrap gap-space-xs">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-primary">show_chart</span>
          Curva de efectividad
        </span>
        <div className="flex items-center gap-space-md font-mono-micro text-mono-micro text-outline">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-error"></span>Blunder
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>Error
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary/60"></span>Franja: mate forzado
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
              className={p.jugada.mate_en > 0 ? 'fill-primary/15' : 'fill-error/15'}
            />
          )
        )}
        <line
          x1={paddingX}
          y1={alto / 2}
          x2={ancho - paddingX}
          y2={alto / 2}
          className="stroke-outline-variant/40"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path d={lineaPath} fill="none" className="stroke-primary/70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              r={esExtremo ? 5 : seleccionado ? 4.5 : 3}
              className={`cursor-pointer focus:outline-none focus-visible:stroke-on-surface ${claseColor} ${seleccionado ? 'stroke-on-surface' : ''}`}
              strokeWidth={seleccionado ? 1.5 : 0}
              opacity={esExtremo || seleccionado ? 1 : 0.55}
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
