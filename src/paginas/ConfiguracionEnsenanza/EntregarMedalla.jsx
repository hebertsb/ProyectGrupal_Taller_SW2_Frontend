import { useEffect, useState } from 'react';
import { listarCursos, listarEstudiantesCurso, otorgarMedalla } from '../../api/backend';
import {
  AvisoError,
  AvisoListo,
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  BotonReintentar,
  CLASE_AYUDA,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  Cargando,
  Giro,
  GIRO_SOBRE_PRINCIPAL,
} from './ComunesMedallas';
import { plural, textoResultadoEntrega } from './medallasPropias';

/** "Ajedrez 2do B · 12 jugadores" (el principal ve además de qué facilitador es cada curso). */
function etiquetaCurso(curso, esPrincipal) {
  const partes = [curso.nombre, plural(curso.estudiantes ?? 0, 'jugador', 'jugadores')];
  if (esPrincipal && curso.facilitador_nombre) partes.push(curso.facilitador_nombre);
  return partes.join(' · ');
}

/**
 * Panel en línea (dentro de la tarjeta de una medalla manual) para entregarla: se elige un curso de `listarCursos()`, y
 * después "Entregar a todo el curso" o marcar jugadores de ese curso (`GET /cursos/{id}/estudiantes`). Muestra el
 * resultado ("Entregada a 3 jugadores (1 ya la tenía).") y avisa a la lista para que actualice cuántos la ganaron.
 *
 * Un facilitador solo puede entregarla a jugadores de sus cursos; el principal, a cualquiera (por eso pide los cursos de
 * todos). Los errores del backend se muestran tal cual.
 */
