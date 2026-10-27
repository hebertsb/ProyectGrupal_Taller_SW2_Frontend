import { useEffect, useState } from 'react';
import { NOMBRE_DE_FASE, SEMAFOROS, TENDENCIAS, haceCuanto, numero, porcentaje, puntos, resultadosEntrePersonas, variacionElo } from './comunes';

const BOTON_INFORME =
  'flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const ENCABEZADO = 'px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-medium';
const CELDA = 'px-space-sm py-space-xs align-middle font-body-sm text-body-sm text-on-surface';

function Indicador({ icono, titulo, valor, detalle = null }) {
  return (
    <div className="flex flex-col gap-1 p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20 min-w-0">
      <span className="flex items-start gap-1.5 font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
        <span className="material-symbols-outlined text-primary text-[16px] shrink-0" aria-hidden="true">{icono}</span>
        <span className="leading-tight min-w-0 break-words">{titulo}</span>
      </span>
      <span className="font-headline-sm text-headline-sm text-on-surface break-words">{valor}</span>
      {detalle && <span className="font-body-sm text-[12px] text-on-surface-variant break-words">{detalle}</span>}
    </div>
  );
}

function Cambio({ fila }) {
  const tendencia = TENDENCIAS[fila.tendencia];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${tendencia.clase}`}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{tendencia.icono}</span>
      {fila.comparable ? `${puntos(fila.variacion_precision)}` : tendencia.texto}
    </span>
  );
}

function NivelAntesDespues({ fila }) {
  if (fila.nivel_antes == null) return <span className="text-on-surface-variant">Sin medir</span>;
  if (!fila.comparable) return <span>Nivel {fila.nivel_antes} <span className="text-on-surface-variant">(punto de partida)</span></span>;
  return (
    <span className="font-mono-metric text-mono-metric">
      {fila.nivel_antes} → <strong>{fila.nivel_despues}</strong>
      {!fila.confirmado && <span className="ml-1 font-mono-micro text-mono-micro uppercase text-on-surface-variant">provisional</span>}
    </span>
  );
}

function Tarjetas({ alumnos, alVerInforme }) {
  return (
    <ul aria-label="Alumnos y su progreso" className="@2xl:hidden m-0 p-0 list-none flex flex-col gap-space-xs">
      {alumnos.map((fila) => (
        <li key={fila.id} className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-space-xs">
            <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">{fila.nombre}</span>
            <Cambio fila={fila} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <span>Nivel: <NivelAntesDespues fila={fila} /></span>
            <span>Última partida: {haceCuanto(fila.dias_sin_jugar)}</span>
          </div>
          {alVerInforme && (
            <button type="button" onClick={() => alVerInforme(fila.id)} className={`${BOTON_INFORME} self-start`}>
              <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">description</span>
              Ver informe
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Tabla({ alumnos, alVerInforme }) {
  return (
    <div className="hidden @2xl:block overflow-x-auto rounded-xl border border-outline-variant/20">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Alumnos, ordenados de los que más mejoraron a los que menos</caption>
        <thead>
          <tr className="bg-surface-container-low">
            <th scope="col" className={ENCABEZADO}>Alumno</th>
            <th scope="col" className={ENCABEZADO}>Nivel antes → después</th>
            <th scope="col" className={`${ENCABEZADO} text-right`}>Precisión</th>
            <th scope="col" className={ENCABEZADO}>Cambio</th>
            <th scope="col" className={`${ENCABEZADO} text-right`}>Partidas</th>
            <th scope="col" className={ENCABEZADO}>Última partida</th>
            {alVerInforme && <th scope="col" className={ENCABEZADO}><span className="sr-only">Informe</span></th>}
          </tr>
        </thead>
        <tbody>
          {alumnos.map((fila) => (
            <tr key={fila.id} className="border-t border-outline-variant/20">
              <td className={`${CELDA} font-medium break-words`}>{fila.nombre}</td>
              <td className={CELDA}><NivelAntesDespues fila={fila} /></td>
              <td className={`${CELDA} text-right font-mono-metric text-mono-metric whitespace-nowrap`}>
                {fila.comparable ? `${numero(fila.precision_antes)} → ${numero(fila.precision_despues)} %` : fila.precision_antes != null ? `${numero(fila.precision_antes)} %` : '—'}
              </td>
              <td className={`${CELDA} whitespace-nowrap`}><Cambio fila={fila} /></td>
              <td className={`${CELDA} text-right font-mono-metric text-mono-metric`}>{fila.partidas}</td>
              <td className={`${CELDA} whitespace-nowrap`}>{haceCuanto(fila.dias_sin_jugar)}</td>
              {alVerInforme && (
                <td className={CELDA}>
                  <button type="button" onClick={() => alVerInforme(fila.id)} className={BOTON_INFORME}>
                    <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">description</span>
                    Informe
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VISTAS = [
  { id: 'aprendizaje', texto: 'Aprendizaje', icono: 'school' },
  { id: 'competencia', texto: 'Competencia', icono: 'emoji_events' },
  { id: 'constancia', texto: 'Constancia', icono: 'event_available' },
];

function Pestanas({ vista, alCambiar }) {
  return (
    <div role="tablist" aria-label="Qué mirar del grupo" className="flex flex-wrap gap-space-xs">
      {VISTAS.map((opcion) => (
        <button
          key={opcion.id}
          type="button"
          role="tab"
          id={`vista-grupo-${opcion.id}`}
          aria-selected={vista === opcion.id}
          aria-controls="panel-vista-grupo"
          onClick={() => alCambiar(opcion.id)}
          className={`flex items-center gap-1 px-space-md min-h-11 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            vista === opcion.id ? 'bg-primary text-on-primary font-medium' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{opcion.icono}</span>
          {opcion.texto}
        </button>
      ))}
    </div>
  );
}

