import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rutaImagenPieza } from './ajedrez';

const UMBRAL_PX = 5;

/**
 * Arrastrar piezas con el mouse o el dedo, como en Lichess. Se apoya en lo que el tablero ya sabe hacer con clics: al empezar a arrastrar se «elige» la pieza (`clic(origen)`,
 * que marca sus destinos) y al soltar sobre otra casilla se «elige» el destino (`clic(destino)`). Un toque sin arrastrar sigue siendo un clic común.
 *
 * Uso: cada casilla con `data-casilla`, y en cada casilla con pieza `{...arrastre.propsDeCasilla(casilla, pieza)}`; en cualquier parte del árbol, `{arrastre.fantasma}` (la pieza
 * que sigue al puntero). `arrastre.origenArrastrado` es la casilla de la que se sacó la pieza (para atenuarla) y `arrastre.alClic(casilla, accion)` envuelve el `onClick` de la
 * casilla para que el clic que el navegador manda al soltar no se cuente dos veces.
 */
export default function useArrastrePiezas({ habilitado, puedeArrastrar, seleccionada, clic }) {
  const [movimiento, setMovimiento] = useState(null); // { origen, pieza, x, y, lado }
  const actual = useRef(null);
  const suprimirClic = useRef(false);
  const seleccionadaRef = useRef(seleccionada);
  const clicRef = useRef(clic);
  seleccionadaRef.current = seleccionada;
  clicRef.current = clic;

  const alPresionar = useCallback(
    (evento, casilla, pieza) => {
      if (!habilitado || (evento.button != null && evento.button > 0) || !pieza || !puedeArrastrar(casilla, pieza)) return;
      const lado = evento.currentTarget.getBoundingClientRect().width;
      actual.current = { origen: casilla, pieza, x0: evento.clientX, y0: evento.clientY, moviendo: false, lado };

      const mover = (e) => {
        const estado = actual.current;
        if (!estado) return;
        if (!estado.moviendo) {
          if (Math.hypot(e.clientX - estado.x0, e.clientY - estado.y0) < UMBRAL_PX) return;
          estado.moviendo = true;
          if (seleccionadaRef.current !== estado.origen) clicRef.current(estado.origen); // elige la pieza: se ven sus destinos mientras se arrastra
        }
        if (e.cancelable) e.preventDefault();
        setMovimiento({ origen: estado.origen, pieza: estado.pieza, x: e.clientX, y: e.clientY, lado: estado.lado });
      };

      const soltar = (e) => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        const estado = actual.current;
        actual.current = null;
        setMovimiento(null);
        if (!estado?.moviendo) return;
        suprimirClic.current = true; // el navegador manda un clic al soltar: ya se atendió
        setTimeout(() => {
          suprimirClic.current = false;
        }, 0);
        if (e.type === 'pointercancel') return;
        const destino = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-casilla]')?.getAttribute('data-casilla');
        if (destino && destino !== estado.origen) clicRef.current(destino);
      };

      window.addEventListener('pointermove', mover, { passive: false });
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    },
    [habilitado, puedeArrastrar],
  );

  const propsDeCasilla = (casilla, pieza) =>
    habilitado && pieza && puedeArrastrar(casilla, pieza)
      ? { onPointerDown: (evento) => alPresionar(evento, casilla, pieza), style: { touchAction: 'none' } }
      : {};

  const alClic = (casilla, accion) => {
    if (suprimirClic.current) return;
    accion(casilla);
  };

  const fantasma = movimiento
    ? createPortal(
        <img
          src={rutaImagenPieza(movimiento.pieza)}
          alt=""
          draggable={false}
          style={{
            position: 'fixed',
            left: movimiento.x - movimiento.lado / 2,
            top: movimiento.y - movimiento.lado / 2,
            width: movimiento.lado,
            height: movimiento.lado,
            pointerEvents: 'none',
            zIndex: 200,
            filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.6))',
          }}
        />,
        document.body,
      )
    : null;

  return { propsDeCasilla, alClic, fantasma, origenArrastrado: movimiento?.origen ?? null };
}
