/** Textos y estilos compartidos por las pantallas de progreso (informe de un alumno, antes y después de un grupo). */

/** Cómo se cuenta el cambio de un alumno: ícono, palabra y color (nunca solo color). */
export const TENDENCIAS = {
  mejora: { texto: 'Mejoró', icono: 'trending_up', clase: 'text-primary', fondo: 'bg-primary-container/20' },
  estable: { texto: 'Se mantiene', icono: 'trending_flat', clase: 'text-on-surface-variant', fondo: 'bg-surface-container-high' },
  baja: { texto: 'Bajó', icono: 'trending_down', clase: 'text-tertiary-fixed-dim', fondo: 'bg-tertiary-container/20' },
  sin_comparacion: { texto: 'En diagnóstico', icono: 'hourglass_top', clase: 'text-on-surface-variant', fondo: 'bg-surface-container-high' },
};

/** El semáforo de constancia de un alumno: ícono, palabra y color (nunca solo color). */
export const SEMAFOROS = {
  verde: { texto: 'Al día', icono: 'check_circle', clase: 'text-primary' },
  amarillo: { texto: 'Se está alejando', icono: 'schedule', clase: 'text-tertiary-fixed-dim' },
  rojo: { texto: 'Hace tiempo que no juega', icono: 'warning', clase: 'text-error' },
  sin_empezar: { texto: 'Sin empezar', icono: 'hourglass_empty', clase: 'text-on-surface-variant' },
};

export const NOMBRE_DE_FASE = { apertura: 'Apertura', medio: 'Medio juego', final: 'Final' };

/** `{ganadas: 3, empatadas: 1, perdidas: 2}` → `3 G · 1 E · 2 P`; `—` si no jugó ninguna. */
export function resultadosEntrePersonas(resultados) {
  if (!resultados) return '—';
  const { ganadas = 0, empatadas = 0, perdidas = 0 } = resultados;
  return ganadas + empatadas + perdidas === 0 ? '—' : `${ganadas} G · ${empatadas} E · ${perdidas} P`;
}

/** `30` → `+30`, `-12` → `−12`, `0` → `0`: lo que se movió el Elo. */
export function variacionElo(cambio) {
  if (!cambio) return '0';
  return `${cambio > 0 ? '+' : '−'}${Math.abs(cambio)}`;
}

/** `42` → `42 %`; `—` si no hay dato. */
export function porcentaje(valor) {
  return valor == null ? '—' : `${Number(valor).toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
}

/** `+20 puntos`, `−3,5 puntos`, `0 puntos`. */
export function puntos(valor) {
  if (valor == null) return '—';
  const redondeado = Math.round(valor * 10) / 10;
  if (redondeado === 0) return '0 puntos';
  const cifra = Math.abs(redondeado).toLocaleString('es-BO', { maximumFractionDigits: 1 });
  return `${redondeado > 0 ? '+' : '−'}${cifra} ${Math.abs(redondeado) === 1 ? 'punto' : 'puntos'}`;
}

/** `6.5` → `6,5`. */
export function numero(valor) {
  return valor == null ? '—' : Number(valor).toLocaleString('es-BO', { maximumFractionDigits: 1 });
}

/** Cuánto hace que no juega: `hoy`, `ayer`, `hace 5 días`, o `nunca jugó`. */
export function haceCuanto(dias) {
  if (dias == null) return 'nunca jugó';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/**
 * El mensaje corto que un docente le puede mandar al responsable del alumno (por ejemplo por WhatsApp). Va sin enlace: el informe lleva
 * el nombre completo de un menor y no se publica en ninguna dirección.
 */
export function mensajeParaElResponsable(informe) {
  const { alumno, progreso, actividad } = informe;
  const primero = alumno.nombre.split(' ')[0];
  const lineas = [`Informe de ajedrez de ${alumno.nombre}${alumno.curso ? ` (${alumno.curso})` : ''}:`];
  if (progreso.comparable) {
    lineas.push(
      `• Empezó en el nivel ${progreso.nivel_antes} (${progreso.rango_antes}) y hoy está en el nivel ${progreso.nivel_despues} (${progreso.rango_despues}): ${TENDENCIAS[progreso.tendencia].texto.toLowerCase()} ${puntos(progreso.variacion_precision)} de precisión.`,
    );
  } else if (progreso.diagnostico_completo) {
    lineas.push(`• Empezó en el nivel ${progreso.nivel_antes} (${progreso.rango_antes}). Con una partida más ya se ve cómo evoluciona.`);
  } else {
    lineas.push(`• ${primero} todavía está en su diagnóstico (${progreso.calibradas} de 3 partidas medidas).`);
  }
  lineas.push(`• Jugó ${actividad.partidas} partida${actividad.partidas === 1 ? '' : 's'}, ${actividad.partidas_30_dias} en el último mes.`);
  const comp = informe.competencia;
  if (comp && comp.total > 0) {
    lineas.push(`• Con compañeros jugó ${comp.total} partida${comp.total === 1 ? '' : 's'}; su Elo es ${comp.elo}${comp.elo_provisional ? ' (provisional)' : ''}.`);
  }
  const torneo = comp?.puestos_en_torneos?.find((t) => t.estado === 'terminado' && t.partidas > 0);
  if (torneo) lineas.push(`• En el torneo «${torneo.nombre}» quedó en el puesto ${torneo.puesto} de ${torneo.de}.`);
  lineas.push('La precisión compara cada jugada con la mejor posible según un motor de ajedrez.');
  return lineas.join('\n');
}
