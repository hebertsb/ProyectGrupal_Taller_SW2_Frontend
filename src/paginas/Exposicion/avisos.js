import { useEffect, useRef, useState } from 'react';

/** `mm:ss` de unos milisegundos (`null` = sin límite → «—:—»). */
export function formatoReloj(ms) {
  if (ms == null) return '—:—';
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Los milisegundos que le quedan a cada lado, contando hacia abajo entre consulta y consulta al backend: el estado trae lo que quedaba al momento de la consulta y quién corre, y acá se sigue
 * descontando en pantalla. Devuelve `null` si la partida no tiene reloj.
 */
export function useRelojEnPantalla(reloj) {
  const [, setLatido] = useState(0);
  const recibidoEn = useRef(performance.now());
  const ultimo = useRef(null);
  if (reloj !== ultimo.current) {
    ultimo.current = reloj;
    recibidoEn.current = performance.now();
  }
  const corre = reloj?.corre ?? null;
  useEffect(() => {
    if (!corre) return undefined;
    const intervalo = setInterval(() => setLatido((n) => n + 1), 250);
    return () => clearInterval(intervalo);
  }, [corre]);
  if (!reloj) return null;
  const pasado = corre ? performance.now() - recibidoEn.current : 0;
  const descontar = (ms, quien) => (ms == null ? null : Math.max(0, ms - (corre === quien ? pasado : 0)));
  return { persona: descontar(reloj.persona_ms, 'persona'), turing: descontar(reloj.turing_ms, 'turing'), corre };
}

let contexto = null;
function pitar(frecuencias) {
  try {
    contexto = contexto ?? new (window.AudioContext || window.webkitAudioContext)();
    if (contexto.state === 'suspended') contexto.resume();
    let inicio = contexto.currentTime;
    frecuencias.forEach((frecuencia) => {
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.frequency.value = frecuencia;
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.22);
      oscilador.connect(ganancia).connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.25);
      inicio += 0.17;
    });
  } catch {
    /* sin audio: la pantalla avisa igual */
  }
}

/** Suena un aviso cuando le toca a la persona (dos notas subiendo) y otro cuando se acaba el tiempo; `activo=false` lo silencia. */
export function useAvisoDeTurno(estado, activo) {
  const anterior = useRef(null);
  const actual = estado?.activa ? estado.estado : null;
  const hayFin = estado?.fin_tiempo ?? null;
  useEffect(() => {
    if (activo && actual === 'esperando_humano' && anterior.current && anterior.current !== 'esperando_humano') pitar([660, 880]);
    if (activo && actual === 'fin' && hayFin) pitar([880, 660, 440]);
    anterior.current = actual;
  }, [actual, hayFin, activo]);
}
