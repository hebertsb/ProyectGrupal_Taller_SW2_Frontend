import { useEffect, useState } from 'react';
import { analisisRedPartida } from '../../api/backend';

/** Nombre con el que se muestra quién juega las negras (la contraparte). */
const NOMBRE_CONTRAPARTE = { modelo: 'Turing', motor: 'Stockfish' };

const porcentajeLegible = (valor) => (valor == null ? '—' : `${valor.toFixed(1)}%`);
const probabilidadLegible = (valor) => (valor == null ? '—' : `${(valor * 100).toFixed(1)}%`);

function Resumen({ resumen, terminada }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body-sm text-body-sm text-on-surface">
        La red eligió lo mismo que se jugó en{' '}
        <strong className="text-neon-cyan">
          {resumen.coinciden} de {resumen.total_jugadas}
        </strong>{' '}
        jugadas ({porcentajeLegible(resumen.porcentaje)}).
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 font-mono-micro text-[11px] text-on-surface">
          Jugador (blancas): {resumen.jugador.coinciden} de {resumen.jugador.total} · {porcentajeLegible(resumen.jugador.porcentaje)}
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 font-mono-micro text-[11px] text-on-surface">
          Contraparte (negras): {resumen.contraparte.coinciden} de {resumen.contraparte.total} · {porcentajeLegible(resumen.contraparte.porcentaje)}
        </span>
      </div>
      {!terminada && (
        <p className="font-mono-micro text-[10px] text-outline">
          Partida en curso: el análisis cubre solo las jugadas hechas hasta ahora.
        </p>
      )}
    </div>
  );
}

/**
 * Análisis de la red propia sobre una partida de un estudiante (solo facilitador).
 * Compara, jugada por jugada, lo que elige la red con lo que se jugó. Tocar una
 * jugada lleva la pantalla a esa posición: el mapa de activación y las candidatas
 * muestran lo que procesó la red ahí.
 */
export default function AnalisisRedPartida({ partidaId, terminada = true, alElegirJugada = null }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [numeroSeleccionada, setNumeroSeleccionada] = useState(null);

  // Al cambiar de partida el análisis anterior ya no aplica.
  useEffect(() => {
    setDatos(null);
    setError(null);
    setNumeroSeleccionada(null);
  }, [partidaId]);

  function analizar() {
    setCargando(true);
    setError(null);
    analisisRedPartida(partidaId)
      .then(setDatos)
      .catch((err) => setError(err.message || 'No se pudo analizar la partida.'))
      .finally(() => setCargando(false));
  }

  function elegirJugada(jugada) {
    setNumeroSeleccionada(jugada.numero);
    alElegirJugada?.(jugada.fen_antes);
  }

  return (
    <section className="flex flex-col gap-3 bg-surface-container/70 p-3 rounded-xl border border-outline-variant/30 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-neon-cyan text-[18px]">neurology</span>
          <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">
            Análisis de la red en esta partida
          </h2>
        </div>
        {datos && (
          <button
            type="button"
            onClick={analizar}
            disabled={cargando}
            className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-micro text-[11px] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Volver a analizar
          </button>
        )}
      </div>

      <p className="font-mono-micro text-[10px] text-outline">
        La red decide sola: acá se compara su elección con la jugada real. Stockfish no interviene.
      </p>

      {!datos && (
        <button
          type="button"
          onClick={analizar}
          disabled={cargando}
          className="self-start flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neon-cyan text-on-primary font-headline-sm text-[12px] font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[16px]">{cargando ? 'sync' : 'neurology'}</span>
          {cargando ? 'Analizando…' : 'Analizar partida con la red'}
        </button>
      )}

      {error && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {error}
        </p>
      )}

      {datos && datos.jugadas.length === 0 && (
        <p className="font-body-sm text-[12px] text-on-surface-variant">Todavía no hay jugadas para analizar.</p>
      )}

      {datos && datos.jugadas.length > 0 && (
        <>
          <Resumen resumen={datos.resumen} terminada={terminada} />

          <p className="font-mono-micro text-[10px] text-outline">
            Tocá una jugada para ver lo que procesó la red en esa posición.
          </p>

          <ol className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1" aria-label="Jugadas analizadas">
            {datos.jugadas.map((jugada) => {
              const seleccionada = numeroSeleccionada === jugada.numero;
              return (
                <li key={jugada.numero}>
                  <button
                    type="button"
                    onClick={() => elegirJugada(jugada)}
                    aria-pressed={seleccionada}
                    className={`w-full grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      seleccionada
                        ? 'bg-neon-cyan/15 border border-neon-cyan/50'
                        : 'bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="font-mono-micro text-[11px] text-outline">
                      {jugada.numero}.{jugada.color === 'negras' ? '..' : ''}
                    </span>
                    <span className="font-mono-metric text-[12px] text-on-surface truncate">
                      {jugada.jugada}{' '}
                      <span className="text-outline">
                        {jugada.quien === 'jugador' ? '· vos' : `· ${NOMBRE_CONTRAPARTE[jugada.quien] ?? jugada.quien}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono-micro text-[10px] text-outline truncate max-w-[9rem]">
                        red: {jugada.red_elige ?? '—'} ({probabilidadLegible(jugada.probabilidad_red)})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono-micro text-[10px] font-semibold ${
                          jugada.coincide ? 'bg-neon-lime/15 text-neon-lime' : 'bg-tertiary-container/15 text-tertiary-container'
                        }`}
                      >
                        {jugada.coincide ? 'Coincide' : 'Distinta'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
