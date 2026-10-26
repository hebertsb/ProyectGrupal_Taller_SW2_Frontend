import { useCallback, useEffect, useState } from 'react';
import { obtenerCatalogoSuscripcion, obtenerMiSuscripcion } from '../../api/backend';
import ModalPago from './ModalPago';
import { BOTON_PRINCIPAL, CLASE_ETIQUETA, ESTADOS, ESTADOS_PAGO, NOMBRE_DEL_CICLO, bs, fechaCorta, plural } from './comunes';

/** Cuánto del plan está usando la institución. */
function Uso({ alumnos, tope, vencida }) {
  const porcentaje = Math.min(100, Math.round((alumnos / Math.max(tope, 1)) * 100));
  const casiLleno = porcentaje >= 90;
  return (
    <div className="flex flex-col gap-space-2xs">
      <div className="flex items-baseline justify-between gap-space-sm">
        <span className={CLASE_ETIQUETA}>Alumnos</span>
        <span className="font-mono-metric text-mono-metric text-on-surface">{alumnos} / {tope}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tope}
        aria-valuenow={alumnos}
        aria-label={`${alumnos} de ${tope} alumnos`}
        className="h-2 rounded-full bg-surface-container-high overflow-hidden"
      >
        <div className={`h-full rounded-full ${casiLleno ? 'bg-error' : 'bg-primary'}`} style={{ width: `${porcentaje}%` }} />
      </div>
      {vencida ? (
        <span className="font-mono-micro text-mono-micro text-error">Con la suscripción vencida no pueden entrar alumnos nuevos.</span>
      ) : casiLleno ? (
        <span className="font-mono-micro text-mono-micro text-error">
          {alumnos >= tope ? 'Llegaron al límite: no pueden entrar alumnos nuevos.' : 'Casi llegan al límite del plan.'} Elegí un plan más grande si lo necesitás.
        </span>
      ) : (
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">Docentes y cursos ilimitados.</span>
      )}
    </div>
  );
}

