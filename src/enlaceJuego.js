/**
 * Enlaces para jugar con otros: una partida (`/#sala=K7QM4T`) o una amistad (`/#amigo=AB3DK7QM`). Igual que los de curso, el código va en el
 * fragmento: no llega al servidor ni queda en sus registros. Al abrir el enlace se guarda en esta pestaña (`sessionStorage`) y se borra de la barra
 * de direcciones; cuando el jugador ya tiene sesión, la aplicación lo sienta en la partida o le manda la solicitud. Así sirve igual si todavía no
 * tenía cuenta y tiene que registrarse primero.
 */

const CLAVE = 'chessia_enlace_de_juego';
const TIPOS = { sala: '#sala=', amigo: '#amigo=' };

/** El enlace que se manda por WhatsApp para jugar una partida: abre la sala con ese código. */
export function enlaceDeSala(codigo) {
  return `${window.location.origin}/${TIPOS.sala}${encodeURIComponent(codigo)}`;
}

/** El enlace para que alguien te agregue como amigo. */
export function enlaceDeAmigo(codigo) {
  return `${window.location.origin}/${TIPOS.amigo}${encodeURIComponent(codigo)}`;
}

/** Los mensajes que se mandan por WhatsApp. */
export function mensajeDeSala({ enlace, nombre, reloj }) {
  const con = reloj ? ` (${reloj} por lado)` : '';
  return `${nombre ? `${nombre} te` : 'Te'} reta a una partida de ajedrez en ChessIA${con}. Entrá con este enlace y jugamos: ${enlace}`;
}

export function mensajeDeAmigo({ enlace, codigo }) {
  return `Agregame como amigo en ChessIA para jugar al ajedrez. Entrá con este enlace: ${enlace} (o poné mi código de amigo: ${codigo})`;
}

function guardar(tipo, codigo) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify({ tipo, codigo }));
  } catch {
    // sin almacenamiento (modo privado): el jugador igual puede escribir el código a mano
  }
}

/**
 * Si la dirección trae un código de partida o de amigo, lo guarda como pendiente y lo borra de la barra. Devuelve `{ tipo, codigo }`, o `null` si la
 * dirección no traía ninguno. Se puede llamar las veces que haga falta.
 */
export function capturarEnlaceDeJuego() {
  const hash = window.location.hash;
  const tipo = Object.keys(TIPOS).find((clave) => hash.startsWith(TIPOS[clave]));
  if (!tipo) return null;
  let codigo = null;
  try {
    codigo = decodeURIComponent(hash.slice(TIPOS[tipo].length)).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || null;
  } catch {
    codigo = null;
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!codigo) return null;
  guardar(tipo, codigo);
  return { tipo, codigo };
}

/** El enlace de juego que quedó pendiente de usar en esta pestaña (`{ tipo, codigo }`), o `null`. */
export function enlaceDeJuegoPendiente() {
  try {
    const guardado = JSON.parse(window.sessionStorage.getItem(CLAVE) || 'null');
    return guardado && TIPOS[guardado.tipo] && guardado.codigo ? guardado : null;
  } catch {
    return null;
  }
}

/** Ya se usó (o se descartó): no vuelve a intentarse. */
export function olvidarEnlaceDeJuego() {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}

/** `1:00` → texto para el reloj: `0` es sin reloj; si no, minutos por lado. */
export function textoDeReloj(ms) {
  return ms ? `${ms / 60000} min` : 'Sin reloj';
}
