import { useMemo } from 'react';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import useMedallas from '../../useMedallas';
import { mejoresGanadas, resumenDeMedallas } from '../../medallas';

/** Cuántas figuritas ganadas se muestran en el perfil (el resto se ve en el álbum). */
const MAXIMO_EN_PERFIL = 6;

/**
 * "Mis medallas" en el perfil del jugador: cuántas figuritas lleva ("5 de 13"), una fila con las ganadas más valiosas
 * (mayor nivel y, a igual nivel, la más reciente) y un botón que lleva al álbum del Panel de Aprendizaje. Si todavía no
 * ganó ninguna, un texto que lo anima a jugar. Si el pedido falla, avisa sin romper el resto del perfil.
 */
export default function TarjetaMisMedallas({ alVerAlbum = null }) {
  const { datos, cargando, error, recargar } = useMedallas();
  const { total, ganadas } = resumenDeMedallas(datos);
  const destacadas = useMemo(() => mejoresGanadas(datos?.medallas, MAXIMO_EN_PERFIL), [datos]);

  return (
    <section
      aria-labelledby="titulo-mis-medallas"
      className="max-w-xl w-full bg-surface-container-low p-space-lg rounded-xl shadow-md flex flex-col gap-space-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            emoji_events
          </span>
          <h2 id="titulo-mis-medallas" className="m-0 font-headline-sm text-headline-sm text-on-surface">
            Mis medallas
          </h2>
        </div>
        {datos && total > 0 && (
          <span className="font-mono-metric text-mono-metric font-medium text-primary">
            {ganadas} de {total}
          </span>
        )}
      </div>

      {cargando && !datos && (
        <div className="flex items-center gap-space-xs text-on-surface-variant" role="status">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Buscando tus medallas…</span>
        </div>
      )}

      {error && !datos && (
        <div className="flex flex-col items-start gap-space-xs">
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
            No pudimos traer tus medallas ahora. Probá de nuevo en un rato.
          </p>
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            className="flex items-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {datos && destacadas.length === 0 && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Todavía no ganaste figuritas. ¡Jugá tu primera partida!
        </p>
      )}

      {destacadas.length > 0 && (
        <ul className="m-0 p-0 list-none grid grid-cols-3 sm:grid-cols-6 gap-space-xs justify-items-center">
          {destacadas.map((medalla) => (
            <li key={medalla.codigo} className="flex justify-center py-space-2xs">
              <MedallaFigurita medalla={medalla} tamano="sm" />
            </li>
          ))}
        </ul>
      )}

      {alVerAlbum && datos && (
        <button
          type="button"
          onClick={alVerAlbum}
          className="self-start flex items-center gap-space-xs px-space-md py-space-sm min-h-10 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:bg-primary-fixed transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            collections_bookmark
          </span>
          Ver mi álbum
        </button>
      )}
    </section>
  );
}
