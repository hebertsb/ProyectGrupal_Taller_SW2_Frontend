/**
 * Capa de comunicación con el backend real (FastAPI). Solo fetch — sin
 * estado ni JSX. Nada de datos simulados: si el backend no responde, el
 * error se propaga tal cual para que la interfaz lo muestre.
 * Incluye automáticamente el token JWT si existe en localStorage.
 */

async function solicitar(endpoint, opciones = {}) {
  const token = localStorage.getItem("access_token");
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
    const error = new Error(detalle?.detail ?? `Error ${respuesta.status}`);
    error.status = respuesta.status; // permite a la UI distinguir 404 de 503, etc.
    throw error;
  }
  return respuesta.json();
}

export function crearPartida(nivel, fenInicial, tipoOponente = "modelo") {
  const cuerpo = {
    nivel,
    tipo_oponente: tipoOponente,
  };
  if (fenInicial) cuerpo.fen_inicial = fenInicial;
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
  return solicitar(`/partida/${partidaId}/mover`, {
    body: JSON.stringify({ jugada }),
  });
}

/** Detecta la jugada hecha en el tablero físico (cámara fija) y la aplica (RF11). */
export function moverPartidaDesdeFoto(partidaId) {
  return solicitar(`/partida/${partidaId}/mover-desde-foto`);
}

/** Casillas destino legales para la pieza parada en `casilla`, para resaltarlas al seleccionarla. */
export function obtenerJugadasLegales(partidaId, casilla) {
  return solicitar(`/partida/${partidaId}/jugadas-legales?casilla=${casilla}`, {
    method: "GET",
  });
}

/**
 * Análisis jugada por jugada de una partida ya jugada, para la vista de
 * Aprendizaje y el Panel de Aprendizaje (tutor Turing). `rango` es opcional
 * ("Principiante" | "Intermedio" | "Avanzado") — el backend todavía no lo
 * lee (ver HU5/HU6, retroalimentación adaptada al nivel, en curso), pero ya
 * se manda: en cuanto el backend lo soporte, la retroalimentación se ajusta
 * sola sin tocar este archivo.
 */
export function analisisCompletoPartida(partidaId, rango) {
  const query = rango ? `?rango=${encodeURIComponent(rango)}` : "";
  return solicitar(`/partida/${partidaId}/analisis-completo${query}`, {
    method: "GET",
  });
}

/**
 * Lanza la ventana nativa de PyBullet en la máquina del backend, sincronizada
 * en vivo con la partida indicada — evita tener que correr `ver_partida_en_vivo.py`
 * a mano con un token copiado del navegador.
 */
export function abrirSimulacion3D(partidaId) {
  return solicitar("/simulacion/abrir-ventana-3d", {
    body: JSON.stringify({ partida_id: partidaId }),
  });
}

/**
 * Prende/apaga, por partida, si el jugador puede ver la simulación 3D, usar
 * la cámara del tablero físico, y/o si la partida se transmite en vivo a los
 * jugadores (`permite_simulacion_3d`, `permite_camara`, `es_demostracion`).
 * Edición parcial — solo facilitadores, y `es_demostracion` solo se puede
 * prender en una partida propia del facilitador (400 si no lo es). Todos los
 * parámetros son opcionales.
 */
export function actualizarPermisosPartida(partidaId, permisos) {
  return solicitar(`/partida/${partidaId}/permisos`, {
    method: "PATCH",
    body: JSON.stringify(permisos),
  });
}

/**
 * Partida que el facilitador marcó como demostración en vivo (`es_demostracion`),
 * si hay alguna — cualquier usuario autenticado puede consultarla, para poder
 * avisarle al jugador que hay una transmisión activa. Devuelve `null` si no hay
 * ninguna. El contrato exacto de "no hay ninguna" todavía puede cambiar del
 * lado del backend (204, 404, o un cuerpo vacío/`{activa: false}`), así que se
 * cubren los casos más probables en vez de asumir uno solo.
 */
