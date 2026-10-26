import { useCallback, useEffect, useState } from 'react';
import { obtenerProgresoCurso } from '../../../api/backend';
import { enlaceWhatsApp } from '../../../whatsapp';
import { enlaceCorreoFamilia } from '../../../contactoFamilia';
import { BOTON_NEUTRO, fechaCorta } from '../../Suscripcion/comunes';

const DIAS_SIN_JUGAR = 7;
const NOMBRE_TENDENCIA = { mejora: 'Mejora', estable: 'Estable', baja: 'Bajó', sin_comparacion: 'Sin comparar todavía' };

/** Por qué un alumno necesita que el docente le escriba: `[{ clave, texto }]` (vacío = va bien). */
export function motivosDeAtencion(fila) {
  if (!fila.activo) return [];
  const motivos = [];
  if (fila.dias_sin_jugar == null) motivos.push({ clave: 'nunca', texto: 'Todavía no jugó ninguna partida' });
  else if (fila.dias_sin_jugar >= DIAS_SIN_JUGAR) motivos.push({ clave: 'inactivo', texto: `${fila.dias_sin_jugar} días sin jugar` });
  if (fila.tendencia === 'baja') motivos.push({ clave: 'baja', texto: 'Su nivel bajó' });
  if (fila.dias_sin_jugar != null && fila.calibradas === 0) motivos.push({ clave: 'sin_medir', texto: 'Sin nivel medido' });
  return motivos;
}

/** El texto con el que el docente le escribe a la familia: amable, concreto y sin datos del alumno que no hagan falta. */
export function mensajeParaLaFamilia(fila, curso, motivos) {
  const saludo = `Hola${fila.tutor_nombre ? ` ${fila.tutor_nombre}` : ''}, le escribe ${curso.facilitador_nombre}, docente de ajedrez (curso ${curso.nombre}). `;
  if (motivos.some((m) => m.clave === 'nunca')) {
    return `${saludo}${fila.nombre} todavía no jugó su primera partida en ChessIA. ¿Lo podemos ayudar a empezar? Puede entrar desde el celular o la computadora.`;
  }
  if (motivos.some((m) => m.clave === 'inactivo')) {
    return `${saludo}${fila.nombre} lleva ${fila.dias_sin_jugar} días sin practicar ajedrez en ChessIA. ¿Podemos ayudarlo a retomar? Unos minutos por día le sirven mucho.`;
  }
  return `${saludo}Quería comentarle cómo viene ${fila.nombre} con el ajedrez en ChessIA y ver cómo podemos apoyarlo.`;
}

/**
 * Seguimiento a distancia del curso: quiénes necesitan que el docente les escriba (hace días que no juegan, bajaron o nunca empezaron) con un botón de WhatsApp a su
 * familia, y cómo va cada alumno. Reemplaza el «¿cómo les va?» que antes se veía en clase.
 */