function Semaforo({ estado }) {
  const semaforo = SEMAFOROS[estado] ?? SEMAFOROS.sin_empezar;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${semaforo.clase}`}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{semaforo.icono}</span>
      {semaforo.texto}
    </span>
  );
}

function EloDe({ fila }) {
  if (!fila.partidas_elo) return <span className="text-on-surface-variant">Sin partidas</span>;
  return (
    <span className="font-mono-metric text-mono-metric">
      <strong>{fila.elo}</strong>
      {fila.elo_provisional && <span className="ml-1 font-mono-micro text-mono-micro uppercase text-on-surface-variant">provisional</span>}
    </span>
  );
}

function CambioElo({ fila }) {
  if (!fila.partidas_elo) return <span className="text-on-surface-variant">—</span>;
  const cambio = fila.elo_cambio_30_dias;
  const clase = cambio > 0 ? 'text-primary' : cambio < 0 ? 'text-error' : 'text-on-surface-variant';
  const icono = cambio > 0 ? 'trending_up' : cambio < 0 ? 'trending_down' : 'trending_flat';
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${clase}`}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{icono}</span>
      {variacionElo(cambio)}
    </span>
  );
}

/**
 * Una lista de alumnos con las columnas que se le pasen (`{ id, encabezado, celda(fila), esTitulo?, derecha? }`): tabla cuando hay lugar y tarjetas
 * en el celular. La columna `esTitulo` encabeza cada tarjeta; las demás se leen como «etiqueta: valor».
 */
