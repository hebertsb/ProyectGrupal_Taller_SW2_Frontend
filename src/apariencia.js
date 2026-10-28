/** Preferencias visuales por cuenta. El servidor guarda la elección; la copia local evita destellos al abrir la web. */
export const MODOS_APARIENCIA = ['dia', 'noche', 'automatico'];
export const PALETAS_APARIENCIA = [
  { id: 'clasico', nombre: 'Clásico', descripcion: 'Cian y violeta', muestras: ['#006575', '#00e5ff', '#cdbdff'] },
  { id: 'oceano', nombre: 'Océano', descripcion: 'Azul y lavanda', muestras: ['#164e9c', '#85baff', '#cbc0ff'] },
  { id: 'bosque', nombre: 'Bosque', descripcion: 'Verde y arena', muestras: ['#1e603b', '#8ed5a7', '#e8c987'] },
  { id: 'atardecer', nombre: 'Atardecer', descripcion: 'Terracota y malva', muestras: ['#9a3d20', '#ffa67e', '#e3bcf8'] },
  { id: 'uva', nombre: 'Uva', descripcion: 'Violeta y menta', muestras: ['#713c87', '#d28ce6', '#83d4cd'] },
];

export function normalizarPaleta(valor) {
  return PALETAS_APARIENCIA.some((p) => p.id === valor) ? valor : 'clasico';
}

export function clavePaleta(usuarioId) {
  return `chessia_paleta_${usuarioId ?? 'visitante'}`;
}

export function leerPaleta(usuario) {
  if (PALETAS_APARIENCIA.some((p) => p.id === usuario?.paleta)) return usuario.paleta;
  try {
    return normalizarPaleta(localStorage.getItem(clavePaleta(usuario?.id)));
  } catch {
    return 'clasico';
  }
}

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

export function guardarAparienciaLocal(usuarioId, modo, paleta) {
  try {
    localStorage.setItem(claveApariencia(usuarioId), normalizarModo(modo));
    if (paleta !== undefined) localStorage.setItem(clavePaleta(usuarioId), normalizarPaleta(paleta));
  } catch { /* La selección funciona también sin almacenamiento local. */ }
}

export function temaEfectivo(modo, sistemaOscuro) {
  return modo === 'noche' || (modo === 'automatico' && sistemaOscuro) ? 'noche' : 'dia';
}

export function aplicarApariencia(modo, sistemaOscuro, paleta = 'clasico') {
  const tema = temaEfectivo(modo, sistemaOscuro);
  document.documentElement.dataset.tema = tema;
  document.documentElement.dataset.modoApariencia = modo;
  document.documentElement.dataset.paleta = normalizarPaleta(paleta);
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
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'data-paleta'] });
  return () => observador.disconnect();
}
