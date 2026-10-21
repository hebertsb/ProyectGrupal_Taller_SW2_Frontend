/**
 * Dónde se guarda la sesión (tokens y usuario) según "Recordar en este equipo":
 * - marcado: en localStorage, sobrevive a cerrar el navegador;
 * - sin marcar: en sessionStorage, se borra al cerrar la pestaña o el navegador.
 * Las lecturas miran los dos lugares, así el resto de la app no necesita saber cuál se usó.
 */

const CLAVES = ["access_token", "refresh_token", "usuario"];

function almacenes() {
  const lista = [];
  try { lista.push(window.localStorage); } catch { /* sin acceso (modo privado estricto) */ }
  try { lista.push(window.sessionStorage); } catch { /* idem */ }
  return lista;
}

/** Lee una clave de la sesión, esté en localStorage o en sessionStorage. */
export function leerSesion(clave) {
  for (const almacen of almacenes()) {
    const valor = almacen.getItem(clave);
    if (valor !== null) return valor;
  }
  return null;
}

/** Guarda la sesión completa tras iniciar sesión; `recordar` elige el almacén y limpia el otro. */
export function guardarSesion({ accessToken, refreshToken, usuario }, recordar) {
  borrarSesion();
  const destino = recordar ? window.localStorage : window.sessionStorage;
  destino.setItem("access_token", accessToken);
  destino.setItem("refresh_token", refreshToken);
  destino.setItem("usuario", JSON.stringify(usuario));
}

/** Actualiza una clave en el mismo almacén donde ya estaba la sesión. */
export function actualizarSesion(clave, valor) {
  const enSesion = window.sessionStorage.getItem("access_token") !== null
    && window.localStorage.getItem("access_token") === null;
  (enSesion ? window.sessionStorage : window.localStorage).setItem(clave, valor);
}

/**
 * Pide al backend un access token nuevo con el refresh token guardado y lo deja en el mismo almacén.
 * Así la sesión no se corta a las 12 horas: dura mientras el usuario vuelva antes de que venza el
 * refresh token (7 días), hasta que cierre sesión. Devuelve false si el refresh ya no es válido;
 * si el servidor no responde (sin internet) devuelve null y no toca la sesión.
 */
export async function renovarSesion() {
  const refreshToken = leerSesion("refresh_token");
  if (!refreshToken) return false;
  let respuesta;
  try {
    respuesta = await fetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return null;
  }
  if (respuesta.status === 401) return false;
  if (!respuesta.ok) return null;
  const datos = await respuesta.json();
  actualizarSesion("access_token", datos.access_token);
  actualizarSesion("refresh_token", datos.refresh_token);
  return true;
}

/** Cierra la sesión en los dos almacenes. */
export function borrarSesion() {
  for (const almacen of almacenes()) {
    for (const clave of CLAVES) almacen.removeItem(clave);
  }
}
