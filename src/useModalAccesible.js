import { useEffect, useRef } from 'react';

const SELECTOR_ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cuántos diálogos que bloquean el desplazamiento del fondo hay abiertos. El fondo se desbloquea recién cuando se
 * cierra el último, así que dos diálogos apilados no se pisan al restaurar el estilo.
 */
let bloqueosDeScroll = 0;
let overflowOriginal = '';

/** Diálogos abiertos, el último es el de arriba: solo ese responde a Escape y a Tab (si no, se cerrarían todos de un golpe). */
const pilaDeModales = [];

function bloquearScrollDelFondo() {
  if (bloqueosDeScroll === 0) {
    overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bloqueosDeScroll += 1;
}

function liberarScrollDelFondo() {
  bloqueosDeScroll = Math.max(0, bloqueosDeScroll - 1);
  if (bloqueosDeScroll === 0) document.body.style.overflow = overflowOriginal;
}

/**
 * Comportamiento accesible de un diálogo modal (mismo criterio que AvisoNivelCalculado): al abrirse el foco entra al
 * diálogo, Tab y Mayús+Tab se quedan adentro, Escape llama a `alCerrar`, el fondo no se desplaza y al cerrarse el foco
 * vuelve a donde estaba. Escape se atiende en la fase de captura y corta la propagación: si hay otro modal debajo, no
 * se cierra también.
 *
 * `dialogoRef` es el elemento con `role="dialog"`; `focoInicialRef` (opcional) es el botón que recibe el foco al abrir
 * (si falta, el primer elemento enfocable). `alCerrar` puede cambiar en cada render sin reenganchar los eventos.
 */
export default function useModalAccesible(dialogoRef, { alCerrar = null, focoInicialRef = null } = {}) {
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  }, [alCerrar]);

  useEffect(() => {
    const elementoPrevio = document.activeElement;
    const dialogo = dialogoRef.current;
    const ficha = {};
    pilaDeModales.push(ficha);
    bloquearScrollDelFondo();

    const enfocables = () =>
      dialogo ? Array.from(dialogo.querySelectorAll(SELECTOR_ENFOCABLES)).filter((nodo) => nodo.offsetParent !== null) : [];

    (focoInicialRef?.current ?? enfocables()[0] ?? dialogo)?.focus?.();

    function alPulsarTecla(evento) {
      if (pilaDeModales[pilaDeModales.length - 1] !== ficha) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        alCerrarRef.current?.();
        return;
      }
      if (evento.key !== 'Tab' || !dialogo) return;
      const nodos = enfocables();
      if (nodos.length === 0) {
        evento.preventDefault();
        dialogo.focus();
        return;
      }
      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      if (!dialogo.contains(document.activeElement)) {
        // El foco se fue a otro lado (por ejemplo otro modal que se abrió después): se lo trae de vuelta.
        evento.preventDefault();
        primero.focus();
      } else if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    window.addEventListener('keydown', alPulsarTecla, true);
    return () => {
      window.removeEventListener('keydown', alPulsarTecla, true);
      const posicion = pilaDeModales.indexOf(ficha);
      if (posicion >= 0) pilaDeModales.splice(posicion, 1);
      liberarScrollDelFondo();
      elementoPrevio?.focus?.();
    };
  }, [dialogoRef, focoInicialRef]);
}
