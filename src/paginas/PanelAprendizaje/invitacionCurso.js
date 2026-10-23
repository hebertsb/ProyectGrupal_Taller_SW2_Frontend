// Memoria de "No, juego por mi cuenta" de la invitación a un curso. La comparten el Panel de Aprendizaje y la Sala de
// Control: descartarla en una pantalla la oculta también en la otra porque la clave es la misma (por usuario).

function claveSinCurso(usuarioId) {
  return `panel_aprendizaje_sin_curso_${usuarioId ?? 'anon'}`;
}

/** `true` si el jugador ya dijo "No, juego por mi cuenta" (se recuerda por usuario; si el storage falla, `false`). */
export function cargarDescartada(usuarioId) {
  try {
    return localStorage.getItem(claveSinCurso(usuarioId)) === '1';
  } catch {
    return false;
  }
}

export function guardarDescartada(usuarioId) {
  try {
    localStorage.setItem(claveSinCurso(usuarioId), '1');
  } catch {
    // localStorage puede fallar (modo privado, cuota): la tarjeta igual se oculta mientras dure la pantalla.
  }
}
