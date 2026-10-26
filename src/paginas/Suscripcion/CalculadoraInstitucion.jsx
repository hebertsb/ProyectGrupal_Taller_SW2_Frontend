import { useEffect, useState } from 'react';
import { obtenerCatalogoSuscripcion } from '../../api/backend';
import { CLASE_ETIQUETA, CLASE_INPUT, NOMBRE_DEL_CICLO, bs } from './comunes';

/**
 * Para presupuestar en una visita: se escribe cuántos alumnos tiene la institución y se ve qué plan le corresponde, cuánto paga por cada ciclo,
 * cuánto es por alumno y por mes y cuánto ahorra pagando por adelantado. Usa los mismos precios del catálogo que ve el director al pagar.
 */
export default function CalculadoraInstitucion() {
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState(null);
  const [alumnos, setAlumnos] = useState('40');

  useEffect(() => {
    let vigente = true;
    obtenerCatalogoSuscripcion()
      .then((datos) => vigente && setCatalogo(datos))
      .catch((err) => vigente && setError(err.message || 'No se pudieron cargar los planes.'));
    return () => {
      vigente = false;
    };
  }, []);

  const cantidad = Number.parseInt(alumnos, 10);
  const valida = Number.isInteger(cantidad) && cantidad >= 1;
  const plan = valida ? catalogo?.planes.find((p) => p.tope_alumnos >= cantidad) : null;
  const mayorPlan = catalogo?.planes[catalogo.planes.length - 1];

  return (
    <section aria-label="Calculadora para presupuestar" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Calculadora para presupuestar</h2>
      <div className="flex flex-col gap-1 max-w-xs">
        <label htmlFor="calc-alumnos" className={CLASE_ETIQUETA}>Alumnos de la institución</label>
        <input id="calc-alumnos" type="number" inputMode="numeric" min="1" max="10000" value={alumnos} onChange={(e) => setAlumnos(e.target.value)} className={CLASE_INPUT} />
      </div>

      {error && <div role="alert" className="p-space-sm rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      {!catalogo && !error && <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando los precios…</span>}

      {catalogo && valida && !plan && (
        <p className="m-0 p-space-sm rounded-lg bg-tertiary-container text-tertiary font-body-sm text-body-sm">
          {cantidad} alumnos pasan el tope del plan más grande ({mayorPlan.tope_alumnos}). Hay que armar un plan a medida con la institución.
        </p>
      )}

      {plan && (
        <>
          <p className="m-0 font-body-sm text-body-sm text-on-surface">
            Le corresponde <strong>{plan.nombre}</strong>. Los primeros <strong>{catalogo.dias_de_prueba} días son gratis</strong>.
          </p>
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
            {plan.precios.map((p) => (
              <li key={p.ciclo} className="flex flex-col gap-0.5 p-space-sm rounded-xl bg-surface-container min-w-0">
                <span className={CLASE_ETIQUETA}>{NOMBRE_DEL_CICLO[p.ciclo]}</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{bs(p.precio_bs)}</span>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                  {bs(p.equivalente_mensual_bs)} al mes · {bs(Math.round((p.equivalente_mensual_bs / cantidad) * 100) / 100)} por alumno al mes
                </span>
                {p.ahorro_bs > 0 && <span className="font-mono-micro text-mono-micro text-primary">Ahorra {bs(p.ahorro_bs)} frente a pagar mes a mes</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