export async function obtenerDemostracionActiva() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/partida/demostracion-activa", { method: "GET", headers });
  if (respuesta.status === 204 || respuesta.status === 404) {
    return null;
  }
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const error = new Error(detalle?.detail ?? `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  const datos = await respuesta.json().catch(() => null);
  if (!datos || datos.activa === false) return null;
  return datos;
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
  const token = localStorage.getItem("access_token");
  const datos = new FormData();
  datos.append("turno", turno);
  if (archivoFoto) {
    datos.append("foto_subida", archivoFoto);
  }
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/vision/reconocer", {
    method: "POST",
    body: datos,
    headers,
  });
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

/** Autenticación tradicional */
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

/** Autenticación con Google OAuth (ID Token / Credential) */
export async function loginGoogle(credential, rolSeleccionado = "jugador", claveFacilitador = null) {
  const respuesta = await fetch("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      rol_seleccionado: rolSeleccionado,
      clave_facilitador: claveFacilitador,
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

/** Registro de nueva cuenta */
export async function registro(email, nombre, password, rol = "jugador", claveFacilitador = null) {
  const respuesta = await fetch("/auth/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      nombre,
      password,
      rol,
      clave_facilitador: claveFacilitador,
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

/** Estado del modelo de aprendizaje (disponible, dispositivo, checkpoint, etc.) */
export function estadoModelo() {
  return solicitar("/aprendizaje/estado-modelo", { method: "GET" });
}

/** Inferencia del modelo propio: candidatas, saliencia, etc. */
export function inferenciaModelo(fen) {
  return solicitar("/aprendizaje/inferencia", {
    body: JSON.stringify({ fen }),
  });
}

async function solicitarAuth(endpoint, opciones = {}) {
  const token = localStorage.getItem("access_token");
  const respuesta = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opciones.headers,
    },
    ...opciones,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const error = new Error(detalle?.detail ?? `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

/**
 * Edición del propio perfil — cualquier rol autenticado (RF/HU perfil).
 * Edición parcial: solo se pisan los campos incluidos en `datos`.
 */
export function actualizarPerfil(datos) {
  return solicitarAuth("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

/** Gestión de usuarios (solo facilitadores) */

export function listarUsuarios() {
  return solicitarAuth("/auth/usuarios");
}

export function historialPartidasUsuario(usuarioId, limit = 10, offset = 0) {
  return solicitarAuth(
    `/auth/usuarios/${usuarioId}/historial-partidas?limit=${limit}&offset=${offset}`,
  );
}

/**
 * Historial de partidas del usuario logueado (cualquier rol, no solo
 * facilitador) — para el Panel de Aprendizaje del jugador ("Repaso de tu
 * partida", insignia "Primera partida jugada"). Ya existía en el backend
 * para HU14 (`backend/rutas/ruta_usuario.py`) aunque hasta ahora ningún
 * componente del frontend lo consumía — no hizo falta pedir un endpoint
 * nuevo.
 */
export function historialPartidasPropio(limit = 10, offset = 0) {
  return solicitarAuth(`/usuario/historial-partidas?limit=${limit}&offset=${offset}`);
}

/**
 * Videos por pieza que el facilitador autenticado ya subió — Configuración
 * de Enseñanza. Dict `tipo_pieza -> url`; una pieza ausente significa que
 * se usa el video por defecto del sistema, no que hubo un error.
 */
export function obtenerVideosFacilitador() {
  return solicitarAuth("/facilitador/videos");
}

/**
 * Sube (o reemplaza) el video educativo del facilitador para `tipoPieza`
 * ("rey" | "dama" | "torre" | "alfil" | "caballo" | "peon"). Multipart
 * aparte de `solicitar`/`solicitarAuth`: el content-type con boundary lo
 * arma el navegador solo al mandar un `FormData`, así que acá no se fija
 * "Content-Type" a mano (ver `reconocerTablero` más arriba, mismo patrón).
 * Devuelve `{tipo_pieza, url}`.
 */
export async function subirVideoPieza(tipoPieza, archivo) {
  const token = localStorage.getItem("access_token");
  const datos = new FormData();
  datos.append("archivo", archivo);
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch(`/facilitador/videos/${tipoPieza}`, {
    method: "POST",
    body: datos,
    headers,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const error = new Error(detalle?.detail ?? `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.json();
}
