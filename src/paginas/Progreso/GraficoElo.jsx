const ANCHO = 320;
const ALTO = 150;
const MARGEN = { izquierda: 36, derecha: 10, arriba: 12, abajo: 22 };

/** Los límites del eje vertical: de a 50 puntos de Elo, con aire arriba y abajo y nunca menos de 100 de alto. */
function limitesDelEje(valores) {
  let minimo = Math.floor((Math.min(...valores) - 20) / 50) * 50;
  let maximo = Math.ceil((Math.max(...valores) + 20) / 50) * 50;
  if (maximo - minimo < 100) maximo = minimo + 100;
  return [Math.max(0, minimo), maximo];
}

const RESULTADOS = { ganó: 'ganó', empató: 'empató', perdió: 'perdió' };

/**
 * El Elo del alumno partida a partida (`serie`: `{ numero, fecha, elo, resultado }`, la primera es el punto de partida con `resultado: null`). Cada círculo muestra cómo
 * terminó la partida: lleno = ganó, hueco = perdió, gris = empató. Es un SVG sin librerías; la tabla oculta (`sr-only`) deja los mismos números para un lector de pantalla.
 */
export default function GraficoElo({ serie }) {
  if (!serie || serie.length < 2) return null;
  const [minimo, maximo] = limitesDelEje(serie.map((p) => p.elo));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (indice) => MARGEN.izquierda + (indice / (serie.length - 1)) * anchoUtil;
  const y = (valor) => MARGEN.arriba + (1 - (valor - minimo) / (maximo - minimo)) * altoUtil;
  const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`).join(' ');
  const guias = [minimo, (minimo + maximo) / 2, maximo];
  const ultimo = serie[serie.length - 1];

  return (
    <figure className="m-0 flex flex-col gap-space-2xs">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto max-h-56" role="img" aria-label={`Evolución del Elo en ${serie.length - 1} partidas, de ${serie[0].elo} a ${ultimo.elo}`}>
        {guias.map((valor) => (
          <g key={valor}>
            <line x1={MARGEN.izquierda - 6} x2={ANCHO - MARGEN.derecha} y1={y(valor)} y2={y(valor)} className="stroke-outline-variant/40" strokeWidth="0.6" strokeDasharray="2 3" />
            <text x={MARGEN.izquierda - 10} y={y(valor) + 3} textAnchor="end" className="fill-on-surface-variant" fontSize="8">{valor}</text>
          </g>
        ))}
        <polyline points={puntos} fill="none" className="stroke-primary" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((p, i) => (
          <circle
            key={p.numero}
            cx={x(i)}
            cy={y(p.elo)}
            r="3.4"
            strokeWidth="1.6"
            className={
              p.resultado === RESULTADOS.perdió
                ? 'stroke-primary fill-surface-container-low'
                : p.resultado === RESULTADOS.empató
                  ? 'stroke-outline fill-outline'
                  : 'stroke-primary fill-primary'
            }
          />
        ))}
        <text x={MARGEN.izquierda - 6} y={ALTO - 6} className="fill-on-surface-variant" fontSize="8">Inicio</text>
        <text x={ANCHO - MARGEN.derecha} y={ALTO - 6} textAnchor="end" className="fill-on-surface-variant" fontSize="8">Partida {ultimo.numero}</text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-space-sm gap-y-1 font-mono-micro text-mono-micro text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full border-2 border-primary bg-primary" /> Ganó
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full border-2 border-outline bg-outline" /> Empató
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full border-2 border-primary bg-surface-container-low" /> Perdió
        </span>
        <span>Eje: Elo</span>
      </figcaption>
      <table className="sr-only">
        <caption>Elo después de cada partida con compañeros</caption>
        <thead>
          <tr><th scope="col">Partida</th><th scope="col">Resultado</th><th scope="col">Elo</th></tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.numero}><td>{p.numero === 0 ? 'Inicio' : p.numero}</td><td>{p.resultado ?? '—'}</td><td>{p.elo}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
