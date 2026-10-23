import { tonoVigenteCurso } from '../tonoTuring';

const BASE_INSIGNIA =
  'inline-flex max-w-full items-center gap-1 px-space-xs py-space-2xs rounded-full font-mono-micro text-mono-micro font-medium self-start';
const ESTILO_PROPIO = 'bg-primary-container text-primary';
const ESTILO_HEREDADO = 'bg-surface-container-high text-on-surface-variant';

/**
 * Tono de Turing que se usa en un curso. El texto siempre dice cuál es y de dónde sale ("Tono: Infantil", "Tono:
 * Adultos (de tu perfil)", "Tono: Estándar (por defecto)"): el color solo acompaña. `duenoAjeno` es el nombre del
 * facilitador dueño cuando el curso NO es de quien mira (el facilitador principal viendo los cursos de todos): ahí el
 * tono heredado es el del perfil de ese facilitador, no el "tuyo".
 */
export default function InsigniaTonoCurso({ curso, duenoAjeno = null }) {
  const tono = tonoVigenteCurso(curso);
  const origen =
    tono.origen === 'perfil' ? (duenoAjeno ? ` (del perfil de ${duenoAjeno})` : ' (de tu perfil)') : tono.origen === 'defecto' ? ' (por defecto)' : '';
  return (
    <span
      className={`${BASE_INSIGNIA} ${tono.origen === 'curso' ? ESTILO_PROPIO : ESTILO_HEREDADO}`}
      title="Cómo les habla Turing a los alumnos de este curso."
    >
      <span className="material-symbols-outlined text-[14px] shrink-0" aria-hidden="true">
        record_voice_over
      </span>
      <span className="min-w-0 break-words">
        Tono: {tono.nombre}
        {origen}
      </span>
    </span>
  );
}
