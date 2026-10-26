import { useMemo, useState } from 'react';
import { BOTON_NEUTRO, CLASE_ETIQUETA, CLASE_INPUT, ESTADOS, bs, fechaCorta, plural } from './comunes';
import ModalGestionar from './ModalGestionar';
import { Etiqueta } from './PagoPendiente';

const ORDENES = [
  { valor: 'atencion', texto: 'Las que piden atención primero' },
  { valor: 'nombre', texto: 'Nombre (A a Z)' },
  { valor: 'alta_reciente', texto: 'Alta más reciente' },
  { valor: 'alta_antigua', texto: 'Alta más antigua' },
  { valor: 'vence_pronto', texto: 'Vencen antes' },
  { valor: 'alumnos', texto: 'Más alumnos' },
];

/** Minúsculas y sin tildes, para que «colegio» encuentre «Colegio San Martín» y «martin» encuentre «Martín». */
function simple(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const vencimiento = (s) => (s.estado === 'activa' ? s.vigente_hasta : s.prueba_hasta) ?? '';

const COMPARAR = {
  atencion: () => 0, // el servidor ya las manda en ese orden
  nombre: (a, b) => simple(a.institucion_nombre).localeCompare(simple(b.institucion_nombre)),
  alta_reciente: (a, b) => b.institucion_creada_en.localeCompare(a.institucion_creada_en),
  alta_antigua: (a, b) => a.institucion_creada_en.localeCompare(b.institucion_creada_en),
  vence_pronto: (a, b) => vencimiento(a).localeCompare(vencimiento(b)),
  alumnos: (a, b) => b.alumnos - a.alumnos,
};

function Filtro({ id, etiqueta, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className={CLASE_ETIQUETA}>{etiqueta}</label>
      {children}
    </div>
  );
}

/** Instituciones con su suscripción, con búsqueda por nombre y filtros por estado, plan, tipo de datos y fecha de alta. */
export default function ListaInstituciones({ lista, ocupado, alCambiar }) {
  const [gestionando, setGestionando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [plan, setPlan] = useState('');
  const [datos, setDatos] = useState('');
  const [orden, setOrden] = useState('atencion');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const hayDemostracion = lista.some((s) => s.es_demostracion);

  const visibles = useMemo(() => {
    const buscada = simple(busqueda.trim());
    return lista
      .filter(
        (s) =>
          (!buscada || simple(s.institucion_nombre).includes(buscada)) &&
          (!estado || s.estado === estado) &&
          (!plan || s.plan === plan) &&
          (!datos || (datos === 'demostracion') === s.es_demostracion) &&
          (!soloPendientes || s.pago_pendiente)
      )
      .sort(COMPARAR[orden]);
  }, [lista, busqueda, estado, plan, datos, orden, soloPendientes]);

  const hayFiltros = busqueda || estado || plan || datos || soloPendientes || orden !== 'atencion';
  const limpiar = () => {
    setBusqueda('');
    setEstado('');
    setPlan('');
    setDatos('');
    setOrden('atencion');
    setSoloPendientes(false);
  };

  return (
    <section aria-label="Instituciones" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-xs">
        <Filtro id="inst-busqueda" etiqueta="Buscar por nombre">
          <input id="inst-busqueda" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: colegio" className={CLASE_INPUT} />
        </Filtro>
        <Filtro id="inst-estado" etiqueta="Estado">
          <select id="inst-estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={CLASE_INPUT}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </Filtro>
        <Filtro id="inst-plan" etiqueta="Plan">
          <select id="inst-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={CLASE_INPUT}>
            <option value="">Todos</option>
            <option value="plan_60">Hasta 60 alumnos</option>
            <option value="plan_120">Hasta 120 alumnos</option>
          </select>
        </Filtro>
        <Filtro id="inst-orden" etiqueta="Ordenar por">
          <select id="inst-orden" value={orden} onChange={(e) => setOrden(e.target.value)} className={CLASE_INPUT}>
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>{o.texto}</option>
            ))}
          </select>
        </Filtro>
        {hayDemostracion && (
          <Filtro id="inst-datos" etiqueta="Mostrar">
            <select id="inst-datos" value={datos} onChange={(e) => setDatos(e.target.value)} className={CLASE_INPUT}>
              <option value="">Reales y de demostración</option>
              <option value="real">Solo reales</option>
              <option value="demostracion">Solo demostración</option>
            </select>
          </Filtro>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface cursor-pointer min-h-10">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="h-4 w-4 cursor-pointer" />
          Solo con pago por confirmar
        </label>
        <div className="flex items-center gap-space-sm">
          <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">
            {visibles.length} de {plural(lista.length, 'institución', 'instituciones')}
          </span>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className={BOTON_NEUTRO}>Limpiar filtros</button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="m-0 p-space-md rounded-lg bg-surface-container text-center font-body-sm text-body-sm text-on-surface-variant">
          {lista.length === 0 ? 'Todavía no hay instituciones. Creá la primera en Instituciones.' : 'Ninguna institución coincide con esos filtros.'}
        </p>
      ) : (
        <ul className="m-0 p-0 list-none grid grid-cols-1 xl:grid-cols-2 gap-space-xs">
          {visibles.map((s) => {
            const e = ESTADOS[s.estado];
            return (
              <li key={s.institucion_id} className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-x-space-sm gap-y-space-2xs">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">{s.institucion_nombre}</span>
                  <span className={`shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${e.clase}`}>{e.texto}</span>
                </div>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                  {s.plan_nombre} · {bs(s.precio_mensual_bs)} al mes · {s.alumnos}/{s.tope_alumnos} alumnos
                </span>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                  Alta {fechaCorta(s.institucion_creada_en)} ·{' '}
                  {s.estado === 'vencida'
                    ? `venció el ${fechaCorta(s.vigente_hasta ?? s.prueba_hasta)}`
                    : `${plural(s.dias_restantes, 'día', 'días')} (hasta el ${fechaCorta(s.estado === 'activa' ? s.vigente_hasta : s.prueba_hasta)})`}
                </span>
                <div className="flex flex-wrap items-center gap-space-xs">
                  {s.pago_pendiente && <span className="font-mono-micro text-mono-micro text-tertiary">Pago por confirmar</span>}
                  {s.es_demostracion && <Etiqueta>Demostración</Etiqueta>}
                  {s.es_prueba && <Etiqueta>En prueba</Etiqueta>}
                  {!s.es_demostracion && (
                    <button type="button" disabled={ocupado} onClick={() => setGestionando(s)} className={`${BOTON_NEUTRO} ml-auto`}>
                      <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">tune</span>
                      Gestionar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {gestionando && (
        <ModalGestionar
          suscripcion={lista.find((x) => x.institucion_id === gestionando.institucion_id) ?? gestionando}
          alCerrar={() => setGestionando(null)}
          alCambiar={alCambiar}
        />
      )}
    </section>
  );
}
