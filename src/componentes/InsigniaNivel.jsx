/**
 * Insignias chicas para mostrar el nivel de un jugador (ranking del Panel de Aprendizaje y reporte del curso). El
 * texto siempre dice el rango o "Provisional": el color solo acompaña, nunca es lo único que transmite el estado.
 */

const BASE_INSIGNIA =
  'inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full font-mono-micro text-mono-micro tracking-wide uppercase font-medium whitespace-nowrap';

const ESTILO_RANGO = {
  Principiante: 'bg-secondary-container/25 text-secondary',
  Intermedio: 'bg-primary/10 text-primary',
  Avanzado: 'bg-tertiary-container/25 text-tertiary-fixed-dim',
};
const ESTILO_RANGO_DESCONOCIDO = 'bg-surface-container-high text-on-surface-variant';

/** Rango del jugador (Principiante, Intermedio, Avanzado). No dibuja nada si no hay rango. */
export function InsigniaRango({ rango }) {
  if (!rango) return null;
  return <span className={`${BASE_INSIGNIA} ${ESTILO_RANGO[rango] ?? ESTILO_RANGO_DESCONOCIDO}`}>{rango}</span>;
}

/** Marca de un nivel que todavía no está confirmado (pocas partidas calibradas): puede cambiar. */
export function InsigniaProvisional() {
  return (
    <span
      className={`${BASE_INSIGNIA} bg-tertiary-container/20 border border-tertiary-container/50 text-tertiary`}
      title="El nivel todavía puede cambiar: faltan partidas para confirmarlo."
    >
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
        hourglass_top
      </span>
      Provisional
    </span>
  );
}
