import { useState } from 'react';
import { BOTON_NEUTRO, BOTON_PELIGRO, BOTON_PRINCIPAL, CLASE_INPUT, NOMBRE_DEL_CICLO, bs, fechaCorta } from './comunes';

export function Etiqueta({ children }) {
  return <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">{children}</span>;
}

/** Un pago por confirmar: la plataforma lo confirma (extiende la suscripción) o lo rechaza con un motivo. */
export default function PagoPendiente({ pago, ocupado, alConfirmar, alRechazar }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  return (
    <li className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-space-sm gap-y-space-2xs">
        <div className="flex flex-col min-w-0">
          <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{pago.institucion_nombre}</span>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            {bs(pago.monto_bs)} · {NOMBRE_DEL_CICLO[pago.ciclo]} · {pago.plan === 'plan_120' ? 'hasta 120 alumnos' : 'hasta 60 alumnos'} · {fechaCorta(pago.creado_en)}
          </span>
          {pago.referencia && <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">Referencia: {pago.referencia}</span>}
        </div>
        {pago.es_demostracion && <Etiqueta>Demostración</Etiqueta>}
      </div>
      {rechazando ? (
        <div className="flex flex-col sm:flex-row gap-space-xs">
          <label htmlFor={`motivo-${pago.id}`} className="sr-only">Motivo del rechazo</label>
          <input id={`motivo-${pago.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Motivo (opcional)" className={`${CLASE_INPUT} flex-1`} />
          <button type="button" disabled={ocupado} onClick={() => alRechazar(pago.id, motivo)} className={BOTON_PELIGRO}>Rechazar</button>
          <button type="button" disabled={ocupado} onClick={() => setRechazando(false)} className={BOTON_NEUTRO}>Cancelar</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-space-xs">
          <button type="button" disabled={ocupado} onClick={() => alConfirmar(pago.id)} className={BOTON_PRINCIPAL}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
            Confirmar pago
          </button>
          <button type="button" disabled={ocupado} onClick={() => setRechazando(true)} className={BOTON_NEUTRO}>No llegó</button>
        </div>
      )}
    </li>
  );
}
