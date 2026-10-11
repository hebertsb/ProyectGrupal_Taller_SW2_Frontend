import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const SEGMENTOS = [
  { clave: 'ganadas', etiqueta: 'Ganadas', clase: 'stroke-primary', punto: 'bg-primary', barra: 'bg-primary' },
  { clave: 'perdidas', etiqueta: 'Perdidas', clase: 'stroke-error', punto: 'bg-error', barra: 'bg-error' },
  { clave: 'tablas', etiqueta: 'Tablas', clase: 'stroke-secondary', punto: 'bg-secondary', barra: 'bg-secondary' },
];

/**
 * Dona de resultados. Al pasar el mouse, tocar o enfocar una porción (o su ítem de la leyenda) esa
 * porción se agranda y se separa del centro, las otras se atenúan y el centro muestra su cantidad y
 * porcentaje. Tocar o Enter la deja fija; volver a tocar la suelta.
 */
export function DonaResultados({ ganadas, perdidas, tablas }) {
  const reducir = useReducedMotion();
  const [pasando, setPasando] = useState(null);
  const [fijada, setFijada] = useState(null);
  const valores = { ganadas, perdidas, tablas };
  const total = ganadas + perdidas + tablas;

  if (total === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no terminaste ninguna partida.</p>;
  }

  const radio = 40;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;
  const arcos = SEGMENTOS.map((segmento) => {
    const largo = (valores[segmento.clave] / total) * circunferencia;
    const mitad = ((acumulado + largo / 2) / circunferencia) * 2 * Math.PI; // ángulo del centro de la porción
    const arco = { ...segmento, valor: valores[segmento.clave], largo, desde: acumulado, mitad };
    acumulado += largo;
    return arco;
  });
  const activa = pasando ?? fijada;
  const visible = arcos.find((a) => a.clave === activa) ?? null;
  const alternar = (clave) => setFijada((actual) => (actual === clave ? null : clave));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 overflow-visible" role="group" aria-label={`Resultados: ${ganadas} ganadas, ${perdidas} perdidas, ${tablas} tablas`}>
          <circle cx="50" cy="50" r={radio} fill="none" className="stroke-white/10" strokeWidth="10" />
          {arcos.map((arco, i) => {
            if (arco.valor === 0) return null;
            const elegida = activa === arco.clave;
            return (
              <motion.circle
                key={arco.clave}
                cx="50"
                cy="50"
                r={radio}
                fill="none"
                className={`${arco.clase} cursor-pointer outline-none`}
                strokeLinecap="butt"
                strokeDashoffset={-arco.desde}
                tabIndex={0}
                role="button"
                aria-pressed={fijada === arco.clave}
                aria-label={`${arco.etiqueta}: ${arco.valor} de ${total}`}
                initial={reducir ? false : { strokeDasharray: `0 ${circunferencia}` }}
                animate={{
                  strokeDasharray: `${Math.max(arco.largo - 1.5, 0)} ${circunferencia}`,
                  strokeWidth: elegida ? 15 : 10,
                  x: elegida ? Math.cos(arco.mitad) * 4.5 : 0,
                  y: elegida ? Math.sin(arco.mitad) * 4.5 : 0,
                  opacity: activa && !elegida ? 0.3 : 1,
                }}
                transition={reducir ? { duration: 0 } : { duration: elegida || activa ? 0.2 : 0.8, delay: activa ? 0 : 0.15 * i, ease: 'easeOut' }}
                style={{ filter: elegida ? 'drop-shadow(0 0 5px currentColor)' : undefined }}
                onPointerEnter={() => setPasando(arco.clave)}
                onPointerLeave={() => setPasando(null)}
                onFocus={() => setPasando(arco.clave)}
                onBlur={() => setPasando(null)}
                onClick={() => alternar(arco.clave)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    alternar(arco.clave);
                  }
                }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="font-headline-sm text-headline-sm text-on-surface">{visible ? visible.valor : total}</span>
          <span className="font-mono-micro text-[10px] uppercase tracking-wider text-on-surface-variant">
            {visible ? `${visible.etiqueta} · ${Math.round((visible.valor / total) * 100)}%` : 'terminadas'}
          </span>
        </div>
      </div>

      <ul className="flex flex-wrap justify-center gap-2 m-0 p-0 list-none">
        {arcos.map((arco) => (
          <li key={arco.clave}>
            <button
              type="button"
              aria-pressed={fijada === arco.clave}
              onPointerEnter={() => setPasando(arco.clave)}
              onPointerLeave={() => setPasando(null)}
              onFocus={() => setPasando(arco.clave)}
              onBlur={() => setPasando(null)}
              onClick={() => alternar(arco.clave)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md font-body-sm text-[12px] text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                activa === arco.clave ? 'bg-white/[0.14] border-white/30' : 'bg-white/[0.05] border-white/10'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${arco.punto}`} aria-hidden="true" />
              {arco.etiqueta} <strong>{arco.valor}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const NOMBRE_RIVAL = { modelo: 'Turing', motor: 'Stockfish' };

/**
 * Cómo te fue contra cada rival: una barra apilada de ganadas, tablas y perdidas. Cada tramo reacciona
 * al mouse, al toque y al teclado, y la frase de abajo dice el detalle del tramo elegido.
 */
export function RendimientoPorRival({ resultados }) {
  const reducir = useReducedMotion();
  const [elegido, setElegido] = useState(null); // { rival, clave }

  const filas = ['modelo', 'motor'].map((rival) => {
    const r = resultados?.[rival] ?? { ganadas: 0, perdidas: 0, tablas: 0 };
    return { rival, ...r, total: r.ganadas + r.perdidas + r.tablas };
  });
  if (filas.every((f) => f.total === 0)) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no terminaste ninguna partida.</p>;
  }

  const detalle = elegido ? filas.find((f) => f.rival === elegido.rival) : null;
  const tramo = elegido ? SEGMENTOS.find((s) => s.clave === elegido.clave) : null;

  return (
    <div className="flex flex-col gap-3">
      {filas.map((fila, indice) => (
        <div key={fila.rival} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 font-body-sm text-[12px] text-on-surface">
            <strong>Contra {NOMBRE_RIVAL[fila.rival]}</strong>
            <span className="text-on-surface-variant">
              {fila.total === 0 ? 'sin partidas terminadas' : `${fila.total} ${fila.total === 1 ? 'partida' : 'partidas'} · ${Math.round((fila.ganadas / fila.total) * 100)}% de victorias`}
            </span>
          </div>
          <div className="flex h-5 rounded-full overflow-hidden bg-white/10">
            {fila.total > 0 &&
              ['ganadas', 'tablas', 'perdidas'].map((clave) => {
                const segmento = SEGMENTOS.find((s) => s.clave === clave);
                const cantidad = fila[clave];
                if (cantidad === 0) return null;
                const activo = elegido?.rival === fila.rival && elegido?.clave === clave;
                return (
                  <motion.button
                    key={clave}
                    type="button"
                    aria-label={`${NOMBRE_RIVAL[fila.rival]}: ${cantidad} ${segmento.etiqueta.toLowerCase()}`}
                    className={`${segmento.barra} h-full border-0 p-0 cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-white`}
                    style={{ opacity: elegido && !activo ? 0.4 : 1, filter: activo ? 'brightness(1.25)' : undefined }}
                    initial={reducir ? false : { width: 0 }}
                    animate={{ width: `${(cantidad / fila.total) * 100}%` }}
                    transition={reducir ? { duration: 0 } : { duration: 0.7, delay: 0.1 * indice, ease: 'easeOut' }}
                    onPointerEnter={() => setElegido({ rival: fila.rival, clave })}
                    onPointerLeave={() => setElegido(null)}
                    onFocus={() => setElegido({ rival: fila.rival, clave })}
                    onBlur={() => setElegido(null)}
                  />
                );
              })}
          </div>
        </div>
      ))}
      <p role="status" aria-live="polite" className="min-h-[2.5rem] font-body-sm text-[12px] text-on-surface-variant">
        {detalle && tramo
          ? `Contra ${NOMBRE_RIVAL[detalle.rival]}: ${detalle[tramo.clave]} ${tramo.etiqueta.toLowerCase()} de ${detalle.total} partidas (${Math.round((detalle[tramo.clave] / detalle.total) * 100)}%).`
          : 'Pasá el mouse o tocá un tramo de la barra para ver el detalle.'}
      </p>
    </div>
  );
}

const NOMBRE_FASE = { apertura: 'Apertura', medio: 'Medio juego', final: 'Final' };
const CON_ARTICULO = { apertura: 'la apertura', medio: 'el medio juego', final: 'el final' };
const CONSEJO_FASE = {
  apertura: 'Repasá los principios de la apertura: controlá el centro, sacá las piezas y enrocá pronto.',
  medio: 'Antes de cada jugada revisá qué amenaza el rival y si dejás alguna pieza sin defensa.',
  final: 'Practicá finales sencillos: acercá el rey, avanzá los peones y activá las torres.',
};
/** Con menos jugadas analizadas que esto, el porcentaje de una fase no dice nada. */
const MINIMO_JUGADAS_POR_FASE = 3;

/** La fase con menor precisión entre las que tienen datos suficientes, o `null` si no hay con qué comparar. */
export function faseMasFloja(fases) {
  const medibles = (fases ?? []).filter((f) => f.precision != null && f.jugadas >= MINIMO_JUGADAS_POR_FASE);
  if (medibles.length < 2) return null;
  return medibles.reduce((peor, f) => (f.precision < peor.precision ? f : peor));
}

/**
 * Precisión en apertura, medio juego y final como tres columnas con degradado. Debajo, una frase con la
 * fase más floja y un consejo fijo (no generado) para mejorarla.
 */
export function PrecisionPorFase({ fases }) {
  const reducir = useReducedMotion();
  const [activa, setActiva] = useState(null);
  const lista = fases ?? [];
  if (lista.every((f) => f.jugadas === 0)) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Abrí el análisis de tus partidas terminadas y acá vas a ver en qué fase jugás mejor.
      </p>
    );
  }
  const floja = faseMasFloja(lista);
  const mostrada = lista.find((f) => f.fase === activa) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 items-end h-36 pt-5">
        {lista.map((fase, indice) => {
          const alto = fase.precision == null ? 4 : Math.max(fase.precision, 4);
          const elegida = activa === fase.fase;
          return (
            <button
              key={fase.fase}
              type="button"
              aria-label={`${NOMBRE_FASE[fase.fase]}: ${fase.precision == null ? 'sin jugadas analizadas' : `${fase.precision}% de precisión en ${fase.jugadas} jugadas`}`}
              onPointerEnter={() => setActiva(fase.fase)}
              onPointerLeave={() => setActiva(null)}
              onFocus={() => setActiva(fase.fase)}
              onBlur={() => setActiva(null)}
              className="flex flex-col items-center justify-end gap-1 h-full bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            >
              <span className="relative flex items-end w-full flex-1 rounded-t-lg bg-white/[0.06]">
                <span
                  className="absolute left-0 right-0 text-center font-mono-metric text-[11px] text-on-surface"
                  style={{ bottom: `calc(${alto}% + 4px)` }}
                >
                  {fase.precision == null ? '—' : `${fase.precision}%`}
                </span>
                <motion.span
                  className="block w-full rounded-t-lg bg-linear-to-t from-primary to-secondary"
                  style={{ opacity: activa && !elegida ? 0.45 : 1, filter: elegida ? 'drop-shadow(0 0 6px var(--color-primary))' : undefined }}
                  initial={reducir ? false : { height: 0 }}
                  animate={{ height: `${alto}%` }}
                  transition={reducir ? { duration: 0 } : { duration: 0.8, delay: 0.12 * indice, ease: 'easeOut' }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center font-mono-micro text-[10px] uppercase tracking-wider text-on-surface-variant" aria-hidden="true">
        {lista.map((fase) => (
          <span key={fase.fase} className={activa === fase.fase ? 'text-primary font-bold' : ''}>{NOMBRE_FASE[fase.fase]}</span>
        ))}
      </div>
      <p role="status" aria-live="polite" className="min-h-[2.5rem] font-body-sm text-[12px] text-on-surface">
        {mostrada
          ? mostrada.precision == null
            ? `${NOMBRE_FASE[mostrada.fase]}: todavía sin jugadas analizadas.`
            : `${NOMBRE_FASE[mostrada.fase]}: ${mostrada.precision}% de precisión en ${mostrada.jugadas} jugadas analizadas.`
          : floja
            ? `Tu fase más floja es ${CON_ARTICULO[floja.fase]} (${floja.precision}%). ${CONSEJO_FASE[floja.fase]}`
            : 'Jugá y analizá más partidas para comparar tus fases.'}
      </p>
    </div>
  );
}
