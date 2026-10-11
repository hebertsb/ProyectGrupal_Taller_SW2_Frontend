import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { obtenerEstadisticasPropias } from '../../api/backend';
import { GraficoSemanal, TarjetaVidrio } from './GraficosEstadisticas';
import { DonaResultados, PrecisionPorFase, RendimientoPorRival } from './GraficosRendimiento';

/** Mínimo de partidas jugadas para mostrar "errores más frecuentes": con menos no hay patrón. */
const PARTIDAS_PARA_TOP_ERRORES = 3;

const NOMBRE_ERROR = {
  blunder: { titulo: 'Blunders', detalle: 'regalar una pieza o permitir un mate' },
  error: { titulo: 'Errores', detalle: 'ceder una ventaja apreciable' },
  inexactitud: { titulo: 'Inexactitudes', detalle: 'una jugada algo peor que la mejor' },
};

/**
 * Compara esta semana con la anterior. Usa la precisión si las dos semanas tienen jugadas
 * analizadas; si no, cae a la cantidad de partidas. Devuelve `null` si no hay nada que comparar.
 */
export function compararConSemanaAnterior(semanas) {
  if (!Array.isArray(semanas) || semanas.length < 2) return null;
  const actual = semanas[semanas.length - 1];
  const anterior = semanas[semanas.length - 2];

  if (actual.precision != null && anterior.precision != null) {
    const diferencia = Math.round((actual.precision - anterior.precision) * 10) / 10;
    if (diferencia > 0) return { tono: 'sube', texto: `Mejoraste ${diferencia} puntos de precisión respecto a la semana pasada.` };
    if (diferencia < 0) return { tono: 'baja', texto: `Bajaste ${Math.abs(diferencia)} puntos de precisión respecto a la semana pasada.` };
    return { tono: 'igual', texto: 'Tu precisión se mantuvo igual que la semana pasada.' };
  }
  if (actual.partidas > 0 || anterior.partidas > 0) {
    return {
      tono: 'igual',
      texto: `Esta semana jugaste ${actual.partidas} ${actual.partidas === 1 ? 'partida' : 'partidas'} y la anterior ${anterior.partidas}.`,
    };
  }
  return null;
}

function Indicador({ icono, titulo, valor, detalle, resplandor }) {
  return (
    <TarjetaVidrio resplandor={resplandor} className="p-space-sm min-w-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5">
      <div className="flex flex-col gap-1">
        <span className="flex items-start gap-1.5 font-mono-micro text-[10px] uppercase tracking-wider text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-[16px] shrink-0" aria-hidden="true">{icono}</span>
          <span className="leading-tight">{titulo}</span>
        </span>
        <span className="font-headline-sm text-headline-sm text-on-surface">{valor}</span>
        {detalle && <span className="font-body-sm text-[12px] text-on-surface-variant break-words">{detalle}</span>}
      </div>
    </TarjetaVidrio>
  );
}

