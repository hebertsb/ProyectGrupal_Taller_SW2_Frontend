/**
 * Capa de comunicación con el backend real (FastAPI). Solo fetch — sin
 * estado ni JSX. Nada de datos simulados: si el backend no responde, el
 * error se propaga tal cual para que la interfaz lo muestre.
 */

async function solicitar(endpoint, opciones = {}) {
  const respuesta = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export function crearPartida(nivel, fenInicial) {
  const cuerpo = fenInicial ? { nivel, fen_inicial: fenInicial } : { nivel };
  return solicitar("/partida", { body: JSON.stringify(cuerpo) });
}

export function obtenerPartida(partidaId) {
  return solicitar(`/partida/${partidaId}`, { method: "GET" });
}

/** Registro de partidas jugadas mientras el backend sigue corriendo (no sobrevive un reinicio). */
export function listarPartidas() {
  return solicitar("/partida", { method: "GET" });
}

export function moverPartida(partidaId, jugada) {
  return solicitar(`/partida/${partidaId}/mover`, { body: JSON.stringify({ jugada }) });
}

export function calcularJugada(fen, nivel) {
  return solicitar("/jugada", { body: JSON.stringify({ fen, nivel }) });
}

export function analizarPosicion(fen, nivel) {
  return solicitar("/analisis", { body: JSON.stringify({ fen, nivel }) });
}

export function reconocerTablero(turno = "w") {
  return solicitar("/vision/reconocer", { body: JSON.stringify({ turno }) });
}

/** URL de la última foto de la cámara fija — agregar un timestamp para evitar el caché del navegador. */
export function urlFotoCamara() {
  return `/vision/foto?t=${Date.now()}`;
}

export async function backendEnLinea() {
  try {
    const respuesta = await fetch("/health");
    return respuesta.ok;
  } catch {
    return false;
  }
}
