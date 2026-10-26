const ANCHO = 320;
const ALTO = 150;
const MARGEN = { izquierda: 30, derecha: 10, arriba: 12, abajo: 22 };

/** Los límites del eje vertical: de a 10 puntos, con aire arriba y abajo y nunca menos de 20 puntos de alto. */
function limitesDelEje(valores) {
  let minimo = Math.max(0, Math.floor((Math.min(...valores) - 8) / 10) * 10);
  let maximo = Math.min(100, Math.ceil((Math.max(...valores) + 8) / 10) * 10);
  if (maximo - minimo < 20) {
    minimo = Math.max(0, maximo - 20);
    maximo = minimo + 20;
  }
  return [minimo, maximo];
}

/**
 * La precisión del alumno partida a partida. Las primeras `diagnostico` partidas (su punto de partida) van con círculos huecos sobre
 * una franja, el resto con círculos llenos: el «antes» y el «después» se ven de un vistazo. Es un SVG sin librerías; la tabla oculta
 * (`sr-only`) deja los mismos números para quien usa un lector de pantalla.
 */
export default function GraficoEvolucion({ serie, diagnostico = 3 }) {
  if (!serie || serie.length === 0) {
    return <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay partidas medidas para dibujar la evolución.</p>;
  }
  const [minimo, maximo] = limitesDelEje(serie.map((p) => p.precision));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (indice) => MARGEN.izquierda + (serie.length === 1 ? anchoUtil / 2 : (indice / (serie.length - 1)) * anchoUtil);
  const y = (valor) => MARGEN.arriba + (1 - (valor - minimo) / (maximo - minimo)) * altoUtil;
  const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.precision).toFixed(1)}`).join(' ');
  const enDiagnostico = serie.filter((p) => p.numero <= diagnostico).length;
  const guias = [minimo, (minimo + maximo) / 2, maximo];

  return (
    <figure className="m-0 flex flex-col gap-space-2xs">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto max-h-56" role="img" aria-label={`Evolución de la precisión en ${serie.length} partidas, de ${serie[0].precision} % a ${serie[serie.length - 1].precision} %`}>
        {enDiagnostico > 0 && serie.length > 1 && (
          <rect
            x={MARGEN.izquierda - 6}
            y={MARGEN.arriba}
            width={Math.max(x(enDiagnostico - 1) - MARGEN.izquierda + 12, 12)}
            height={altoUtil}
            rx="4"
            className="fill-outline-variant/25"
          />
        )}
        {guias.map((valor) => (
          <g key={valor}>
            <line x1={MARGEN.izquierda - 6} x2={ANCHO - MARGEN.derecha} y1={y(valor)} y2={y(valor)} className="stroke-outline-variant/40" strokeWidth="0.6" strokeDasharray="2 3" />
            <text x={MARGEN.izquierda - 10} y={y(valor) + 3} textAnchor="end" className="fill-on-surface-variant" fontSize="8">{valor}</text>
          </g>
        ))}
        {serie.length > 1 && <polyline points={puntos} fill="none" className="stroke-primary" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />}
        {serie.map((p, i) => (
          <circle
            key={p.numero}
            cx={x(i)}
            cy={y(p.precision)}
            r="3.4"
            strokeWidth="1.6"
            className={p.numero <= diagnostico ? 'stroke-primary fill-surface-container-low' : 'stroke-primary fill-primary'}
          />
        ))}
        <text x={MARGEN.izquierda - 6} y={ALTO - 6} className="fill-on-surface-variant" fontSize="8">Partida 1</text>
        <text x={ANCHO - MARGEN.derecha} y={ALTO - 6} textAnchor="end" className="fill-on-surface-variant" fontSize="8">Partida {serie[serie.length - 1].numero}</text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-space-sm gap-y-1 font-mono-micro text-mono-micro text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full border-2 border-primary bg-surface-container-low" /> Diagnóstico (las {diagnostico} primeras)
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full border-2 border-primary bg-primary" /> Después
        </span>
        <span>Eje: % de precisión</span>
      </figcaption>
      <table className="sr-only">
        <caption>Precisión por partida medida</caption>
        <thead>
          <tr><th scope="col">Partida</th><th scope="col">Precisión (%)</th><th scope="col">Nivel</th></tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.numero}><td>{p.numero}</td><td>{p.precision}</td><td>{p.nivel}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