/** Errores más frecuentes como barras que crecen hasta su proporción; cada fila reacciona al pasar el mouse o enfocar. */
function BarrasDeErrores({ errores }) {
  const reducir = useReducedMotion();
  const mayor = Math.max(1, ...errores.map((e) => e.cantidad));
  const total = errores.reduce((suma, e) => suma + e.cantidad, 0);
  const COLOR = { blunder: 'bg-error', error: 'bg-tertiary-container', inexactitud: 'bg-secondary' };

  return (
    <ol className="flex flex-col gap-2 m-0 p-0 list-none">
      {errores.map((error, indice) => {
        const nombre = NOMBRE_ERROR[error.tipo] ?? { titulo: error.tipo, detalle: '' };
        const porcentaje = Math.round((error.cantidad / total) * 100);
        return (
          <li
            key={error.tipo}
            tabIndex={0}
            title={`${error.cantidad} jugadas: ${porcentaje}% de tus errores analizados`}
            className="group flex flex-col gap-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md transition-colors hover:bg-white/[0.09] focus-visible:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-body-sm text-body-sm text-on-surface min-w-0">
                <span className="font-mono-micro text-[11px] text-primary mr-1.5">{indice + 1}.</span>
                <strong>{nombre.titulo}</strong>
                {nombre.detalle && <span className="text-on-surface-variant"> · {nombre.detalle}</span>}
              </span>
              <span className="font-mono-metric text-mono-metric text-on-surface shrink-0">
                {error.cantidad} <span className="text-[10px] text-on-surface-variant">({porcentaje}%)</span>
              </span>
            </span>
            <span className="block h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
              <motion.span
                className={`block h-full rounded-full ${COLOR[error.tipo] ?? 'bg-primary'}`}
                initial={reducir ? false : { width: 0 }}
                animate={{ width: `${(error.cantidad / mayor) * 100}%` }}
                transition={reducir ? { duration: 0 } : { duration: 0.7, delay: 0.1 * indice, ease: 'easeOut' }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Dashboard de estadísticas personales del jugador (HU14). Los datos los calcula el backend en
 * `GET /usuario/estadisticas`; acá solo se presentan, con estados de carga, error y "todavía no
 * jugaste". Se monta recién cuando el jugador abre la sección, así no pide datos que no mira.
 */
export default function EstadisticasPersonales() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    obtenerEstadisticasPropias()
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((err) => vigente && setError(err.message || 'No se pudieron cargar tus estadísticas.'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-2 text-on-surface-variant">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
        <span className="font-mono-micro text-mono-micro">Calculando tus estadísticas…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
        {error}
      </div>
    );
  }

  const porOponente = datos.partidas_por_oponente ?? {};
  const jugadas = (porOponente.motor ?? 0) + (porOponente.modelo ?? 0);
  if (jugadas === 0) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Todavía no jugaste ninguna partida. Jugá una en la Sala de Control y acá vas a ver tu progreso.
      </p>
    );
  }

  const comparacion = compararConSemanaAnterior(datos.progreso_semanal);
  const errores = (datos.top_errores ?? []).slice(0, 3);
  const finalizadas = datos.partidas_ganadas + datos.partidas_perdidas + datos.partidas_tablas;

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-xs">
        <Indicador
          icono="sports_esports"
          resplandor="bg-primary/20"
          titulo="Partidas jugadas"
          valor={jugadas}
          detalle={`Turing: ${porOponente.modelo ?? 0} · Stockfish: ${porOponente.motor ?? 0}`}
        />
        <Indicador
          icono="emoji_events"
          resplandor="bg-primary/15"
          titulo="Victorias"
          valor={finalizadas ? `${datos.win_percent_promedio}%` : '—'}
          detalle={`${datos.partidas_ganadas} ganadas · ${datos.partidas_perdidas} perdidas · ${datos.partidas_tablas} tablas`}
        />
        <Indicador
          icono="target"
          resplandor="bg-secondary/20"
          titulo="Precisión"
          valor={datos.precision_promedio > 0 ? `${datos.precision_promedio}%` : '—'}
          detalle="Jugadas a menos de medio peón de la mejor (solo las analizadas)"
        />
        <Indicador
          icono="local_fire_department"
          resplandor="bg-error/15"
          titulo="Racha de victorias"
          valor={datos.racha_victoria_actual}
          detalle={datos.racha_victoria_actual === 1 ? 'partida ganada seguida' : 'partidas ganadas seguidas'}
        />
      </div>

      {comparacion && (
        <p
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm ${
            comparacion.tono === 'sube'
              ? 'bg-primary/10 text-primary'
              : comparacion.tono === 'baja'
                ? 'bg-tertiary-container/20 text-on-surface'
                : 'bg-surface-container-lowest text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
            {comparacion.tono === 'sube' ? 'trending_up' : comparacion.tono === 'baja' ? 'trending_down' : 'trending_flat'}
          </span>
          {comparacion.texto}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm items-start">
        <div className="lg:col-span-2 flex flex-col gap-space-sm min-w-0">
          <TarjetaVidrio className="p-space-sm" resplandor="bg-secondary/15">
            <h3 className="mb-2 font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant">Tu progreso por semana</h3>
            <GraficoSemanal semanas={datos.progreso_semanal ?? []} />
          </TarjetaVidrio>
          <TarjetaVidrio className="p-space-sm" resplandor="bg-primary/10">
            <h3 className="mb-2 font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant">Tu precisión por fase de la partida</h3>
            <PrecisionPorFase fases={datos.precision_por_fase} />
          </TarjetaVidrio>
        </div>
        <div className="flex flex-col gap-space-sm min-w-0">
          <TarjetaVidrio className="p-space-sm" resplandor="bg-primary/15">
            <h3 className="mb-2 font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant">Tus resultados</h3>
            <DonaResultados ganadas={datos.partidas_ganadas} perdidas={datos.partidas_perdidas} tablas={datos.partidas_tablas} />
          </TarjetaVidrio>
          <TarjetaVidrio className="p-space-sm" resplandor="bg-secondary/15">
            <h3 className="mb-2 font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant">Cómo te fue con cada rival</h3>
            <RendimientoPorRival resultados={datos.resultados_por_oponente} />
          </TarjetaVidrio>
        </div>
      </div>

      <TarjetaVidrio className="p-space-sm" resplandor="bg-error/10">
        <h3 className="mb-2 font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant">Tus errores más frecuentes</h3>
        {jugadas < PARTIDAS_PARA_TOP_ERRORES ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Jugá al menos {PARTIDAS_PARA_TOP_ERRORES} partidas para ver en qué te equivocás más seguido (llevás {jugadas}).
          </p>
        ) : errores.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay errores analizados: abrí el análisis de tus partidas y acá aparecen.
          </p>
        ) : (
          <BarrasDeErrores errores={errores} />
        )}
      </TarjetaVidrio>
    </div>
  );
}