export default function PestanaSeguimiento({ curso }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerProgresoCurso(curso.id));
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el seguimiento.');
    }
  }, [curso.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>;
  if (!datos) return <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Cargando seguimiento…</p>;

  const filas = datos.alumnos.map((fila) => ({ fila, motivos: motivosDeAtencion(fila) }));
  const atencion = filas.filter((f) => f.motivos.length > 0);
  const { resumen } = datos;

  return (
    <div className="flex flex-col gap-space-md">
      <dl className="m-0 grid grid-cols-2 lg:grid-cols-4 gap-space-xs">
        {[
          ['Alumnos', resumen.alumnos],
          [`Jugaron esta semana`, `${resumen.activos_7_dias} de ${resumen.alumnos}`],
          ['Partidas en 30 días', resumen.partidas_30_dias],
          ['Mejoraron', resumen.porcentaje_mejoraron != null ? `${resumen.porcentaje_mejoraron} %` : '—'],
        ].map(([titulo, valor]) => (
          <div key={titulo} className="flex flex-col gap-space-2xs p-space-sm rounded-xl bg-surface-container-low">
            <dt className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{titulo}</dt>
            <dd className="m-0 font-headline-sm text-headline-sm text-on-surface">{valor}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Necesitan atención" className="flex flex-col gap-space-xs">
        <h3 className="m-0 font-body-md text-body-md font-medium text-on-surface flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-tertiary" aria-hidden="true">notification_important</span>
          Necesitan que les escribas ({atencion.length})
        </h3>
        {atencion.length === 0 ? (
          <p className="m-0 p-space-sm rounded-xl bg-primary/10 border border-primary/30 font-body-sm text-body-sm text-on-surface">
            Todos tus alumnos activos vienen jugando. Cuando alguien se quede atrás, aparece acá con un botón para avisarle a su familia.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
            {atencion.map(({ fila, motivos }) => {
              const enlace = enlaceWhatsApp(fila.tutor_telefono, mensajeParaLaFamilia(fila, curso, motivos));
              return (
                <li key={fila.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-xs p-space-sm rounded-xl bg-tertiary/10 border border-tertiary/30 min-w-0">
                  <div className="flex flex-col gap-space-2xs min-w-0">
                    <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{fila.nombre}</span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant">{motivos.map((m) => m.texto).join(' · ')}</span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                      {fila.tutor_nombre || fila.tutor_telefono || fila.tutor_email ? `Familia: ${fila.tutor_nombre ?? 'sin nombre'}${fila.tutor_telefono ? ` · ${fila.tutor_telefono}` : ''}${fila.tutor_email ? ` · ${fila.tutor_email}` : ''}` : 'Sin contacto de la familia cargado'}
                    </span>
                  </div>
                  {fila.tutor_email && <a href={enlaceCorreoFamilia(fila.tutor_email, mensajeParaLaFamilia(fila, curso, motivos))} className={`${BOTON_NEUTRO} no-underline shrink-0`}>Correo a la familia</a>}
                  {enlace ? (
                    <a href={enlace} target="_blank" rel="noopener noreferrer" className={`${BOTON_NEUTRO} no-underline shrink-0`} aria-label={`Escribirle por WhatsApp a la familia de ${fila.nombre}`}>
                      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">chat</span>
                      Avisar a la familia
                    </a>
                  ) : !fila.tutor_email && (
                    <span className="font-mono-micro text-mono-micro text-outline shrink-0">Cargá el teléfono en «Alumnos»</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Todo el curso" className="flex flex-col gap-space-xs">
        <h3 className="m-0 font-body-md text-body-md font-medium text-on-surface">Cómo va cada alumno</h3>
        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full min-w-[34rem] border-collapse font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-high text-left font-mono-micro text-mono-micro uppercase text-on-surface-variant">
                <th scope="col" className="px-space-sm py-space-xs">Alumno</th>
                <th scope="col" className="px-space-sm py-space-xs">Nivel</th>
                <th scope="col" className="px-space-sm py-space-xs">Evolución</th>
                <th scope="col" className="px-space-sm py-space-xs text-right">Partidas (30 d)</th>
                <th scope="col" className="px-space-sm py-space-xs">Última</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ fila }) => (
                <tr key={fila.id} className="border-t border-outline-variant/20">
                  <td className="px-space-sm py-space-xs text-on-surface break-words">{fila.nombre}{!fila.activo && <span className="ml-space-xs font-mono-micro text-mono-micro text-outline">(inactivo)</span>}</td>
                  <td className="px-space-sm py-space-xs text-on-surface-variant">{fila.rango_actual ?? 'Sin medir'}{fila.nivel_actual != null ? ` · ${fila.nivel_actual}` : ''}</td>
                  <td className="px-space-sm py-space-xs text-on-surface-variant">{NOMBRE_TENDENCIA[fila.tendencia] ?? fila.tendencia}</td>
                  <td className="px-space-sm py-space-xs text-right">{fila.partidas_30_dias}</td>
                  <td className="px-space-sm py-space-xs text-on-surface-variant">{fila.ultima_partida ? fechaCorta(fila.ultima_partida) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
