import { useRef } from 'react';
import { createPortal } from 'react-dom';
import './AlbumFiguritas.css';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import {
  esMedallaNueva,
  etiquetaNivel,
  etiquetaPieza,
  fechaLarga,
  normalizarNivel,
  progresoDeMedalla,
} from '../../medallas';
import useModalAccesible from '../../useModalAccesible';

const CHIP =
  'inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface font-mono-micro text-mono-micro uppercase tracking-wide';

/**
 * Detalle de una figurita del álbum: hoja inferior en celular y diálogo centrado desde 640 px. Muestra la figurita
 * grande, el nombre, el nivel y la pieza, y si está ganada cuándo se ganó o, si no, qué falta (con el avance si se
 * mide con un contador). Se cierra con Escape, con la X o tocando fuera; el foco queda adentro mientras está abierto.
 */
export default function DetalleMedalla({ medalla, alCerrar }) {
  const dialogoRef = useRef(null);
  const botonCerrarRef = useRef(null);
  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: botonCerrarRef });

  const nivel = normalizarNivel(medalla.nivel);
  const ganada = medalla.ganada === true;
  const nueva = esMedallaNueva(medalla);
  const { actual, meta, proporcion } = progresoDeMedalla(medalla);
  const fecha = fechaLarga(medalla.ganada_en);

  // En un portal sobre <body>: así ningún contenedor del panel (con transform, filtros u overflow) lo recorta o lo desplaza.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm sm:p-space-md"
      onMouseDown={(evento) => {
        // Tocar fuera de la hoja (no adentro) = cerrar.
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-medalla"
        aria-describedby="descripcion-detalle-medalla"
        tabIndex={-1}
        data-nivel-medalla={nivel}
        className="album-hoja relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-surface-container-low border border-outline-variant/30 shadow-2xl px-space-lg pb-space-lg pt-space-lg flex flex-col items-center gap-space-md text-center outline-none"
      >
        <span aria-hidden="true" className="sm:hidden w-10 h-1 rounded-full bg-outline-variant/60 -mt-space-xs" />
        <button
          ref={botonCerrarRef}
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar el detalle de la figurita"
          className="absolute top-space-xs right-space-xs w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            close
          </span>
        </button>

        <div className="pt-space-xs">
          <MedallaFigurita medalla={medalla} tamano="lg" decorativa mostrarProgreso={false} />
        </div>

        <div className="flex flex-col items-center gap-space-xs min-w-0">
          <h2 id="titulo-detalle-medalla" className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">
            {medalla.nombre}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-space-2xs">
            <span className={CHIP}>
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                military_tech
              </span>
              Nivel {etiquetaNivel(nivel)}
            </span>
            <span className={CHIP}>
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                extension
              </span>
              {etiquetaPieza(medalla.pieza)}
            </span>
            {nueva && (
              <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-primary text-on-primary font-mono-micro text-mono-micro uppercase font-semibold">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  auto_awesome
                </span>
                Nueva
              </span>
            )}
          </div>
        </div>

        {ganada ? (
          <>
            <p id="descripcion-detalle-medalla" className="m-0 font-body-sm text-body-sm text-on-surface break-words">
              {medalla.descripcion}
            </p>
            <p className="m-0 w-full flex items-center justify-center gap-space-xs px-space-sm py-space-xs rounded-lg bg-primary/10 border border-primary/30 text-primary font-body-sm text-body-sm font-medium">
              <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                check_circle
              </span>
              <span className="min-w-0 break-words">{fecha ? `Ganada el ${fecha}` : 'Ganada'}</span>
            </p>
          </>
        ) : (
          <div className="w-full flex flex-col gap-space-xs px-space-sm py-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-left">
            <p id="descripcion-detalle-medalla" className="m-0 font-body-sm text-body-sm text-on-surface break-words">
              <span className="inline-flex items-center gap-1 font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  lock
                </span>
                Te falta:
              </span>{' '}
              {medalla.descripcion}
              {meta > 1 && <span className="font-mono-label text-mono-label text-primary"> ({actual} / {meta})</span>}
            </p>
            {meta > 1 && (
              <div
                role="progressbar"
                aria-label="Avance de la medalla"
                aria-valuemin={0}
                aria-valuemax={meta}
                aria-valuenow={actual}
                className="h-2 rounded-full bg-surface-container-high overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-primary-fixed-dim transition-[width] motion-reduce:transition-none"
                  style={{ width: `${Math.round(proporcion * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
