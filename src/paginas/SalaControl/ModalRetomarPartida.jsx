import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { tiempoRelativo } from '../../formatoTiempo';
import { NIVEL_MAX_MODELO, rangoDeNivel } from '../../nivelJugador';

gsap.registerPlugin(useGSAP);

/** Cantidad de jugadas del propio jugador: la que manda el backend o, si falta, la mitad de las jugadas de la partida. */
function contarJugadasPropias(partida) {
  if (typeof partida?.jugadas_jugador === 'number') return partida.jugadas_jugador;
  return Math.ceil((partida?.jugadas?.length ?? 0) / 2);
}

function describirNivel(partida) {
  if (typeof partida?.nivel !== 'number') return 'Sin nivel';
  const esTuring = partida.tipo_oponente === 'modelo';
  const rango = esTuring && partida.nivel >= NIVEL_MAX_MODELO ? 'Maestro' : rangoDeNivel(partida.nivel);
  return rango ? `Nivel ${partida.nivel} · ${rango}` : `Nivel ${partida.nivel}`;
}

/**
 * Modal que se muestra al abrir la Sala de Control cuando quien entra (jugador o
 * facilitador) dejó una partida sin terminar: hay que ELEGIR entre retomarla o
 * empezar otra, por eso no se cierra con Escape ni con un clic en el fondo.
 * `partida` es la respuesta de `GET /partida/en-curso`. Es accesible:
 * `role="dialog"`, el foco va al botón principal, Tab se queda dentro del modal y
 * al cerrar el foco vuelve a donde estaba. El texto de abajo del todo menciona el
 * nivel solo para el jugador — al facilitador no le aplica la calibración de nivel.
 */
export default function ModalRetomarPartida({ partida, alRetomar, alEmpezarNueva, esFacilitador = false }) {
  const tarjetaRef = useRef(null);
  const botonRetomarRef = useRef(null);

  useEffect(() => {
    const elementoPrevio = document.activeElement;
    botonRetomarRef.current?.focus();

    // Solo se atrapa el foco: Escape no hace nada a propósito (hay que elegir una opción).
    function alPulsarTecla(evento) {
      if (evento.key !== 'Tab') return;
      const enfocables = tarjetaRef.current?.querySelectorAll('button:not([disabled])');
      if (!enfocables || enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      elementoPrevio?.focus?.();
    };
  }, []);

  // Entrada sutil: solo opacidad/desplazamiento (nunca `visibility`, que impediría enfocar el botón).
  // Con "reducir movimiento" no se anima nada.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(tarjetaRef.current, {
          opacity: 0,
          y: 18,
          scale: 0.97,
          duration: 0.35,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
        gsap.from('.retomar-partida-bloque', {
          opacity: 0,
          y: 10,
          duration: 0.3,
          stagger: 0.07,
          delay: 0.12,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope: tarjetaRef }
  );

  const jugadasPropias = contarJugadasPropias(partida);
  const ultimaActividad =
    tiempoRelativo(partida?.actualizada_en) ??
    tiempoRelativo(partida?.iniciada_en) ??
    tiempoRelativo(partida?.creada_en) ??
    'sin registro';
  const rival = partida?.tipo_oponente === 'modelo' ? 'Turing' : 'Stockfish';

  const datos = [
    { etiqueta: 'Tus jugadas', valor: String(jugadasPropias), icono: 'touch_app' },
    { etiqueta: 'Última actividad', valor: ultimaActividad, icono: 'schedule' },
    { etiqueta: 'Rival', valor: rival, icono: partida?.tipo_oponente === 'modelo' ? 'psychology' : 'smart_toy' },
    { etiqueta: 'Dificultad', valor: describirNivel(partida), icono: 'signal_cellular_alt' },
  ];

  return (
    // Sin cierre por clic en el fondo: la persona tiene que elegir una de las dos opciones.
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm">
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-retomar-partida"
        aria-describedby="descripcion-retomar-partida"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="retomar-partida-bloque flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              pause_circle
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">
              Partida pendiente
            </span>
            <h2 id="titulo-retomar-partida" className="font-headline-sm text-headline-sm text-on-surface">
              Tienes una partida sin terminar
            </h2>
          </div>
        </div>

        <p
          id="descripcion-retomar-partida"
          className="retomar-partida-bloque font-body-sm text-body-sm text-on-surface-variant"
        >
          Puedes seguir donde la dejaste o empezar una desde cero.
        </p>

        <dl className="retomar-partida-bloque grid grid-cols-2 gap-space-xs">
          {datos.map((dato) => (
            <div key={dato.etiqueta} className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1 min-w-0">
              <dt className="font-mono-micro text-mono-micro uppercase text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  {dato.icono}
                </span>
                {dato.etiqueta}
              </dt>
              <dd className="font-body-sm text-body-sm font-medium text-on-surface break-words">{dato.valor}</dd>
            </div>
          ))}
        </dl>

        <div className="retomar-partida-bloque flex flex-col gap-space-xs">
          <button
            ref={botonRetomarRef}
            type="button"
            onClick={alRetomar}
            className="w-full px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none hover:bg-primary-fixed flex items-center justify-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              play_arrow
            </span>
            Retomar partida
          </button>
          <button
            type="button"
            onClick={alEmpezarNueva}
            aria-describedby="aviso-descartar-partida"
            className="w-full px-space-lg py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none flex items-center justify-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            Empezar una nueva
          </button>
          <p id="aviso-descartar-partida" className="font-mono-micro text-mono-micro text-on-surface-variant text-center">
            {esFacilitador
              ? 'Si empiezas una nueva, la anterior queda descartada.'
              : 'Si empiezas una nueva, la anterior se descarta y no cuenta para tu nivel.'}
          </p>
        </div>
      </div>
    </div>
  );
}
