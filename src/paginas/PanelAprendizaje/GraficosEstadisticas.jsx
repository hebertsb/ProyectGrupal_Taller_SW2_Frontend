import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** "2026-10-12" → "12/10". Sin pasar por `Date`, para que la zona horaria no corra el día. */
export function diaMes(iso) {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** Último día (domingo) de la semana que empieza el lunes `iso`, como "18/10". */
function finDeSemana(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const domingo = new Date(Date.UTC(anio, mes - 1, dia + 6));
  return `${String(domingo.getUTCDate()).padStart(2, '0')}/${String(domingo.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Tarjeta con efecto vidrio (glassmorphism): fondo translúcido con desenfoque, borde fino y un
 * resplandor de color detrás. Es solo estilo, no sabe nada de los datos.
 */
export function TarjetaVidrio({ className = '', resplandor = 'bg-primary/20', children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
    >
      <span aria-hidden="true" className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl ${resplandor}`} />
      <div className="relative">{children}</div>
    </div>
  );
}

const VISTA = { ancho: 480, alto: 240, izq: 30, der: 12, arriba: 20, abajo: 12 };

/** Tramos continuos de semanas con precisión: un hueco (semana sin jugadas analizadas) corta la línea. */
function tramosConPrecision(puntos) {
  const tramos = [];
  let actual = [];
  puntos.forEach((p) => {
    if (p.precision == null) {
      if (actual.length) tramos.push(actual);
      actual = [];
    } else {
      actual.push(p);
    }
  });
  if (actual.length) tramos.push(actual);
  return tramos;
}

/**
 * Progreso por semana: línea con área de precisión y barras de partidas jugadas. Pasar el mouse,
 * enfocar con el teclado o tocar una semana la resalta y muestra su detalle debajo (tocar la
 * deja fija). Se anima al aparecer, salvo que el sistema pida reducir el movimiento.
 */
