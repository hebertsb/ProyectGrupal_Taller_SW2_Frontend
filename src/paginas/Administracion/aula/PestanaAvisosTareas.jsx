import { useCallback, useEffect, useState } from 'react';
import {
  borrarAvisoDelCurso,
  borrarTareaDelCurso,
  crearTareaEnCurso,
  obtenerAvisosDelCurso,
  obtenerTareasDelCurso,
  publicarAvisoEnCurso,
} from '../../../api/backend';
import { BOTON_NEUTRO, BOTON_PELIGRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT, fechaCorta } from '../../Suscripcion/comunes';

const TIPOS_DE_TAREA = [
  { valor: 'partidas_ia', texto: 'Partidas contra Turing o Stockfish', unidad: 'partidas' },
  { valor: 'partidas_amigos', texto: 'Partidas con compañeros o amigos', unidad: 'partidas' },
  { valor: 'precision', texto: 'Una partida con precisión de…', unidad: '% o más' },
];

function Alerta({ mensaje }) {
  return <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{mensaje}</div>;
}

function FormularioAviso({ cursoId, alPublicar }) {
  const [texto, setTexto] = useState('');
  const [enlace, setEnlace] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  async function publicar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await publicarAvisoEnCurso(cursoId, texto.trim(), enlace.trim());
      setTexto('');
      setEnlace('');
      alPublicar();
    } catch (err) {
      setError(err.message || 'No se pudo publicar el aviso.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={publicar} className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-low">
      <label htmlFor={`aviso-texto-${cursoId}`} className={CLASE_ETIQUETA}>Escribile un aviso a tu curso</label>
      <textarea
        id={`aviso-texto-${cursoId}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={500}
        rows={3}
        required
        minLength={3}
        placeholder="Ej.: Mañana a las 15:00 jugamos el torneo. Entren a Mi aula cinco minutos antes."
        className="w-full px-space-sm py-space-xs bg-surface-container-lowest border border-outline-variant/40 rounded-lg font-body-sm text-body-sm text-on-surface resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      />
      <label htmlFor={`aviso-enlace-${cursoId}`} className={CLASE_ETIQUETA}>Enlace (opcional, por ejemplo la clase en vivo)</label>
      <input id={`aviso-enlace-${cursoId}`} type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} maxLength={300} placeholder="https://meet.google.com/…" className={CLASE_INPUT} />
      {error && <Alerta mensaje={error} />}
      <button type="submit" disabled={ocupado || texto.trim().length < 3} className={`${BOTON_PRINCIPAL} self-start`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">campaign</span>
        {ocupado ? 'Publicando…' : 'Publicar aviso'}
      </button>
    </form>
  );
}

function FormularioTarea({ cursoId, alCrear }) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('partidas_ia');
  const [meta, setMeta] = useState('3');
  const [dias, setDias] = useState('7');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const unidad = TIPOS_DE_TAREA.find((t) => t.valor === tipo)?.unidad ?? '';

  async function crear(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await crearTareaEnCurso(cursoId, { titulo: titulo.trim(), tipo, meta: Number(meta), dias: Number(dias) });
      setTitulo('');
      alCrear();
    } catch (err) {
      setError(err.message || 'No se pudo crear la tarea.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={crear} className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs p-space-sm rounded-xl bg-surface-container-low">
      <div className="sm:col-span-2 flex flex-col gap-space-2xs">
        <label htmlFor={`tarea-titulo-${cursoId}`} className={CLASE_ETIQUETA}>Nueva tarea</label>
        <input id={`tarea-titulo-${cursoId}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} minLength={3} required placeholder="Ej.: Practicá esta semana" className={CLASE_INPUT} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-space-2xs">
        <label htmlFor={`tarea-tipo-${cursoId}`} className={CLASE_ETIQUETA}>Qué tienen que hacer</label>
        <select id={`tarea-tipo-${cursoId}`} value={tipo} onChange={(e) => setTipo(e.target.value)} className={CLASE_INPUT}>
          {TIPOS_DE_TAREA.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`tarea-meta-${cursoId}`} className={CLASE_ETIQUETA}>Meta ({unidad})</label>
        <input id={`tarea-meta-${cursoId}`} type="number" inputMode="numeric" min={1} max={100} value={meta} onChange={(e) => setMeta(e.target.value)} required className={CLASE_INPUT} />
      </div>
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`tarea-dias-${cursoId}`} className={CLASE_ETIQUETA}>Plazo (días)</label>
        <input id={`tarea-dias-${cursoId}`} type="number" inputMode="numeric" min={1} max={60} value={dias} onChange={(e) => setDias(e.target.value)} required className={CLASE_INPUT} />
      </div>
      {error && <div className="sm:col-span-2"><Alerta mensaje={error} /></div>}
      <button type="submit" disabled={ocupado || titulo.trim().length < 3} className={`${BOTON_PRINCIPAL} sm:col-span-2 sm:justify-self-start`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_task</span>
        {ocupado ? 'Creando…' : 'Crear tarea'}
      </button>
    </form>
  );
}

