import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cargarDemostracionSuscripciones,
  confirmarPagoSuscripcion,
  listarPagosSuscripciones,
  listarSuscripciones,
  obtenerIngresos,
  quitarDemostracionSuscripciones,
  rechazarPagoSuscripcion,
} from '../../api/backend';
import CalculadoraInstitucion from './CalculadoraInstitucion';
import ListaInstituciones from './ListaInstituciones';
import ListaPagos from './ListaPagos';
import PagoPendiente from './PagoPendiente';
import SaludClientes from './SaludClientes';
import { BOTON_NEUTRO, CLASE_ETIQUETA, CLASE_INPUT, bs, plural } from './comunes';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Dato({ icono, valor, titulo, detalle }) {
  return (
    <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container-low shadow-md min-w-0">
      <span className="material-symbols-outlined text-[26px] text-primary shrink-0" aria-hidden="true">{icono}</span>
      <div className="flex flex-col min-w-0">
        <span className="font-mono-metric text-mono-metric text-on-surface break-words">{valor}</span>
        <span className={CLASE_ETIQUETA}>{titulo}</span>
        {detalle && <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">{detalle}</span>}
      </div>
    </div>
  );
}

/** Barras de lo cobrado en los últimos 12 meses. Lo real y lo de demostración se dibujan distinto, para no confundirlos. */
function GraficoDeMeses({ meses }) {
  const maximo = Math.max(1, ...meses.map((m) => m.real_bs + m.demostracion_bs));
  const total = meses.reduce((suma, m) => suma + m.real_bs, 0);
  const totalDemo = meses.reduce((suma, m) => suma + m.demostracion_bs, 0);
  return (
    <div className="flex flex-col gap-space-xs">
      <div
        role="img"
        aria-label={`Lo cobrado en los últimos 12 meses: ${bs(total)} reales${totalDemo ? ` y ${bs(totalDemo)} de demostración` : ''}`}
        className="grid grid-cols-12 gap-1 items-end h-40"
      >
        {meses.map((m) => {
          const [anio, mes] = m.mes.split('-');
          return (
            <div
              key={m.mes}
              className="flex flex-col items-center justify-end gap-1 h-full min-w-0"
              title={`${MESES_CORTOS[Number(mes) - 1]} ${anio}: ${bs(m.real_bs)}${m.demostracion_bs ? ` (+ ${bs(m.demostracion_bs)} demostración)` : ''}`}
            >
              <div className="w-full flex flex-col justify-end flex-1 min-h-0">
                <div className="w-full bg-tertiary/50 rounded-t" style={{ height: `${(m.demostracion_bs / maximo) * 100}%` }} />
                <div className="w-full bg-primary" style={{ height: `${(m.real_bs / maximo) * 100}%`, borderRadius: m.demostracion_bs ? 0 : '4px 4px 0 0' }} />
              </div>
              <span className="font-mono-micro text-[10px] text-on-surface-variant">{MESES_CORTOS[Number(mes) - 1]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-space-md gap-y-space-2xs font-mono-micro text-mono-micro text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-primary rounded-sm" aria-hidden="true" />Cobrado real: {bs(total)}</span>
        {totalDemo > 0 && <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-tertiary/50 rounded-sm" aria-hidden="true" />Demostración: {bs(totalDemo)}</span>}
      </div>
    </div>
  );
}

function CampoNumero({ id, etiqueta, valor, alCambiar }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className={CLASE_ETIQUETA}>{etiqueta}</label>
      <input id={id} type="number" inputMode="numeric" min={0} value={valor} onChange={(e) => alCambiar(e.target.value)} className={CLASE_INPUT} />
    </div>
  );
}

/** Cuántas suscripciones hacen falta para cubrir los costos. Los valores de partida son supuestos del plan de emprendimiento (CANVAS). */
function PuntoDeEquilibrio({ parametros, pagandoHoy }) {
  const [precio, setPrecio] = useState(String(parametros.precio_referencia_bs));
  const [infraestructura, setInfraestructura] = useState(String(parametros.infraestructura_mensual_bs));
  const [fijos, setFijos] = useState(String(parametros.costos_fijos_mensuales_bs));
  const [sueldo, setSueldo] = useState(String(parametros.sueldo_objetivo_bs));
  const necesarias = (costo) => (Number(precio) > 0 ? Math.ceil(Number(costo) / Number(precio)) : null);
  const cobertura = Number(fijos) > 0 ? Math.round((pagandoHoy / Number(fijos)) * 100) : 0;
  const filas = [
    ['Solo la infraestructura (servidor, dominio, tutor)', necesarias(infraestructura)],
    ['Todos los costos fijos', necesarias(fijos)],
    [`Costos fijos + un sueldo de ${bs(sueldo)}`, necesarias(Number(fijos) + Number(sueldo))],
  ];
  return (
    <section aria-label="Punto de equilibrio" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Punto de equilibrio</h2>
        <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Supuestos de diseño, a validar con la prueba piloto. Fuente: {parametros.fuente}.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-xs">
        <CampoNumero id="eq-precio" etiqueta="Precio por suscripción (Bs/mes)" valor={precio} alCambiar={setPrecio} />
        <CampoNumero id="eq-infra" etiqueta="Infraestructura (Bs/mes)" valor={infraestructura} alCambiar={setInfraestructura} />
        <CampoNumero id="eq-fijos" etiqueta="Costos fijos (Bs/mes)" valor={fijos} alCambiar={setFijos} />
        <CampoNumero id="eq-sueldo" etiqueta="Sueldo objetivo (Bs/mes)" valor={sueldo} alCambiar={setSueldo} />
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
        {filas.map(([texto, cantidad]) => (
          <li key={texto} className="flex items-center justify-between gap-space-sm p-space-xs rounded-lg bg-surface-container min-w-0">
            <span className="font-body-sm text-body-sm text-on-surface break-words min-w-0">{texto}</span>
            <span className="shrink-0 font-mono-metric text-mono-metric text-on-surface">{cantidad == null ? '—' : plural(cantidad, 'suscripción', 'suscripciones')}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        Hoy entran {bs(pagandoHoy)} al mes por suscripciones reales: cubren el <strong>{cobertura} %</strong> de los costos fijos.
      </p>
    </section>
  );
}

/** Dinero de la plataforma en tres vistas: resumen, pagos e instituciones. Solo la plataforma. */
export default function Ingresos() {
  const [datos, setDatos] = useState(null);
  const [lista, setLista] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [vista, setVista] = useState('resumen');
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [ingresos, suscripciones, todosLosPagos] = await Promise.all([obtenerIngresos(), listarSuscripciones(), listarPagosSuscripciones()]);
      setDatos(ingresos);
      setLista(suscripciones);
      setPagos(todosLosPagos);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los ingresos.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion, mensajeOk) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      setAviso(mensajeOk);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  }

  const confirmar = (id) => ejecutar(() => confirmarPagoSuscripcion(id), 'Pago confirmado: la suscripción quedó extendida.');
  const rechazar = (id, nota) => ejecutar(() => rechazarPagoSuscripcion(id, nota), 'Pago rechazado.');

  const reales = useMemo(() => (datos ? Object.values(datos.conteo_real).reduce((a, b) => a + b, 0) : 0), [datos]);
  const pendientes = datos?.pendientes.length ?? 0;
  const VISTAS = [
    { id: 'resumen', texto: 'Resumen', icono: 'dashboard' },
    { id: 'pagos', texto: 'Pagos', icono: 'receipt_long', cantidad: pendientes },
    { id: 'instituciones', texto: 'Instituciones', icono: 'apartment', cantidad: lista.length },
  ];

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-md animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[24px] text-primary shrink-0" aria-hidden="true">payments</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Ingresos</h1>
        </div>
        {datos &&
          (datos.hay_demostracion ? (
            <button type="button" disabled={ocupado} onClick={() => ejecutar(quitarDemostracionSuscripciones, 'Se quitaron las instituciones de demostración.')} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete_sweep</span>
              Quitar datos de demostración
            </button>
          ) : (
            <button type="button" disabled={ocupado} onClick={() => ejecutar(cargarDemostracionSuscripciones, 'Cargué cinco instituciones de demostración.')} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">science</span>
              Cargar datos de demostración
            </button>
          ))}
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

      {datos && (
        <>
          <div role="tablist" aria-label="Vistas de ingresos" className="flex gap-space-2xs overflow-x-auto border-b border-outline-variant/20">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                id={`ingresos-tab-${v.id}`}
                aria-selected={vista === v.id}
                aria-controls={`ingresos-panel-${v.id}`}
                onClick={() => setVista(v.id)}
                className={`shrink-0 flex items-center gap-space-xs px-space-md min-h-11 border-b-2 font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  vista === v.id ? 'border-primary text-primary font-medium' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{v.icono}</span>
                {v.texto}
                {v.cantidad > 0 && (
                  <span className={`font-mono-micro text-mono-micro px-space-xs rounded-full ${v.id === 'pagos' ? 'bg-tertiary-container text-tertiary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    {v.cantidad}
                  </span>
                )}
              </button>
            ))}
          </div>

          {datos.hay_demostracion && (
            <p className="m-0 flex items-start gap-space-xs p-space-sm rounded-xl bg-tertiary-container text-tertiary font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">science</span>
              Hay instituciones de demostración cargadas. Se ven marcadas y sus montos se muestran aparte de lo real.
            </p>
          )}

          <div role="tabpanel" id={`ingresos-panel-${vista}`} aria-labelledby={`ingresos-tab-${vista}`} className="flex flex-col gap-space-lg">
            {vista === 'resumen' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
                  <Dato icono="payments" valor={bs(datos.mensual_equivalente_real_bs)} titulo="Entra por mes" detalle={datos.hay_demostracion ? `+ ${bs(datos.mensual_equivalente_demostracion_bs)} de demostración` : 'Suscripciones activas, real'} />
                  <Dato icono="verified" valor={datos.conteo_real.activa} titulo="Instituciones pagando" detalle={`${plural(reales, 'institución real', 'instituciones reales')} en total`} />
                  <Dato icono="hourglass_top" valor={datos.conteo_real.prueba} titulo="En prueba gratis" detalle={datos.hay_demostracion ? `${datos.conteo_demostracion.prueba} de demostración` : null} />
                  <Dato icono="pending_actions" valor={pendientes} titulo="Pagos por confirmar" detalle={datos.conteo_real.vencida ? `${plural(datos.conteo_real.vencida, 'vencida', 'vencidas')} (real)` : null} />
                </div>

                {pendientes > 0 && (
                  <section aria-label="Pagos por confirmar" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
                    <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Pagos por confirmar</h2>
                    <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
                      {datos.pendientes.map((pago) => (
                        <PagoPendiente key={pago.id} pago={pago} ocupado={ocupado} alConfirmar={confirmar} alRechazar={rechazar} />
                      ))}
                    </ul>
                  </section>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg items-start">
                  <section aria-label="Cobrado por mes" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md min-w-0">
                    <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Cobrado por mes</h2>
                    <GraficoDeMeses meses={datos.por_mes} />
                  </section>
                  <PuntoDeEquilibrio parametros={datos.parametros} pagandoHoy={datos.mensual_equivalente_real_bs} />
                </div>

                <SaludClientes />
                <CalculadoraInstitucion />
              </>
            )}
            {vista === 'pagos' && <ListaPagos pagos={pagos} ocupado={ocupado} alConfirmar={confirmar} alRechazar={rechazar} />}
            {vista === 'instituciones' && <ListaInstituciones lista={lista} ocupado={ocupado} alCambiar={cargar} />}
          </div>
        </>
      )}
    </div>
  );
}
