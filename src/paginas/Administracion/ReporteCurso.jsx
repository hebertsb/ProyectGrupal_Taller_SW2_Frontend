import { useEffect, useState } from 'react';
import { obtenerReporteCurso } from '../../api/backend';
import { InsigniaProvisional, InsigniaRango } from '../../componentes/InsigniaNivel';
import { textoUltimaActividad } from '../../formatoTiempo';

const BOTON_ACTUALIZAR =
  'flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

const ENCABEZADO_TABLA =
  'px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-medium';
const CELDA_TABLA = 'px-space-sm py-space-xs align-middle font-body-sm text-body-sm text-on-surface';

/* ---------- Formato de números (puro, sin DOM) ---------- */

/** "40", "40,4": hasta un decimal, y solo si hace falta. */
function numeroCorto(valor) {
  return valor.toLocaleString('es-BO', { maximumFractionDigits: 1 });
}

/** "1,5", "2,0": siempre con un decimal. `—` si no hay dato. */
function numeroConUnDecimal(valor) {
  if (valor == null) return '—';
  return valor.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "7 de 10 · 70 %" (alumnos que jugaron esta semana sobre el total, y su porcentaje si el backend lo mandó). */
function textoActivos(resumen, totalAlumnos) {
  const partes = [`${resumen.alumnos_activos_7_dias ?? 0} de ${totalAlumnos}`];
  if (resumen.porcentaje_activos != null) partes.push(`${Math.round(resumen.porcentaje_activos)} %`);
  return partes.join(' · ');
}

/**
 * "40 % → 70 %". Solo hay valor si el backend pudo comparar dos semanas distintas (`variacion_precision` no nula);
 * si toda la actividad cayó en la misma semana, mostrar dos precisiones iguales sería engañoso.
 */
function textoPrecisionSemanas(resumen) {
  const primera = resumen.precision_primera_semana;
  const ultima = resumen.precision_ultima_semana;
  if (resumen.variacion_precision == null || primera == null || ultima == null) return '—';
  return `${numeroCorto(primera)} % → ${numeroCorto(ultima)} %`;
}

/** Cómo se cuenta el cambio de precisión: ícono, texto con signo y una palabra (nunca solo color). */
function describirVariacion(variacion) {
  const decimas = Math.round(variacion * 10);
  if (decimas === 0) {
    return { icono: 'trending_flat', texto: '0 puntos', palabra: 'sin cambios', clase: 'text-on-surface-variant' };
  }
  const puntos = Math.abs(decimas) / 10;
  const unidad = puntos === 1 ? 'punto' : 'puntos';
  if (decimas > 0) {
    return { icono: 'trending_up', texto: `+${numeroCorto(puntos)} ${unidad}`, palabra: 'mejoró', clase: 'text-primary' };
  }
  return {
    icono: 'trending_down',
    texto: `−${numeroCorto(puntos)} ${unidad}`,
    palabra: 'bajó',
    clase: 'text-tertiary-fixed-dim',
  };
}

function textoPrecisionAlumno(alumno) {
  return alumno.precision != null ? `${Math.round(alumno.precision)} %` : '—';
}

/* ---------- Piezas chicas ---------- */

function AvisoError({ mensaje }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-space-xs px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        error
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

function Cargando({ texto }) {
  return (
    <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

function Indicador({ icono, titulo, valor, children = null }) {
  return (
    <div className="flex flex-col gap-1 p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20 min-w-0">
      <span className="flex items-start gap-1.5 font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
        <span className="material-symbols-outlined text-primary text-[16px] shrink-0" aria-hidden="true">
          {icono}
        </span>
        <span className="leading-tight min-w-0 break-words">{titulo}</span>
      </span>
      <span className="font-headline-sm text-headline-sm text-on-surface break-words">{valor}</span>
      {children && <div className="font-body-sm text-[12px] text-on-surface-variant break-words">{children}</div>}
    </div>
  );
}

/** Cambio de precisión entre la primera y la última semana, con ícono y texto (no solo color). */
function VariacionPrecision({ variacion }) {
  if (variacion == null) return <span>Todavía no hay dos semanas con datos</span>;
  const { icono, texto, palabra, clase } = describirVariacion(variacion);
  return (
    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span className={`inline-flex items-center gap-1 font-medium ${clase}`}>
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          {icono}
        </span>
        {texto}
      </span>
      <span>({palabra})</span>
    </span>
  );
}

/** Nivel (número), rango y marca de provisional de un alumno; `—` si todavía no tiene nivel. */
function NivelAlumno({ alumno }) {
  if (alumno.nivel == null) {
    return (
      <span className="text-on-surface-variant">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin nivel</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-space-2xs">
      <span className="font-mono-metric text-mono-metric font-bold text-on-surface">{alumno.nivel}</span>
      <InsigniaRango rango={alumno.rango} />
      {!alumno.confirmado && <InsigniaProvisional />}
    </span>
  );
}

/** Marca de un alumno con la cuenta desactivada: ícono y texto, además del color. */
function ChipInactivo() {
  return (
    <span
      className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-error-container text-error font-mono-micro text-mono-micro tracking-wide uppercase font-medium whitespace-nowrap"
      title="La cuenta de este alumno está desactivada."
    >
      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
        person_off
      </span>
      Inactivo
    </span>
  );
}

function Dato({ etiqueta, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 px-space-xs py-space-2xs rounded-lg bg-surface-container-low">
      <dt className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant break-words">
        {etiqueta}
      </dt>
      <dd className="m-0 font-mono-metric text-mono-metric text-on-surface">{children}</dd>
    </div>
  );
}

/** Alumnos como tarjetas apiladas: el formato para pantallas (o tarjetas de curso) angostas. */
function AlumnosComoTarjetas({ alumnos }) {
  return (
    <ul aria-label="Alumnos del curso" className="@2xl:hidden m-0 p-0 list-none flex flex-col gap-space-xs">
      {alumnos.map((alumno) => (
        <li
          key={alumno.id}
          className={`flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-lowest min-w-0 ${
            alumno.activo ? 'border border-outline-variant/20' : 'border border-dashed border-outline-variant/50'
          }`}
        >
          <div className="flex flex-wrap items-start gap-x-space-sm gap-y-space-2xs min-w-0">
            <span className="shrink-0 min-w-10 h-10 px-space-2xs rounded-full flex items-center justify-center border border-outline-variant/40 bg-surface-container-high text-on-surface-variant font-mono-metric text-mono-metric font-bold">
              <span className="sr-only">{alumno.puesto != null ? 'Puesto ' : 'Sin puesto'}</span>
              {alumno.puesto != null && <span>{alumno.puesto}</span>}
              {alumno.puesto == null && <span aria-hidden="true">—</span>}
            </span>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">
                {alumno.nombre}
              </span>
              <NivelAlumno alumno={alumno} />
              {!alumno.activo && (
                <span className="self-start">
                  <ChipInactivo />
                </span>
              )}
            </div>
          </div>

          <dl className="m-0 grid grid-cols-3 gap-space-xs">
            <Dato etiqueta="Precisión">{textoPrecisionAlumno(alumno)}</Dato>
            <Dato etiqueta="Partidas">{alumno.partidas}</Dato>
            <Dato etiqueta="En 7 días">{alumno.partidas_7_dias}</Dato>
          </dl>

          <p className="m-0 flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">
              schedule
            </span>
            <span className="min-w-0 break-words">
              Última partida: <strong className="text-on-surface">{textoUltimaActividad(alumno.ultima_partida)}</strong>
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Alumnos como tabla normal: solo cuando hay ancho de sobra (ver `@2xl` en el contenedor). */
function AlumnosComoTabla({ alumnos }) {
  return (
    <div className="hidden @2xl:block overflow-x-auto rounded-xl border border-outline-variant/20">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Alumnos del curso, ordenados por puesto</caption>
        <thead>
          <tr className="bg-surface-container-low">
            <th scope="col" className={ENCABEZADO_TABLA}>
              Puesto
            </th>
            <th scope="col" className={ENCABEZADO_TABLA}>
              Alumno
            </th>
            <th scope="col" className={ENCABEZADO_TABLA}>
              Nivel
            </th>
            <th scope="col" className={`${ENCABEZADO_TABLA} text-right`}>
              Precisión
            </th>
            <th scope="col" className={`${ENCABEZADO_TABLA} text-right`}>
              Partidas
            </th>
            <th scope="col" className={`${ENCABEZADO_TABLA} text-right`}>
              En 7 días
            </th>
            <th scope="col" className={ENCABEZADO_TABLA}>
              Última partida
            </th>
          </tr>
        </thead>
        <tbody>
          {alumnos.map((alumno) => (
            <tr key={alumno.id} className="border-t border-outline-variant/20">
              <td className={`${CELDA_TABLA} font-mono-metric text-mono-metric font-bold text-on-surface-variant`}>
                {alumno.puesto != null ? alumno.puesto : '—'}
                {alumno.puesto == null && <span className="sr-only">Sin puesto</span>}
              </td>
              <td className={CELDA_TABLA}>
                <span className="flex flex-wrap items-center gap-x-space-xs gap-y-1">
                  <span className="font-medium break-words min-w-0">{alumno.nombre}</span>
                  {!alumno.activo && <ChipInactivo />}
                </span>
              </td>
              <td className={CELDA_TABLA}>
                <NivelAlumno alumno={alumno} />
              </td>
              <td className={`${CELDA_TABLA} text-right font-mono-metric text-mono-metric whitespace-nowrap`}>
                {textoPrecisionAlumno(alumno)}
              </td>
              <td className={`${CELDA_TABLA} text-right font-mono-metric text-mono-metric`}>{alumno.partidas}</td>
              <td className={`${CELDA_TABLA} text-right font-mono-metric text-mono-metric`}>{alumno.partidas_7_dias}</td>
              <td className={`${CELDA_TABLA} whitespace-nowrap`}>{textoUltimaActividad(alumno.ultima_partida)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Reporte de un curso para su facilitador: los tres indicadores de la prueba piloto (participación, práctica y
 * aprendizaje) y una fila por alumno. Se monta recién al desplegarlo, así que pide el reporte al abrirse; después
 * solo se actualiza con el botón (sin sondeo). Las dos vistas de alumnos (tarjetas y tabla) dependen del ancho del
 * propio reporte (`@container`), no de la pantalla: la tarjeta del curso puede ser angosta aun en un monitor grande.
 */
export default function ReporteCurso({ cursoId }) {
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [actualizadoEn, setActualizadoEn] = useState(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    obtenerReporteCurso(cursoId)
      .then((datos) => {
        if (!vigente) return;
        setReporte(datos);
        setActualizadoEn(new Date());
      })
      .catch((err) => {
        if (vigente) setError(err.message || 'No se pudo cargar el reporte del curso.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [cursoId, recarga]);

  const alumnos = reporte?.alumnos ?? [];
  const resumen = reporte?.resumen ?? null;
  const totalAlumnos = reporte?.curso?.alumnos ?? alumnos.length;
  const horaActualizado = actualizadoEn
    ? actualizadoEn.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="@container flex flex-col gap-space-sm pt-space-xs border-t border-outline-variant/20 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <div className="flex flex-col min-w-0">
          <h4 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">Reporte del curso</h4>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            Últimos 7 días{horaActualizado ? ` · actualizado a las ${horaActualizado}` : ''}
          </span>
        </div>
        <button type="button" onClick={() => setRecarga((n) => n + 1)} disabled={cargando} className={BOTON_ACTUALIZAR}>
          <span
            className={`material-symbols-outlined text-[16px] text-primary ${cargando ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          >
            refresh
          </span>
          {cargando && reporte ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={error} />
          <button
            type="button"
            onClick={() => setRecarga((n) => n + 1)}
            disabled={cargando}
            className={`${BOTON_ACTUALIZAR} self-start`}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {cargando && reporte === null && <Cargando texto="Cargando el reporte…" />}

      {reporte && alumnos.length === 0 && (
        <p className="m-0 font-body-sm text-body-sm text-outline">Todavía no hay alumnos en este curso.</p>
      )}

      {reporte && resumen && alumnos.length > 0 && (
        <div aria-busy={cargando} className="flex flex-col gap-space-sm min-w-0">
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-space-xs">
            <Indicador icono="groups" titulo="Alumnos activos (7 días)" valor={textoActivos(resumen, totalAlumnos)}>
              Jugaron al menos una partida en la semana
            </Indicador>
            <Indicador
              icono="sports_esports"
              titulo="Partidas por alumno (7 días)"
              valor={numeroConUnDecimal(resumen.partidas_por_alumno_semana)}
            >
              Promedio del curso
            </Indicador>
            <Indicador
              icono="monitoring"
              titulo="Precisión primera semana → última"
              valor={textoPrecisionSemanas(resumen)}
            >
              <VariacionPrecision variacion={resumen.variacion_precision} />
            </Indicador>
            <Indicador icono="date_range" titulo="Partidas en 7 días" valor={resumen.partidas_7_dias ?? 0}>
              Entre todos los alumnos
            </Indicador>
          </div>

          <AlumnosComoTarjetas alumnos={alumnos} />
          <AlumnosComoTabla alumnos={alumnos} />
        </div>
      )}
    </div>
  );
}
