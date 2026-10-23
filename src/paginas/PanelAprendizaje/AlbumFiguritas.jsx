import { useMemo, useState } from 'react';
import './AlbumFiguritas.css';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import DetalleMedalla from './DetalleMedalla';
import useMedallas from '../../useMedallas';
import {
  esMedallaNueva,
  fechaCorta,
  normalizarNivel,
  ordenarMedallas,
  progresoDeMedalla,
  resumenDeMedallas,
} from '../../medallas';

const BOTON_REINTENTAR =
  'self-start flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

/** Una figurita del álbum: toda la tarjeta es un botón que abre el detalle. Las bloqueadas muestran la condición abreviada. */
function FiguritaDelAlbum({ medalla, alAbrir }) {
  const ganada = medalla.ganada === true;
  const nueva = esMedallaNueva(medalla);
  const fecha = fechaCorta(medalla.ganada_en);
  const { actual, meta } = progresoDeMedalla(medalla);
  const nivel = normalizarNivel(medalla.nivel);
  const descripcionAccesible = [
    medalla.nombre,
    `nivel ${nivel}`,
    ganada ? 'ganada' : 'bloqueada',
    !ganada && meta > 1 ? `${actual} de ${meta}` : null,
    nueva ? 'nueva' : null,
    'tocá para ver el detalle',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => alAbrir(medalla.codigo)}
        aria-label={descripcionAccesible}
        title={medalla.descripcion}
        className={`relative w-full h-full min-h-10 flex flex-col items-center gap-space-xs p-space-sm rounded-xl border text-center transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          nueva
            ? 'bg-primary/10 border-primary ring-1 ring-primary/40'
            : ganada
              ? 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container hover:border-primary/50'
              : 'bg-surface-container-lowest/60 border-outline-variant/20 hover:bg-surface-container'
        }`}
      >
        {nueva && (
          <span className="album-nueva absolute -top-2 -right-1 inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-primary text-on-primary font-mono-micro text-mono-micro uppercase font-semibold">
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              auto_awesome
            </span>
            Nueva
          </span>
        )}
        <MedallaFigurita medalla={medalla} tamano="md" decorativa />
        <span
          className={`font-body-sm text-body-sm font-medium break-words min-w-0 ${ganada ? 'text-on-surface' : 'text-on-surface-variant'}`}
        >
          {medalla.nombre}
        </span>
        {ganada ? (
          <span className="flex items-center justify-center gap-1 font-mono-micro text-mono-micro text-primary">
            <span className="material-symbols-outlined text-[14px] shrink-0" aria-hidden="true">
              check_circle
            </span>
            <span className="min-w-0 break-words">{fecha ? `Ganada el ${fecha}` : 'Ganada'}</span>
          </span>
        ) : (
          <span className="font-body-sm text-[12px] leading-snug text-on-surface-variant line-clamp-2 break-words min-w-0">
            {medalla.descripcion}
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * "Mi álbum de figuritas": las medallas del jugador dibujadas como figuritas coleccionables. Todo sale de lo que manda
 * el backend (`GET /usuario/medallas`), así que las medallas que se agreguen más adelante aparecen solas. Se monta recién
 * cuando el jugador abre "Tus logros", y se refresca cuando el notificador avisa de una medalla nueva. Las nuevas y las
 * ganadas van primero; después las bloqueadas, de la más cercana a la más lejana. Tocar una figurita abre su detalle.
 */
export default function AlbumFiguritas() {
  const { datos, cargando, error, recargar } = useMedallas();
  const [codigoAbierto, setCodigoAbierto] = useState(null);

  const { total, ganadas } = resumenDeMedallas(datos);
  const ordenadas = useMemo(() => ordenarMedallas(datos?.medallas, esMedallaNueva), [datos]);
  const medallaAbierta = codigoAbierto ? ordenadas.find((medalla) => medalla.codigo === codigoAbierto) ?? null : null;
  const porcentaje = total > 0 ? Math.round((ganadas / total) * 100) : 0;

  return (
    <section aria-labelledby="titulo-album-figuritas" className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
        <h3
          id="titulo-album-figuritas"
          className="m-0 flex items-center gap-space-xs font-headline-sm text-headline-sm text-on-surface"
        >
          <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">
            collections_bookmark
          </span>
          Mi álbum de figuritas
        </h3>
        {datos && total > 0 && (
          <span className="font-mono-metric text-mono-metric font-medium text-primary">
            {ganadas} de {total} figuritas
          </span>
        )}
      </div>

      {datos && total > 0 && (
        <div
          role="progressbar"
          aria-label="Figuritas conseguidas"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ganadas}
          aria-valuetext={`${ganadas} de ${total} figuritas`}
          className="h-2 rounded-full bg-surface-container-high overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      )}

      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        {datos && total > 0 && ganadas === 0
          ? 'Todavía no ganaste figuritas. ¡Jugá una partida y conseguí la primera! Tocá cualquiera para ver cómo se gana.'
          : 'Jugá, aprendé y juntalas todas. Tocá una figurita para ver cómo se gana.'}
      </p>

      {cargando && !datos && (
        <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Abriendo tu álbum…</span>
        </div>
      )}

      {error && !datos && (
        <div className="flex flex-col gap-space-xs">
          <div
            role="alert"
            className="flex items-start gap-space-xs px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
              error
            </span>
            <span className="min-w-0 break-words">{error.message || 'No se pudo cargar tu álbum.'}</span>
          </div>
          <button type="button" onClick={recargar} disabled={cargando} className={BOTON_REINTENTAR}>
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {datos && total === 0 && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay figuritas para coleccionar. Volvé pronto.
        </p>
      )}

      {/* Las columnas dependen del ancho del propio bloque (no de la pantalla): con la barra lateral abierta el contenido es más angosto. */}
      {ordenadas.length > 0 && (
        <div className="@container">
          <ul className="m-0 p-0 list-none grid grid-cols-2 @[30rem]:grid-cols-3 @[44rem]:grid-cols-4 @[60rem]:grid-cols-5 gap-space-xs pt-space-xs">
            {ordenadas.map((medalla) => (
              <FiguritaDelAlbum key={medalla.codigo} medalla={medalla} alAbrir={setCodigoAbierto} />
            ))}
          </ul>
        </div>
      )}

      {medallaAbierta && <DetalleMedalla medalla={medallaAbierta} alCerrar={() => setCodigoAbierto(null)} />}
    </section>
  );
}
