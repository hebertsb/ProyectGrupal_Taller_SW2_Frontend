import { useRef, useState } from 'react';
import { extenderPruebaSuscripcion, registrarPagoRecibido } from '../../api/backend';
import useModalAccesible from '../../useModalAccesible';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT, NOMBRE_DEL_CICLO, bs, fechaCorta } from './comunes';

/**
 * Lo que la plataforma puede hacerle a la suscripción de una institución sin esperar a que ella actúe: sumar días de prueba y registrar un
 * pago recibido en persona (efectivo o transferencia). Cada acción se aplica de una vez y deja la ventana abierta para la siguiente.
 */
export default function ModalGestionar({ suscripcion, alCerrar, alCambiar }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [dias, setDias] = useState('15');
  const [plan, setPlan] = useState(suscripcion.plan);
  const [ciclo, setCiclo] = useState('mensual');
  const [referencia, setReferencia] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: ocupado ? null : alCerrar, focoInicialRef: campoRef });

  async function aplicar(accion, mensaje) {
    setOcupado(true);
    setError(null);
    setHecho(null);
    try {
      await accion();
      setHecho(mensaje);
      await alCambiar();
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  }

  const diasNumero = Number(dias);
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= 1 && diasNumero <= 365;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) alCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gestionar"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <h2 id="titulo-gestionar" className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{suscripcion.institucion_nombre}</h2>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            {suscripcion.plan_nombre} · {suscripcion.estado === 'prueba' ? `prueba hasta el ${fechaCorta(suscripcion.prueba_hasta)}` : suscripcion.estado === 'activa' ? `pagada hasta el ${fechaCorta(suscripcion.vigente_hasta)}` : 'vencida'}
          </span>
        </div>

        {error && <div role="alert" className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>}
        {hecho && <div role="status" className="p-space-sm rounded-lg bg-primary/10 text-on-surface font-body-sm text-body-sm">{hecho}</div>}

        <section aria-label="Sumar días de prueba" className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container">
          <h3 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">Sumar días de prueba gratis</h3>
          <div className="flex items-end gap-space-xs">
            <div className="flex flex-col gap-1 w-28">
              <label htmlFor="gest-dias" className={CLASE_ETIQUETA}>Días</label>
              <input id="gest-dias" ref={campoRef} type="number" inputMode="numeric" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} className={CLASE_INPUT} />
            </div>
            <button type="button" disabled={ocupado || !diasValidos} onClick={() => aplicar(() => extenderPruebaSuscripcion(suscripcion.institucion_id, diasNumero), `Sumé ${diasNumero} días de prueba.`)} className={BOTON_NEUTRO}>
              Sumar
            </button>
          </div>
        </section>

        <section aria-label="Registrar un pago recibido" className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container">
          <h3 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">Registrar un pago que recibiste</h3>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Para efectivo o una transferencia que ya llegó. Queda confirmado y activa la suscripción.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="gest-plan" className={CLASE_ETIQUETA}>Plan</label>
              <select id="gest-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={CLASE_INPUT}>
                <option value="plan_60">Hasta 60 alumnos · {bs(350)} al mes</option>
                <option value="plan_120">Hasta 120 alumnos · {bs(500)} al mes</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="gest-ciclo" className={CLASE_ETIQUETA}>Pagó por</label>
              <select id="gest-ciclo" value={ciclo} onChange={(e) => setCiclo(e.target.value)} className={CLASE_INPUT}>
                {Object.entries(NOMBRE_DEL_CICLO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>{texto}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gest-ref" className={CLASE_ETIQUETA}>Referencia (opcional)</label>
            <input id="gest-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} placeholder="Ej.: efectivo en la visita del 28/10" className={CLASE_INPUT} />
          </div>
          <button type="button" disabled={ocupado} onClick={() => aplicar(() => registrarPagoRecibido(suscripcion.institucion_id, { plan, ciclo, referencia: referencia.trim() || null }), 'Pago registrado: la suscripción quedó activa.')} className={`${BOTON_PRINCIPAL} self-start`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">paid</span>
            Registrar pago
          </button>
        </section>

        <button type="button" onClick={alCerrar} disabled={ocupado} className={`${BOTON_NEUTRO} self-end`}>Cerrar</button>
      </div>
    </div>
  );
}
