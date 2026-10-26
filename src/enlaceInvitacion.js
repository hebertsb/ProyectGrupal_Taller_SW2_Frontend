/**
 * Enlaces de invitación: llevan el código en el fragmento (`/#invitacion=K7QM-4TXD`). Lo que va después del `#` no se manda al servidor ni
 * queda en sus registros, y al abrir el enlace la pantalla de ingreso lo lee, lo usa y lo borra de la barra de direcciones.
 */

const PREFIJO = '#invitacion=';

/** El enlace que se manda por WhatsApp o por mensaje: abre directo el registro con la invitación ya cargada. */
export function enlaceDeInvitacion(codigo) {
  return `${window.location.origin}/${PREFIJO}${encodeURIComponent(codigo)}`;
}

/** El código que trae la dirección actual, o `null`. */
export function leerInvitacionDelEnlace() {
  const hash = window.location.hash;
  if (!hash.startsWith(PREFIJO)) return null;
  try {
    return decodeURIComponent(hash.slice(PREFIJO.length)) || null;
  } catch {
    return null;
  }
}

/** Saca el código de la barra de direcciones (ya se leyó) para que no quede a la vista ni en el historial. */
export function borrarInvitacionDelEnlace() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** `true` si el sistema está abierto en esta misma computadora: un enlace así no le sirve a nadie más. */
export function esDireccionLocal() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

/** El texto del mensaje de invitación, según para qué es. */
export function mensajeDeInvitacion({ enlace, institucion, esEvaluacion, comoAdministrador, vigencia }) {
  const hasta = vigencia ? ` y vence ${vigencia}` : '';
  if (esEvaluacion) {
    return `Te invito a probar ChessIA, el tutor inteligente de ajedrez, como director de «${institucion}». Creá tu cuenta con este enlace (es personal${hasta}): ${enlace}`;
  }
  if (comoAdministrador) {
    return `Te invito a ser el administrador de «${institucion}» en ChessIA. Creá tu cuenta con este enlace (es personal${hasta}): ${enlace}`;
  }
  if (institucion) {
    return `Te invito a sumarte como docente de «${institucion}» en ChessIA. Creá tu cuenta con este enlace (es personal${hasta}): ${enlace}`;
  }
  return `Te invito a ChessIA como facilitador. Creá tu cuenta con este enlace (es personal${hasta}): ${enlace}`;
}

/** Abre WhatsApp (la aplicación o WhatsApp Web) con el mensaje ya escrito, para elegir a quién mandárselo. */
export function enlaceDeWhatsApp(texto) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
