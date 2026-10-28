import { useEffect, useState } from 'react';
import { preparacionPartidaFisica } from '../../api/backend';

const CADA_MS = 3000;
const CADA_OCULTA_MS = 10000;

/**
 * La lista de verificación del backend (cámara, brazo, Turing, Stockfish…), consultada cada pocos segundos mientras la pantalla de preparación está abierta. Solo lee: no mueve ni cambia nada del brazo.
 * Devuelve `{ items, error }`: `items` es `null` hasta la primera respuesta; `error` es el mensaje si el backend no contestó.
 */
export default function usePreparacion(activo = true) {
  const [datos, setDatos] = useState({ items: null, error: null });
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let temporizador = null;
    async function consultar() {
      try {
        const respuesta = await preparacionPartidaFisica();
        if (vivo) setDatos({ items: respuesta.items, error: null });
      } catch (e) {
        if (vivo) setDatos((anterior) => ({ items: anterior.items, error: e.message }));
      }
      if (vivo) temporizador = setTimeout(consultar, document.hidden ? CADA_OCULTA_MS : CADA_MS);
    }
    consultar();
    return () => {
      vivo = false;
      clearTimeout(temporizador);
    };
  }, [activo]);
  return datos;
}
