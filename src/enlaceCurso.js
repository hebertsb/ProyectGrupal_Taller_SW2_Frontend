/**
 * Enlaces y códigos QR de curso: llevan el código en el fragmento (`/#curso=K7QM-4TXD`). Lo que va después del `#` no se manda al
 * servidor ni queda en sus registros. Al abrir el enlace se guarda el código en esta pestaña (`sessionStorage`) y se borra de la barra
 * de direcciones; cuando el alumno ya tiene sesión, la aplicación lo inscribe en el curso. Así sirve igual si todavía no tenía cuenta
 * y tiene que registrarse primero.
 */

const PREFIJO = '#curso=';
const CLAVE = 'chessia_curso_pendiente';

/** El enlace que abre el registro del alumno con el curso ya elegido; es lo que lleva el código QR del curso. */
export function enlaceDeCurso(codigo) {
  return `${window.location.origin}/${PREFIJO}${encodeURIComponent(codigo)}`;
}

/** El mensaje que el docente le manda a los alumnos o a sus familias. */
export function mensajeDeCurso({ enlace, curso, docente }) {
  const de = docente ? ` de ${docente}` : '';
  return `Te invito al curso de ajedrez «${curso}»${de} en ChessIA. Entrá con este enlace, creá tu cuenta (o iniciá sesión) y quedás dentro del curso: ${enlace}`;
}

function guardar(codigo) {
  try {
    window.sessionStorage.setItem(CLAVE, codigo);
  } catch {
    // sin almacenamiento (modo privado): el alumno igual puede escribir el código en «Mi curso»
  }
}

/**
 * Si la dirección trae un código de curso, lo guarda como pendiente y lo borra de la barra. Devuelve el código, o `null` si la
 * dirección no traía ninguno. Se puede llamar las veces que haga falta.
 */
export function capturarCursoDelEnlace() {
  const hash = window.location.hash;
  if (!hash.startsWith(PREFIJO)) return null;
  let codigo = null;
  try {
    codigo = decodeURIComponent(hash.slice(PREFIJO.length)).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || null;
  } catch {
    codigo = null;
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (codigo) guardar(codigo);
  return codigo;
}

/** El código de curso que quedó pendiente de usar en esta pestaña, o `null`. */
export function cursoPendiente() {
  try {
    return window.sessionStorage.getItem(CLAVE) || null;
  } catch {
    return null;
  }
}

/** Ya se usó (o se descartó): no vuelve a intentarse. */
export function olvidarCursoPendiente() {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}