function TareaDelDocente({ tarea, alBorrar }) {
  const [abierta, setAbierta] = useState(false);
  const porcentaje = tarea.total > 0 ? Math.round((tarea.cumplieron / tarea.total) * 100) : 0;
  return (
    <li className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-low min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-space-xs">
        <div className="min-w-0">
          <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{tarea.titulo}</span>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            Meta {tarea.meta} · {tarea.vencida ? 'vencida' : `${tarea.dias_restantes} días restantes`} · hasta el {fechaCorta(tarea.hasta)}
          </p>
        </div>
        <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface shrink-0">
          {tarea.cumplieron} de {tarea.total} cumplieron
        </span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-label={`Alumnos que cumplieron ${tarea.titulo}`} className="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${porcentaje}%` }} />
      </div>
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} className={BOTON_NEUTRO}>
          {abierta ? 'Ocultar avance' : 'Ver el avance de cada alumno'}
        </button>
        <button type="button" onClick={alBorrar} className={BOTON_PELIGRO}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
          Borrar
        </button>
      </div>
      {abierta && (
        <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-space-2xs">
          {tarea.alumnos.map((alumno) => (
            <li key={alumno.id} className={`flex items-center justify-between gap-space-xs px-space-sm py-space-2xs rounded-lg ${alumno.cumplida ? 'bg-primary/10' : 'bg-surface-container'}`}>
              <span className="font-body-sm text-body-sm text-on-surface truncate min-w-0">{alumno.nombre}</span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant shrink-0">{alumno.cumplida ? '✔ ' : ''}{Math.min(alumno.valor, tarea.meta)}/{tarea.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Avisos y tareas del curso: lo que el docente deja escrito para que los alumnos lo vean en «Mi aula», sin tener que repetirlo en clase. */
export default function PestanaAvisosTareas({ curso }) {
  const [avisos, setAvisos] = useState(null);
  const [tareas, setTareas] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [losAvisos, lasTareas] = await Promise.all([obtenerAvisosDelCurso(curso.id), obtenerTareasDelCurso(curso.id)]);
      setAvisos(losAvisos);
      setTareas(lasTareas);
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los avisos y las tareas.');
    }
  }, [curso.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const borrar = async (accion) => {
    try {
      await accion();
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo borrar.');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md items-start">
      {error && <div className="xl:col-span-2"><Alerta mensaje={error} /></div>}

      <section aria-label="Avisos" className="flex flex-col gap-space-sm min-w-0">
        <h3 className="m-0 font-body-md text-body-md font-medium text-on-surface">Avisos</h3>
        <FormularioAviso cursoId={curso.id} alPublicar={cargar} />
        {avisos && avisos.length === 0 && <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no publicaste avisos.</p>}
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {(avisos ?? []).map((aviso) => (
            <li key={aviso.id} className="flex flex-col gap-space-2xs p-space-sm rounded-xl bg-surface-container-low min-w-0">
              <p className="m-0 font-body-sm text-body-sm text-on-surface whitespace-pre-line break-words">{aviso.texto}</p>
              {aviso.enlace && <span className="font-mono-micro text-mono-micro text-primary break-all">{aviso.enlace}</span>}
              <div className="flex flex-wrap items-center justify-between gap-space-xs">
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">{fechaCorta(aviso.creado_en)}</span>
                <button type="button" onClick={() => borrar(() => borrarAvisoDelCurso(curso.id, aviso.id))} className={BOTON_PELIGRO} aria-label="Borrar el aviso">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Tareas" className="flex flex-col gap-space-sm min-w-0">
        <h3 className="m-0 font-body-md text-body-md font-medium text-on-surface">Tareas con seguimiento</h3>
        <FormularioTarea cursoId={curso.id} alCrear={cargar} />
        {tareas && tareas.length === 0 && <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no dejaste tareas. El sistema cuenta solo lo que cada alumno juega desde que la creás.</p>}
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {(tareas ?? []).map((tarea) => (
            <TareaDelDocente key={tarea.id} tarea={tarea} alBorrar={() => borrar(() => borrarTareaDelCurso(curso.id, tarea.id))} />
          ))}
        </ul>
      </section>
    </div>
  );
}