export function GraficoSemanal({ semanas: todasLasSemanas }) {
  const reducir = useReducedMotion();
  const idGradiente = useId().replace(/:/g, '');
  const [pasando, setPasando] = useState(null);
  const [fija, setFija] = useState(null);
  // Por defecto las últimas 4 semanas: con 8 casi siempre hay varias en blanco y el gráfico se ve vacío.
  const [rango, setRango] = useState(4);

  const semanas = todasLasSemanas.slice(-rango);
  const n = semanas.length;
  if (n === 0) return null;

  const cambiarRango = (nuevo) => {
    setRango(nuevo);
    setPasando(null);
    setFija(null);
  };

  const { ancho, alto, izq, der, arriba, abajo } = VISTA;
  const anchoUtil = ancho - izq - der;
  const altoUtil = alto - arriba - abajo;
  const base = arriba + altoUtil;
  const anchoColumna = anchoUtil / n;
  const xCentro = (i) => izq + anchoColumna * (i + 0.5);
  const yDe = (precision) => base - (precision / 100) * altoUtil;
  const maxPartidas = Math.max(1, ...semanas.map((s) => s.partidas));
  const altoBarra = (s) => (s.partidas / maxPartidas) * altoUtil * 0.3;

  const puntos = semanas.map((s, i) => ({ ...s, i, x: xCentro(i), y: s.precision == null ? null : yDe(s.precision) }));
  const tramos = tramosConPrecision(puntos);
  const lineaDe = (tramo) => tramo.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaDe = (tramo) =>
    `${lineaDe(tramo)} L ${tramo[tramo.length - 1].x.toFixed(1)} ${base} L ${tramo[0].x.toFixed(1)} ${base} Z`;

  const ultimaConPartidas = [...semanas.keys()].reverse().find((i) => semanas[i].partidas > 0);
  const activa = pasando ?? fija ?? ultimaConPartidas ?? n - 1;
  const detalle = semanas[activa];

  const alternarFija = (i) => setFija((actual) => (actual === i ? null : i));
  const transicion = (retraso = 0) => (reducir ? { duration: 0 } : { duration: 0.9, delay: retraso, ease: 'easeOut' });

  return (
    <figure className="flex flex-col gap-2 m-0">
      <div className="flex justify-end gap-1" role="group" aria-label="Período del gráfico">
        {[4, 8].map((semanasDelRango) => (
          <button
            key={semanasDelRango}
            type="button"
            aria-pressed={rango === semanasDelRango}
            onClick={() => cambiarRango(semanasDelRango)}
            className={`px-2.5 py-1 rounded-full border font-mono-micro text-[10px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              rango === semanasDelRango
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-white/[0.04] border-white/10 text-on-surface-variant hover:bg-white/[0.09]'
            }`}
          >
            {semanasDelRango} semanas
          </button>
        ))}
      </div>
      <div className="relative">
        {[0, 50, 100].map((nivel) => (
          <span
            key={nivel}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 font-mono-micro text-[10px] text-on-surface-variant"
            style={{ top: `${(yDe(nivel) / alto) * 100}%` }}
          >
            {nivel}
          </span>
        ))}

        <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-auto max-h-[300px] overflow-visible" role="group" aria-label="Progreso semanal">
          <defs>
            <linearGradient id={`barra-${idGradiente}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-secondary)" />
              <stop offset="100%" stopColor="var(--color-primary)" />
            </linearGradient>
            <linearGradient id={`area-${idGradiente}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.38" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="text-primary">
            {[0, 50, 100].map((nivel) => (
              <line key={nivel} x1={izq} x2={ancho - der} y1={yDe(nivel)} y2={yDe(nivel)} className="stroke-white/10" strokeDasharray="3 5" />
            ))}

            {/* Franja de la semana activa */}
            <rect
              x={izq + anchoColumna * activa + 3}
              y={arriba - 6}
              width={anchoColumna - 6}
              height={altoUtil + 6}
              rx={10}
              className="fill-white/[0.07] stroke-white/15"
              style={{ transition: reducir ? 'none' : 'x 200ms ease' }}
            />

            {semanas.map((s, i) => (
              <motion.rect
                key={`barra-${s.semana_inicio}`}
                x={xCentro(i) - 9}
                width={18}
                rx={4}
                fill={`url(#barra-${idGradiente})`}
                opacity={i === activa ? 0.95 : 0.4}
                initial={reducir ? false : { height: 0, y: base }}
                animate={{ height: altoBarra(s), y: base - altoBarra(s) }}
                transition={transicion(0.05 * i)}
              />
            ))}

            {tramos.map((tramo) => (
              <motion.path
                key={`area-${tramo[0].semana_inicio}`}
                d={areaDe(tramo)}
                fill={`url(#area-${idGradiente})`}
                initial={reducir ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transicion(0.5)}
              />
            ))}
            {tramos.map((tramo) => (
              <motion.path
                key={`linea-${tramo[0].semana_inicio}`}
                d={lineaDe(tramo)}
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                initial={reducir ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={transicion(0.2)}
              />
            ))}

            {puntos.map((p) =>
              p.precision == null ? null : (
                <circle
                  key={`punto-${p.semana_inicio}`}
                  cx={p.x}
                  cy={p.y}
                  r={p.i === activa ? 8 : 5}
                  className="fill-primary stroke-surface"
                  strokeWidth="2"
                  style={{ transition: reducir ? 'none' : 'r 160ms ease' }}
                />
              )
            )}

            {/* Zonas que reaccionan: una por semana, alcanzables con mouse, toque y teclado */}
            {semanas.map((s, i) => (
              <rect
                key={`zona-${s.semana_inicio}`}
                x={izq + anchoColumna * i}
                y={0}
                width={anchoColumna}
                height={alto}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-pressed={fija === i}
                aria-label={`Semana del ${diaMes(s.semana_inicio)} al ${finDeSemana(s.semana_inicio)}: ${s.partidas} partidas, ${
                  s.precision == null ? 'sin precisión medida' : `${s.precision}% de precisión`
                }`}
                className="cursor-pointer outline-none focus-visible:stroke-primary"
                strokeWidth="2"
                onPointerEnter={() => setPasando(i)}
                onPointerLeave={() => setPasando(null)}
                onFocus={() => setPasando(i)}
                onBlur={() => setPasando(null)}
                onClick={() => alternarFija(i)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    alternarFija(i);
                  }
                }}
              />
            ))}
          </g>
        </svg>

        <div
          className="grid font-mono-micro text-[9px] text-on-surface-variant text-center"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            paddingLeft: `${(izq / ancho) * 100}%`,
            paddingRight: `${(der / ancho) * 100}%`,
          }}
          aria-hidden="true"
        >
          {semanas.map((s, i) => (
            <span key={s.semana_inicio} className={i === activa ? 'text-primary font-bold' : ''}>
              {diaMes(s.semana_inicio)}
            </span>
          ))}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-md font-body-sm text-[12px] text-on-surface"
      >
        <strong className="font-mono-micro text-[11px] uppercase tracking-wider text-primary">
          Semana del {diaMes(detalle.semana_inicio)} al {finDeSemana(detalle.semana_inicio)}
        </strong>
        {detalle.partidas === 0 ? (
          <span className="text-on-surface-variant">Sin partidas esa semana</span>
        ) : (
          <>
            <span>{detalle.partidas} {detalle.partidas === 1 ? 'partida' : 'partidas'}</span>
            <span>{detalle.victorias} {detalle.victorias === 1 ? 'victoria' : 'victorias'}</span>
            <span>{detalle.precision == null ? 'Precisión: sin jugadas analizadas' : `Precisión: ${detalle.precision}%`}</span>
          </>
        )}
      </div>

      <figcaption className="font-mono-micro text-[10px] text-on-surface-variant">
        Línea: precisión de la semana (0 a 100). Barras: partidas jugadas. Pasá el mouse o tocá una semana para ver el detalle.
      </figcaption>
    </figure>
  );
}
