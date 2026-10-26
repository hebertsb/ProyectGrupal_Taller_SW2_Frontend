/**
 * Franja del modo evaluación: quien prueba el sistema como director tiene además un jugador de prueba. Explica en qué vista está y tiene el
 * botón para pasar a la otra (en el celular el menú lateral está cerrado, así que el botón también está acá).
 */
export default function AvisoEvaluacion({ esFacilitador, ocupado, error, alAlternar }) {
  return (
    <div role="region" aria-label="Modo evaluación" className="w-full px-space-lg py-space-sm bg-tertiary/10 border-b border-tertiary/30 flex flex-wrap items-center justify-between gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-center gap-space-xs min-w-0">
        <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0" aria-hidden="true">science</span>
        <span>
          {esFacilitador ? (
            <><strong>Estás evaluando ChessIA</strong> con una institución de prueba. Mirá cómo lo ven tus alumnos con «Ver como jugador».</>
          ) : (
            <><strong>Esta es la vista de jugador de prueba:</strong> así lo ven tus alumnos. Volvé a tu panel cuando quieras.</>
          )}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-space-xs">
        {error && <span role="alert" className="font-body-sm text-body-sm text-error">{error}</span>}
        <button
          type="button"
          onClick={alAlternar}
          disabled={ocupado}
          className="flex items-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg bg-tertiary text-on-tertiary font-body-sm text-body-sm font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
          {ocupado ? 'Cambiando…' : esFacilitador ? 'Ver como jugador' : 'Volver a mi panel'}
        </button>
      </div>
    </div>
  );
}
