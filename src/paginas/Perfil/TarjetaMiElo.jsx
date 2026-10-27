import { useEffect, useState } from 'react';
import { obtenerMiElo } from '../../api/backend';
import { textoDeCambio } from '../../elo';

function fecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/**
 * «Mi Elo» del perfil del jugador: el número (empieza en 1000), si todavía es provisional y sus últimas partidas contra otras personas con lo que ganó o perdió en cada una.
 * Es lo que muestra si va mejorando: el nivel mide cómo juega contra Turing; el Elo, cómo le va contra otros jugadores.
 */
export default function TarjetaMiElo() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerMiElo()
      .then((d) => !cancelado && setDatos(d))
      .catch((e) => !cancelado && setError(e.message || 'No se pudo cargar tu Elo.'));
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">military_tech</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi Elo</h2>
      </div>
      {error && <p role="alert" className="m-0 font-body-sm text-body-sm text-error break-words">{error}</p>}
      {datos && (
        <>
          <div className="flex flex-wrap items-baseline gap-space-sm">
            <span className="font-mono-metric text-[36px] leading-none text-on-surface">{datos.elo}{datos.provisional ? '?' : ''}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {datos.partidas === 0
                ? 'Todavía no jugaste contra otras personas: empezás en 1000.'
                : `${datos.partidas} ${datos.partidas === 1 ? 'partida' : 'partidas'}${datos.provisional ? ' · provisional: se estabiliza con más partidas' : ''}`}
            </span>
          </div>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant leading-relaxed">
            El Elo sube cuando ganás y baja cuando perdés, y se mueve más si le ganás a alguien con más Elo. Cuenta lo que jugás contra otras personas (retos, rival de tu nivel, torneos); lo que jugás
            contra Turing mide tu nivel, no el Elo.
          </p>
          {datos.historial.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs" aria-label="Últimas partidas">
              {datos.historial.slice(0, 8).map((m, i) => (
                <li key={`${m.fecha}-${i}`} className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs px-space-sm py-space-2xs rounded-lg bg-surface-container">
                  <span className="font-body-sm text-body-sm text-on-surface min-w-0 break-words">
                    {m.resultado} contra {m.rival} <span className="text-on-surface-variant">(Elo {m.rival_elo})</span>
                  </span>
                  <span className="flex items-center gap-space-xs shrink-0 font-mono-micro text-mono-micro">
                    <span className="text-on-surface-variant">{fecha(m.fecha)}</span>
                    <span className={m.cambio > 0 ? 'text-primary' : m.cambio < 0 ? 'text-error' : 'text-on-surface-variant'}>{textoDeCambio(m.cambio)}</span>
                    <span className="text-on-surface">{m.despues}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
