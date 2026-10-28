import { formatearReloj } from './useRelojAjedrez';

/** Con menos de este tiempo el reloj se pone en rojo. */
const TIEMPO_CRITICO_MS = 30_000;

/**
 * Un lado del reloj de ajedrez: quién es, cuánto tiempo le queda y si es su turno. El que tiene el
 * turno se resalta y, si le queda poco, se pone en rojo. No avisa cada segundo a lectores de pantalla:
 * el texto de `aria-label` describe el estado y solo cambia al cambiar el turno o agotarse.
 */
export default function RelojAjedrez({ nombre, icono, ms, activo, agotado = false }) {
  const critico = ms <= TIEMPO_CRITICO_MS;
  return (
    <div
      className={`w-full max-w-[660px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl border backdrop-blur-md transition-colors ${
        agotado
          ? 'bg-error/20 border-error/60'
          : activo
            ? 'bg-primary/10 border-primary/50 shadow-[0_0_14px_color-mix(in_srgb,var(--color-primary-container)_18%,transparent)]'
            : 'bg-on-surface/[0.04] border-outline-variant/10'
      }`}
      aria-label={`${nombre}: ${agotado ? 'sin tiempo' : `${formatearReloj(ms)} restantes${activo ? ', es su turno' : ''}`}`}
    >
      <span className="flex items-center gap-2 min-w-0 font-body-sm text-body-sm text-on-surface">
        <span className="material-symbols-outlined text-[20px] shrink-0 text-on-surface-variant" aria-hidden="true">{icono}</span>
        <span className="truncate">{nombre}</span>
        {agotado && <span className="font-mono-micro text-[10px] uppercase tracking-wider text-error shrink-0">sin tiempo</span>}
      </span>
      <span
        aria-hidden="true"
        className={`font-mono-metric text-[22px] leading-none tabular-nums px-2.5 py-1 rounded-lg ${
          agotado || (activo && critico)
            ? 'text-error bg-error/15'
            : activo
              ? 'text-primary bg-primary/10'
              : 'text-on-surface-variant bg-on-surface/[0.04]'
        } ${activo && critico && !agotado ? 'motion-safe:animate-pulse' : ''}`}
      >
        {formatearReloj(ms)}
      </span>
    </div>
  );
}
