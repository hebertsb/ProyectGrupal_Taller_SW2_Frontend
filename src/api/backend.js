/**
 * Capa de comunicación con el backend real (FastAPI). Solo fetch — sin
 * estado ni JSX. Nada de datos simulados: si el backend no responde, el
 * error se propaga tal cual para que la interfaz lo muestre.
 * Incluye automáticamente el token JWT si existe en localStorage.
 */

async function solicitar(endpoint, opciones = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { "Content-Type": "application/json", ...opciones.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch(endpoint, {
    method: "POST",
    headers,
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

/** Detecta la jugada hecha en el tablero físico (cámara fija) y la aplica (RF11). */
export function moverPartidaDesdeFoto(partidaId) {
  return solicitar(`/partida/${partidaId}/mover-desde-foto`);
}

/** Casillas destino legales para la pieza parada en `casilla`, para resaltarlas al seleccionarla. */
export function obtenerJugadasLegales(partidaId, casilla) {
  return solicitar(`/partida/${partidaId}/jugadas-legales?casilla=${casilla}`, { method: "GET" });
}

/** Análisis jugada por jugada de una partida ya jugada, para la vista de Aprendizaje. */
export function analisisCompletoPartida(partidaId) {
  return solicitar(`/partida/${partidaId}/analisis-completo`, { method: "GET" });
}

export function calcularJugada(fen, nivel) {
  return solicitar("/jugada", { body: JSON.stringify({ fen, nivel }) });
}

export function analizarPosicion(fen, nivel) {
  return solicitar("/analisis", { body: JSON.stringify({ fen, nivel }) });
}

/**
 * Reconoce el tablero. Si se pasa `archivoFoto` (una imagen ya sacada, ej.
 * de la galería del celular), la usa en vez de sacar una foto nueva de la
 * cámara fija — útil para no depender de que la cámara en vivo acierte el
 * encuadre justo en el momento de mostrar el sistema.
 */
export async function reconocerTablero(turno = "w", archivoFoto = null) {
  const token = localStorage.getItem('access_token');
  const datos = new FormData();
  datos.append("turno", turno);
  if (archivoFoto) {
    datos.append("foto_subida", archivoFoto);
  }
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/vision/reconocer", { method: "POST", body: datos, headers });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

/** URL de la última foto de la cámara fija — agregar un timestamp para evitar el caché del navegador. */
export function urlFotoCamara() {
  return `/vision/foto?t=${Date.now()}`;
}

/** Health check del backend — sin auth para que funcione antes de login */
export async function backendEnLinea() {
  try {
    const respuesta = await fetch("/health");
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Autenticación */
export async function login(email, password, rolEsperado) {
  const respuesta = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rol_esperado: rolEsperado }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

/** Gestión de usuarios (solo facilitadores) */

async function solicitarAuth(endpoint, opciones = {}) {
  const token = localStorage.getItem('access_token');
  const respuesta = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...opciones.headers,
    },
    ...opciones,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export function listarUsuarios() {
  return solicitarAuth("/auth/usuarios");
}

export function historialPartidasUsuario(usuarioId, limit = 10, offset = 0) {
  return solicitarAuth(`/auth/usuarios/${usuarioId}/historial-partidas?limit=${limit}&offset=${offset}`);
}
