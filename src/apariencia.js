/** Preferencias visuales por cuenta. El servidor guarda la elección; la copia local evita destellos al abrir la web. */
export const MODOS_APARIENCIA = ['dia', 'noche', 'automatico'];

export function normalizarModo(valor) {
  return MODOS_APARIENCIA.includes(valor) ? valor : 'dia';
}

export function claveApariencia(usuarioId) {
  return `chessia_apariencia_${usuarioId ?? 'visitante'}`;
}

export function leerApariencia(usuario) {
  if (MODOS_APARIENCIA.includes(usuario?.tema)) return usuario.tema;
  try {
    return normalizarModo(localStorage.getItem(claveApariencia(usuario?.id)));
  } catch {
    return 'dia';
  }
}

export function guardarAparienciaLocal(usuarioId, modo) {
  try {
    localStorage.setItem(claveApariencia(usuarioId), normalizarModo(modo));
  } catch { /* La selección funciona también sin almacenamiento local. */ }
}

export function temaEfectivo(modo, sistemaOscuro) {
  return modo === 'noche' || (modo === 'automatico' && sistemaOscuro) ? 'noche' : 'dia';
}

export function aplicarApariencia(modo, sistemaOscuro) {
  const tema = temaEfectivo(modo, sistemaOscuro);
  document.documentElement.dataset.tema = tema;
  document.documentElement.dataset.modoApariencia = modo;
  document.documentElement.style.colorScheme = tema === 'noche' ? 'dark' : 'light';
}

/** Color del tema para dibujar en un canvas/WebGL, que no interpreta variables CSS directamente. */
export function colorDelTema(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`).trim();
}

/** Actualiza materiales de una escena existente al cambiar el tema, sin reconstruir sus modelos ni su animación. */
export function observarApariencia(actualizar) {
  actualizar();
  const observador = new MutationObserver(actualizar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  return () => observador.disconnect();
}
