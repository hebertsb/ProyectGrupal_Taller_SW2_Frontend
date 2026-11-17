/**
 * Reglas puras del camino de aprendizaje (CU27), separadas del componente para poder probarlas sin navegador:
 * el candado pedagógico (no se practica sin terminar la demostración) y qué video se muestra en cada lección.
 */

/** Un tema ya completado se puede practicar directo; el paso en curso exige terminar antes la demostración. */
export const demostracionInicialCompletada = (capitulo) => capitulo?.estado === 'completado';

/** El botón «Probar una partida» solo se habilita cuando la demostración (o el video) ya se terminó. */
export const puedeProbarPartida = (demostracionCompletada) => Boolean(demostracionCompletada);

/**
 * Video de la lección. Prioridad 1: el del tema o módulo que subió el facilitador (por ejemplo `enroque`);
 * prioridad 2: el de la pieza asociada (por ejemplo `rey`). Sin ninguno, `url` es `null`.
 */
export function videoDelCapitulo(videosPorPieza, capitulo) {
  const delModulo = (videosPorPieza && capitulo?.id && videosPorPieza[capitulo.id]) || null;
  const tipoPieza = capitulo?.tipoPiezaVideo;
  const dePieza = (videosPorPieza && tipoPieza && videosPorPieza[tipoPieza]) || null;
  return { url: delModulo || dePieza, esEspecificoDelModulo: Boolean(delModulo) };
}

/** Un módulo bloqueado no abre su lección: primero hay que terminar el que está en curso. */
export const puedeAbrirLeccion = (capitulo) => capitulo?.estado !== 'bloqueado';

/** Aviso al tocar un módulo bloqueado, con el nombre del módulo que hay que terminar antes. */
export function avisoDeModuloBloqueado(capitulos) {
  const enCurso = capitulos?.find((c) => c.estado === 'en_curso');
  return enCurso ? `Primero terminá el módulo en curso: «${enCurso.titulo}».` : 'Primero terminá el módulo anterior para abrir este.';
}
