/**
 * Capa de comunicación con el backend real (FastAPI). Solo fetch — sin
 * estado ni JSX. Nada de datos simulados: si el backend no responde, el
 * error se propaga tal cual para que la interfaz lo muestre.
 * Incluye automáticamente el token JWT de la sesión (ver api/sesion.js).
 */

import { leerSesion, actualizarSesion } from "./sesion";

async function solicitar(endpoint, opciones = {}) {
  const token = leerSesion("access_token");
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

/** `controlTiempoMs`: tiempo de reloj de cada lado para toda la partida (0 = sin reloj). */
export function crearPartida(nivel, fenInicial, tipoOponente = "modelo", controlTiempoMs = 0) {
  const cuerpo = {
    nivel,
    tipo_oponente: tipoOponente,
    control_tiempo_ms: controlTiempoMs,
  };
  if (fenInicial) cuerpo.fen_inicial = fenInicial;
  return solicitar("/partida", { body: JSON.stringify(cuerpo) });
}

export function obtenerPartida(partidaId) {
  return solicitar(`/partida/${partidaId}`, { method: "GET" });
}

/**
 * Análisis jugada por jugada de una partida con la red propia (solo facilitador):
 * qué elegiría la red en cada posición frente a lo que se jugó. No usa Stockfish.
 */
export function analisisRedPartida(partidaId) {
  return solicitarAuth(`/partida/${partidaId}/analisis-red`);
}

/**
 * Arma el `Error` de una respuesta HTTP fallida: usa el `detail` del backend
 * solo si es texto (un 422 de FastAPI manda una lista, que no sirve mostrar
 * tal cual) y conserva el `status` para que la UI distinga 404, 409, 403, etc.
 */
async function errorDeRespuesta(respuesta) {
  const detalle = await respuesta.json().catch(() => null);
  const mensaje = typeof detalle?.detail === "string" ? detalle.detail : `Error ${respuesta.status}`;
  const error = new Error(mensaje);
  error.status = respuesta.status;
  return error;
}

/**
 * Partida sin terminar del usuario autenticado, para ofrecer retomarla en vez
 * de crear otra al abrir la Sala de Control. Devuelve `null` si no hay ninguna
 * (el backend responde `null` o 204). Campos nuevos opcionales: `estado`,
 * `iniciada_en`, `actualizada_en`, `jugadas_jugador`. Si el endpoint todavía no
 * existe en el backend desplegado lanza el error con su `status` (404/405): quien
 * llama decide degradar al flujo de siempre.
 */
export async function obtenerPartidaEnCurso() {
  const token = leerSesion("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/partida/en-curso", { method: "GET", headers });
  if (respuesta.status === 204) return null;
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  const datos = await respuesta.json().catch(() => null);
  return datos && typeof datos === "object" ? datos : null;
}

/** Registro de partidas jugadas mientras el backend sigue corriendo (no sobrevive un reinicio). */
export function listarPartidas() {
  return solicitar("/partida", { method: "GET" });
}

/**
 * `tiempos`: lo que mide la pantalla de la jugada — `tiempoJugadaMs` (cuánto tardó en decidirla, o
 * `null` si no se midió) y `relojBlancasMs` (lo que le queda en el reloj).
 */
export function moverPartida(partidaId, jugada, tiempos = {}) {
  const cuerpo = { jugada };
  if (tiempos.tiempoJugadaMs != null) cuerpo.tiempo_jugada_ms = Math.round(tiempos.tiempoJugadaMs);
  if (tiempos.relojBlancasMs != null) cuerpo.reloj_blancas_ms = Math.round(tiempos.relojBlancasMs);
  return solicitar(`/partida/${partidaId}/mover`, { body: JSON.stringify(cuerpo) });
}

/**
 * Guarda en la partida lo que le queda a cada lado en el reloj (o, antes de la primera jugada, cambia
 * el control de tiempo). Con `alCerrar` usa `keepalive` para que el pedido salga aunque se cierre la
 * pestaña; ese caso no espera ni devuelve respuesta.
 */
export function guardarRelojPartida(partidaId, { blancasMs, negrasMs, controlTiempoMs } = {}, alCerrar = false) {
  const cuerpo = {};
  if (blancasMs != null) cuerpo.blancas_ms = Math.round(blancasMs);
  if (negrasMs != null) cuerpo.negras_ms = Math.round(negrasMs);
  if (controlTiempoMs != null) cuerpo.control_tiempo_ms = controlTiempoMs;
  if (alCerrar) {
    const token = leerSesion("access_token");
    fetch(`/partida/${partidaId}/reloj`, {
      method: "PUT",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(cuerpo),
    }).catch(() => {});
    return Promise.resolve(null);
  }
  return solicitar(`/partida/${partidaId}/reloj`, { method: "PUT", body: JSON.stringify(cuerpo) });
}

/**
 * Señal de vida de una partida con reloj: avisa que el jugador sigue en la pantalla. Una partida con reloj no se puede
 * dejar: si pasan más de 20 segundos sin esta señal el servidor la da por perdida (o la borra si casi no se jugó). La
 * respuesta es el estado de la partida: `estado === "abandonada"` (con `terminada` y `resultado: "0-1"`) avisa que ya se
 * perdió; 404 si se borró por abandono. Hay que mandarla cada pocos segundos y solo mientras la pantalla está a la vista.
 */
export function registrarPresenciaPartida(partidaId) {
  return solicitar(`/partida/${partidaId}/presencia`, { body: "{}" });
}

/**
 * Informa que a un lado ("blancas" = el jugador, "negras" = el rival) se le acabó el reloj: la partida
 * termina y gana el otro. El reloj corre en la pantalla; el servidor solo registra el resultado.
 */
export function terminarPartidaPorTiempo(partidaId, lado) {
  return solicitar(`/partida/${partidaId}/tiempo-agotado`, {
    body: JSON.stringify({ lado }),
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
  const token = leerSesion("access_token");
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
  const token = leerSesion("access_token");
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

/**
 * Captura una foto de la cámara fija. Va con fetch y el token porque un
 * <img src> no manda el header Authorization y la ruta exige sesión. Devuelve
 * un object URL (JPEG), listo para un <img src>; quien lo use es responsable
 * de revocarlo con `URL.revokeObjectURL` cuando ya no haga falta.
 */
export async function obtenerUrlFotoCamara() {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/vision/foto", { headers, cache: "no-store" });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  const blob = await respuesta.blob();
  return URL.createObjectURL(blob);
}

/**
 * Pide al backend la foto subida enderezada con la grilla 8x8 dibujada
 * encima — prueba visual de que la detección geométrica del tablero
 * encontró las esquinas y alineó bien, sin depender del clasificador de
 * piezas. Devuelve un object URL (JPEG), listo para un <img src=...>; quien
 * lo use es responsable de revocarlo con `URL.revokeObjectURL` cuando ya no
 * haga falta.
 */
export async function obtenerUrlGrillaDebug(archivoFoto) {
  const token = leerSesion("access_token");
  const datos = new FormData();
  datos.append("foto_subida", archivoFoto);
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/vision/grilla-debug", {
    method: "POST",
    body: datos,
    headers,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  const blob = await respuesta.blob();
  return URL.createObjectURL(blob);
}

/** Estado de la cámara fija: {fuente, disponible, ancho, alto, latencia_ms, error}. */
export function obtenerEstadoVision(camara = "principal") {
  return solicitar(`/vision/estado?camara=${camara}`, { method: "GET" });
}

/**
 * Calibración del tablero: `{calibrada, esquinas}` con esquinas
 * `{a1, h1, h8, a8}` como `[x, y]` en píxeles de la foto de GET /vision/foto
 * (o `null` si no hay calibración).
 */
export function obtenerCalibracionTablero() {
  return solicitar("/vision/calibracion", { method: "GET" });
}

/** Guarda las 4 esquinas; si el backend las rechaza (422) el error trae su `detail`. */
export function guardarCalibracionTablero(esquinas) {
  return solicitar("/vision/calibracion", { method: "PUT", body: JSON.stringify({ esquinas }) });
}

/**
 * Estado de la calibración del tablero con su vigencia: `{calibrada, vigente, motivo_no_vigente, esquinas, fecha, resolucion,
 * fuente, advertencias}`. `vigente` es `null` si no se pudo verificar (la cámara no entrega imagen).
 */
export function obtenerEstadoCalibracion(camara = "principal") {
  return solicitar(`/vision/calibracion/estado?camara=${camara}`, { method: "GET" });
}

function formularioDeCalibracion(esquinas, foto, camara = "principal") {
  const formulario = new FormData();
  formulario.append("camara", camara);
  formulario.append("esquinas", JSON.stringify(esquinas));
  formulario.append("foto", foto, "foto.jpg");
  return formulario;
}

/**
 * Guarda la calibración con la foto sobre la que se marcaron las esquinas (de ahí salen la resolución y la referencia para
 * detectar que la cámara se movió). Devuelve el estado, con `advertencias` si algo se ve dudoso; 422 = esquinas inválidas.
 */
export function guardarCalibracionConFoto(esquinas, foto, camara = "principal") {
  return solicitarFormulario("/vision/calibracion/guardar", formularioDeCalibracion(esquinas, foto, camara));
}

/**
 * Vista previa del tablero enderezado con la grilla 8x8 para esas esquinas, sin guardar. Devuelve un object URL (JPEG); quien
 * lo use debe revocarlo con `URL.revokeObjectURL`.
 */
export async function previsualizarCalibracion(esquinas, foto, camara = "principal") {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const respuesta = await fetch("/vision/calibracion/previsualizar", {
    method: "POST",
    headers,
    body: formularioDeCalibracion(esquinas, foto, camara),
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}

/**
 * Compara una foto de la cámara fija con la de referencia de la calibración: `{movida, desplazamiento_px, coincidencias, mensaje}`.
 * `movida` es `null` si no se pudo comparar.
 */
export function comprobarCalibracion(camara = "principal") {
  const formulario = new FormData();
  formulario.append("camara", camara);
  return solicitarFormulario("/vision/calibracion/comprobar", formulario);
}

/** Quita la calibración de una cámara (esquinas, metadata y referencia). La principal vuelve a la detección automática. */
export function quitarCalibracionCamara(camara = "principal") {
  return solicitar(`/vision/calibracion/quitar?camara=${camara}`, { method: "DELETE" });
}

/** Quita la calibración y vuelve a la detección automática. */
export function quitarCalibracionTablero() {
  return solicitar("/vision/calibracion", { method: "DELETE" });
}

/**
 * Foto actual de la cámara (o con la grilla de depuración dibujada si
 * `grilla` es true). Va con fetch y token porque <img src> no manda el header
 * Authorization. Devuelve `{ url, blob }`: `url` es un object URL para el <img>
 * (quien lo use debe revocarlo con `URL.revokeObjectURL`) y `blob` sirve para
 * reenviar la misma foto a `reconocerTablero`.
 */
export async function obtenerFotoVision(grilla = false, camara = "principal") {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch(`/vision/foto?grilla=${grilla ? "true" : "false"}&camara=${camara}`, {
    headers,
    cache: "no-store",
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
  const blob = await respuesta.blob();
  return { url: URL.createObjectURL(blob), blob };
}

/**
 * Entrenar cámara: junta muestras etiquetadas del tablero real. Guarda una captura con la
 * colocación de piezas que el facilitador armó (`fenPiezas`, solo la parte de piezas del FEN).
 * Devuelve `{captura_id, guardadas, total}`; 422 = FEN inválido o tablero no detectado, 503 = cámara.
 */
export function guardarFotoDataset(fenPiezas, soloPiezas = false) {
  const cuerpo = { fen_piezas: fenPiezas };
  if (soloPiezas) cuerpo.solo_piezas = true; // guarda solo las casillas ocupadas, sin "vacía"
  return solicitar("/vision/dataset/foto", { method: "POST", body: JSON.stringify(cuerpo) });
}

/** POST multipart con token. No fija Content-Type: el navegador agrega el boundary solo. */
async function solicitarFormulario(endpoint, formulario) {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const respuesta = await fetch(endpoint, { method: "POST", headers, body: formulario });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const texto = typeof detalle?.detail === "string" ? detalle.detail : null;
    const error = new Error(texto ?? (respuesta.status === 413 ? "la imagen es demasiado grande" : `Error ${respuesta.status}`));
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

/**
 * Sube fotos sueltas de una sola pieza (o casilla vacía) a una clase del dataset.
 * `fotos` es una lista de File/Blob. Devuelve `{guardadas, total_clase}`; 422 = clase inválida o
 * imagen ilegible, 413 = muy grande.
 */
export function subirFotosPieza(clase, fotos) {
  const formulario = new FormData();
  formulario.append("clase", clase);
  fotos.forEach((foto) => formulario.append("fotos", foto, foto.name || "foto.jpg"));
  return solicitarFormulario("/vision/dataset/pieza", formulario);
}

/**
 * Guarda como muestra de `clase` (ej. "black-pawn", o "vacia") la casilla `casilla` tal como la ven ahora las cámaras (todas las calibradas, o solo `camaras`), para que el
 * reentrenamiento aprenda de un error del reconocimiento. Devuelve `{guardadas, camaras, avisos, total_clase}`.
 */
export const corregirCasillaDataset = (casilla, clase, camaras) =>
  solicitar("/vision/dataset/casilla", { method: "POST", body: JSON.stringify({ casilla, clase, ...(camaras ? { camaras } : {}) }) });

/**
 * Lanza el entrenamiento de un modelo candidato con el dataset propio (incluidas las casillas corregidas), en la GPU del Mac si hay. Solo reemplaza al
 * modelo actual si lo supera en validación. `recorte`: `ampliado` (2D, la casilla con margen) o `volumen` (3D, la caja de la pieza). Usa solo fotos de la cámara principal; con `soloPosicionActual`, las tomadas desde su última calibración; con `incluirSecundaria` suma, solo para entrenar, las de la secundaria tomadas desde arriba. Devuelve `{estado: "en_curso"}`; 409 = ya hay uno corriendo, 400 = faltan muestras.
 */
export const entrenarCandidatoPiezas = (recorte = "ampliado", soloPosicionActual = true, incluirSecundaria = false) =>
  solicitar(`/vision/dataset/candidato?recorte=${recorte}&solo_posicion_actual=${soloPosicionActual}&incluir_secundaria=${incluirSecundaria}`, { method: "POST" });

/** Estado del entrenamiento del candidato: `{estado: "inactivo"|"en_curso"|"terminado"|"error", progreso, resultado, log}`. */
export const estadoCandidatoPiezas = () => solicitar("/vision/dataset/candidato/estado", { method: "GET" });

/**
 * Sube una foto del tablero entero (hecha a mano) etiquetada con la colocación de piezas del FEN.
 * Devuelve `{captura_id, guardadas, total}`; 422 = FEN inválido o tablero no detectado, 413 = muy grande.
 */
export function subirFotoTablero(fenPiezas, foto) {
  const formulario = new FormData();
  formulario.append("fen_piezas", fenPiezas);
  formulario.append("foto", foto, foto.name || "tablero.jpg");
  return solicitarFormulario("/vision/dataset/foto-tablero", formulario);
}

/**
 * Imagen de control (foto enderezada con grilla) de la última captura. Va con fetch y token
 * porque <img src> no manda Authorization. Devuelve un object URL; quien lo use debe revocarlo.
 * `?t=` evita que el navegador reutilice una imagen anterior.
 */
export async function obtenerUrlControlDataset() {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const respuesta = await fetch(`/vision/dataset/control?t=${Date.now()}`, { headers, cache: "no-store" });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}

/** Contadores del dataset: `{por_clase: {clase: n}, total, capturas, minimo_recomendado}`. */
export function obtenerResumenDataset() {
  return solicitar("/vision/dataset/resumen", { method: "GET" });
}

/** Borra una captura entera (todas sus muestras). Devuelve `{borradas}`. */
export function borrarCapturaDataset(capturaId) {
  return solicitar(`/vision/dataset/captura/${encodeURIComponent(capturaId)}`, { method: "DELETE" });
}

/** Inicia el reentrenamiento del clasificador. 409 = ya hay uno corriendo, 400 = pocas muestras. */
export function reentrenarClasificador() {
  return solicitar("/vision/dataset/reentrenar", { method: "POST" });
}

/** Estado del reentrenamiento: `{estado: "inactivo"|"en_curso"|"terminado"|"error", log}`. */
export function obtenerEstadoReentrenamiento() {
  return solicitar("/vision/dataset/reentrenar/estado", { method: "GET" });
}

/** Estado del brazo: {modo: "simulado"|"real", host, conectado: bool|null, ultima_jugada}. */
export function obtenerEstadoBrazo() {
  return solicitar("/brazo/estado", { method: "GET" });
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

/**
 * Segundo paso del login de una cuenta con verificación en dos pasos: la constancia que devolvió `login` (`token_2fa`) y el código de
 * 6 dígitos de la app (o uno de respaldo). Devuelve lo mismo que `login`: `{ usuario, tokens }`. 401 si el código no sirve.
 */
export async function login2fa(token2fa, codigo) {
  const respuesta = await fetch("/auth/login/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token_2fa: token2fa, codigo }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(typeof detalle?.detail === "string" ? detalle.detail : `Error ${respuesta.status}`);
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

/**
 * Registro de nueva cuenta. `familia` (solo jugadores): `{edad, tutorNombre, tutorTelefono, autorizacionTutor}`; la edad es obligatoria en la web, y si el jugador
 * es menor puede declarar la autorización de su madre, padre o tutor (con su nombre y teléfono).
 */
export async function registro(email, nombre, password, rol = "jugador", claveFacilitador = null, familia = {}) {
  const respuesta = await fetch("/auth/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      nombre,
      password,
      rol,
      clave_facilitador: claveFacilitador,
      edad: familia.edad ?? null,
      tutor_nombre: familia.tutorNombre || null,
      tutor_telefono: familia.tutorTelefono || null,
      tutor_email: familia.tutorEmail || null,
      autorizacion_tutor: Boolean(familia.autorizacionTutor),
    }),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(mensajeDeDetalle(detalle?.detail) ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

/** Texto legible del `detail` de un error de FastAPI: una frase, o la primera regla de validación que falló (422). */
function mensajeDeDetalle(detalle) {
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle) && typeof detalle[0]?.msg === "string") return detalle[0].msg.replace(/^Value error, /, "");
  return null;
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
  const token = leerSesion("access_token");
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
    // Un 422 de FastAPI manda `detail` como lista: mostrarla tal cual daría "[object Object]".
    const detalle = await respuesta.json().catch(() => null);
    const mensaje = typeof detalle?.detail === "string" ? detalle.detail : `Error ${respuesta.status}`;
    const error = new Error(mensaje);
    error.status = respuesta.status;
    throw error;
  }
  return respuesta.json();
}

/**
 * Perfil actual del usuario autenticado, leído del servidor. El `usuario` que
 * la web guarda en localStorage al loguear no se actualiza solo: esto sirve
 * para traer el nivel recalibrado (`nivel_estimado`, `rango_estimado`) y los
 * campos `diagnostico_completado` / `partidas_calibradas`.
 */
export function obtenerPerfil() {
  return solicitarAuth("/auth/me");
}

/**
 * Calibra el nivel del jugador con una partida terminada: el backend la
 * analiza contra Stockfish (tarda unos segundos) y devuelve si quedó
 * registrada (`registrada`), el motivo si no (`motivo`), la precisión y el
 * nivel/rango nuevo. Es idempotente: repetirla para la misma partida responde
 * `motivo: "ya_registrada"`.
 */
export function calibrarPartida(partidaId) {
  return solicitarAuth(`/partida/${partidaId}/calibrar`, { method: "POST" });
}

/**
 * Nivel medido del jugador para la sección "Tu nivel": nivel/rango, progreso
 * hacia el siguiente nivel, últimas calibraciones y la escala vigente.
 */
export function obtenerNivelJugador() {
  return solicitarAuth("/auth/nivel");
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

/**
 * Guarda el nivel/rango que el jugador elige a mano en Mi Perfil. Mismo
 * endpoint que ya usa el diagnóstico "Mide tu nivel" de la app móvil
 * (`PATCH /auth/nivel-estimado`, ver game_screen.dart) — acá no hay
 * diagnóstico, es autoselección directa, así que se reusan los mismos pares
 * nivel/rango que ya define la app móvil para que ambas plataformas hablen
 * el mismo idioma (Avanzado→18, Intermedio→11, Principiante→5). El backend
 * puede recalibrar este valor más adelante solo, analizando partidas reales
 * — esto solo pisa el punto de partida.
 */
export function guardarNivelEstimado(nivel, rango) {
  return solicitarAuth("/auth/nivel-estimado", {
    method: "PATCH",
    body: JSON.stringify({ nivel, rango }),
  });
}

/**
 * Sube (o reemplaza) la foto de perfil real del usuario autenticado — multipart,
 * mismo patrón que `subirVideoPieza`. Devuelve el `UsuarioResponse` actualizado
 * (con la nueva `avatar_url`). Pedido a backend-fastapi (`POST /auth/foto`),
 * puede no estar listo todavía — si no existe, la UI lo trata igual que
 * cualquier otro endpoint en construcción (404/405).
 */
export async function subirFotoPerfil(archivo) {
  const token = leerSesion("access_token");
  const datos = new FormData();
  datos.append("archivo", archivo);
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/auth/foto", {
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

/**
 * Darme de baja: elimina mi propia cuenta y todo lo mío, para siempre. Vuelve a comprobar quién soy: `password`, o
 * `confirmarEmail` (mi correo completo) si la cuenta entra solo con Google. 401 si no coincide, 429 si falló demasiadas veces.
 */
export function eliminarMiCuenta({ password = null, confirmarEmail = null }) {
  return solicitarAuth("/auth/me/eliminar", {
    method: "POST",
    body: JSON.stringify({ password, confirmar_email: confirmarEmail }),
  });
}

/** Confirma el correo con el código de 6 dígitos que llegó por mail. Devuelve el usuario ya verificado; 400 si el código no sirve. */
export function verificarCorreo(codigo) {
  return solicitarAuth("/auth/verificar-correo", { method: "POST", body: JSON.stringify({ codigo }) });
}

/** Pide un código nuevo para verificar el correo (el anterior deja de servir). 429 si se pidió hace menos de un minuto. */
export function reenviarCodigoCorreo() {
  return solicitarAuth("/auth/verificar-correo/reenviar", { method: "POST" });
}

/** Últimas acciones de los administradores sobre cuentas, instituciones y códigos (solo la plataforma). */
export function listarAuditoria({ limite = 100, accion = null } = {}) {
  const consulta = new URLSearchParams({ limite: String(limite) });
  if (accion) consulta.set("accion", accion);
  return solicitarAuth(`/auditoria?${consulta.toString()}`);
}

/** Genera el secreto para vincular la app de códigos (todavía sin activar): `{ secreto, uri }`, la `uri` es lo que dibuja el QR. */
export function prepararDobleFactor() {
  return solicitarAuth("/auth/2fa/preparar", { method: "POST" });
}

/** Activa la verificación en dos pasos con el primer código de la app. Devuelve `{ codigos_respaldo }`: se ven una sola vez. */
export function activarDobleFactor(codigo) {
  return solicitarAuth("/auth/2fa/activar", { method: "POST", body: JSON.stringify({ codigo }) });
}

/** Desactiva la verificación en dos pasos (pide la contraseña, si la cuenta tiene, y un código). Devuelve el usuario actualizado. */
export function desactivarDobleFactor({ password = null, codigo }) {
  return solicitarAuth("/auth/2fa/desactivar", { method: "POST", body: JSON.stringify({ password, codigo }) });
}

/** Le quita el doble factor a una cuenta que perdió el celular y los códigos (solo la plataforma). Devuelve el usuario actualizado. */
export function reiniciarDobleFactorDe(usuarioId) {
  return solicitarAuth(`/auth/usuarios/${usuarioId}/2fa/reiniciar`, { method: "POST" });
}

/** Gestión de usuarios (solo facilitadores) */

export function listarUsuarios() {
  return solicitarAuth("/auth/usuarios");
}

/** Edita a un usuario (solo facilitadores). `campos` lleva solo lo que cambió. */
export function editarUsuario(usuarioId, campos) {
  return solicitarAuth(`/auth/usuarios/${usuarioId}`, { method: "PATCH", body: JSON.stringify(campos) });
}

/**
 * Genera un código de invitación para un nuevo facilitador (un solo uso, vence a los `minutos`). El código
 * viene en la respuesta una única vez: el servidor solo guarda su hash.
 */
export function generarCodigoFacilitador(minutos = 15, para = null, { institucionId = null, comoAdministrador = false } = {}) {
  return solicitarAuth("/auth/codigos-facilitador", {
    method: "POST",
    body: JSON.stringify({ minutos, para, institucion_id: institucionId, como_administrador: comoAdministrador }),
  });
}

/**
 * Comprueba un código de invitación SIN gastarlo (no requiere sesión): `{ valido, segundos_restantes, institucion_nombre, como_administrador,
 * es_evaluacion }` (lo último, si es de una institución).
 * Responde 429 si ese cliente ya probó demasiados códigos incorrectos.
 */
export function verificarCodigoFacilitador(codigo) {
  return solicitar("/auth/codigos-facilitador/verificar", { body: JSON.stringify({ codigo }) });
}

/** Códigos de invitación generados, con su estado (vigente, usado, vencido), sin su valor. */
export function listarCodigosFacilitador() {
  return solicitarAuth("/auth/codigos-facilitador");
}

/** Anula un código que todavía no se usó. */
export async function anularCodigoFacilitador(codigoId) {
  const token = leerSesion("access_token");
  const respuesta = await fetch(`/auth/codigos-facilitador/${codigoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.detail ?? `Error ${respuesta.status}`);
  }
}

/** Elimina a un usuario y todo lo suyo (solo facilitadores). No se puede deshacer. */
export function eliminarUsuario(usuarioId) {
  return solicitarAuth(`/auth/usuarios/${usuarioId}`, { method: "DELETE" });
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
 * Estadísticas personales del usuario logueado (HU14): partidas, victorias, precisión, racha,
 * errores más frecuentes, partidas por rival y progreso por semana. Calculadas al vuelo en el
 * backend (`GET /usuario/estadisticas`), nada se guarda aparte.
 */
export function obtenerEstadisticasPropias() {
  return solicitarAuth("/usuario/estadisticas");
}

/**
 * Videos PROPIOS por pieza que el facilitador autenticado ya subió — Configuración
 * de Enseñanza. Dict `tipo_pieza -> url`; una pieza ausente significa que no tiene
 * video propio de esa pieza, no que hubo un error. Los del facilitador principal
 * son los videos generales que ve todo jugador; los de otro facilitador reemplazan
 * al general, solo en esa pieza, para los jugadores de sus cursos. Para borrar uno,
 * `quitarVideoPieza`.
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
  const token = leerSesion("access_token");
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

/**
 * Borra el video PROPIO del facilitador para `tipoPieza` (solo facilitadores): sus jugadores vuelven a ver el
 * video general de esa pieza. Para el facilitador principal su video propio ES el general, así que borrarlo
 * deja esa pieza sin video general. 204 sin cuerpo; 404 si no tenía video propio de esa pieza; 400 si la
 * pieza no es válida.
 */
export function quitarVideoPieza(tipoPieza) {
  return solicitarAuthSinCuerpo(`/facilitador/videos/${encodeURIComponent(tipoPieza)}`, { method: "DELETE" });
}

/**
 * Igual que `solicitarAuth` pero para los endpoints que responden 204 sin cuerpo (no hay JSON que
 * parsear). Si falla lanza el `Error` con el `detail` del backend y el `status` HTTP.
 */
async function solicitarAuthSinCuerpo(endpoint, opciones = {}) {
  const token = leerSesion("access_token");
  const respuesta = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...opciones,
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
}

/** Cursos: el facilitador arma grupos con un código y el jugador entra con él */

/**
 * Crea un curso (facilitador). Devuelve `{id, nombre, codigo, acepta_ingresos, estudiantes, cupo, creado_en,
 * facilitador_id, facilitador_nombre, preset_ensenanza, preset_efectivo}`; el código viene con guion (ej.
 * `K7Q-M4T`). Máximo 20 cursos por facilitador (400 con mensaje). Un facilitador principal puede pasar
 * `facilitadorId` para crearlo a nombre de otro facilitador activo (403 si no es principal; 400 si el destino no
 * sirve). `cupo` (entero de 1 a 120) es la cantidad máxima de alumnos: solo se manda si viene, y sin él el backend
 * usa 60 (422 si está fuera de rango). `presetEnsenanza` (`"infantil" | "estandar" | "adultos"`) es el tono con el
 * que Turing les habla a los alumnos del curso: solo se manda si viene, y sin él el curso hereda el tono del perfil
 * del facilitador.
 */
export function crearCurso(nombre, facilitadorId = null, cupo = null, presetEnsenanza = null) {
  const cuerpo = { nombre };
  if (facilitadorId != null) cuerpo.facilitador_id = facilitadorId;
  if (cupo != null) cuerpo.cupo = cupo;
  if (presetEnsenanza != null) cuerpo.preset_ensenanza = presetEnsenanza;
  return solicitarAuth("/cursos", { method: "POST", body: JSON.stringify(cuerpo) });
}

/**
 * Cursos del facilitador autenticado, con su código, cuántos estudiantes tiene cada uno y su `cupo`. Cada curso trae
 * además `preset_ensenanza` (el tono propio del curso, o `null` si hereda) y `preset_efectivo` (el tono que realmente
 * se usa: el del curso, o el del perfil del facilitador, o `null` si ninguno eligió). Con `todos` un facilitador
 * principal pide los de todos los facilitadores (`?todos=true`; 403 si no es principal).
 */
export function listarCursos(todos = false) {
  return solicitarAuth(todos ? "/cursos?todos=true" : "/cursos");
}

/**
 * Renombra un curso, abre o cierra los ingresos, cambia su cupo, su tono y/o lo reasigna (facilitador). `campos`
 * lleva solo lo que cambia: `{nombre}`, `{acepta_ingresos}`, `{cupo}`, `{preset_ensenanza}` y/o `{facilitador_id}`.
 * Con `acepta_ingresos: false` el código deja de servir hasta reabrir. `cupo` es un entero de 1 a 120 (422 si está
 * fuera de rango; 400 con mensaje si es menor que los alumnos ya inscritos). `preset_ensenanza` es el tono con el
 * que Turing les habla a los alumnos del curso: `"infantil" | "estandar" | "adultos"`, o `"facilitador"` para que el
 * curso vuelva a heredar el del perfil del facilitador; omitirlo no cambia nada. `facilitador_id` solo lo puede
 * mandar un facilitador principal (403 si no lo es).
 */
export function editarCurso(cursoId, campos) {
  return solicitarAuth(`/cursos/${cursoId}`, { method: "PATCH", body: JSON.stringify(campos) });
}

/**
 * Pasa un curso a otro facilitador activo (solo facilitador principal; 400 con mensaje si el destino no sirve).
 * Los estudiantes inscritos siguen en el curso y pasan a ver los videos y el tono del nuevo dueño.
 */
export function reasignarCurso(cursoId, facilitadorId) {
  return editarCurso(cursoId, { facilitador_id: facilitadorId });
}

/** Genera un código nuevo para el curso (facilitador): el anterior deja de servir, los inscritos siguen. */
export function regenerarCodigoCurso(cursoId) {
  return solicitarAuth(`/cursos/${cursoId}/codigo`, { method: "POST" });
}

/** Elimina el curso (facilitador). Sus estudiantes no se borran: quedan sin curso. */
export function eliminarCurso(cursoId) {
  return solicitarAuthSinCuerpo(`/cursos/${cursoId}`, { method: "DELETE" });
}

/**
 * Jugadores inscritos en un curso del facilitador: `[{id, nombre, email, avatar_url, nivel_estimado,
 * rango_estimado, activo, unido_en}]`.
 */
export function listarEstudiantesCurso(cursoId) {
  return solicitarAuth(`/cursos/${cursoId}/estudiantes`);
}

/** Saca a un jugador del curso (facilitador) sin borrar su cuenta. 404 si no estaba inscrito. */
export function sacarEstudianteDeCurso(cursoId, usuarioId) {
  return solicitarAuthSinCuerpo(`/cursos/${cursoId}/estudiantes/${usuarioId}`, { method: "DELETE" });
}

/**
 * Reporte de un curso para su facilitador (el dueño o el principal; 403 si no lo es, 404 si no existe):
 * `{curso: {id, nombre, cupo, alumnos}, resumen: {alumnos_activos_7_dias, porcentaje_activos, partidas_7_dias,
 * partidas_por_alumno_semana, precision_primera_semana, precision_ultima_semana, variacion_precision},
 * alumnos: [{id, nombre, activo, nivel, rango, puesto, confirmado, precision, partidas, partidas_7_dias,
 * ultima_partida}]}`. Los indicadores del resumen pueden venir en `null` (curso vacío o sin dos semanas con datos)
 * y `alumnos` viene ordenado por puesto, con los que no tienen puesto al final.
 */
export function obtenerReporteCurso(cursoId) {
  return solicitarAuth(`/cursos/${cursoId}/reporte`);
}

/**
 * Entra a un curso con el código que dio el facilitador (jugador): acepta mayúsculas, minúsculas y con o
 * sin guion. Si ya estaba en otro, lo mueve. Devuelve `{id, nombre, facilitador_nombre,
 * facilitador_avatar_url, preset_ensenanza}`. 400 si el código no existe, el curso cerró ingresos o el curso
 * está completo (llegó a su cupo), y 429 si gastó sus intentos fallidos: el `message` del error ya está listo
 * para mostrarse.
 */
export function unirseACurso(codigo) {
  return solicitarAuth("/cursos/unirse", { method: "POST", body: JSON.stringify({ codigo }) });
}

/** Curso en el que está inscrito el jugador (mismo formato que `unirseACurso`), o `null` si no está en ninguno. */
export function obtenerMiCurso() {
  return solicitarAuth("/cursos/mio");
}

/** El jugador deja su curso. 404 si no estaba en ninguno. */
export function salirDelCurso() {
  return solicitarAuthSinCuerpo("/cursos/salir", { method: "POST" });
}

/** Suscripción de las instituciones */

/** Los planes con el precio de cada ciclo y los días de prueba gratis. */
export function obtenerCatalogoSuscripcion() {
  return solicitarAuth("/suscripciones/planes");
}

/** La suscripción de mi institución con mis pagos (solo su administrador). */
export function obtenerMiSuscripcion() {
  return solicitarAuth("/suscripciones/mia");
}

/** La institución avisa que pagó `plan` por `ciclo`. Queda pendiente hasta que la plataforma lo confirme. 409 si ya hay uno pendiente. */
export function avisarPago({ plan, ciclo, referencia = null }) {
  return solicitarAuth("/suscripciones/mia/pagos", { method: "POST", body: JSON.stringify({ plan, ciclo, referencia }) });
}

/** Todas las suscripciones, las que piden atención primero (solo la plataforma). */
export function listarSuscripciones() {
  return solicitarAuth("/suscripciones");
}

/** Ingresos por mes, instituciones por estado, pagos por confirmar y valores del punto de equilibrio (solo la plataforma). */
export function obtenerIngresos() {
  return solicitarAuth("/suscripciones/ingresos");
}

/** Todos los pagos de todas las instituciones, los más nuevos primero; `estado` filtra (solo la plataforma). */
export function listarPagosSuscripciones(estado = null) {
  const consulta = new URLSearchParams({ limite: "300" });
  if (estado) consulta.set("estado", estado);
  return solicitarAuth(`/suscripciones/pagos?${consulta.toString()}`);
}

/** Confirma un pago y extiende la suscripción (solo la plataforma). */
export function confirmarPagoSuscripcion(pagoId, nota = null) {
  return solicitarAuth(`/suscripciones/pagos/${pagoId}/confirmar`, { method: "POST", body: JSON.stringify({ nota: nota || null }) });
}

/** Rechaza un pago, con un motivo opcional (solo la plataforma). */
export function rechazarPagoSuscripcion(pagoId, nota = null) {
  return solicitarAuth(`/suscripciones/pagos/${pagoId}/rechazar`, { method: "POST", body: JSON.stringify({ nota: nota || null }) });
}

/** Suma `dias` a la prueba gratis de una institución (solo la plataforma). */
export function extenderPruebaSuscripcion(institucionId, dias) {
  return solicitarAuth(`/suscripciones/${institucionId}/extender-prueba`, { method: "POST", body: JSON.stringify({ dias }) });
}

/** Carga cinco instituciones de ejemplo con pagos, para mostrar el panel de ingresos (solo la plataforma). */
export function cargarDemostracionSuscripciones() {
  return solicitarAuth("/suscripciones/demostracion", { method: "POST" });
}

/** Quita las instituciones de ejemplo (solo la plataforma). */
export function quitarDemostracionSuscripciones() {
  return solicitarAuth("/suscripciones/demostracion", { method: "DELETE" });
}

/** Instituciones clientes */

/** Todas las instituciones con sus docentes (solo la plataforma). */
export function listarInstituciones() {
  return solicitarAuth("/instituciones");
}

/**
 * Crea una institución con su suscripción de una vez (solo la plataforma). `tipo`: academia, colegio u organizador; `plan`: plan_60 o plan_120.
 * El administrador puede ser un facilitador que ya tiene cuenta (`administradorId`) o alguien nuevo que se registra con un código
 * (`invitarAdministrador`). Con `esPrueba` es una institución para evaluar el sistema (con su código de evaluación). `pagoInicialCiclo`
 * registra un pago y la deja activa. Devuelve la institución, su suscripción y, si hubo invitación, el código (se ve una sola vez).
 */
export function crearInstitucion({
  nombre,
  tipo,
  administradorId = null,
  plan = "plan_60",
  diasDePrueba = 60,
  pagoInicialCiclo = null,
  invitarAdministrador = false,
  esPrueba = false,
  minutosDelCodigo = 1440,
}) {
  return solicitarAuth("/instituciones", {
    method: "POST",
    body: JSON.stringify({
      nombre,
      tipo,
      administrador_id: administradorId,
      plan,
      dias_de_prueba: diasDePrueba,
      pago_inicial_ciclo: pagoInicialCiclo,
      invitar_administrador: invitarAdministrador,
      es_prueba: esPrueba,
      minutos_del_codigo: minutosDelCodigo,
    }),
  });
}

/** El trato se cerró: la institución de prueba pasa a ser cliente y se borra el jugador de prueba. Todo es opcional (solo la plataforma). */
export function convertirInstitucion(institucionId, { nombre = null, tipo = null, plan = null, pagoInicialCiclo = null } = {}) {
  return solicitarAuth(`/instituciones/${institucionId}/convertir`, {
    method: "POST",
    body: JSON.stringify({ nombre, tipo, plan, pago_inicial_ciclo: pagoInicialCiclo }),
  });
}

/** Registra un pago que la plataforma recibió directamente (efectivo, transferencia): queda confirmado y extiende la suscripción. */
export function registrarPagoRecibido(institucionId, { plan, ciclo, referencia = null }) {
  return solicitarAuth(`/suscripciones/${institucionId}/pago-registrado`, {
    method: "POST",
    body: JSON.stringify({ plan, ciclo, referencia }),
  });
}

/** Pasa de la vista de director de prueba a su jugador de prueba (y de vuelta). Devuelve la sesión de la otra cuenta: `{ usuario, tokens }`. */
export function cambiarVista() {
  return solicitarAuth("/auth/cambiar-vista", { method: "POST" });
}

/** Edita una institución (solo la plataforma). `campos` lleva solo lo que cambió: nombre, tipo, administrador_id. */
export function editarInstitucion(institucionId, campos) {
  return solicitarAuth(`/instituciones/${institucionId}`, { method: "PATCH", body: JSON.stringify(campos) });
}

/** Pasa a un facilitador a esa institución (solo la plataforma). */
export function asignarDocenteAInstitucion(institucionId, usuarioId) {
  return solicitarAuth(`/instituciones/${institucionId}/docentes/${usuarioId}`, { method: "PUT" });
}

/** Saca a un docente de la institución (solo la plataforma). */
export function quitarDocenteDeInstitucion(institucionId, usuarioId) {
  return solicitarAuth(`/instituciones/${institucionId}/docentes/${usuarioId}`, { method: "DELETE" });
}

/** La institución del facilitador que consulta, con sus números. 404 si no pertenece a ninguna. */
export function obtenerMiInstitucion() {
  return solicitarAuth("/instituciones/mia");
}

/** Los docentes de mi institución (solo su administrador o la plataforma). */
export function listarDocentesDeMiInstitucion() {
  return solicitarAuth("/instituciones/mia/docentes");
}

/** Los alumnos de mi institución, con su curso y su docente (solo su administrador o la plataforma). */
export function listarAlumnosDeMiInstitucion() {
  return solicitarAuth("/instituciones/mia/alumnos");
}

/**
 * Ranking de jugadores por nivel (cualquier usuario autenticado): el de su curso si está inscrito
 * (`alcance: "curso"`) o el de los jugadores sin curso (`alcance: "general"`). Devuelve `{alcance, curso, total,
 * jugadores: [{puesto, nombre, nivel, rango, confirmado, partidas_calibradas, soy_yo}], mi_puesto}`. `limite` son
 * los primeros que se piden (el backend lo acota a 1-20); `mi_puesto` solo viene si el jugador quedó fuera de ese
 * tope. Los nombres ya llegan abreviados ("Ana P.") y los puestos pueden repetirse (empate exacto).
 */
export function obtenerRanking(limite = 10) {
  return solicitarAuth(`/cursos/ranking?limite=${encodeURIComponent(limite)}`);
}

/**
 * Videos por pieza que ve el usuario autenticado: `{tipo_pieza: url}` (con `?v=…`) con claves
 * `rey | dama | torre | alfil | caballo | peon`, solo las que existen. Son los videos generales del facilitador
 * principal, que ve todo jugador esté o no en un curso; si el facilitador de su curso subió uno propio de una
 * pieza, ese reemplaza al general en esa pieza. A un facilitador le devuelve los generales (no está inscrito en
 * ningún curso). `{}` si no hay ninguno.
 */
export function obtenerVideosDeMiCurso() {
  return solicitarAuth("/cursos/mio/videos");
}

/** Medallas ("figuritas" del álbum) */

/**
 * Medallas del usuario autenticado: `{medallas: [{codigo, nombre, descripcion, nivel, pieza, meta, progreso, ganada,
 * ganada_en, nueva, imagen_url}], total, ganadas, nuevas: [codigo], es_primera}`. `nivel` es `bronce | plata | oro |
 * legendaria` y `pieza` es `peon | caballo | alfil | torre | dama | rey`. `imagen_url` (o `null`) es la imagen que subió
 * el facilitador principal y reemplaza a la figurita dibujada. Al pedirlas, el backend evalúa y otorga las que
 * correspondan: `nuevas` son las ganadas que todavía no se le avisaron al jugador y `es_primera` indica que entre ellas
 * está la primera medalla de su vida. A un facilitador le devuelve el catálogo completo, sin ganadas.
 */
export function obtenerMedallas() {
  return solicitarAuth("/usuario/medallas");
}

/**
 * Marca medallas como ya avisadas para que no se repita el aviso: `{marcadas: n}`. Con una lista marca solo esas;
 * sin argumento (`null`) las marca todas. Una lista vacía no marca nada (no se manda al backend, donde `{}` significaría
 * "todas").
 */
export function marcarMedallasVistas(codigos = null) {
  if (Array.isArray(codigos) && codigos.length === 0) return Promise.resolve({ marcadas: 0 });
  const cuerpo = Array.isArray(codigos) ? { codigos } : {};
  return solicitarAuth("/usuario/medallas/vistas", { method: "POST", body: JSON.stringify(cuerpo) });
}

/**
 * Sube (o reemplaza) la ilustración de una medalla: las 13 de fábrica solo las cambia el facilitador PRINCIPAL; una medalla
 * propia, su creador o el principal (403 si no). Es la ilustración del centro de la figurita (el escudo lo pone el sistema
 * según el nivel) y reemplaza a la silueta de la pieza. Multipart con el campo `archivo` (PNG, JPG o WEBP de hasta 2 MB); el
 * content-type con boundary lo arma el navegador. Devuelve `{codigo, imagen_url}` (la URL trae `?v=…`, así que se
 * refresca sola). 400 con un mensaje legible si el archivo no sirve.
 */
export async function subirImagenMedalla(codigo, archivo) {
  const token = leerSesion("access_token");
  const datos = new FormData();
  datos.append("archivo", archivo);
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch(`/facilitador/medallas/${encodeURIComponent(codigo)}/imagen`, {
    method: "POST",
    body: datos,
    headers,
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return respuesta.json();
}

/**
 * Lee una ilustración sugerida (un archivo estático del frontend, p. ej. `/ideas-medallas/campeon_del_torneo.png`) y la
 * devuelve como `File`, lista para `subirImagenMedalla`. Falla con un mensaje legible si no se puede leer o no es una imagen.
 */
export async function leerArchivoSugerido(ruta, nombreArchivo) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer la ilustración sugerida (error ${respuesta.status}).`);
  const contenido = await respuesta.blob();
  if (!contenido.type.startsWith("image/")) throw new Error("La ilustración sugerida no es una imagen.");
  return new File([contenido], nombreArchivo, { type: contenido.type });
}

/**
 * Borra la imagen subida de una medalla (solo el facilitador principal): vuelve la figurita de fábrica. 204 sin
 * cuerpo; 404 si no tenía imagen subida.
 */
export function quitarImagenMedalla(codigo) {
  return solicitarAuthSinCuerpo(`/facilitador/medallas/${encodeURIComponent(codigo)}/imagen`, { method: "DELETE" });
}

/** Medallas propias: un facilitador crea las suyas, las edita, las borra y las entrega (todo con su token) */

/**
 * Lo que necesita el formulario de creación: `{reglas: [{codigo, nombre, tipo: "contador" | "si_no" | "manual", minimo,
 * maximo, unidad}], niveles, piezas, plantillas: [{nombre, descripcion, nivel, pieza, regla, meta}], largo_nombre: [min,
 * max], largo_descripcion: [min, max]}`. `contador` se gana al llegar a un número (`meta` entre `minimo` y `maximo`),
 * `si_no` al cumplirlo una vez (meta 1) y `manual` la entrega el facilitador. Las `plantillas` son ideas listas para usar.
 * Solo facilitadores (403 si no).
 */
export function obtenerOpcionesMedallas() {
  return solicitarAuth("/medallas/opciones");
}

/**
 * Las medallas propias que el facilitador puede gestionar (el principal ve las de todos): `[{codigo, nombre,
 * descripcion, nivel, pieza, regla, regla_nombre, meta, general, creada_por, creador_nombre, es_mia, ganada_por,
 * imagen_url}]`. `ganada_por` es cuántos jugadores la ganaron; `imagen_url` es `null` mientras no tenga ilustración.
 */
export function listarMisMedallas() {
  return solicitarAuth("/medallas/mias");
}

/**
 * Crea una medalla propia (sin imagen: se sube después con `subirImagenMedalla`). `datos`: `{nombre, descripcion, nivel,
 * pieza, regla, meta, general}`; `general: true` solo si el usuario es PRINCIPAL (la ven todos los jugadores; si no, solo los
 * de los cursos del creador). Devuelve la medalla creada (201). 400 con un mensaje claro si algún dato no sirve o si llegó al
 * máximo de 30 medallas; 403 si pide una general sin ser principal.
 */
export function crearMedallaPropia(datos) {
  return solicitarAuth("/medallas", { method: "POST", body: JSON.stringify(datos) });
}

/**
 * Edita una medalla propia con un cuerpo parcial (`nombre`, `descripcion`, `nivel`, `pieza`, `regla`, `meta`; no se cambia
 * `general`). Los jugadores que ya la ganaron la conservan. Devuelve la medalla. 403 si es de otro facilitador (salvo el
 * principal), 404 si no existe, 400 con un mensaje claro si algún dato no sirve.
 */
export function editarMedallaPropia(codigo, cambios) {
  return solicitarAuth(`/medallas/${encodeURIComponent(codigo)}`, { method: "PATCH", body: JSON.stringify(cambios) });
}

/**
 * Borra una medalla propia con su imagen: quienes la ganaron la pierden. 204 sin cuerpo; 403 si es de otro facilitador
 * (salvo el principal), 404 si no existe.
 */
export function borrarMedallaPropia(codigo) {
  return solicitarAuthSinCuerpo(`/medallas/${encodeURIComponent(codigo)}`, { method: "DELETE" });
}

/**
 * Entrega una medalla MANUAL (`regla === "manual"`) a jugadores concretos (`usuarioIds`) y/o a todos los de un curso
 * (`cursoId`). Un facilitador solo puede entregarla a jugadores de sus cursos (el principal, a cualquiera). Devuelve
 * `{otorgadas, ya_la_tenian}`. 400 con un mensaje claro si no es manual, no se indicó a quién o el curso no es suyo.
 */
export function otorgarMedalla(codigo, { usuarioIds = [], cursoId = null } = {}) {
  return solicitarAuth(`/medallas/${encodeURIComponent(codigo)}/otorgar`, {
    method: "POST",
    body: JSON.stringify({ usuario_ids: usuarioIds, curso_id: cursoId }),
  });
}

/** Tutor conversacional "Turing" (Panel de Aprendizaje) */

/**
 * Manda un mensaje al tutor conversacional "Turing" y persiste el turno en
 * el backend — misma conversación que lee `obtenerHistorialTutor`. Devuelve
 * `{respuesta, creado_en}`. El backend responde 503 si el tutor no está
 * disponible (LLM caído o sin API key configurada) — la UI distingue ese
 * caso vía `error.status` para mostrar un aviso amigable en vez de un error
 * crudo.
 */
export function enviarMensajeTutor(mensaje) {
  return solicitarAuth("/tutor/mensaje", {
    method: "POST",
    body: JSON.stringify({ mensaje }),
  });
}

/**
 * Historial de la conversación con Turing del usuario logueado, en orden
 * cronológico (el más viejo primero). `limite` es la cantidad de turnos a
 * traer (cada mensaje del usuario y cada respuesta cuentan como un turno
 * cada uno), no de intercambios completos.
 */
export function obtenerHistorialTutor(limite = 50) {
  return solicitarAuth(`/tutor/historial?limite=${limite}`);
}

/**
 * Borra el historial de conversación con Turing del usuario logueado
 * (reinicia la memoria del tutor — útil si una demo se traba a mitad de
 * conversación). Devuelve 204 sin cuerpo, así que no reusa
 * `solicitar`/`solicitarAuth` (que siempre parsean JSON de la respuesta):
 * arma el fetch a mano, con el mismo manejo de token y de errores que el
 * resto del archivo (ver `obtenerDemostracionActiva` más arriba, mismo
 * criterio defensivo).
 */
export async function borrarHistorialTutor() {
  const token = leerSesion("access_token");
  const respuesta = await fetch("/tutor/historial", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const error = new Error(detalle?.detail ?? `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
}

/** Entrenamiento del modelo Turing (solo facilitadores) */

/**
 * Estado de los datos acumulados para reentrenar a Turing: umbral de partidas,
 * cuántas partidas válidas hay en total y cuántas son nuevas desde la última
 * descarga, progreso (0..1), si ya está `listo_para_entrenar`, la
 * `ultima_descarga` (o `null`) y el `modelo_actual`. Responde 403 a los
 * jugadores. El reentrenamiento en sí NO es automático: lo hace el equipo
 * técnico por lotes (HU4, pendiente); esto solo dice si ya hay datos suficientes.
 */
export function obtenerEstadoEntrenamiento() {
  return solicitarAuth("/entrenamiento/estado");
}

/** Cómo juega Turing según el nivel de la partida, frente a Stockfish (solo facilitador). */
export function obtenerTuringPorNivel() {
  return solicitarAuth("/entrenamiento/turing-por-nivel");
}

/**
 * Nombre de archivo que viene en el header `Content-Disposition`
 * (`filename="..."` o `filename*=UTF-8''...`), o `null` si no se puede leer.
 */
function nombreDesdeContentDisposition(cabecera) {
  if (!cabecera) return null;
  const codificado = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cabecera);
  if (codificado) {
    try {
      return decodeURIComponent(codificado[1].trim());
    } catch {
      // si la codificación viene rota se prueba con el formato simple
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/.exec(cabecera);
  return simple ? simple[1].trim() : null;
}

/** `dataset_ajedrez_AAAAMMDD_HHMM.zip` con la hora local, por si el header no se puede leer. */
function nombreDatasetPorDefecto() {
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  const fecha = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}`;
  const hora = `${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  return `dataset_ajedrez_${fecha}_${hora}.zip`;
}

/**
 * Descarga el dataset de entrenamiento (ZIP con partidas.pgn, jugadas.csv,
 * partidas.csv, manifiesto.json y LEEME.txt). Hace falta leer el binario con
 * fetch (lleva el token), así que devuelve `{ blob, nombre }` y la pantalla
 * dispara la descarga con un `<a download>`. Con `soloNuevas` trae únicamente
 * las partidas posteriores a la última descarga. Si falla lanza un `Error` con
 * el `detail` del backend (ej. 409 cuando todavía no hay partidas válidas).
 */
export async function descargarDatasetEntrenamiento({ soloNuevas = false } = {}) {
  const token = leerSesion("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const respuesta = await fetch("/entrenamiento/dataset", {
    method: "POST",
    headers,
    body: JSON.stringify({ solo_nuevas: Boolean(soloNuevas) }),
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  const blob = await respuesta.blob();
  const nombre =
    nombreDesdeContentDisposition(respuesta.headers.get("Content-Disposition")) ?? nombreDatasetPorDefecto();
  return { blob, nombre };
}

/**
 * Descarga el dataset de piezas (ZIP con una carpeta por clase + clases.json) para entrenar en Colab. Devuelve
 * `{ blob, nombre }`; 404 = todavía no hay muestras.
 */
export async function descargarDatasetPiezas() {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const respuesta = await fetch("/vision/dataset/export", { headers });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return { blob: await respuesta.blob(), nombre: "dataset_piezas.zip" };
}

/** Borra todas las fotos de una clase del dataset (ej. "black-pawn"). Devuelve `{borradas}`. */
export function borrarClaseDataset(clase) {
  return solicitar(`/vision/dataset/clase/${encodeURIComponent(clase)}`, { method: "DELETE" });
}

/**
 * Vista previa de lo que se guardaría ahora en el dataset: el tablero con las casillas elegidas en verde y su recorte exacto.
 * Devuelve un object URL (JPEG) que quien lo use debe revocar; 503 = cámara no disponible. No guarda nada.
 */
export async function obtenerVistaPreviaDataset(casillas) {
  const token = leerSesion("access_token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const respuesta = await fetch(`/vision/dataset/vista-previa?casillas=${encodeURIComponent(casillas.join(","))}`, {
    headers,
    cache: "no-store",
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}

/**
 * Probador de piezas: saca una foto y devuelve `{casillas: [{casilla, clase, confianza, alternativas}], imagen}` con `imagen` en
 * base64 (JPEG anotado). 409 = no hay modelo entrenado, 422 = tablero no detectado, 503 = cámara.
 */
export function probarPiezas() {
  return solicitar("/vision/probar-piezas", { method: "GET" });
}

// --- Control del brazo (panel «Control del brazo»): todo bajo /brazo/control, solo facilitador ---
const controlBrazo = (ruta, metodo = "POST", cuerpo) =>
  solicitar(`/brazo/control${ruta}`, { method: metodo, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) });

/** Estado del brazo: `{conectado, destino, emulador, calibrado, modo, modo_texto, pose, angulos, pinza, tarea, ...}`. */
export const estadoControlBrazo = () => controlBrazo("/estado", "GET");
export const conectarBrazo = (host, puerto, emulador) => controlBrazo("/conectar", "POST", { host, puerto, emulador });
export const desconectarBrazo = () => controlBrazo("/desconectar");
export const habilitarBrazo = () => controlBrazo("/habilitar");
export const deshabilitarBrazo = () => controlBrazo("/deshabilitar");
export const limpiarErrorBrazo = () => controlBrazo("/limpiar-error");
/** Parada: frena el brazo y cancela la secuencia en curso. */
export const pararBrazo = () => controlBrazo("/parar");
export const obtenerParametrosBrazo = () => controlBrazo("/parametros", "GET");
export const actualizarParametrosBrazo = (valores, guardar = false) => controlBrazo("/parametros", "PUT", { valores, guardar });
export const inicializarPinza = () => controlBrazo("/pinza/inicializar");
/** `accion`: "abrir" | "cerrar" | "ancho" (con `anchoMm`). */
export const moverPinza = (accion, anchoMm = null) => controlBrazo("/pinza", "POST", { accion, ancho_mm: anchoMm });
export const listarConfiguracionesBrazo = () => controlBrazo("/configuraciones", "GET");
export const guardarConfiguracionBrazo = (nombre, descripcion = "") => controlBrazo("/configuraciones", "POST", { nombre, descripcion });
export const aplicarConfiguracionBrazo = (nombre) => controlBrazo(`/configuraciones/${encodeURIComponent(nombre)}/aplicar`);
export const borrarConfiguracionBrazo = (nombre) => controlBrazo(`/configuraciones/${encodeURIComponent(nombre)}`, "DELETE");
/** Ensayo: pasos y poses por los que pasaría, sin mover nada. */
/**
 * Prueba manual del panel. `opciones`: `captura` (el destino tiene una pieza de `tipoCapturada`: se retira primero al cementerio), `alCementerio` (manda la pieza del
 * origen al cementerio, sin destino) y `casillaCementerio` (0 a 29, dónde la deja).
 */
const cuerpoMoverPieza = (origen, destino, tipoPieza, { captura = false, tipoCapturada = "p", alCementerio = false, casillaCementerio = 0 } = {}) => ({
  origen,
  destino: destino ?? "",
  tipo_pieza: tipoPieza,
  captura,
  tipo_capturada: tipoCapturada,
  al_cementerio: alCementerio,
  casilla_cementerio: casillaCementerio,
});
export const ensayoMoverPieza = (origen, destino, tipoPieza = "p", opciones) =>
  controlBrazo("/mover-pieza/ensayo", "POST", cuerpoMoverPieza(origen, destino, tipoPieza, opciones));
export const moverPiezaBrazo = (origen, destino, tipoPieza = "p", opciones) =>
  controlBrazo("/mover-pieza", "POST", cuerpoMoverPieza(origen, destino, tipoPieza, opciones));

/** Cámaras que abre el equipo: `{actual, camaras: [{indice, disponible, ancho, alto}]}`. Corta el video un instante. */
export const listarCamaras = () => solicitar("/vision/camaras", { method: "GET" });
/** Un cuadro (JPEG, object URL a revocar) de la cámara `indice`, para reconocer cuál es. */
export async function fotoDeCamara(indice) {
  const token = leerSesion("access_token");
  const respuesta = await fetch(`/vision/camaras/${indice}/foto`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}
/** Asigna una fuente (índice `"2"` o URL de stream) a la cámara `principal` o `secundaria`. Cada una necesita una fuente distinta. */
export const seleccionarCamara = (fuente, camara = "principal") =>
  solicitar("/vision/camara", { method: "POST", body: JSON.stringify({ fuente: String(fuente), camara }) });
/** Deja de usar la cámara secundaria. */
export const quitarCamaraSecundaria = () => solicitar("/vision/camara/secundaria", { method: "DELETE" });
/**
 * Enciende o apaga la cámara secundaria sin tocar su configuración ni su calibración: apagada, la captura de fotos, el reconocimiento y las
 * vistas en vivo usan solo la principal. Devuelve `{usar_secundaria, camaras}`.
 */
export const usarCamaraSecundaria = (activa) =>
  solicitar("/vision/camara/secundaria/uso", { method: "POST", body: JSON.stringify({ activa }) });
/**
 * Qué cámaras están EN USO y cuáles calibradas: `{configuradas, calibradas, fuentes, rotaciones, secundaria_configurada, usar_secundaria}`. `configuradas`
 * ya no incluye la secundaria si está apagada. Barato: no abre ninguna cámara.
 */
export const estadoDeLasCamaras = () => solicitar("/vision/camaras/estado", { method: "GET" });

/** Gira la imagen de la cámara fija (0, 90, 180 o 270, horario). Después hay que volver a calibrar el tablero. */
export const girarCamara = (grados, camara = "principal") =>
  solicitar("/vision/camara/rotacion", { method: "POST", body: JSON.stringify({ grados, camara }) });

/**
 * Verifica que las calibraciones de las dos cámaras describen el mismo tablero y con la misma orientación. Devuelve
 * `{nivel: "bien"|"regular"|"mal"|"orientacion", ok, mensaje, error_px, error_casillas, orientacion, por_esquina, corrimiento_global, camaras,
 * imagen}`: `error_casillas` es el de la peor de las 49 esquinas internas; `camaras.{principal,secundaria}` dice cuánto se aleja cada una de su
 * propia grilla (`error_max_casillas`, `peor_esquina`) y `sugeridas` (`{esquinas, error_casillas}` o null). `imagen` en base64 (JPEG 2×2:
 * principal, secundaria, superpuestas y el mapa de esquinas). 409 si falta configurar o calibrar alguna cámara.
 */
export const verificarCalibracionUnificada = () => solicitar("/vision/calibracion/unificada", { method: "GET" });
/**
 * Recalcula al subpíxel las 4 esquinas de la cámara con las 49 esquinas internas del damero y las guarda si mejoran. Con el tablero vacío.
 * Devuelve `{aplicada, error_antes_casillas, error_despues_casillas, esquinas, mensaje}`; 409 si se ven pocas esquinas (piezas encima).
 */
export const ajustarEsquinasCalibracion = (camara = "principal") =>
  solicitar(`/vision/calibracion/ajustar?camara=${camara}`, { method: "POST" });
export const aplicarOrientacionCalibracion = () => solicitar("/vision/calibracion/aplicar-orientacion", { method: "POST" });
/**
 * Empieza a seguir la partida por diferencias entre imágenes (un cuadro por segundo, sin clasificar piezas). `fen` (opcional): la posición de la que se parte
 * (por defecto la inicial). 409 = la cámara no está calibrada, 422 = FEN inválido. Devuelve `{activo, estado, fen, jugadas, turno, alerta}`.
 */
export const iniciarSeguimientoPartida = (fen = null, camara = "principal") =>
  solicitar("/vision/seguimiento/iniciar", { method: "POST", body: JSON.stringify({ fen, camara }) });

/**
 * Procesa el último cuadro de la cámara y dice qué pasó: `{estado, mensaje, fen, jugada, cambiadas, jugadas, turno}` con `estado` = tomando_base | esperando |
 * moviendo | jugada | incompleta | invalida | dudosa. Se pide una vez por segundo. 409 = no hay seguimiento iniciado. Con `conVista`, suma `vista`: las fotos
 * base y actual, el mapa de cambios por casilla y las jugadas candidatas (para mostrar cómo decide).
 */
export const avanzarSeguimientoPartida = (conVista = false) => solicitar(`/vision/seguimiento/tick${conVista ? "?vista=true" : ""}`, { method: "POST" });

/** Vuelve a tomar la foto base con la posición que el seguimiento ya sabe (las piezas están bien pero la imagen no coincide con la foto). */
export const retomarFotoBaseSeguimiento = () => solicitar("/vision/seguimiento/foto-base", { method: "POST" });

/** Quita la última jugada detectada (si se detectó mal) y vuelve a tomar la foto base. Devuelve `{..., deshecha}`; 422 = no hay jugada que deshacer. */
export const deshacerJugadaSeguimiento = () => solicitar("/vision/seguimiento/deshacer", { method: "POST" });

/** Cambia la posición conocida del seguimiento (p. ej. tras jugar el robot) y vuelve a tomar la foto base cuando el tablero esté quieto. */
export const fijarPosicionSeguimiento = (fen) => solicitar("/vision/seguimiento/posicion", { method: "POST", body: JSON.stringify({ fen }) });

/**
 * Partida física (cámara + Turing + brazo). Solo facilitador. `estado` = esperando_humano | turing_decide | brazo_ejecuta | verificando | esperando_robot_manual |
 * incidente | fin. 404 = la partida no existe, 409 = cámara sin calibrar / sin partida física, 422 = no se puede.
 */
export const iniciarPartidaFisica = (partidaId, camara = "principal") =>
  solicitar("/partida-fisica/iniciar", { method: "POST", body: JSON.stringify({ partida_id: partidaId, camara }) });
/** Con `conVista`, el estado trae `vista`: la foto base, la actual y la comparación casilla por casilla (como el seguimiento por diferencias). */
export const estadoPartidaFisica = (conVista = false) => solicitar(`/partida-fisica/estado${conVista ? "?vista=true" : ""}`, { method: "GET" });
export const pausarPartidaFisica = () => solicitar("/partida-fisica/pausar", { method: "POST" });
export const reanudarPartidaFisica = () => solicitar("/partida-fisica/reanudar", { method: "POST" });
/** Respaldo si la cámara no detecta tu jugada: SAN (`Nf3`) o UCI (`g1f3`). */
export const jugadaManualPartidaFisica = (movimiento) =>
  solicitar("/partida-fisica/jugada-manual", { method: "POST", body: JSON.stringify({ movimiento }) });
/** `accion`: `continuar` (el tablero físico ya coincide con la partida) o `reintentar` (quedó como antes de la jugada del brazo y se repite). */
export const resolverIncidentePartidaFisica = (accion) =>
  solicitar("/partida-fisica/resolver-incidente", { method: "POST", body: JSON.stringify({ accion }) });
export const detenerPartidaFisica = () => solicitar("/partida-fisica", { method: "DELETE" });

/** Deja de seguir la partida. */
export const detenerSeguimientoPartida = () => solicitar("/vision/seguimiento", { method: "DELETE" });

/**
 * Por qué una posición reconocida no puede darse en una partida (peones en la fila 1 u 8, más de un rey, material de más, jaques imposibles).
 * `fen` puede ser completo o solo las piezas. Devuelve `{problemas: [...]}`; con `exigirReyes` también avisa si falta un rey.
 */
export const problemasDePosicion = (fen, exigirReyes = false) =>
  solicitar("/vision/posicion/problemas", { method: "POST", body: JSON.stringify({ fen, exigir_reyes: exigirReyes }) });

// --- Lente y geometría 3D por cámara (`/vision/lente`) ---
/** Lente (calibrado o supuesto), posición de la cámara respecto del tablero y fotos guardadas para calibrar. */
export const estadoLente = (camara = "principal") => solicitar(`/vision/lente/estado?camara=${camara}`, { method: "GET" });
/** Saca una foto y la guarda para calibrar el lente si se ven las 49 esquinas internas del tablero. */
export const agregarFotoLente = (camara = "principal") => solicitar(`/vision/lente/foto?camara=${camara}`, { method: "POST" });
/** Calibra el lente con las fotos guardadas. */
export const calcularLente = (camara = "principal") => solicitar(`/vision/lente/calcular?camara=${camara}`, { method: "POST" });
/** Fija a mano el campo de visión horizontal (grados). */
export const fijarCampoDeVision = (grados, camara = "principal") =>
  solicitar(`/vision/lente/fov?camara=${camara}`, { method: "POST", body: JSON.stringify({ grados }) });
export const borrarLente = (camara = "principal") => solicitar(`/vision/lente?camara=${camara}`, { method: "DELETE" });
/** La imagen actual con las cajas 3D de algunas casillas dibujadas (object URL a revocar). */
export async function vistaDeCajas(camara = "principal", casillas = []) {
  const token = leerSesion("access_token");
  const respuesta = await fetch(`/vision/lente/vista?camara=${camara}&casillas=${casillas.join(",")}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}

/** Qué modelos hay entrenados y con qué recorte: `{ocupacion, piezas, dos_vistas}`, cada uno `{existe, recorte}`. */
export const estadoDeLosModelos = () => solicitar("/vision/modelos/estado", { method: "GET" });
export const moverArticulacionesBrazo = (angulos) => controlBrazo("/mover-articulaciones", "POST", { angulos });
export const moverRelativoBrazo = (dx = 0, dy = 0, dz = 0, velocidadMmS = 20) =>
  controlBrazo("/mover-relativo", "POST", { dx, dy, dz, velocidad_mm_s: velocidadMmS });
export const irAPosicionInicialBrazo = () => controlBrazo("/posicion-inicial");
/** Baja con la pinza abierta (sin cerrarla) sobre la pieza de `casilla`, a la apertura de ese tipo de pieza, espera unos segundos y sube: para medir cada apertura. */
export const probarAperturaBrazo = (casilla, tipoPieza = "p") => controlBrazo("/probar-apertura", "POST", { casilla, tipo_pieza: tipoPieza });
/** Lleva la punta, SIN pieza, sobre `cementerio:K` (K de 0 a 29), `reserva:dama_negra` o `reserva:dama_blanca`, baja hasta unos mm de donde soltaría y vuelve (para revisarlos antes de jugar). */
export const probarLugarBrazo = (lugar) => controlBrazo("/probar-lugar", "POST", { lugar });

/** Límites de las articulaciones y distancias de seguridad que validan las poses: `{limites_articulaciones, margen_mesa_m, distancia_minima_eslabones_m, punta_minima_m, z_tope_mm}`. */
export const limitesBrazo = () => controlBrazo("/limites", "GET");
/** Con el brazo real conectado: compara la pose del controlador con la del modelo para los mismos ángulos. `{coincide, conclusion, error_mm, ...}`. */
export const verificarGeometriaBrazo = () => controlBrazo("/verificar-geometria", "GET");

// --- Rutinas del brazo (`/brazo/control/rutinas`) ---
/** Las rutinas guardadas: `[{nombre, pasos (cantidad), validada, actualizada}]`. `validada` = ya corrió completa en el emulador (requisito para el brazo real). */
export const listarRutinasBrazo = () => controlBrazo("/rutinas", "GET");
/** Una rutina: `{nombre, pasos, validada, actualizada}`. */
export const obtenerRutinaBrazo = (nombre) => controlBrazo(`/rutinas/${encodeURIComponent(nombre)}`, "GET");
/** Guarda (o reemplaza) una rutina. Pasos: `{tipo: "articulaciones", angulos, velocidad}`, `{tipo: "pinza", apertura, fuerza?, velocidad?}`, `{tipo: "esperar", segundos}` o `{tipo: "rutina", nombre}`. */
export const guardarRutinaBrazo = (nombre, pasos) => controlBrazo(`/rutinas/${encodeURIComponent(nombre)}`, "PUT", { pasos });
export const borrarRutinaBrazo = (nombre) => controlBrazo(`/rutinas/${encodeURIComponent(nombre)}`, "DELETE");
/** Ejecuta la rutina. En el brazo real exige que esté validada y `confirmar: true`; `factor` (0,25 a 2) multiplica la velocidad. */
export const ejecutarRutinaBrazo = (nombre, factor = 1, confirmar = false) =>
  controlBrazo(`/rutinas/${encodeURIComponent(nombre)}/ejecutar`, "POST", { factor, confirmar });

// --- Progreso de los alumnos (`/progreso`) ---
/** El informe de progreso del propio jugador: `{alumno, generado_en, progreso, actividad, resultados, precision_por_fase, errores_frecuentes, medallas, lectura}`. */
export const obtenerMiProgreso = () => solicitarAuth("/progreso/mio");
/** El informe de un alumno para su docente, el administrador de su institución o la plataforma (404 si no es de su alcance). */
export const obtenerInformeAlumno = (alumnoId) => solicitarAuth(`/progreso/alumnos/${alumnoId}`);
/** El antes y el después de un curso: `{nombre, resumen, alumnos}`. */
export const obtenerProgresoCurso = (cursoId) => solicitarAuth(`/progreso/cursos/${cursoId}`);
/** El antes y el después de la institución que administra el usuario (la plataforma indica cuál con `institucionId`). */
export const obtenerProgresoInstitucion = (institucionId = null) =>
  solicitarAuth(institucionId == null ? "/progreso/institucion" : `/progreso/institucion?institucion_id=${institucionId}`);
/** Solo la plataforma: por institución, cuántos alumnos juegan y mejoran y si está en riesgo de irse. */
export const obtenerSaludInstituciones = () => solicitarAuth("/progreso/instituciones");

// --- Partidas entre personas: salas (`/sala`) ---
/** Controles de tiempo de una sala, en milisegundos por lado: sin reloj, 3, 5, 10 y 15 minutos. */
export const CONTROLES_DE_TIEMPO_SALA = [0, 180000, 300000, 600000, 900000];
/** Crea una sala con el color (`"blancas" | "negras" | "aleatorio"`) y el reloj elegidos. `{codigo, partida_id, estado, rol, control_tiempo_ms, ...}`. */
export const crearSala = (color = "aleatorio", controlTiempoMs = 0) =>
  solicitarAuth("/sala", { method: "POST", body: JSON.stringify({ color, control_tiempo_ms: controlTiempoMs }) });
/** Se sienta en la sala con el código (o la mira si está llena). `{codigo, partida_id, rol}`; 404 si no existe. */
export const unirseASala = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/unirse`, { method: "POST" });
/**
 * El estado de la sala: tablero, turno, quién juega (`blancas`/`negras` con nombre público, nivel y `ausente_s`), los tiempos que le quedan a cada lado
 * (`tiempo_blancas_ms`, `tiempo_negras_ms`, ya descontado lo que lleva gastado el que tiene el turno), `reloj_corre`, `resultado` y `motivo_fin`
 * (`mate`, `tablas`, `abandono`, `tiempo`, `ausencia`, `inactividad`). Consultarla es también la señal de que el jugador sigue en pantalla.
 */
export const obtenerSala = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}`);
/** Solo docentes: las salas abiertas en las que juega algún alumno que el docente puede ver, con el código para mirarlas en vivo. */
export const obtenerPartidasEnVivo = () => solicitarAuth("/social/partidas-en-vivo");
/** Señal de vida de quien está sentado en la sala (para una pantalla que no la consulta): devuelve el estado de la sala. */
export const presenciaSala = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/presencia`, { method: "POST" });
/** La sala `esperando` o `en_curso` más reciente del jugador, o `null`. */
export const obtenerSalaActiva = () => solicitarAuth("/sala/activa");
/** Casillas a las que puede ir la pieza de `casilla` (`["e3", "e4"]`). */
export const jugadasLegalesSala = (codigo, casilla) =>
  solicitarAuth(`/sala/${encodeURIComponent(codigo)}/jugadas-legales?casilla=${encodeURIComponent(casilla)}`).then((r) => r.casillas);
/** Juega `jugada` (UCI, `"e2e4"` o `"e7e8q"`). Devuelve la sala ya actualizada; 403 si no es tu turno. */
export const moverEnSala = (codigo, jugada) =>
  solicitarAuth(`/sala/${encodeURIComponent(codigo)}/mover`, { method: "POST", body: JSON.stringify({ jugada }) });
/** Abandona la partida: gana el otro. */
export const abandonarSala = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/abandonar`, { method: "POST" });
/** Cancela una sala que todavía espera rival. */
export const cancelarSala = (codigo) => solicitarAuthSinCuerpo(`/sala/${encodeURIComponent(codigo)}`, { method: "DELETE" });
/** Análisis con Stockfish de los dos bandos (solo cuando la sala terminó). */
export const obtenerAnalisisSala = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/analisis`);

// --- Amigos, retos y búsqueda de rival (`/social`) ---
/** Lo que la pantalla del jugador consulta cada pocos segundos: `{retos_recibidos, mi_reto, busqueda, solicitudes_amistad}`. Consultar es también estar en línea. */
export const obtenerAvisosSociales = () => solicitarAuth("/social/avisos");
/** Compañeros de curso y amigos (los que están en línea, primero), solicitudes pendientes y el código de amigo propio. */
export const obtenerAmigos = () => solicitarAuth("/social/amigos");
/** Manda una solicitud de amistad con `{email}`, `{codigo}` o `{usuarioId}` (un compañero de curso). Responde igual exista o no la cuenta. */
export const mandarSolicitudDeAmistad = ({ email, codigo, usuarioId } = {}) =>
  solicitarAuth("/social/amigos/solicitudes", {
    method: "POST",
    body: JSON.stringify({ email: email || null, codigo: codigo || null, usuario_id: usuarioId ?? null }),
  });
export const aceptarSolicitudDeAmistad = (id) => solicitarAuthSinCuerpo(`/social/amigos/solicitudes/${id}/aceptar`);
export const rechazarSolicitudDeAmistad = (id) => solicitarAuthSinCuerpo(`/social/amigos/solicitudes/${id}/rechazar`);
export const quitarAmigo = (usuarioId) => solicitarAuthSinCuerpo(`/social/amigos/${usuarioId}`, { method: "DELETE" });
/** Reta a un compañero o amigo. `{id, codigo, tu_color, control_tiempo_ms, segundos_restantes}`; 403 si no lo es, 409 si alguno ya juega. */
export const retarJugador = ({ retadoId, color = "aleatorio", controlTiempoMs = 0 }) =>
  solicitarAuth("/social/retos", { method: "POST", body: JSON.stringify({ retado_id: retadoId, color, control_tiempo_ms: controlTiempoMs }) });
/** Acepta un reto: devuelve `{codigo}` de la sala, que ya está en curso. */
export const aceptarReto = (id) => solicitarAuth(`/social/retos/${id}/aceptar`, { method: "POST" });
export const rechazarReto = (id) => solicitarAuthSinCuerpo(`/social/retos/${id}/rechazar`);
export const cancelarReto = (id) => solicitarAuthSinCuerpo(`/social/retos/${id}`, { method: "DELETE" });
/** Pide la revancha de una partida que acaba de terminar (colores cambiados, mismo reloj). */
export const pedirRevancha = (codigo) => solicitarAuth(`/social/retos/revancha/${encodeURIComponent(codigo)}`, { method: "POST" });
/** Se pone a buscar un rival de nivel parecido. `{estado: "buscando" | "encontrado" | "sin_rival", codigo?, rival?, segundos}`. */
export const buscarRival = (controlTiempoMs = 0) =>
  solicitarAuth("/social/emparejamiento", { method: "POST", body: JSON.stringify({ control_tiempo_ms: controlTiempoMs }) });
export const dejarDeBuscarRival = () => solicitarAuthSinCuerpo("/social/emparejamiento", { method: "DELETE" });

// --- Tablas, bloqueos y denuncias ---
/** Ofrece tablas en la sala. Si el rival ya había ofrecido, las acepta y la partida termina `1/2-1/2` por acuerdo. Devuelve la sala. */
export const ofrecerTablas = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/tablas`, { method: "POST" });
/** Rechaza las tablas que ofreció el rival. Devuelve la sala. */
export const rechazarTablas = (codigo) => solicitarAuth(`/sala/${encodeURIComponent(codigo)}/tablas/rechazar`, { method: "POST" });
/** Las personas que bloqueó el jugador (nombre abreviado). */
export const obtenerBloqueados = () => solicitarAuth("/social/bloqueos");
/** Bloquea a alguien: no puede retarlo ni buscarlo, y la otra persona no se entera. */
export const bloquearJugador = (usuarioId) => solicitarAuthSinCuerpo(`/social/bloqueos/${usuarioId}`);
export const desbloquearJugador = (usuarioId) => solicitarAuthSinCuerpo(`/social/bloqueos/${usuarioId}`, { method: "DELETE" });
/** Denuncia a alguien que conoce (compañero, amigo o rival de una sala). `motivo`: `conducta | trampa | abandono | otro`. Con `bloquear` también lo bloquea. */
export const denunciarJugador = ({ usuarioId, motivo, detalle = "", codigoSala = null, bloquear = false }) =>
  solicitarAuth("/social/denuncias", {
    method: "POST",
    body: JSON.stringify({ usuario_id: usuarioId, motivo, detalle: detalle || null, codigo_sala: codigoSala, bloquear }),
  });
/** Solo docentes: las denuncias contra sus alumnos (nombres completos). */
export const obtenerDenuncias = () => solicitarAuth("/social/denuncias");
export const marcarDenunciaRevisada = (id) => solicitarAuthSinCuerpo(`/social/denuncias/${id}/revisada`);

// --- Autorización de menores, edad y contraseña ---
/** Si el jugador puede jugar con otras personas y qué le falta: `{estado, puede_jugar_con_otros, es_menor, falta, mensaje, tutor_nombre, tutor_telefono}`. */
export const obtenerMiAutorizacion = () => solicitarAuth("/auth/me/autorizacion");
/** Cambia la contraseña de quien la tiene (pide la actual). */
export const cambiarMiPassword = async (passwordActual, passwordNueva) => {
  const tokens = await solicitarAuth("/auth/me/cambiar-password", {
    method: "POST",
    body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
  });
  actualizarSesion("access_token", tokens.access_token);
  actualizarSesion("refresh_token", tokens.refresh_token);
};
export const pedirRecuperacionPassword = (email) => solicitar("/auth/recuperar-password", { body: JSON.stringify({ email }) });
export const confirmarRecuperacionPassword = async (email, codigo, passwordNueva) => {
  const respuesta = await fetch("/auth/recuperar-password/confirmar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, codigo, password_nueva: passwordNueva }),
  });
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
};

// --- Torneos relámpago de un curso (`/torneos`) ---
export const crearTorneo = ({ cursoId, nombre, controlTiempoMs = 300000, rondas = 3 }) =>
  solicitarAuth("/torneos", { method: "POST", body: JSON.stringify({ curso_id: cursoId, nombre, control_tiempo_ms: controlTiempoMs, rondas }) });
/** Los torneos de un curso, el más reciente primero, con la tabla de posiciones. */
export const obtenerTorneosDelCurso = (cursoId) => solicitarAuth(`/torneos/curso/${cursoId}`);
export const obtenerTorneo = (id) => solicitarAuth(`/torneos/${id}`);
export const inscribirmeEnTorneo = (id) => solicitarAuth(`/torneos/${id}/inscribirse`, { method: "POST" });
export const bajarmeDelTorneo = (id) => solicitarAuth(`/torneos/${id}/inscripcion`, { method: "DELETE" });
/** Docente: inscribe a los alumnos que pueden jugar con otros. `{inscritos, omitidos: [{nombre, motivo}]}`. */
export const inscribirATodosEnTorneo = (id) => solicitarAuth(`/torneos/${id}/inscribir-a-todos`, { method: "POST" });
/** Docente: empareja la ronda siguiente. Con `forzar` cierra sin ganador las partidas de la anterior que siguen abiertas. */
export const iniciarRondaDeTorneo = (id, forzar = false) =>
  solicitarAuth(`/torneos/${id}/iniciar-ronda`, { method: "POST", body: JSON.stringify({ forzar }) });
export const cerrarTorneo = (id) => solicitarAuth(`/torneos/${id}/cerrar`, { method: "POST" });

// --- Aula: avisos y tareas del curso ---
/** Alumno: los avisos de su docente. */
export const obtenerAvisosDeMiCurso = () => solicitarAuth("/cursos/mio/avisos");
/** Alumno: las tareas de su curso con su avance (`valor` de `meta`). */
export const obtenerTareasDeMiCurso = () => solicitarAuth("/cursos/mio/tareas");
export const obtenerAvisosDelCurso = (cursoId) => solicitarAuth(`/cursos/${cursoId}/avisos`);
export const publicarAvisoEnCurso = (cursoId, texto, enlace = "") =>
  solicitarAuth(`/cursos/${cursoId}/avisos`, { method: "POST", body: JSON.stringify({ texto, enlace: enlace || null }) });
export const borrarAvisoDelCurso = (cursoId, avisoId) => solicitarAuthSinCuerpo(`/cursos/${cursoId}/avisos/${avisoId}`, { method: "DELETE" });
/** Docente: las tareas del curso con el avance de cada alumno. */
export const obtenerTareasDelCurso = (cursoId) => solicitarAuth(`/cursos/${cursoId}/tareas`);
/** `tipo`: `partidas_ia | partidas_amigos | precision`. Cuenta lo jugado desde ahora hasta dentro de `dias` días. */
export const crearTareaEnCurso = (cursoId, { titulo, tipo, meta, dias = 7 }) =>
  solicitarAuth(`/cursos/${cursoId}/tareas`, { method: "POST", body: JSON.stringify({ titulo, tipo, meta, dias }) });
export const borrarTareaDelCurso = (cursoId, tareaId) => solicitarAuthSinCuerpo(`/cursos/${cursoId}/tareas/${tareaId}`, { method: "DELETE" });

// --- Aula: cuentas de alumnos, familias y modo clase (docente) ---
/** Crea una cuenta por alumno (`[{nombre, edad?, tutor_nombre?, tutor_telefono?}]`, hasta 60). La clave temporal solo se ve esta vez. `{cuentas: [{id, nombre, usuario, password}], dominio}`. */
export const crearCuentasDeAlumnos = (cursoId, alumnos) =>
  solicitarAuth(`/cursos/${cursoId}/estudiantes/crear`, { method: "POST", body: JSON.stringify({ alumnos }) });
/** Le pone una clave temporal nueva a un alumno: `{usuario, password}`. */
export const restablecerClaveDeAlumno = (cursoId, alumnoId) =>
  solicitarAuth(`/cursos/${cursoId}/estudiantes/${alumnoId}/restablecer-clave`, { method: "POST" });
/** Carga o corrige la edad y el contacto de la familia de un alumno (`{edad, tutor_nombre, tutor_telefono}`, solo lo que cambia). */
export const actualizarDatosDeFamilia = (cursoId, alumnoId, campos) =>
  solicitarAuth(`/cursos/${cursoId}/estudiantes/${alumnoId}/familia`, { method: "PATCH", body: JSON.stringify(campos) });
