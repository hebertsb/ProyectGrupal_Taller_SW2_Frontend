import { useEffect, useState } from 'react';
import { TENDENCIAS, haceCuanto, numero, porcentaje, puntos } from './comunes';

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

/**
 * El antes y el después de un grupo de alumnos (un curso o toda una institución): cuántos mejoraron desde su diagnóstico y cuánto, y una
 * fila por alumno con un botón para abrir su informe. `cargar` devuelve la respuesta de `/progreso/...`; `recarga` cambia para volver a pedirla.
 */
export default function AntesDespuesGrupo({ cargar, titulo = 'Antes y después', recarga = 0, alVerInforme = null }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

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
    </section>
  );
}
