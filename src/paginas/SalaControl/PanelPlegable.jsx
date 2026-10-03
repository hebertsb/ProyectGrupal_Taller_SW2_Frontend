/**
 * Sección plegable reutilizable para paneles secundarios de la Sala de Control.
 * Usa <details>/<summary> nativo a propósito: foco y teclado (Enter/Espacio)
 * funcionan sin JS propio, y el estado abierto/cerrado no vive en React — así
 * que envolver un panel con esto nunca desmonta un nodo del que dependa un ref
 * de otra parte de la pantalla (ninguno de los paneles que se pliegan aquí
 * tiene refs de GSAP ni estado local que se pierda al colapsar).
 *
 * El indicador de estado es la rotación de la flecha (`panel-plegable-chevron`,
 * ver SalaControl.css) — nunca depende solo de un cambio de color.
 */
export default function PanelPlegable({
  titulo,
  icono,
  extra = null,
  defaultAbierto = false,
  className = '',
  children,
}) {
  return (
    <details
      className={`panel-plegable bg-surface-container-low rounded-xl shadow-xl border border-outline-variant/30 ${className}`}
      open={defaultAbierto || undefined}
    >
      <summary className="flex items-center justify-between gap-2 px-space-md py-space-sm cursor-pointer select-none rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1 font-semibold">
          {icono && (
            <span className="material-symbols-outlined text-[13px] text-primary" aria-hidden="true">
              {icono}
            </span>
          )}
          {titulo}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {extra}
          <span
            className="panel-plegable-chevron material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 motion-reduce:transition-none"
            aria-hidden="true"
          >
            expand_more
          </span>
        </span>
      </summary>
      <div className="px-space-md pb-space-md pt-space-2xs flex flex-col gap-space-sm">{children}</div>
    </details>
  );
}
