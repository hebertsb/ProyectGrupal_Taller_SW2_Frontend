import MedallaFigurita from '../../componentes/MedallaFigurita';
import { CLASE_AYUDA } from './ComunesMedallas';
import { rutaImagenIdea } from './medallasPropias';
import { useImagenCargable } from './useImagenCargable';

/** La figurita `xs` de una idea: con su ilustración sugerida si ya existe en `public/ideas-medallas/`, si no con la silueta. */
function FiguritaIdea({ idea }) {
  const imagen = useImagenCargable(rutaImagenIdea(idea.nombre));
  return (
    <MedallaFigurita
      medalla={{ codigo: idea.nombre, nombre: idea.nombre, nivel: idea.nivel, pieza: idea.pieza, imagen_url: imagen }}
      tamano="xs"
      vistaPrevia
      decorativa
    />
  );
}

/**
 * "¿Sin ideas? Empezá con una de estas.": las `plantillas` que manda el backend como tarjetas chicas (la figurita `xs` de
 * su nivel con la ilustración sugerida de la idea, el nombre y la descripción). Tocar una llena el formulario con sus
 * valores y deja elegida su ilustración sugerida, sin guardar nada. Se apagan
 * mientras se edita una medalla, para no pisar lo que se está cambiando. Usa el ancho del contenedor (`@container` en
 * CrearMedallas.jsx), no el de la pantalla.
 */
export default function IdeasMedallas({ ideas, alElegir, ideaElegida = null, deshabilitado = false }) {
  if (ideas.length === 0) return null;

  return (
    <section aria-labelledby="titulo-ideas-medallas" className="flex flex-col gap-space-sm min-w-0">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
          lightbulb
        </span>
        <h3 id="titulo-ideas-medallas" className="m-0 font-headline-sm text-headline-sm text-on-surface">
          ¿Sin ideas? Empezá con una de estas.
        </h3>
      </div>

      <ul className="m-0 p-0 list-none grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-space-xs">
        {ideas.map((idea) => {
          const elegida = ideaElegida === idea.nombre;
          return (
            <li key={idea.nombre} className="min-w-0">
              <button
                type="button"
                onClick={() => alElegir(idea)}
                disabled={deshabilitado}
                aria-pressed={elegida}
                className={`w-full h-full min-h-14 flex items-center gap-space-sm p-space-sm rounded-xl border text-left transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  elegida
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface-container-lowest border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <FiguritaIdea idea={idea} />
                <span className="flex flex-col gap-space-2xs min-w-0 flex-1">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">
                    {idea.nombre}
                  </span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                    {idea.descripcion}
                  </span>
                </span>
                {elegida && (
                  <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">
                    check_circle
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {deshabilitado && (
        <p className={CLASE_AYUDA}>Estás editando una medalla: cancelá la edición para usar una idea.</p>
      )}
      {!deshabilitado && ideaElegida && (
        <p role="status" className={CLASE_AYUDA}>
          Cargamos «{ideaElegida}» en el formulario, con su ilustración sugerida si tiene. Cambiá lo que quieras y tocá
          «Crear medalla»: todavía no se guardó.
        </p>
      )}
    </section>
  );
}
