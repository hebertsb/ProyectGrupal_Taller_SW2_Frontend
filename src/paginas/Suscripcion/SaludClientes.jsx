import { useEffect, useState } from 'react';
import { obtenerSaludInstituciones } from '../../api/backend';
import { haceCuanto } from '../Progreso/comunes';
import { CLASE_ETIQUETA } from './comunes';

function Fila({ fila }) {
  return (
    <li className={`flex flex-col gap-space-xs p-space-sm rounded-xl min-w-0 ${fila.en_riesgo ? 'bg-error-container/40 border border-error/40' : 'bg-surface-container'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-space-sm gap-y-space-2xs min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{fila.nombre}</span>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            {fila.es_demostracion ? 'Demostración · ' : fila.es_prueba ? 'En evaluación · ' : ''}
            {fila.alumnos} {fila.alumnos === 1 ? 'alumno' : 'alumnos'}
          </span>
        </div>
        {fila.en_riesgo ? (
          <span className="flex items-center gap-1 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-error-container text-error">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">warning</span>
            Llamar
          </span>
        ) : (
          <span className="flex items-center gap-1 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-primary-container/30 text-primary">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
            Activa
          </span>
        )}
      </div>
      {fila.motivo_riesgo && <p className="m-0 font-body-sm text-body-sm text-error">{fila.motivo_riesgo}</p>}
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
        <Dato etiqueta="Jugaron (7 días)" valor={`${fila.activos_7_dias} de ${fila.alumnos}`} />
        <Dato etiqueta="Jugaron (30 días)" valor={`${fila.activos_30_dias} de ${fila.alumnos}`} />
        <Dato etiqueta="Mejoraron" valor={fila.comparables > 0 ? `${fila.mejoraron} de ${fila.comparables}${fila.porcentaje_mejoraron != null ? ` · ${fila.porcentaje_mejoraron} %` : ''}` : 'Sin comparar'} />
        <Dato etiqueta="Última partida" valor={fila.alumnos === 0 ? '—' : haceCuanto(fila.dias_sin_actividad)} />
      </dl>
    </li>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant break-words">{etiqueta}</dt>
      <dd className="m-0 font-mono-metric text-mono-metric text-on-surface break-words">{valor}</dd>
    </div>
  );
}

/**
 * Qué tan vivas están las instituciones clientes: si sus alumnos juegan y si mejoran. Una institución que paga pero cuyos alumnos no
 * juegan es la que no va a renovar; las que están en riesgo van primero, con el motivo, para saber a quién llamar.
 */
export default function SaludClientes() {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    obtenerSaludInstituciones()
      .then((lista) => vigente && setFilas(lista))
      .catch((err) => vigente && setError(err.message || 'No se pudo cargar la salud de las instituciones.'));
    return () => {
      vigente = false;
    };
  }, []);

  const enRiesgo = filas?.filter((f) => f.en_riesgo).length ?? 0;
  return (
    <section aria-label="Salud de las instituciones" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <div className="flex flex-wrap items-baseline justify-between gap-space-xs">
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Salud de los clientes</h2>
        {filas && <span className={CLASE_ETIQUETA}>{enRiesgo > 0 ? `${enRiesgo} para llamar` : 'Todas andan bien'}</span>}
      </div>
      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        Una institución que paga pero cuyos alumnos no juegan es la que no renueva. Acá ves a tiempo cuál es.
      </p>
      {error && <div role="alert" className="p-space-sm rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      {!filas && !error && <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando…</span>}
      {filas && filas.length === 0 && <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay instituciones.</p>}
      {filas && filas.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {filas.map((fila) => (
            <Fila key={fila.institucion_id} fila={fila} />
          ))}
        </ul>
      )}
    </section>
  );
}
