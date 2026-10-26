import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { enlaceDeCurso, mensajeDeCurso } from '../../enlaceCurso';
import { enlaceDeWhatsApp, esDireccionLocal } from '../../enlaceInvitacion';
import useModalAccesible from '../../useModalAccesible';

const BOTON =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm no-underline transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_PRINCIPAL = `${BOTON} bg-primary text-on-primary font-medium hover:brightness-110`;
const BOTON_NEUTRO = `${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;

/**
 * El código QR de un curso: el alumno lo escanea con la cámara del celular, se abre ChessIA con el curso ya elegido y, al crear su cuenta
 * (o iniciar sesión), queda inscrito sin escribir nada. También se puede mandar el enlace por WhatsApp, bajar la imagen del QR o
 * imprimir un cartel para pegar en el aula.
 */
export default function ModalQrCurso({ curso, alCerrar }) {
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(null);
  const [qr, setQr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const enlace = enlaceDeCurso(curso.codigo);

  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: cerrarRef });

  useEffect(() => {
    let vigente = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(enlace, { width: 480, margin: 2, errorCorrectionLevel: 'M' }))
      .then((url) => vigente && setQr(url))
      .catch(() => vigente && setQr(null));
    return () => {
      vigente = false;
    };
  }, [enlace]);

  useEffect(() => {
    if (!copiado) return undefined;
    const temporizador = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(temporizador);
  }, [copiado]);

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setCopiado(false); // sin permiso de portapapeles: el enlace igual se manda por WhatsApp
    }
  }

  const nombreDeArchivo = `qr-${curso.nombre.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'curso'}.png`;

  return createPortal(
    <div
      id="informe-impreso"
      className="fixed inset-0 z-[90] flex items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/85 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-qr-curso"
        className="hoja-informe w-full max-w-md max-h-[94dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md sm:p-space-lg flex flex-col items-center gap-space-md text-center"
      >
        <div className="flex flex-col gap-1 items-center min-w-0 w-full">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">ChessIA · Curso de ajedrez</span>
          <h2 id="titulo-qr-curso" className="m-0 font-headline-lg text-headline-lg text-on-surface break-words max-w-full">{curso.nombre}</h2>
          {curso.facilitador_nombre && <span className="font-body-sm text-body-sm text-on-surface-variant">Docente: {curso.facilitador_nombre}</span>}
        </div>

        {qr ? (
          <img src={qr} alt={`Código QR para unirse al curso ${curso.nombre}`} width="260" height="260" className="w-full max-w-[260px] h-auto rounded-xl bg-white p-space-2xs" />
        ) : (
          <div className="w-[260px] h-[260px] max-w-full rounded-xl bg-surface-container-high animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        )}

        <div className="flex flex-col gap-1 items-center">
          <span className="font-body-sm text-body-sm text-on-surface">Escaneá el QR con la cámara del celular, o ingresá con este código:</span>
          <span className="font-mono-metric text-[28px] tracking-[0.18em] text-on-surface break-all select-all">{curso.codigo}</span>
        </div>

        <div className="no-imprimir flex flex-col gap-space-xs w-full">
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-space-xs">
            <a href={enlaceDeWhatsApp(mensajeDeCurso({ enlace, curso: curso.nombre, docente: curso.facilitador_nombre }))} target="_blank" rel="noopener noreferrer" className={BOTON_PRINCIPAL}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
              Enviar por WhatsApp
            </a>
            <button type="button" onClick={copiarEnlace} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'link'}</span>
              {copiado ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-space-xs">
            {qr && (
              <a href={qr} download={nombreDeArchivo} className={BOTON_NEUTRO}>
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">download</span>
                Bajar imagen
              </a>
            )}
            <button type="button" onClick={() => window.print()} disabled={!qr} className={`${BOTON_NEUTRO} disabled:opacity-50`}>
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">print</span>
              Imprimir cartel
            </button>
            <button ref={cerrarRef} type="button" onClick={alCerrar} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
              Cerrar
            </button>
          </div>
          {esDireccionLocal() && (
            <p className="m-0 flex items-start gap-space-xs p-space-xs rounded-lg bg-tertiary-container text-tertiary font-body-sm text-body-sm text-left">
              <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">warning</span>
              Estás en una dirección local: este QR solo abre en esta computadora. Generalo desde la dirección pública del sistema.
            </p>
          )}
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            El QR sirve mientras el curso acepte ingresos. Si generás un código nuevo para el curso, este QR deja de servir.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
