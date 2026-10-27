/** Lo que se muestra del Elo de un jugador, y los filtros de la búsqueda de rival. El Elo empieza en 1000 y se marca como provisional (con «?») mientras lleva pocas partidas. */

export const ELO_INICIAL = 1000;
export const ELO_MAXIMO_FILTRO = 3000;
export const NIVEL_MAXIMO = 20;

/** `1020` o `1000?` (provisional); `''` si no hay Elo. Acepta una persona (`{elo, elo_provisional}`) o un número. */
export function textoDeElo(persona) {
  const elo = typeof persona === 'number' ? persona : persona?.elo;
  if (elo == null) return '';
  return `${elo}${persona?.elo_provisional ? '?' : ''}`;
}

/** «Nivel 10 · Intermedio · Elo 1020», con lo que se sepa: para las listas, las franjas de la partida y los avisos. */
export function textoDePersona(persona) {
  if (!persona) return '';
  const nivel = persona.nivel != null ? `Nivel ${persona.nivel}${persona.rango ? ` · ${persona.rango}` : ''}` : 'Nivel sin medir';
  const elo = textoDeElo(persona);
  return elo ? `${nivel} · Elo ${elo}` : nivel;
}

/** «+18» / «−12» / «0» (con el signo menos de verdad, para que se lea bien). */
export function textoDeCambio(cambio) {
  if (!cambio) return '0';
  return cambio > 0 ? `+${cambio}` : `−${Math.abs(cambio)}`;
}

export const FILTROS_VACIOS = { modo: 'parecido', eloMin: '', eloMax: '', nivelMin: '', nivelMax: '' };

/** Los filtros de la pantalla como los pide el backend (`elo_min`, …, solo los que se eligieron); `{}` con «nivel parecido». */
export function filtrosParaEnviar(valor) {
  if (valor.modo !== 'rango') return {};
  const campos = { elo_min: valor.eloMin, elo_max: valor.eloMax, nivel_min: valor.nivelMin, nivel_max: valor.nivelMax };
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]));
}

/** Un mensaje si el rango elegido no sirve (el mínimo supera al máximo, o no se eligió ningún límite); `null` si está bien. */
export function errorDeFiltros(valor) {
  if (valor.modo !== 'rango') return null;
  const f = filtrosParaEnviar(valor);
  if (Object.keys(f).length === 0) return 'Elegí al menos un límite de Elo o de nivel, o volvé a «Nivel parecido».';
  if (f.elo_min != null && f.elo_max != null && f.elo_min > f.elo_max) return 'El Elo «desde» no puede ser mayor que el «hasta».';
  if (f.nivel_min != null && f.nivel_max != null && f.nivel_min > f.nivel_max) return 'El nivel «desde» no puede ser mayor que el «hasta».';
  return null;
}

/** «Elo 1000 a 1500 · nivel 10 a 12» (o «Elo desde 1500», «nivel hasta 12»…) para mostrar qué se está buscando. */
export function textoDeFiltros(filtros) {
  if (!filtros) return '';
  const rango = (nombre, minimo, maximo) =>
    minimo != null && maximo != null ? `${nombre} ${minimo} a ${maximo}` : minimo != null ? `${nombre} desde ${minimo}` : maximo != null ? `${nombre} hasta ${maximo}` : null;
  return [rango('Elo', filtros.elo_min, filtros.elo_max), rango('nivel', filtros.nivel_min, filtros.nivel_max)].filter(Boolean).join(' · ');
}
