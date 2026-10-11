import { useCallback, useEffect, useRef, useState } from 'react';

/** Cada cuánto se actualiza el reloj en pantalla (el tiempo restado es el real transcurrido, no 200 fijos). */
const INTERVALO_MS = 200;

/** "7:05" (minutos:segundos). Con menos de 10 minutos no lleva cero adelante en los minutos. */
export function formatearReloj(ms) {
  const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}

/**
 * Reloj de ajedrez de dos lados. Descuenta tiempo solo al lado que tiene el turno y solo mientras
 * `enMarcha`; al cambiar el turno el otro lado empieza a correr (como al apretar el reloj de mesa).
 * El estado del reloj vive en la partida (en el servidor): este hook solo lo hace correr en pantalla.
 *
 * - `partidaId`: al cambiar, el reloj se reinicia con `inicial`.
 * - `controlMs`: tiempo por lado de esta partida; `0` o `null` significa sin reloj (igual se mide
 *   cuánto tarda cada turno, para registrar el tiempo de cada jugada).
 * - `inicial`: `{ blancas, negras }` en ms con lo que le queda a cada lado (por ejemplo, al reanudar una
 *   partida); sin esto cada lado arranca con `controlMs`.
 * - `turno`: `"w"` o `"b"`, de quién corre el reloj ahora.
 * - `enMarcha`: `false` mientras la partida no empezó, terminó, está en pausa o es de otra persona.
 *
 * Devuelve `{ tiempos, agotado, ajustar, instantanea }`: `agotado` es el lado que se quedó sin tiempo
 * (`"blancas"`/`"negras"`) o `null`; `ajustar({ blancas, negras })` pone los tiempos que informó el
 * servidor; `instantanea()` da, sin esperar al próximo intervalo, `{ gastadoMs, tiempos }` con lo que
 * tardó el turno actual y lo que le queda a cada lado.
 */
export function useRelojAjedrez({ partidaId, controlMs, inicial, enMarcha, turno }) {
  const control = controlMs || 0;
  const [tiempos, setTiempos] = useState({ blancas: control, negras: control });
  const [agotado, setAgotado] = useState(null);
  const tiemposRef = useRef(tiempos);
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  const gastadoTurnoRef = useRef(0);
  const marcaRef = useRef(null); // instante del último descuento mientras el reloj corre; null si está detenido

  // Nueva partida o nuevo control de tiempo: el reloj arranca con lo que diga la partida.
  useEffect(() => {
    const desde = inicialRef.current;
    const arranque = control
      ? { blancas: desde?.blancas ?? control, negras: desde?.negras ?? control }
      : { blancas: 0, negras: 0 };
    tiemposRef.current = arranque;
    setTiempos(arranque);
    setAgotado(control ? (arranque.blancas <= 0 ? 'blancas' : arranque.negras <= 0 ? 'negras' : null) : null);
  }, [partidaId, control]);

  // Al cambiar de partida o de turno empieza a contarse un turno nuevo (la limpieza del efecto de abajo
  // ya sumó lo que faltaba del turno anterior antes de llegar acá).
  useEffect(() => {
    gastadoTurnoRef.current = 0;
  }, [partidaId, turno]);

  useEffect(() => {
    if (!enMarcha || agotado || !turno) return undefined;
    const lado = turno === 'w' ? 'blancas' : 'negras';
    marcaRef.current = performance.now();

    const descontar = () => {
      const ahora = performance.now();
      const transcurrido = ahora - marcaRef.current;
      marcaRef.current = ahora;
      gastadoTurnoRef.current += transcurrido;
      if (!control) return;
      const restante = Math.max(0, tiemposRef.current[lado] - transcurrido);
      tiemposRef.current = { ...tiemposRef.current, [lado]: restante };
      setTiempos(tiemposRef.current);
      if (restante === 0) setAgotado(lado);
    };

    const intervalo = setInterval(descontar, INTERVALO_MS);
    return () => {
      clearInterval(intervalo);
      // Al cambiar el turno se descuenta lo que faltaba del último intervalo, para no regalarle ese resto al lado que movió.
      descontar();
      marcaRef.current = null;
    };
  }, [enMarcha, control, turno, agotado]);

  const ajustar = useCallback((nuevos) => {
    tiemposRef.current = { blancas: nuevos.blancas, negras: nuevos.negras };
    setTiempos(tiemposRef.current);
  }, []);

  const instantanea = useCallback(() => {
    const pendiente = marcaRef.current == null ? 0 : performance.now() - marcaRef.current;
    const lado = turno === 'w' ? 'blancas' : 'negras';
    const actuales = { ...tiemposRef.current };
    if (control && marcaRef.current != null) actuales[lado] = Math.max(0, actuales[lado] - pendiente);
    return { gastadoMs: gastadoTurnoRef.current + pendiente, tiempos: actuales };
  }, [turno, control]);

  return { tiempos, agotado, ajustar, instantanea };
}
