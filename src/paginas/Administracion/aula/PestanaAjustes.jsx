import { useState } from 'react';
import { editarCurso } from '../../../api/backend';
import { fechaCorta } from '../../Suscripcion/comunes';

function Interruptor({ activo, ocupado, alCambiar, titulo, descripcion, idDescripcion }) {
  return (
    <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-low">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={titulo}
        aria-describedby={idDescripcion}
        onClick={alCambiar}
        disabled={ocupado}
        className="shrink-0 min-h-10 flex items-center rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${activo ? 'bg-primary-container' : 'bg-surface-bright'}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${activo ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-outline'}`} />
        </span>
      </button>
      <div className="flex flex-col gap-space-2xs min-w-0">
        <span className="font-body-sm text-body-sm font-medium text-on-surface">{titulo}</span>
        <span id={idDescripcion} className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{descripcion}</span>
      </div>
    </div>
  );
}

/**
 * Los dos interruptores del curso que el docente maneja a distancia:
 * - **Modo clase**: pausa los retos, la búsqueda de rival y las salas entre los alumnos del curso mientras explica; los alumnos siguen pudiendo jugar contra Turing.
 * - **Autorización de las familias**: declara que el colegio, la academia o el docente ya tiene el permiso de las familias para que los menores jueguen entre sí, así no
 *   hace falta pedirlo alumno por alumno.
 */
export default function PestanaAjustes({ curso, alCambiar }) {
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  async function cambiar(campo, valor) {
    setOcupado(campo);
    setError(null);
    try {
      alCambiar(curso.id, await editarCurso(curso.id, { [campo]: valor }));
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cambio.');
    } finally {
      setOcupado(null);
    }
  }

  const modoClase = curso.permite_retos === false;
  return (
    <div className="flex flex-col gap-space-sm">
      {error && <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      <Interruptor
        activo={modoClase}
        ocupado={ocupado === 'permite_retos'}
        alCambiar={() => cambiar('permite_retos', modoClase)}
        titulo="Modo clase: pausar las partidas entre alumnos"
        idDescripcion={`desc-modo-clase-${curso.id}`}
        descripcion={
          modoClase
            ? 'Activado: tus alumnos no pueden retarse, buscar rival ni crear salas hasta que lo apagues. Siguen jugando contra Turing y Stockfish.'
            : 'Apagado: tus alumnos pueden retarse entre sí. Activalo cuando vas a explicar y querés que presten atención.'
        }
      />
      <Interruptor
        activo={curso.autorizacion_familias === true}
        ocupado={ocupado === 'autorizacion_familias'}
        alCambiar={() => cambiar('autorizacion_familias', curso.autorizacion_familias !== true)}
        titulo="Tengo la autorización de las familias"
        idDescripcion={`desc-autorizacion-${curso.id}`}
        descripcion={
          curso.autorizacion_familias
            ? `Declarada${curso.autorizacion_familias_en ? ` el ${fechaCorta(curso.autorizacion_familias_en)}` : ''}. Los menores de este curso pueden jugar con sus compañeros y amigos sin cargar datos de su familia.`
            : 'Activalo si tu colegio, tu academia o vos ya tienen el permiso de las madres, los padres o los tutores de este curso para que usen la plataforma y jueguen entre sí. Sin esto, cada menor tiene que cargar los datos de su familia.'
        }
      />
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant leading-relaxed">
        Al activar la autorización asumís que contás con ese permiso. Queda registrada con la fecha. Los menores nunca pueden hablar con otras personas: no hay chat,
        solo se juega, y los nombres se ven abreviados.
      </p>
    </div>
  );
}
