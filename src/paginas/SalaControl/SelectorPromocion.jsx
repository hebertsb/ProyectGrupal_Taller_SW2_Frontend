import { useEffect, useRef } from 'react';
import { PIEZAS_DE_CORONACION, rutaImagenPieza } from '../../ajedrez';

/**
 * Diálogo para elegir en qué pieza corona un peón que llegó a la última fila: Dama, Torre, Alfil o
 * Caballo. Se muestra ANTES de mandar la jugada, así que cancelar no manda nada y el peón sigue en su casilla.
 * `esBlanca` es el color del peón (las piezas se dibujan de ese color). `alElegir` recibe la letra UCI
 * ('q', 'r', 'b' o 'n'); `alCancelar` se llama con el botón Cancelar, con Escape o tocando el fondo.
 *
 * Accesible: `role="dialog"`, el foco entra en la primera opción, Tab se queda dentro y, al cerrar,
 * el foco vuelve a donde estaba. Las opciones son botones de 88 px de alto como mínimo (táctil).
 */
export default function SelectorPromocion({ esBlanca, alElegir, alCancelar }) {
  const tarjetaRef = useRef(null);
  const primeraOpcionRef = useRef(null);
  // El padre se vuelve a renderizar seguido (el reloj corre): se lee el callback más nuevo desde un ref
  // para no re-enfocar la primera opción cada vez que cambia su identidad.
  const alCancelarRef = useRef(alCancelar);
  alCancelarRef.current = alCancelar;

  useEffect(() => {
    const elementoPrevio = document.activeElement;
    primeraOpcionRef.current?.focus();

    function alPulsarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCancelarRef.current();
        return;
      }
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) alCancelar();
      }}
    >
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-coronacion"
        aria-describedby="descripcion-coronacion"
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl p-space-md flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">Coronación</span>
          <h2 id="titulo-coronacion" className="font-headline-sm text-headline-sm text-on-surface">
            Elegí tu nueva pieza
          </h2>
          <p id="descripcion-coronacion" className="font-body-sm text-body-sm text-on-surface-variant">
            Tu peón llegó a la última fila. ¿En qué pieza lo convertís?
          </p>
        </div>

        <div className="grid grid-cols-4 gap-space-xs">
          {PIEZAS_DE_CORONACION.map((opcion, indice) => (
            <button
              key={opcion.letra}
              ref={indice === 0 ? primeraOpcionRef : null}
              type="button"
              onClick={() => alElegir(opcion.letra)}
              aria-label={`Coronar a ${opcion.nombre.toLowerCase()}`}
              className="min-h-[88px] min-w-0 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* Fondo de casilla clara: las piezas negras se ven igual que las blancas sobre el fondo oscuro del diálogo. */}
              <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#b89772] flex items-center justify-center shrink-0">
                <img
                  src={rutaImagenPieza(esBlanca ? opcion.letra.toUpperCase() : opcion.letra)}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="w-[88%] h-[88%] pointer-events-none select-none"
                />
              </span>
              <span className="font-body-sm text-body-sm font-medium text-on-surface">{opcion.nombre}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={alCancelar}
          className="w-full min-h-11 px-space-lg py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
