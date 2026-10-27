import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAXIMO_ANTICIPADAS, coronaAlAnticipar, destinosAnticipados, esDelColor, indicesDeCasilla, matrizConAnticipadas } from './anticipadas';
import { fenAMatriz } from './ajedrez';

/**
 * Jugadas anticipadas de un tablero. Mientras NO es el turno del jugador (`puedeAnticipar`) los clics arman anticipadas (hasta `MAXIMO_ANTICIPADAS`): se elige una pieza propia y
 * una casilla a la que podría ir, y la jugada queda marcada. Cuando le toca (`miTurno`) la primera se comprueba con `obtenerDestinosLegales(origen)` y, si es legal, se juega sola
 * con `jugar(origen, destino, promocion)`; la siguiente espera a que el rival responda. Si una no es legal, se descartan todas. Cambiar de partida o terminarla las borra.
 *
 * Devuelve `{ cola, seleccion, destinos, clic(casilla), cancelar(), matrizMostrada(fen) }`: `clic` devuelve `true` cuando el clic era de una anticipada (el tablero no tiene que
 * hacer nada más) y `matrizMostrada` es el tablero con las anticipadas ya hechas.
 */
export default function useAnticipadas({ fen, miColor, activo, miTurno, puedeAnticipar, obtenerDestinosLegales, jugar, claveDePartida = '' }) {
  const [cola, setCola] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const ejecutando = useRef(false);
  const matrizReal = useMemo(() => (fen ? fenAMatriz(fen) : null), [fen]);
  const matrizVirtual = useMemo(() => (matrizReal ? matrizConAnticipadas(matrizReal, cola) : null), [matrizReal, cola]);

  const cancelar = useCallback(() => {
    setCola([]);
    setSeleccion(null);
  }, []);

  // Otra partida, o esta terminó: no queda nada anticipado.
  useEffect(() => {
    cancelar();
  }, [claveDePartida, activo, cancelar]);

  // Si ya no se puede anticipar (llegó el turno o terminó), tampoco queda una selección a medias.
  useEffect(() => {
    if (!puedeAnticipar) setSeleccion(null);
  }, [puedeAnticipar]);

  // Es mi turno: la primera anticipada se comprueba y se juega.
  useEffect(() => {
    if (!activo || !miTurno || cola.length === 0 || ejecutando.current) return;
    ejecutando.current = true;
    const [primera, ...resto] = cola;
    (async () => {
      try {
        const legales = await obtenerDestinosLegales(primera.origen);
        if (legales.includes(primera.destino)) {
          setCola(resto);
          await jugar(primera.origen, primera.destino, primera.promocion ?? '');
        } else {
          setCola([]);
        }
      } catch {
        setCola([]);
      } finally {
        ejecutando.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, miTurno, cola, fen]);

  const destinos = useMemo(() => (seleccion && matrizVirtual ? destinosAnticipados(matrizVirtual, seleccion, miColor) : []), [seleccion, matrizVirtual, miColor]);

  const clic = useCallback(
    (casilla) => {
      if (!puedeAnticipar || !matrizVirtual) return false;
      const [fila, columna] = indicesDeCasilla(casilla);
      const piezaPropia = esDelColor(matrizVirtual[fila]?.[columna], miColor);
      if (seleccion && destinos.includes(casilla)) {
        if (cola.length < MAXIMO_ANTICIPADAS) {
          const promocion = coronaAlAnticipar(matrizVirtual, seleccion, casilla) ? 'q' : '';
          setCola((actual) => [...actual, { origen: seleccion, destino: casilla, promocion }]);
        }
        setSeleccion(null);
        return true;
      }
      if (piezaPropia && casilla !== seleccion) {
        setSeleccion(casilla);
        return true;
      }
      setSeleccion(null);
      return true;
    },
    [puedeAnticipar, matrizVirtual, miColor, seleccion, destinos, cola.length],
  );

  const matrizMostrada = useCallback((fenReal) => (cola.length > 0 && fenReal === fen ? matrizVirtual : fenReal ? fenAMatriz(fenReal) : null), [cola.length, fen, matrizVirtual]);

  return { cola, seleccion: puedeAnticipar ? seleccion : null, destinos: puedeAnticipar ? destinos : [], clic, cancelar, matrizMostrada };
}
