import { useEffect, useState } from 'react';
import { enlaceDeInvitacion, enlaceDeWhatsApp, esDireccionLocal, mensajeDeInvitacion } from '../enlaceInvitacion';
import { fechaDesdeIso } from '../formatoTiempo';

const BOTON =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Un código de invitación recién generado, listo para mandar: el código, un enlace que abre el registro con la invitación ya cargada
 * y un botón que lo manda por WhatsApp. El código se ve una sola vez (en el servidor queda solo su huella).
 */
export default function CodigoCompartible({ codigo, expiraEn, institucion = null, esEvaluacion = false, comoAdministrador = false }) {
  const [copiado, setCopiado] = useState(null);
  const enlace = enlaceDeInvitacion(codigo);
  const vence = fechaDesdeIso(expiraEn);
  const vigencia = vence ? `el ${vence.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las ${vence.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : null;
  const mensaje = mensajeDeInvitacion({ enlace, institucion, esEvaluacion, comoAdministrador, vigencia });

  useEffect(() => {
    if (!copiado) return undefined;
    const temporizador = setTimeout(() => setCopiado(null), 2000);
    return () => clearTimeout(temporizador);
  }, [copiado]);

  async function copiar(texto, que) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(que);
    } catch {
      setCopiado(null); // sin permiso de portapapeles: el código y el enlace igual están a la vista
    }
  }

  return (
    <div role="status" className="flex flex-col gap-space-sm p-space-md rounded-xl bg-primary/10 border border-primary/40">
      <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">
        {esEvaluacion ? 'Invitación para evaluar' : comoAdministrador ? 'Invitación como administrador' : 'Invitación'}
        {institucion ? ` · ${institucion}` : ''}
      </span>
      <span className="font-mono-metric text-[28px] sm:text-[34px] tracking-[0.2em] text-on-surface break-all select-all">{codigo}</span>

      <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
        <a href={enlaceDeWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer" className={`${BOTON} bg-primary text-on-primary font-medium hover:brightness-110`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
          Enviar por WhatsApp
        </a>
        <button type="button" onClick={() => copiar(enlace, 'enlace')} className={`${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`}>
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado === 'enlace' ? 'check' : 'link'}</span>
          {copiado === 'enlace' ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <button type="button" onClick={() => copiar(codigo, 'codigo')} className={`${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`}>
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado === 'codigo' ? 'check' : 'content_copy'}</span>
          {copiado === 'codigo' ? 'Código copiado' : 'Copiar código'}
        </button>
      </div>

      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        El enlace abre el registro con la invitación ya cargada{vigencia ? <>; sirve <strong>una sola vez</strong> y vence {vigencia}</> : ' y sirve una sola vez'}. Se muestra
        solo ahora: si lo perdés, generá otro.
      </p>
      {esDireccionLocal() && (
        <p className="m-0 flex items-start gap-space-xs p-space-xs rounded-lg bg-tertiary-container text-tertiary font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">warning</span>
          Estás en una dirección local. Para mandarle el enlace a otra persona, generalo desde la dirección pública del sistema.
        </p>
      )}
    </div>
  );
}
