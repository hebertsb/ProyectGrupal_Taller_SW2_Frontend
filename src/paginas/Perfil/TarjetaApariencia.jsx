import { PALETAS_APARIENCIA } from '../../apariencia';

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
            className={`min-h-20 min-w-0 flex items-center min-[400px]:flex-col justify-start min-[400px]:justify-center gap-space-xs p-space-sm rounded-xl border transition-colors motion-reduce:transition-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${apariencia.modo === valor ? 'bg-primary/10 border-primary text-on-surface' : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined text-[26px] shrink-0" aria-hidden="true">{icono}</span>
            <span className="flex flex-col min-w-0 min-[400px]:items-center">
              <span className="font-body-sm text-body-sm font-medium">{etiqueta}</span>
              <span className="text-xs text-on-surface-variant">{descripcion}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-space-xs">
        <h3 id="titulo-paletas" className="m-0 font-body-sm text-body-sm text-on-surface font-semibold">Paleta de colores</h3>
        <p className="m-0 text-xs text-on-surface-variant">Combiná tus colores favoritos con el modo día, noche o automático.</p>
        <div role="group" aria-labelledby="titulo-paletas" className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-space-xs">
          {PALETAS_APARIENCIA.map((paleta) => (
            <button
              key={paleta.id}
              type="button"
              aria-label={`Paleta ${paleta.nombre}`}
              aria-pressed={apariencia.paleta === paleta.id}
              disabled={apariencia.guardando}
              onClick={() => apariencia.cambiarPaleta(paleta.id)}
              className={`min-h-24 min-w-0 flex flex-col items-start gap-2 p-space-sm rounded-xl border transition-colors motion-reduce:transition-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${apariencia.paleta === paleta.id ? 'bg-surface-container-high border-primary text-on-surface' : 'bg-surface-container-lowest border-outline-variant/50 text-on-surface hover:bg-surface-container'}`}
            >
              <span className="flex w-full items-center justify-between gap-2" aria-hidden="true">
                <span className="flex gap-1.5">
                  {paleta.muestras.map((color) => <span key={color} className="h-5 w-5 rounded-full ring-1 ring-on-surface/15" style={{ backgroundColor: color }} />)}
                </span>
                {apariencia.paleta === paleta.id && <span className="material-symbols-outlined text-[20px] text-primary">check_circle</span>}
              </span>
              <span className="font-body-sm text-body-sm font-medium">{paleta.nombre}</span>
              <span className="text-xs text-on-surface-variant">{paleta.descripcion}</span>
            </button>
          ))}
        </div>
      </div>
      <p role="status" aria-live="polite" className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        {apariencia.guardando ? 'Guardando tu elección…' : `Paleta ${PALETAS_APARIENCIA.find((p) => p.id === apariencia.paleta)?.nombre || 'Clásico'} · ${apariencia.modo === 'automatico' ? `modo ${apariencia.efectivo === 'dia' ? 'día' : 'noche'}, según tu dispositivo` : `modo ${apariencia.modo === 'dia' ? 'día' : 'noche'}`}.`}
      </p>
    </section>
  );
}
