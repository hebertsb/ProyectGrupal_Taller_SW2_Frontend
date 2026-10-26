import { useEffect, useRef, useState } from 'react';
import { avisarPago } from '../../api/backend';
import useModalAccesible from '../../useModalAccesible';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT, NOMBRE_DEL_CICLO, bs } from './comunes';

/**
 * Paso final para pagar: muestra un QR de DEMOSTRACIÓN (no es un pago real), pide un dato para que la plataforma encuentre la
 * transferencia y avisa que se pagó. La suscripción no cambia hasta que la plataforma confirma el pago.
 */
export default function ModalPago({ institucion, plan, ciclo, monto, alCerrar, alAvisar }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [qr, setQr] = useState(null);
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: enviando ? null : alCerrar, focoInicialRef: campoRef });

  useEffect(() => {
    let vigente = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(`CHESSIA-DEMOSTRACION|${institucion}|${plan}|${ciclo}|${monto}`, { width: 200, margin: 1 }))
      .then((url) => vigente && setQr(url))
      .catch(() => vigente && setQr(null));
    return () => {
      vigente = false;
    };
  }, [institucion, plan, ciclo, monto]);

  async function avisar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await avisarPago({ plan, ciclo, referencia: referencia.trim() || null });
      alAvisar();
    } catch (err) {
      setError(err.message || 'No se pudo avisar el pago.');
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !enviando) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={avisar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pago"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <h2 id="titulo-pago" className="m-0 font-headline-sm text-headline-sm text-on-surface">Pagar {bs(monto)}</h2>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            {NOMBRE_DEL_CICLO[ciclo]} · {institucion}
          </span>
        </div>

        <div className="flex flex-col items-center gap-space-xs p-space-sm rounded-xl bg-surface-container">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">
            Demostración · no es un pago real
          </span>
          {qr ? (
            <img src={qr} alt="Código QR de demostración" width="200" height="200" className="rounded-lg bg-white p-space-2xs" />
          ) : (
            <div className="w-[200px] h-[200px] rounded-lg bg-surface-container-high animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          )}
          <p className="m-0 text-center font-body-sm text-body-sm text-on-surface-variant">
            En la versión real, este QR o la transferencia bancaria van a la cuenta de la plataforma.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pago-referencia" className={CLASE_ETIQUETA}>Dato para encontrar tu pago (opcional)</label>
          <input
            id="pago-referencia"
            ref={campoRef}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={120}
            placeholder="Ej.: número de transferencia o nombre del titular"
            className={CLASE_INPUT}
          />
        </div>

        {error && (
          <div role="alert" className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button type="button" onClick={alCerrar} disabled={enviando} className={BOTON_NEUTRO}>Cancelar</button>
          <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>{enviando ? 'Avisando…' : 'Ya pagué'}</button>
        </div>
      </form>
    </div>
  );
}
