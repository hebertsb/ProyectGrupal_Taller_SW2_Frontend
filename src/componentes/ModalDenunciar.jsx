import { useRef, useState } from 'react';
import { bloquearJugador, denunciarJugador } from '../api/backend';
import useModalAccesible from '../useModalAccesible';

const MOTIVOS = [
  { valor: 'conducta', texto: 'Me trató mal', ayuda: 'Insultos, burlas o mensajes que no corresponden.' },
  { valor: 'trampa', texto: 'Hizo trampa', ayuda: 'Usó ayuda externa o un programa durante la partida.' },
  { valor: 'abandono', texto: 'Abandonó la partida', ayuda: 'Se fue en medio de la partida de forma repetida.' },
  { valor: 'otro', texto: 'Otro motivo', ayuda: 'Contanos qué pasó.' },
];

const CLASE_BOTON =
  'px-space-md py-space-sm min-h-11 rounded-xl font-body-sm text-body-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Ventana para bloquear o denunciar a otro jugador. Bloquear no le avisa a la otra persona: deja de poder retarte y de aparecer en tu lista. Denunciar le llega al
 * docente de quien se denuncia (con el código de la partida si la hay) y se puede bloquear en el mismo paso. Solo se puede denunciar a quien se conoce
 * (compañero, amigo o rival de una sala). `alListo(mensaje)` se llama al terminar.
 */
export default function ModalDenunciar({ persona, codigoSala = null, alCerrar, alListo }) {
  const dialogoRef = useRef(null);
  const [motivo, setMotivo] = useState('conducta');
  const [detalle, setDetalle] = useState('');
  const [bloquear, setBloquear] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: ocupado ? null : alCerrar });

  async function ejecutar(accion, mensajeOk) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      alListo?.(mensajeOk);
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
      setOcupado(false);
    }
  }

  const soloBloquear = () => ejecutar(() => bloquearJugador(persona.id), `Bloqueaste a ${persona.nombre}. No se entera.`);
  const denunciar = (evento) => {
    evento.preventDefault();
    return ejecutar(
      () => denunciarJugador({ usuarioId: persona.id, motivo, detalle: detalle.trim(), codigoSala, bloquear }),
      bloquear ? `Enviamos tu denuncia y bloqueaste a ${persona.nombre}.` : 'Enviamos tu denuncia. Gracias por avisar.',
    );
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={denunciar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-denunciar"
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md flex flex-col gap-space-md"
      >
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-error/15 text-error flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">flag</span>
          </div>
          <h2 id="titulo-denunciar" className="m-0 font-headline-sm text-headline-sm text-on-surface break-words min-w-0">
            Bloquear o denunciar a {persona.nombre}
          </h2>
        </div>

        <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs" disabled={ocupado}>
          <legend className="font-mono-micro text-mono-micro uppercase text-on-surface-variant mb-space-2xs">¿Qué pasó?</legend>
          {MOTIVOS.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex items-start gap-space-xs p-space-sm rounded-lg cursor-pointer border ${
                motivo === opcion.valor ? 'bg-primary/10 border-primary/40' : 'bg-surface-container border-transparent'
              }`}
            >
              <input type="radio" name="motivo-denuncia" value={opcion.valor} checked={motivo === opcion.valor} onChange={() => setMotivo(opcion.valor)} className="mt-1 h-4 w-4 accent-primary" />
              <span className="flex flex-col min-w-0">
                <span className="font-body-sm text-body-sm text-on-surface">{opcion.texto}</span>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">{opcion.ayuda}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-space-2xs">
          <label htmlFor="detalle-denuncia" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Detalle (opcional)</label>
          <textarea
            id="detalle-denuncia"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={300}
            rows={3}
            disabled={ocupado}
            className="w-full px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg font-body-sm text-body-sm text-on-surface resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          <span className="font-mono-micro text-mono-micro text-outline text-right">{detalle.length}/300</span>
        </div>

        <label className="flex items-start gap-space-xs cursor-pointer">
          <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} disabled={ocupado} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span className="font-body-sm text-body-sm text-on-surface leading-snug">Bloquearlo también: no podrá retarte y no se entera de que lo bloqueaste.</span>
        </label>

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button type="button" onClick={alCerrar} disabled={ocupado} className={`${CLASE_BOTON} bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface`}>
            Cancelar
          </button>
          <button type="button" onClick={soloBloquear} disabled={ocupado} className={`${CLASE_BOTON} bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface`}>
            Solo bloquear
          </button>
          <button type="submit" disabled={ocupado} className={`${CLASE_BOTON} bg-error text-on-error hover:brightness-110`}>
            {ocupado ? 'Enviando…' : 'Denunciar'}
          </button>
        </div>
      </form>
    </div>
  );
}
