/** Abre el borrador en la aplicación de correo del docente; el docente decide cuándo enviarlo. */
export function enlaceCorreoFamilia(correo, texto = '', asunto = 'Seguimiento de ajedrez en ChessIA') {
  if (!correo) return '';
  return `mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
}
