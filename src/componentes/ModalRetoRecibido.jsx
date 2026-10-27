import { useEffect, useRef, useState } from 'react';
import useModalAccesible from '../useModalAccesible';
import { textoDeReloj } from '../enlaceJuego';
import { textoDePersona } from '../elo';

/** Un aviso corto para que el jugador se entere aunque esté mirando otra cosa: vibra el celular y suena un tono breve (si el navegador lo permite). */
function avisarConSonido() {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // sin vibración
  }
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    const contexto = new Contexto();
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = 880;
    volumen.gain.value = 0.08;
    oscilador.connect(volumen);
    volumen.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.18);
    oscilador.onended = () => contexto.close?.();
  } catch {
    // sin audio (el navegador pide un toque antes de permitirlo): igual se ve el aviso
  }
}

const BOTON =
  'flex-1 flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-12 rounded-lg font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Aviso de que otro jugador te retó a una partida: quién es, con qué reloj y con qué color te toca. Aparece en cualquier pantalla (el jugador
 * puede estar leyendo el Panel de Aprendizaje) y vence solo a los 90 segundos si no se responde. Aceptar te lleva directo a la partida.
 */
export default function ModalRetoRecibido({ reto, ocupado, error, alAceptar, alRechazar }) {
  const dialogoRef = useRef(null);
  const aceptarRef = useRef(null);
  const [recibidoEn, setRecibidoEn] = useState(() => performance.now());
  const [ahora, setAhora] = useState(() => performance.now());
  useModalAccesible(dialogoRef, { alCerrar: ocupado ? null : () => alRechazar(reto.id), focoInicialRef: aceptarRef });

  useEffect(() => {
    avisarConSonido();
  }, []);

  // Cada respuesta del servidor trae los segundos que le quedan al reto: desde ese momento se cuenta.
  useEffect(() => {
    setRecibidoEn(performance.now());
  }, [reto.segundos_restantes]);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(performance.now()), 500);
    return () => clearInterval(intervalo);
  }, []);

  const segundos = Math.max(0, reto.segundos_restantes - Math.floor((ahora - recibidoEn) / 1000));
  const retador = reto.de;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/80 backdrop-blur-sm">
      <div
        ref={dialogoRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-reto"
        aria-describedby="detalle-reto"
        className="w-full max-w-sm bg-surface-container-low border border-primary/40 rounded-2xl shadow-2xl p-space-md flex flex-col gap-space-sm"
      >
        <div className="flex items-center gap-space-sm">
          <span className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0">
            {retador.avatar_url ? (
              <img src={retador.avatar_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <span className="material-symbols-outlined text-[26px] text-on-surface-variant" aria-hidden="true">person</span>
            )}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">Te retan a una partida</span>
            <h2 id="titulo-reto" className="m-0 font-headline-sm text-headline-sm text-on-surface truncate">{retador.nombre}</h2>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              {textoDePersona(retador)}
            </span>
          </div>
        </div>

        <p id="detalle-reto" className="m-0 font-body-sm text-body-sm text-on-surface">
          {textoDeReloj(reto.control_tiempo_ms)}{reto.control_tiempo_ms ? ' por lado' : ''} · vos jugás con <strong>{reto.tu_color}</strong>.{reto.puntuada === false ? ' Es una partida amistosa: no mueve el Elo.' : ''} Vence en {segundos} s.
        </p>
        {error && <p role="alert" className="m-0 p-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">{error}</p>}

        <div className="flex gap-space-xs">
          <button ref={aceptarRef} type="button" onClick={() => alAceptar(reto.id)} disabled={ocupado || segundos === 0} className={`${BOTON} bg-primary text-on-primary hover:brightness-110`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
            Aceptar
          </button>
          <button type="button" onClick={() => alRechazar(reto.id)} disabled={ocupado} className={`${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
