import { useState } from 'react';
import PestanaAjustes from './PestanaAjustes';
import PestanaAlumnos from './PestanaAlumnos';
import PestanaAvisosTareas from './PestanaAvisosTareas';
import PestanaSeguimiento from './PestanaSeguimiento';
import PestanaTorneo from './PestanaTorneo';

const PESTANAS = [
  { id: 'alumnos', texto: 'Alumnos y familias', icono: 'groups' },
  { id: 'seguimiento', texto: 'Seguimiento', icono: 'monitoring' },
  { id: 'avisos', texto: 'Avisos y tareas', icono: 'campaign' },
  { id: 'torneo', texto: 'Torneo', icono: 'emoji_events' },
  { id: 'ajustes', texto: 'Ajustes de clase', icono: 'tune' },
];

/**
 * El «aula virtual» de un curso: lo que el docente maneja a distancia, sin necesidad de estar con sus alumnos — cuentas y contacto de las familias, seguimiento de quién
 * necesita ayuda, avisos y tareas, torneo relámpago, y los ajustes de la clase (modo clase y autorización de las familias).
 */
export default function PanelAulaCurso({ curso, alCambiarCurso, alMirarPartida = null }) {
  const [activa, setActiva] = useState('alumnos');
  const idPanel = `aula-panel-${curso.id}`;

  function moverFoco(evento, indice) {
    const delta = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    evento.preventDefault();
    const siguiente = PESTANAS[(indice + delta + PESTANAS.length) % PESTANAS.length];
    setActiva(siguiente.id);
    document.getElementById(`aula-pestana-${curso.id}-${siguiente.id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-space-sm pt-space-xs border-t border-outline-variant/20 min-w-0">
      <div role="tablist" aria-label={`Aula de ${curso.nombre}`} className="flex gap-space-2xs overflow-x-auto pb-space-2xs">
        {PESTANAS.map((pestana, indice) => (
          <button
            key={pestana.id}
            id={`aula-pestana-${curso.id}-${pestana.id}`}
            type="button"
            role="tab"
            aria-selected={activa === pestana.id}
            aria-controls={idPanel}
            tabIndex={activa === pestana.id ? 0 : -1}
            onClick={() => setActiva(pestana.id)}
            onKeyDown={(evento) => moverFoco(evento, indice)}
            className={`shrink-0 flex items-center gap-space-2xs px-space-sm min-h-10 rounded-lg font-body-sm text-body-sm whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              activa === pestana.id ? 'bg-primary text-on-primary font-medium' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{pestana.icono}</span>
            {pestana.texto}
          </button>
        ))}
      </div>
      <div id={idPanel} role="tabpanel" aria-labelledby={`aula-pestana-${curso.id}-${activa}`} className="min-w-0">
        {activa === 'alumnos' && <PestanaAlumnos curso={curso} />}
        {activa === 'seguimiento' && <PestanaSeguimiento curso={curso} />}
        {activa === 'avisos' && <PestanaAvisosTareas curso={curso} />}
        {activa === 'torneo' && <PestanaTorneo curso={curso} alMirarPartida={alMirarPartida} />}
        {activa === 'ajustes' && <PestanaAjustes curso={curso} alCambiar={alCambiarCurso} />}
      </div>
    </div>
  );
}
