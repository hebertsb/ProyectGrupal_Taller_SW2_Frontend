import { useCallback, useEffect, useState } from 'react';
import { obtenerAvisosDeMiCurso, obtenerMiCurso, obtenerTareasDeMiCurso } from '../../api/backend';
import { fechaCorta } from '../Suscripcion/comunes';
import TarjetaTorneoAlumno from './TarjetaTorneoAlumno';

const NOMBRE_TIPO_TAREA = {
  partidas_ia: 'partidas contra Turing o Stockfish',
  partidas_amigos: 'partidas con compañeros o amigos',
  precision: 'partida medida con esa precisión o más',
};

function Tarjeta({ icono, titulo, children }) {
  return (
    <section className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{icono}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Texto con enlaces seguros: el aviso del docente puede traer un enlace (a la clase en vivo, por ejemplo) que abre en otra pestaña. */
function EnlaceDeAviso({ enlace }) {
  if (!enlace || !/^https?:\/\//i.test(enlace)) return null;
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-space-2xs self-start px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-body-sm text-body-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
      Abrir el enlace
    </a>
  );
}

/**
 * «Mi aula»: lo que el alumno necesita de su curso sin que nadie se lo tenga que repetir en clase — los avisos de su docente, las tareas con su avance y el torneo
 * relámpago. Si todavía no está en un curso, le dice cómo entrar.
 */
export default function Aula({ usuario, alIrAPartida, alIrAPerfil }) {
  const [curso, setCurso] = useState(undefined); // undefined = cargando, null = sin curso
  const [avisos, setAvisos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const miCurso = await obtenerMiCurso();
      setCurso(miCurso);
      if (miCurso) {
        const [losAvisos, lasTareas] = await Promise.all([obtenerAvisosDeMiCurso(), obtenerTareasDeMiCurso()]);
        setAvisos(losAvisos);
        setTareas(lasTareas);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu aula.');
    }
  }, []);

  useEffect(() => {
    cargar();
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, 30000);
    return () => clearInterval(temporizador);
  }, [cargar]);

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className="w-full max-w-3xl mx-auto px-space-lg py-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">school</span>
            <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi aula</h1>
          </div>
          {curso && (
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant break-words">
              {curso.nombre} · docente: <strong className="text-on-surface">{curso.facilitador_nombre}</strong>
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">
            <p className="m-0">{error}</p>
            <button type="button" className="min-h-11 underline" onClick={cargar}>Volver a intentar</button>
          </div>
        )}

        {curso === undefined && !error && (
          <div className="flex items-center gap-space-xs text-on-surface-variant" role="status">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
            <span className="font-mono-micro text-mono-micro">Buscando tu aula…</span>
          </div>
        )}

        {curso === null && (
          <Tarjeta icono="groups" titulo="Todavía no estás en un curso">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Cuando entres al curso de tu docente con su código, acá vas a ver sus avisos, tus tareas y los torneos de tu curso.
            </p>
            <button
              type="button"
              onClick={alIrAPerfil}
              className="self-start px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Entrar con un código
            </button>
          </Tarjeta>
        )}

        {curso && (
          <>
            <TarjetaTorneoAlumno cursoId={curso.id} yoId={usuario?.id} alIrAPartida={alIrAPartida} />

            <Tarjeta icono="assignment" titulo="Tareas">
              {tareas.length === 0 ? (
                <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Tu docente no dejó tareas por ahora.</p>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-space-sm">
                  {tareas.map((tarea) => {
                    const porcentaje = Math.min(100, Math.round((tarea.valor / tarea.meta) * 100));
                    return (
                      <li key={tarea.id} className="flex flex-col gap-space-2xs p-space-sm rounded-lg bg-surface-container">
                        <div className="flex flex-wrap items-start justify-between gap-space-xs">
                          <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">{tarea.titulo}</span>
                          <span
                            className={`shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${
                              tarea.cumplida ? 'bg-primary-container text-primary' : tarea.vencida ? 'bg-error-container text-error' : 'bg-surface-bright text-on-surface-variant'
                            }`}
                          >
                            {tarea.cumplida ? 'Cumplida' : tarea.vencida ? 'Vencida' : `${tarea.dias_restantes} d`}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={tarea.meta}
                          aria-valuenow={Math.min(tarea.valor, tarea.meta)}
                          aria-label={`Avance de ${tarea.titulo}`}
                          className="h-2 rounded-full bg-surface-container-high overflow-hidden"
                        >
                          <div className={`h-full ${tarea.cumplida ? 'bg-primary' : 'bg-secondary'}`} style={{ width: `${porcentaje}%` }} />
                        </div>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                          {Math.min(tarea.valor, tarea.meta)} de {tarea.meta} · {NOMBRE_TIPO_TAREA[tarea.tipo] ?? tarea.tipo} · hasta el {fechaCorta(tarea.hasta)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta icono="campaign" titulo="Avisos de tu docente">
              {avisos.length === 0 ? (
                <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">No hay avisos por ahora.</p>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-space-sm">
                  {avisos.map((aviso) => (
                    <li key={aviso.id} className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container">
                      <p className="m-0 font-body-sm text-body-sm text-on-surface whitespace-pre-line break-words">{aviso.texto}</p>
                      <EnlaceDeAviso enlace={aviso.enlace} />
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                        {aviso.autor ? `${aviso.autor} · ` : ''}{fechaCorta(aviso.creado_en)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </>
        )}
      </div>
    </div>
  );
}