function ListaDeAlumnos({ leyenda, columnas, alumnos, alVerInforme, nota }) {
  const titulo = columnas.find((columna) => columna.esTitulo) ?? columnas[0];
  const resto = columnas.filter((columna) => columna !== titulo);
  return (
    <>
      <ul aria-label={leyenda} className="@2xl:hidden m-0 p-0 list-none flex flex-col gap-space-xs">
        {alumnos.map((fila) => (
          <li key={fila.id} className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20 min-w-0">
            <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{titulo.celda(fila)}</span>
            <dl className="m-0 flex flex-col gap-1 font-body-sm text-body-sm">
              {resto.map((columna) => (
                <div key={columna.id} className="flex flex-wrap items-baseline justify-between gap-x-space-xs">
                  <dt className="text-on-surface-variant">{columna.encabezado}</dt>
                  <dd className="m-0 text-right text-on-surface min-w-0 break-words">{columna.celda(fila)}</dd>
                </div>
              ))}
            </dl>
            {alVerInforme && (
              <button type="button" onClick={() => alVerInforme(fila.id)} className={`${BOTON_INFORME} self-start`}>
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">description</span>
                Ver informe
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden @2xl:block overflow-x-auto rounded-xl border border-outline-variant/20">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{leyenda}</caption>
          <thead>
            <tr className="bg-surface-container-low">
              {columnas.map((columna) => (
                <th key={columna.id} scope="col" className={`${ENCABEZADO} ${columna.derecha ? 'text-right' : ''}`}>{columna.encabezado}</th>
              ))}
              {alVerInforme && <th scope="col" className={ENCABEZADO}><span className="sr-only">Informe</span></th>}
            </tr>
          </thead>
          <tbody>
            {alumnos.map((fila) => (
              <tr key={fila.id} className="border-t border-outline-variant/20">
                {columnas.map((columna) => (
                  <td key={columna.id} className={`${CELDA} ${columna.esTitulo ? 'font-medium break-words' : ''} ${columna.derecha ? 'text-right font-mono-metric text-mono-metric' : ''}`}>
                    {columna.celda(fila)}
                  </td>
                ))}
                {alVerInforme && (
                  <td className={CELDA}>
                    <button type="button" onClick={() => alVerInforme(fila.id)} className={BOTON_INFORME}>
                      <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">description</span>
                      Informe
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">{nota}</p>}
    </>
  );
}

/** Los alumnos a los que conviene mirar hoy y por qué (hace tiempo que no juegan, bajaron de nivel, perdieron varias seguidas). */
function ParaMirarHoy({ alumnos, alVerInforme }) {
  const lista = alumnos.filter((fila) => fila.atencion?.length);
  if (lista.length === 0) return null;
  const visibles = lista.slice(0, 8);
  return (
    <section aria-label="Alumnos para mirar hoy" className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-tertiary/10 border border-tertiary/30">
      <h5 className="m-0 flex items-center gap-1.5 font-body-sm text-body-sm font-medium text-on-surface">
        <span className="material-symbols-outlined text-[18px] text-tertiary-fixed-dim" aria-hidden="true">notifications_active</span>
        Para mirar hoy ({lista.length})
      </h5>
      <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
        {visibles.map((fila) => (
          <li key={fila.id} className="flex flex-wrap items-center justify-between gap-space-xs">
            <div className="flex flex-col min-w-0">
              <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{fila.nombre}</span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">{fila.atencion.join(' · ')}</span>
            </div>
            {alVerInforme && (
              <button type="button" onClick={() => alVerInforme(fila.id)} className={BOTON_INFORME}>
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">description</span>
                Ver informe
              </button>
            )}
          </li>
        ))}
      </ul>
      {lista.length > visibles.length && (
        <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Y {lista.length - visibles.length} más: están en la pestaña Constancia.</p>
      )}
    </section>
  );
}

/** Qué conviene enseñar al grupo: en qué fase de la partida se acierta menos y qué errores se repiten, con una sugerencia para la próxima clase. */
function ParaLaProximaClase({ plan }) {
  if (!plan || (plan.sugerencias.length === 0 && plan.fases.every((fase) => fase.precision == null))) return null;
  return (
    <section aria-label="Para la próxima clase" className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20">
      <h5 className="m-0 flex items-center gap-1.5 font-body-sm text-body-sm font-medium text-on-surface">
        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">menu_book</span>
        Para la próxima clase
      </h5>
      {plan.sugerencias.length > 0 ? (
        <ul className="m-0 pl-space-md flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface">
          {plan.sugerencias.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay una diferencia clara entre las fases de la partida: el grupo juega parejo.</p>
      )}
      <ul aria-label="Precisión del grupo por fase" className="m-0 p-0 list-none flex flex-col gap-space-xs">
        {plan.fases.map((fase) => (
          <li key={fase.fase} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-space-sm font-body-sm text-body-sm">
              <span className="text-on-surface">{NOMBRE_DE_FASE[fase.fase] ?? fase.fase}</span>
              <span className="font-mono-metric text-mono-metric text-on-surface-variant">{fase.precision == null ? 'sin jugadas medidas' : porcentaje(fase.precision)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${fase.precision ?? 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <span className="font-mono-micro text-mono-micro text-on-surface-variant">
        Sale de las partidas analizadas de {plan.alumnos_con_datos} {plan.alumnos_con_datos === 1 ? 'alumno' : 'alumnos'}
        {plan.alumnos_totales > plan.alumnos_leidos ? ` (se leyeron los primeros ${plan.alumnos_leidos} de ${plan.alumnos_totales})` : ''}. Son sugerencias para planificar, no una evaluación.
      </span>
    </section>
  );
}

const RANGO_SEMAFORO = { rojo: 0, sin_empezar: 1, amarillo: 2, verde: 3 };

/**
 * El antes y el después de un grupo de alumnos (un curso o toda una institución): cuántos mejoraron desde su diagnóstico y cuánto, y una
 * fila por alumno con un botón para abrir su informe. `cargar` devuelve la respuesta de `/progreso/...`; `recarga` cambia para volver a pedirla.
 */
export default function AntesDespuesGrupo({ cargar, titulo = 'Antes y después', recarga = 0, alVerInforme = null }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('aprendizaje');

  useEffect(() => {
    let vigente = true;
    setError(null);
    cargar()
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((err) => vigente && setError(err.message || 'No se pudo cargar el progreso.'));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarga]);

  if (error) return <div role="alert" className="p-space-sm rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>;
  if (!datos) return <div role="status" className="py-space-xs font-mono-micro text-mono-micro text-on-surface-variant">Calculando el progreso…</div>;

  const { resumen, alumnos } = datos;
  const hayComparables = resumen.comparables > 0;
  const activosConSemaforo = Object.values(resumen.semaforo ?? {}).reduce((suma, cantidad) => suma + cantidad, 0);
  const porElo = [...alumnos].sort((a, b) => Number(b.partidas_elo > 0) - Number(a.partidas_elo > 0) || b.elo - a.elo || a.nombre.localeCompare(b.nombre));
  const puestos = new Map();
  porElo.filter((fila) => fila.partidas_elo > 0).forEach((fila, indice) => puestos.set(fila.id, indice + 1));
  const porConstancia = [...alumnos].sort(
    (a, b) =>
      RANGO_SEMAFORO[a.estado_actividad ?? 'sin_empezar'] - RANGO_SEMAFORO[b.estado_actividad ?? 'sin_empezar'] ||
      (b.dias_sin_jugar ?? 0) - (a.dias_sin_jugar ?? 0) ||
      a.nombre.localeCompare(b.nombre),
  );
  const columnasDeCompetencia = [
    { id: 'puesto', encabezado: 'Puesto', derecha: true, celda: (fila) => puestos.get(fila.id) ?? '—' },
    { id: 'nombre', encabezado: 'Alumno', esTitulo: true, celda: (fila) => fila.nombre },
    { id: 'elo', encabezado: 'Elo', celda: (fila) => <EloDe fila={fila} /> },
    { id: 'cambio', encabezado: 'Últimos 30 días', celda: (fila) => <CambioElo fila={fila} /> },
    { id: 'puntuadas', encabezado: 'Puntuadas', celda: (fila) => resultadosEntrePersonas(fila.puntuadas) },
    { id: 'torneos', encabezado: 'Torneos', celda: (fila) => resultadosEntrePersonas(fila.torneos) },
    { id: 'amistosas', encabezado: 'Amistosas', celda: (fila) => resultadosEntrePersonas(fila.amistosas) },
  ];
  const columnasDeConstancia = [
    { id: 'nombre', encabezado: 'Alumno', esTitulo: true, celda: (fila) => fila.nombre },
    { id: 'estado', encabezado: 'Constancia', celda: (fila) => <Semaforo estado={fila.estado_actividad} /> },
    { id: 'ultima', encabezado: 'Última partida', celda: (fila) => haceCuanto(fila.dias_sin_jugar) },
    { id: 'mes', encabezado: 'Partidas en 30 días', derecha: true, celda: (fila) => fila.partidas_30_dias },
    { id: 'companeros', encabezado: 'Con compañeros', derecha: true, celda: (fila) => fila.partidas_companeros ?? 0 },
    { id: 'atencion', encabezado: 'Para mirar', celda: (fila) => (fila.atencion?.length ? fila.atencion.join(' · ') : '—') },
  ];
  return (
    <section aria-label={titulo} className="@container flex flex-col gap-space-sm min-w-0">
      <div className="flex flex-col min-w-0">
        <h4 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{titulo}</h4>
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">Cada alumno se compara con su propio diagnóstico (sus 3 primeras partidas medidas)</span>
      </div>

      {resumen.alumnos === 0 ? (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay alumnos.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-space-xs">
            <Indicador icono="notifications_active" titulo="Para mirar hoy" valor={`${resumen.necesitan_atencion ?? 0}`} detalle="alumnos que necesitan atención" />
            <Indicador
              icono="event_available"
              titulo="Al día esta semana"
              valor={`${resumen.semaforo?.verde ?? 0} de ${activosConSemaforo}`}
              detalle={`${resumen.semaforo?.amarillo ?? 0} se están alejando · ${resumen.semaforo?.rojo ?? 0} hace tiempo que no juegan`}
            />
            <Indicador icono="leaderboard" titulo="Elo promedio" valor={resumen.elo_promedio != null ? numero(resumen.elo_promedio) : '—'} detalle="de quienes jugaron con compañeros" />
            <Indicador icono="groups" titulo="Partidas con compañeros" valor={`${resumen.partidas_companeros ?? 0}`} detalle="amistosas, puntuadas y torneos" />
          </div>
          <ParaMirarHoy alumnos={alumnos} alVerInforme={alVerInforme} />
          <ParaLaProximaClase plan={datos.plan_de_clase} />
          <Pestanas vista={vista} alCambiar={setVista} />
          <div id="panel-vista-grupo" role="tabpanel" aria-labelledby={`vista-grupo-${vista}`} className="flex flex-col gap-space-sm min-w-0">
          {vista === 'aprendizaje' && (
          <>
          {hayComparables ? (
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-space-xs">
              <Indicador icono="emoji_events" titulo="Alumnos que mejoraron" valor={`${resumen.mejoraron} de ${resumen.comparables}${resumen.porcentaje_mejoraron != null ? ` · ${resumen.porcentaje_mejoraron} %` : ''}`} detalle={`${resumen.estables} se mantienen · ${resumen.bajaron} bajaron`} />
              <Indicador icono="trending_up" titulo="Mejora promedio de precisión" valor={puntos(resumen.mejora_promedio_precision)} detalle={`${porcentaje(resumen.precision_antes)} → ${porcentaje(resumen.precision_despues)}`} />
              <Indicador icono="military_tech" titulo="Nivel promedio" valor={`${numero(resumen.nivel_antes)} → ${numero(resumen.nivel_despues)}`} detalle="Antes (diagnóstico) → después" />
              <Indicador icono="sports_esports" titulo="Actividad" valor={`${resumen.activos_7_dias} de ${resumen.alumnos} esta semana`} detalle={`${resumen.partidas_30_dias} partidas en 30 días`} />
            </div>
          ) : (
            <p className="m-0 p-space-sm rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/50 font-body-sm text-body-sm text-on-surface-variant">
              Todavía no hay alumnos que hayan terminado su diagnóstico y jugado después. Cuando pasen sus 3 primeras partidas medidas y sigan
              practicando, acá aparece cuánto mejoraron.
            </p>
          )}
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            {resumen.sin_diagnostico > 0 && `${resumen.sin_diagnostico} ${resumen.sin_diagnostico === 1 ? 'alumno todavía está' : 'alumnos todavía están'} en su diagnóstico. `}
            {resumen.sin_actividad > 0 && `${resumen.sin_actividad} ${resumen.sin_actividad === 1 ? 'no juega' : 'no juegan'} hace ${resumen.dias_sin_actividad} días o más.`}
          </p>
          <Tarjetas alumnos={alumnos} alVerInforme={alVerInforme} />
          <Tabla alumnos={alumnos} alVerInforme={alVerInforme} />
          </>
          )}
          {vista === 'competencia' && (
            <ListaDeAlumnos
              leyenda="Alumnos ordenados por Elo"
              columnas={columnasDeCompetencia}
              alumnos={porElo}
              alVerInforme={alVerInforme}
              nota="G = ganadas, E = empatadas, P = perdidas. El Elo mide resultados contra otras personas y es provisional hasta las 20 partidas; las amistosas no lo mueven. Es para el docente: no lo compartas con el grupo si no querés compararlos."
            />
          )}
          {vista === 'constancia' && (
            <ListaDeAlumnos
              leyenda="Alumnos ordenados de los que hace más tiempo que no juegan a los que están al día"
              columnas={columnasDeConstancia}
              alumnos={porConstancia}
              alVerInforme={alVerInforme}
              nota={`Al día: jugó en los últimos 7 días. Se está alejando: de 8 a ${resumen.dias_sin_actividad - 1} días. Hace tiempo que no juega: ${resumen.dias_sin_actividad} días o más.`}
            />
          )}
          </div>
        </>
      )}
    </section>
  );
}
