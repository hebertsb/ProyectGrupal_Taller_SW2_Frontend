import { MAXIMO_ANTICIPADAS } from '../anticipadas';

/** Las jugadas anticipadas que están armadas («e2→e4 · g1→f3») con un botón para cancelarlas. No muestra nada si no hay ninguna. */
export default function ResumenAnticipadas({ cola, alCancelar }) {
  if (!cola || cola.length === 0) return null;
  return (
    <div role="status" className="w-full flex flex-wrap items-center justify-between gap-space-xs px-space-sm py-space-xs rounded-xl bg-tertiary/10 border border-tertiary/30">
      <p className="m-0 font-body-sm text-body-sm text-on-surface min-w-0 break-words">
        <strong>Jugadas anticipadas ({cola.length}/{MAXIMO_ANTICIPADAS}):</strong> {cola.map((m) => `${m.origen}→${m.destino}`).join(' · ')}
        <span className="block font-mono-micro text-mono-micro text-on-surface-variant">Se juegan solas cuando te toca. Clic derecho o «Cancelar» para borrarlas.</span>
      </p>
      <button
        type="button"
        onClick={alCancelar}
        className="px-space-md py-space-xs min-h-11 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        Cancelar
      </button>
    </div>
  );
}
