import { useMemo, useState } from 'react';
import { BOTON_NEUTRO, CLASE_ETIQUETA, CLASE_INPUT, ESTADOS_PAGO, NOMBRE_DEL_CICLO, bs, fechaCorta, plural } from './comunes';
import PagoPendiente, { Etiqueta } from './PagoPendiente';

function simple(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Todos los pagos, con búsqueda por institución o referencia y filtro por estado. Los pendientes se confirman o rechazan acá mismo. */
export default function ListaPagos({ pagos, ocupado, alConfirmar, alRechazar }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [orden, setOrden] = useState('reciente');

  const visibles = useMemo(() => {
    const buscada = simple(busqueda.trim());
    const filtrados = pagos.filter(
      (p) => (!estado || p.estado === estado) && (!buscada || simple(`${p.institucion_nombre} ${p.referencia ?? ''}`).includes(buscada))
    );
    const factor = orden === 'antiguo' ? -1 : 1;
    if (orden === 'monto') return filtrados.sort((a, b) => b.monto_bs - a.monto_bs);
    return filtrados.sort((a, b) => factor * b.creado_en.localeCompare(a.creado_en));
  }, [pagos, busqueda, estado, orden]);

  const total = visibles.filter((p) => p.estado === 'confirmado').reduce((suma, p) => suma + p.monto_bs, 0);

  return (
    <section aria-label="Pagos" className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="pagos-busqueda" className={CLASE_ETIQUETA}>Buscar institución o referencia</label>
          <input id="pagos-busqueda" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: transferencia" className={CLASE_INPUT} />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="pagos-estado" className={CLASE_ETIQUETA}>Estado</label>
          <select id="pagos-estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={CLASE_INPUT}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS_PAGO).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="pagos-orden" className={CLASE_ETIQUETA}>Ordenar por</label>
          <select id="pagos-orden" value={orden} onChange={(e) => setOrden(e.target.value)} className={CLASE_INPUT}>
            <option value="reciente">Más recientes</option>
            <option value="antiguo">Más antiguos</option>
            <option value="monto">Mayor monto</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">
          {visibles.length} de {plural(pagos.length, 'pago', 'pagos')} · confirmados: {bs(total)}
        </span>
        {(busqueda || estado || orden !== 'reciente') && (
          <button type="button" onClick={() => { setBusqueda(''); setEstado(''); setOrden('reciente'); }} className={BOTON_NEUTRO}>Limpiar filtros</button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="m-0 p-space-md rounded-lg bg-surface-container text-center font-body-sm text-body-sm text-on-surface-variant">
          {pagos.length === 0 ? 'Todavía no hay pagos. Aparecen cuando una institución avise que pagó.' : 'Ningún pago coincide con esos filtros.'}
        </p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {visibles.map((pago) =>
            pago.estado === 'pendiente' ? (
              <PagoPendiente key={pago.id} pago={pago} ocupado={ocupado} alConfirmar={alConfirmar} alRechazar={alRechazar} />
            ) : (
              <li key={pago.id} className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs p-space-sm rounded-xl bg-surface-container min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="font-body-sm text-body-sm text-on-surface break-words">{pago.institucion_nombre}</span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                    {bs(pago.monto_bs)} · {NOMBRE_DEL_CICLO[pago.ciclo]} · {fechaCorta(pago.creado_en)}
                    {pago.referencia ? ` · ${pago.referencia}` : ''}
                    {pago.nota ? ` · ${pago.nota}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-space-xs">
                  {pago.es_demostracion && <Etiqueta>Demostración</Etiqueta>}
                  <span className={`shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${ESTADOS_PAGO[pago.estado].clase}`}>
                    {ESTADOS_PAGO[pago.estado].texto}
                  </span>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
