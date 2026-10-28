/** Cambio rápido entre día y noche. La opción automática está disponible en Mi Perfil. */
export default function BotonTema({ apariencia }) {
  const siguiente = apariencia.efectivo === 'dia' ? 'noche' : 'dia';
  return (
    <>
      <button
        type="button"
        onClick={() => apariencia.cambiarModo(siguiente)}
        disabled={apariencia.guardando}
        aria-label={`Activar modo ${siguiente === 'dia' ? 'día' : 'noche'}`}
        title={`Activar modo ${siguiente === 'dia' ? 'día' : 'noche'}`}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-container text-on-surface hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 transition-colors motion-reduce:transition-none"
      >
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{siguiente === 'dia' ? 'light_mode' : 'dark_mode'}</span>
      </button>
      {apariencia.error && (
        <div role="alert" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-xl border border-outline-variant bg-surface-container-high p-space-sm text-on-surface shadow-lg font-body-sm text-body-sm flex flex-wrap items-center gap-space-xs">
          <span className="flex-1 min-w-0">{apariencia.error}</span>
          <button type="button" className="min-h-11 px-space-sm text-primary underline" onClick={() => apariencia.cambiarModo(apariencia.modo)} disabled={apariencia.guardando}>Reintentar</button>
        </div>
      )}
    </>
  );
}
