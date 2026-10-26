import { useEffect, useState } from 'react';
import { listarAlumnosDeMiInstitucion, listarDocentesDeMiInstitucion, obtenerMiInstitucion, obtenerProgresoInstitucion } from '../../api/backend';
import PanelInvitaciones from '../Administracion/PanelInvitaciones';
import AntesDespuesGrupo from '../Progreso/AntesDespuesGrupo';
import InformeAlumno from '../Progreso/InformeAlumno';
import { CLASE_ETIQUETA, datosDelTipo, plural } from './tipos';

function Numero({ icono, valor, etiqueta }) {
  return (
    <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-low shadow-md min-w-0">
      <span className="material-symbols-outlined text-[28px] text-primary shrink-0" aria-hidden="true">{icono}</span>
      <div className="flex flex-col min-w-0">
        <span className="font-mono-metric text-mono-metric text-on-surface">{valor}</span>
        <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant truncate">{etiqueta}</span>
      </div>
    </div>
  );
}

/**
 * La institución del docente o del administrador: sus datos y sus números (docentes, cursos y alumnos). El administrador,
 * además, ve la lista de sus docentes. Es de solo lectura: la plataforma es quien arma el equipo.
 */
export default function MiInstitucion() {
  const [institucion, setInstitucion] = useState(null);
  const [docentes, setDocentes] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [informeDe, setInformeDe] = useState(null); // id del alumno cuyo informe está abierto

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const datos = await obtenerMiInstitucion();
        if (cancelado) return;
        setInstitucion(datos);
        if (datos.es_administrador) {
          const [listaDocentes, listaAlumnos] = await Promise.all([listarDocentesDeMiInstitucion(), listarAlumnosDeMiInstitucion()]);
          if (!cancelado) {
            setDocentes(listaDocentes);
            setAlumnos(listaAlumnos);
          }
        }
      } catch (err) {
        if (!cancelado) setError(err.message || 'No se pudo cargar tu institución.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const tipo = datosDelTipo(institucion?.tipo);

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">apartment</span>
        <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi institución</h1>
      </div>

      {cargando && (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Cargando…</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>
      )}

      {institucion && (
        <>
          <section className="flex flex-col gap-space-2xs bg-surface-container-low p-space-lg rounded-xl shadow-md">
            <div className="flex items-start gap-space-xs min-w-0">
              <span className="material-symbols-outlined text-[26px] text-primary shrink-0" aria-hidden="true">{tipo.icono}</span>
              <div className="flex flex-col min-w-0">
                <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{institucion.nombre}</h2>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">{tipo.etiqueta}</span>
              </div>
            </div>
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              {institucion.es_administrador
                ? 'Sos el administrador de esta institución.'
                : institucion.administrador_nombre
                  ? `Administra la institución: ${institucion.administrador_nombre}.`
                  : 'Todavía no tiene un administrador asignado.'}
            </p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <Numero icono="co_present" valor={institucion.cantidad_docentes} etiqueta={institucion.cantidad_docentes === 1 ? 'docente' : 'docentes'} />
            <Numero icono="groups" valor={institucion.cursos} etiqueta={institucion.cursos === 1 ? 'curso' : 'cursos'} />
            <Numero icono="school" valor={institucion.alumnos} etiqueta={institucion.alumnos === 1 ? 'alumno' : 'alumnos'} />
          </div>

          {institucion.es_administrador && (
            <section aria-label="Docentes de la institución" className="flex flex-col gap-space-xs bg-surface-container-low p-space-lg rounded-xl shadow-md">
              <span className={CLASE_ETIQUETA}>{plural(docentes.length, 'docente', 'docentes')}</span>
              <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
                {docentes.map((d) => (
                  <li key={d.id} className="flex flex-col p-space-xs rounded-lg bg-surface-container min-w-0">
                    <span className="font-body-sm text-body-sm text-on-surface truncate">
                      {d.nombre}
                      {d.es_administrador && (
                        <span className="ml-space-xs font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">{d.email}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                Para sumar un docente, usá «Invitar a un docente» de arriba. Para quitarlo, pedíselo a la plataforma.
              </p>
            </section>
          )}

          {institucion.es_administrador && (
            <section aria-label="Progreso de la institución" className="bg-surface-container-low p-space-lg rounded-xl shadow-md">
              <AntesDespuesGrupo titulo="Antes y después de tu institución" cargar={() => obtenerProgresoInstitucion()} alVerInforme={setInformeDe} />
            </section>
          )}

          {institucion.es_administrador && <PanelInvitaciones modo="institucion" institucion={{ id: institucion.id, nombre: institucion.nombre }} />}

          {institucion.es_administrador && (
            <section aria-label="Alumnos de la institución" className="flex flex-col gap-space-xs bg-surface-container-low p-space-lg rounded-xl shadow-md">
              <span className={CLASE_ETIQUETA}>{plural(alumnos.length, 'alumno', 'alumnos')}</span>
              {alumnos.length === 0 ? (
                <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
                  Todavía no hay alumnos: aparecen cuando entran a un curso de alguno de tus docentes con su código.
                </p>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
                  {alumnos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-space-xs p-space-xs rounded-lg bg-surface-container min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm text-on-surface truncate">{a.nombre}</span>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">
                          {a.curso} · {a.docente}
                        </span>
                      </div>
                      {a.rango_estimado && (
                        <span className="shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-secondary-container text-secondary">
                          {a.rango_estimado}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {informeDe != null && <InformeAlumno alumnoId={informeDe} alCerrar={() => setInformeDe(null)} />}
    </div>
  );
}