export default function EntregarMedalla({ medalla, esPrincipal, alEntregada, alCerrar }) {
  const [cursos, setCursos] = useState(null);
  const [errorCursos, setErrorCursos] = useState(null);
  const [intentoCursos, setIntentoCursos] = useState(0);

  const [cursoId, setCursoId] = useState('');
  const [estudiantes, setEstudiantes] = useState(null);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);
  const [errorEstudiantes, setErrorEstudiantes] = useState(null);
  const [intentoEstudiantes, setIntentoEstudiantes] = useState(0);

  const [todoElCurso, setTodoElCurso] = useState(false);
  const [seleccion, setSeleccion] = useState(() => new Set());

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let vivo = true;
    setErrorCursos(null);
    listarCursos(esPrincipal)
      .then((lista) => {
        if (vivo) setCursos(Array.isArray(lista) ? lista : []);
      })
      .catch((err) => {
        if (vivo) setErrorCursos(err?.message || 'No se pudieron cargar tus cursos.');
      });
    return () => {
      vivo = false;
    };
  }, [esPrincipal, intentoCursos]);

  useEffect(() => {
    if (!cursoId) return undefined;
    let vivo = true;
    setCargandoEstudiantes(true);
    setErrorEstudiantes(null);
    listarEstudiantesCurso(Number(cursoId))
      .then((lista) => {
        if (vivo) setEstudiantes(Array.isArray(lista) ? lista : []);
      })
      .catch((err) => {
        if (vivo) setErrorEstudiantes(err?.message || 'No se pudieron cargar los jugadores del curso.');
      })
      .finally(() => {
        if (vivo) setCargandoEstudiantes(false);
      });
    return () => {
      vivo = false;
    };
  }, [cursoId, intentoEstudiantes]);

  function elegirCurso(valor) {
    setCursoId(valor);
    setEstudiantes(null);
    setErrorEstudiantes(null);
    setTodoElCurso(false);
    setSeleccion(new Set());
    setResultado(null);
    setErrorEnvio(null);
  }

  function marcar(id, marcado) {
    setResultado(null);
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  const hayAQuien = todoElCurso || seleccion.size > 0;

  async function entregar() {
    if (enviando || !cursoId || !hayAQuien) return;
    setEnviando(true);
    setErrorEnvio(null);
    setResultado(null);
    try {
      const respuesta = await otorgarMedalla(medalla.codigo, {
        usuarioIds: todoElCurso ? [] : Array.from(seleccion),
        cursoId: todoElCurso ? Number(cursoId) : null,
      });
      setResultado(textoResultadoEntrega(respuesta));
      setSeleccion(new Set());
      setTodoElCurso(false);
      alEntregada();
    } catch (err) {
      setErrorEnvio(err?.message || 'No se pudo entregar la medalla.');
    } finally {
      setEnviando(false);
    }
  }

  const idSelect = `entregar-curso-${medalla.codigo}`;

  return (
    <section
      aria-label={`Entregar la medalla ${medalla.nombre}`}
      className="flex flex-col gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/30"
    >
      <p className="m-0 font-body-sm text-body-sm text-on-surface">
        Entregá «{medalla.nombre}» a un curso entero o a jugadores que elijas. Les aparece como medalla nueva.
      </p>

      {cursos === null && !errorCursos && <Cargando texto="Buscando tus cursos…" />}
      {errorCursos && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={errorCursos} />
          <BotonReintentar
            alTocar={() => {
              setCursos(null);
              setErrorCursos(null);
              setIntentoCursos((n) => n + 1);
            }}
          />
        </div>
      )}
      {cursos !== null && cursos.length === 0 && (
        <p className={CLASE_AYUDA}>
          Todavía no tenés cursos con jugadores. Creá uno en Gestión de Usuarios y compartí su código con tus estudiantes.
        </p>
      )}

      {cursos !== null && cursos.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={idSelect} className={CLASE_ETIQUETA}>
            Curso
          </label>
          <select
            id={idSelect}
            value={cursoId}
            onChange={(evento) => elegirCurso(evento.target.value)}
            disabled={enviando}
            className={CLASE_INPUT}
          >
            <option value="">Elegí un curso…</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={String(curso.id)}>
                {etiquetaCurso(curso, esPrincipal)}
              </option>
            ))}
          </select>
        </div>
      )}

      {cursoId && cargandoEstudiantes && <Cargando texto="Buscando los jugadores del curso…" />}
      {cursoId && errorEstudiantes && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={errorEstudiantes} />
          <BotonReintentar alTocar={() => setIntentoEstudiantes((n) => n + 1)} deshabilitado={cargandoEstudiantes} />
        </div>
      )}

      {cursoId && estudiantes !== null && !cargandoEstudiantes && !errorEstudiantes && (
        <>
          {estudiantes.length === 0 ? (
            <p className={CLASE_AYUDA}>Este curso todavía no tiene jugadores inscritos.</p>
          ) : (
            <>
              <label className="flex items-center gap-space-xs min-h-11 px-space-xs rounded-lg bg-surface-container cursor-pointer has-disabled:opacity-60 has-disabled:cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={todoElCurso}
                  onChange={(evento) => {
                    setTodoElCurso(evento.target.checked);
                    setResultado(null);
                  }}
                  disabled={enviando}
                  className="w-5 h-5 shrink-0 accent-primary"
                />
                <span className="font-body-sm text-body-sm font-medium text-on-surface">
                  Entregar a todo el curso ({plural(estudiantes.length, 'jugador', 'jugadores')})
                </span>
              </label>

              <ul
                aria-label="Jugadores del curso"
                className="m-0 p-0 list-none flex flex-col max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-outline-variant/20"
              >
                {estudiantes.map((estudiante) => {
                  const inactivo = estudiante.activo === false;
                  return (
                    <li key={estudiante.id}>
                      <label className="flex items-center gap-space-xs min-h-11 px-space-xs hover:bg-surface-container cursor-pointer has-disabled:opacity-60 has-disabled:cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={todoElCurso || seleccion.has(estudiante.id)}
                          onChange={(evento) => marcar(estudiante.id, evento.target.checked)}
                          disabled={enviando || todoElCurso || inactivo}
                          className="w-5 h-5 shrink-0 accent-primary"
                        />
                        <span className="flex flex-col min-w-0">
                          <span className="font-body-sm text-body-sm text-on-surface break-words">
                            {estudiante.nombre}
                            {inactivo ? ' (inactivo)' : ''}
                          </span>
                          {estudiante.email && (
                            <span className="font-mono-micro text-mono-micro text-on-surface-variant break-all">
                              {estudiante.email}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {!todoElCurso && (
                <p className={CLASE_AYUDA}>
                  {seleccion.size === 0
                    ? 'Marcá a quién se la das, o entregala a todo el curso.'
                    : `Elegiste ${plural(seleccion.size, 'jugador', 'jugadores')}.`}
                </p>
              )}
            </>
          )}
        </>
      )}

      {errorEnvio && <AvisoError mensaje={errorEnvio} />}
      {resultado && <AvisoListo mensaje={resultado} />}

      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          onClick={entregar}
          disabled={enviando || !cursoId || !hayAQuien}
          className={BOTON_PRINCIPAL}
        >
          {enviando ? (
            <Giro colores={GIRO_SOBRE_PRINCIPAL} />
          ) : (
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              card_giftcard
            </span>
          )}
          {enviando ? 'Entregando…' : 'Entregar'}
        </button>
        <button type="button" onClick={alCerrar} disabled={enviando} className={BOTON_SECUNDARIO}>
          Cerrar
        </button>
      </div>
    </section>
  );
}
