const OPCIONES = [
  ['dia', 'Día', 'light_mode', 'Fondos claros'],
  ['noche', 'Noche', 'dark_mode', 'Fondos oscuros'],
  ['automatico', 'Automático', 'brightness_auto', 'Sigue tu dispositivo'],
];

/** La preferencia se guarda al elegirla y acompaña a esta cuenta en otros dispositivos. */
export default function TarjetaApariencia({ apariencia }) {
  return (
    <section aria-labelledby="titulo-apariencia" className="w-full min-w-0 bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">contrast</span>
        <h2 id="titulo-apariencia" className="m-0 font-headline-sm text-headline-sm text-on-surface">Apariencia</h2>
      </div>
      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Elegí cómo querés ver ChessIA. Tu elección se guarda en tu cuenta.</p>
      <div role="group" aria-label="Modo de apariencia" className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-space-xs">
        {OPCIONES.map(([valor, etiqueta, icono, descripcion]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={apariencia.modo === valor}
            disabled={apariencia.guardando}
            onClick={() => apariencia.cambiarModo(valor)}
            className={`min-h-20 min-w-0 flex items-center min-[400px]:flex-col justify-start min-[400px]:justify-center gap-space-xs p-space-sm rounded-xl border transition-colors motion-reduce:transition-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${apariencia.modo === valor ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined text-[26px] shrink-0" aria-hidden="true">{icono}</span>
            <span className="flex flex-col min-w-0 min-[400px]:items-center">
              <span className="font-body-sm text-body-sm font-medium">{etiqueta}</span>
              <span className="text-xs text-on-surface-variant">{descripcion}</span>
            </span>
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        {apariencia.guardando ? 'Guardando tu elección…' : apariencia.modo === 'automatico' ? `Ahora se muestra el modo ${apariencia.efectivo === 'dia' ? 'día' : 'noche'}, según tu dispositivo.` : `Modo ${apariencia.modo === 'dia' ? 'día' : 'noche'} seleccionado.`}
      </p>
    </section>
  );
}
