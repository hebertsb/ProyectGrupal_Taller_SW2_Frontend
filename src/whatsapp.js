/**
 * Enlaces de WhatsApp para que un docente le escriba a la familia de un alumno: el teléfono que se guardó (`71234567`, `+59171234567`…) se deja con el
 * prefijo del país, que es lo que pide `wa.me`. Un número boliviano de 8 cifras que empieza con 6 o 7 es un celular y recibe el prefijo 591.
 */

/** Solo dígitos, con el prefijo del país. Devuelve `''` si no hay teléfono. */
export function telefonoParaWhatsApp(telefono) {
  const texto = String(telefono ?? '').trim();
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return '';
  if (texto.startsWith('+')) return digitos;
  if (digitos.startsWith('00')) return digitos.slice(2);
  if (/^[67]\d{7}$/.test(digitos)) return `591${digitos}`;
  return digitos;
}

/** Enlace `https://wa.me/...` para abrir la conversación, con un mensaje ya escrito (opcional). `''` si no hay teléfono. */
export function enlaceWhatsApp(telefono, mensaje = '') {
  const numero = telefonoParaWhatsApp(telefono);
  if (!numero) return '';
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}