/** La suscripción de la institución del administrador: estado, uso del plan, elección de plan y ciclo, pago e historial. */
export default function MiSuscripcion() {
  const [datos, setDatos] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [ciclo, setCiclo] = useState('mensual');
  const [pagando, setPagando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [mia, planes] = await Promise.all([obtenerMiSuscripcion(), obtenerCatalogoSuscripcion()]);
      setDatos(mia);
      setCatalogo(planes);
      setPlan((actual) => actual ?? mia.plan);
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu suscripción.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const estado = datos ? ESTADOS[datos.estado] : null;
  const planElegido = catalogo?.planes.find((p) => p.plan === plan);
  const opcion = planElegido?.precios.find((o) => o.ciclo === ciclo);
  const noAlcanza = datos && planElegido && datos.alumnos > planElegido.tope_alumnos;

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[24px] text-primary shrink-0" aria-hidden="true">workspace_premium</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi suscripción</h1>
        </div>
        {estado && (
          <span className={`shrink-0 flex items-center gap-1 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${estado.clase}`}>
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{estado.icono}</span>
            {estado.texto}
          </span>
        )}
      </div>

      {error && <div role="alert" className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>}
      {aviso && (
        <div role="status" className="flex items-center justify-between gap-space-sm px-space-md py-space-sm rounded-xl bg-primary/10 border border-primary/30 text-on-surface font-body-sm text-body-sm">
          <span className="min-w-0 break-words">{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {!datos && !error && (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Cargando…</span>
        </div>
      )}

      {datos && catalogo && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg items-start">
          <div className="flex flex-col gap-space-md min-w-0">
            <section className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md" aria-label="Estado de la suscripción">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{datos.institucion_nombre}</h2>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                  {datos.plan_nombre} · {bs(datos.precio_mensual_bs)} al mes
                </span>
              </div>
              <p className="m-0 font-body-sm text-body-sm text-on-surface">
                {datos.estado === 'prueba' && (
                  <>
                    Te quedan <strong>{plural(datos.dias_restantes, 'día', 'días')}</strong> de prueba gratis (hasta el {fechaCorta(datos.prueba_hasta)}).
                    {' '}Si pagás antes, el período pagado empieza cuando termina la prueba: no perdés ningún día.
                  </>
                )}
                {datos.estado === 'activa' && (
                  <>
                    Cubierta hasta el <strong>{fechaCorta(datos.vigente_hasta)}</strong> ({plural(datos.dias_restantes, 'día', 'días')}). Ciclo {NOMBRE_DEL_CICLO[datos.ciclo].toLowerCase()}.
                    {new Date(datos.prueba_hasta) > new Date() && <> Incluye la prueba gratis que te quedaba, hasta el {fechaCorta(datos.prueba_hasta)}.</>}
                  </>
                )}
                {datos.estado === 'vencida' && <>Terminó el {fechaCorta(datos.vigente_hasta ?? datos.prueba_hasta)}. Tus alumnos siguen jugando, pero no entran nuevos hasta que pagues.</>}
              </p>
              <Uso alumnos={datos.alumnos} tope={datos.tope_alumnos} vencida={datos.estado === 'vencida'} />
            </section>

            <section aria-label="Historial de pagos" className="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-xl shadow-md">
              <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Tus pagos</h2>
              {datos.pagos.length === 0 ? (
                <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no avisaste ningún pago.</p>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
                  {datos.pagos.map((pago) => (
                    <li key={pago.id} className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs p-space-xs rounded-lg bg-surface-container min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm text-on-surface">
                          {bs(pago.monto_bs)} · {NOMBRE_DEL_CICLO[pago.ciclo]}
                        </span>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                          {fechaCorta(pago.creado_en)}
                          {pago.referencia ? ` · ${pago.referencia}` : ''}
                          {pago.nota ? ` · ${pago.nota}` : ''}
                        </span>
                      </div>
                      <span className={`shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${ESTADOS_PAGO[pago.estado].clase}`}>
                        {ESTADOS_PAGO[pago.estado].texto}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-label="Elegir plan y ciclo" className="flex flex-col gap-space-md bg-surface-container-low p-space-md rounded-xl shadow-md min-w-0">
            <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">{datos.estado === 'activa' ? 'Renovar o cambiar de plan' : 'Elegí tu plan'}</h2>

            <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs">
              <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>Plan</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
                {catalogo.planes.map((p) => (
                  <label
                    key={p.plan}
                    className={`flex flex-col gap-1 p-space-sm rounded-xl border cursor-pointer min-h-11 focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
                      plan === p.plan ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    <input type="radio" name="plan" value={p.plan} checked={plan === p.plan} onChange={() => setPlan(p.plan)} className="sr-only" />
                    <span className="font-body-sm text-body-sm font-medium text-on-surface">{p.nombre}</span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant">{bs(p.precios[0].precio_bs)} al mes</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs">
              <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>Cuánto tiempo pagás</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                {planElegido?.precios.map((o) => (
                  <label
                    key={o.ciclo}
                    className={`flex flex-col gap-1 p-space-sm rounded-xl border cursor-pointer min-h-11 focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
                      ciclo === o.ciclo ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-container hover:bg-surface-container-high'
                    }`}
                  >
                    <input type="radio" name="ciclo" value={o.ciclo} checked={ciclo === o.ciclo} onChange={() => setCiclo(o.ciclo)} className="sr-only" />
                    <span className="font-body-sm text-body-sm font-medium text-on-surface">{NOMBRE_DEL_CICLO[o.ciclo]}</span>
                    <span className="font-mono-metric text-mono-metric text-on-surface">{bs(o.precio_bs)}</span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant">{bs(o.equivalente_mensual_bs)} por mes</span>
                    {o.ahorro_bs > 0 && <span className="font-mono-micro text-mono-micro text-primary">Ahorrás {bs(o.ahorro_bs)}</span>}
                  </label>
                ))}
              </div>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                El trimestral tiene 10 % de descuento y el anual son 2 meses gratis. Precios de lanzamiento, en etapa piloto.
              </p>
            </fieldset>

            {noAlcanza && (
              <div role="alert" className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm">
                Hoy tenés {datos.alumnos} alumnos y ese plan cubre hasta {planElegido.tope_alumnos}. Elegí el plan más grande.
              </div>
            )}

            {datos.pago_pendiente ? (
              <div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-tertiary-container text-tertiary font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">schedule</span>
                Tenés un pago esperando confirmación de la plataforma. Cuando lo confirme, tu suscripción se extiende.
              </div>
            ) : (
              <button type="button" onClick={() => setPagando(true)} disabled={!opcion || noAlcanza} className={`${BOTON_PRINCIPAL} self-start`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">qr_code_2</span>
                Pagar {opcion ? bs(opcion.precio_bs) : ''}
              </button>
            )}
          </section>
        </div>
      )}

      {pagando && opcion && (
        <ModalPago
          institucion={datos.institucion_nombre}
          plan={plan}
          ciclo={ciclo}
          monto={opcion.precio_bs}
          alCerrar={() => setPagando(false)}
          alAvisar={() => {
            setPagando(false);
            setAviso('Avisamos a la plataforma. Apenas confirme el pago, tu suscripción se extiende.');
            cargar();
          }}
        />
      )}
    </div>
  );
}
