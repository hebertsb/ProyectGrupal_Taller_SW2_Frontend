import { useState } from 'react';
import { NumeroCampo } from './ComunesMedallas';

/** Mismo escudo que dibuja MedallaFigurita (caja de 100 x 100), para que el boceto se parezca a la figurita real. */
const FORMA_ESCUDO = 'M50 3L90 15V55C90 78 72 92 50 98C28 92 10 78 10 55V15Z';
const FORMA_CAMPO = 'M50 10L83.5 20V54C83.5 74 68 86 50 91.5C32 86 16.5 74 16.5 54V20Z';

/**
 * Marcador numerado del boceto: un círculo con el número y una línea hasta la parte que señala. Los colores salen de
 * los tokens del tema (`fill-*` / `stroke-*`), nada hardcodeado.
 */
function Marcador({ numero, x, y, haciaX, haciaY }) {
  return (
    <g>
      <line x1={x} y1={y} x2={haciaX} y2={haciaY} className="stroke-primary" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={x} cy={y} r="9" className="fill-primary" />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="600"
        className="fill-on-primary font-mono-label"
      >
        {numero}
      </text>
    </g>
  );
}

/** Dibujo esquemático de la medalla con los cuatro marcadores. Decorativo: la leyenda de al lado dice lo mismo en texto. */
function EsquemaMedalla() {
  return (
    <svg viewBox="0 0 200 196" focusable="false" aria-hidden="true" className="block w-full h-auto">
      {/* Escudo: lo pone el sistema según el nivel */}
      <g transform="translate(40 6) scale(1.2)">
        <path d={FORMA_ESCUDO} className="fill-surface-container-highest stroke-outline" strokeWidth="1.2" />
        <path
          d={FORMA_CAMPO}
          className="fill-surface-container-low stroke-outline-variant"
          strokeWidth="0.8"
        />
      </g>
      {/* Tres estrellitas de nivel */}
      <g className="fill-primary-fixed-dim">
        <circle cx="88" cy="32" r="3" />
        <circle cx="100" cy="32" r="3" />
        <circle cx="112" cy="32" r="3" />
      </g>
      {/* Lugar de la ilustración */}
      <circle
        cx="100"
        cy="72"
        r="26"
        className="fill-none stroke-primary"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <g transform="translate(100 72)" className="fill-none stroke-primary" strokeWidth="1.5" strokeLinejoin="round">
        <circle cx="9" cy="-10" r="3.5" />
        <path d="M-15 12L-5 -3L2 6L8 0L15 12Z" />
      </g>
      {/* Nombre */}
      <rect
        x="52"
        y="132"
        width="96"
        height="22"
        rx="6"
        className="fill-surface-container-highest stroke-outline-variant"
        strokeWidth="1"
      />
      <text
        x="100"
        y="143"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        className="fill-on-surface-variant font-mono-label"
      >
        Nombre
      </text>
      {/* Descripción: dos renglones */}
      <rect x="60" y="164" width="80" height="6" rx="3" className="fill-outline-variant" />
      <rect x="72" y="176" width="56" height="6" rx="3" className="fill-outline-variant" />

      <Marcador numero="1" x={26} y={30} haciaX={56} haciaY={36} />
      <Marcador numero="2" x={174} y={72} haciaX={127} haciaY={72} />
      <Marcador numero="3" x={26} y={143} haciaX={52} haciaY={143} />
      <Marcador numero="4" x={26} y={173} haciaX={58} haciaY={173} />
    </svg>
  );
}

/**
 * Boceto guía: qué va en cada campo del formulario. Un dibujo simple de la medalla con cuatro marcadores numerados y, al
 * lado, la leyenda con los mismos números que llevan los campos (1 Nivel, 2 Ilustración, 3 Nombre, 4 Descripción). Los
 * largos salen de lo que manda el backend. Con dos columnas se ve siempre; con una sola (celular) se pliega para no
 * empujar el formulario hacia abajo. Usa el ancho del contenedor (`@container` en CrearMedallas.jsx).
 */
export default function BocetoMedalla({ largoNombre, largoDescripcion }) {
  const [abierto, setAbierto] = useState(false);
  const partes = [
    { numero: 1, titulo: 'Nivel', texto: 'color y brillo del escudo (se aplican solos).' },
    { numero: 2, titulo: 'Ilustración', texto: 'tu dibujo, en el centro (lo único que diseñás vos).' },
    { numero: 3, titulo: 'Nombre', texto: `debajo de la figurita, hasta ${largoNombre[1]} letras.` },
    { numero: 4, titulo: 'Descripción', texto: `cómo se gana, hasta ${largoDescripcion[1]} letras.` },
  ];

  return (
    <section
      aria-labelledby="titulo-boceto-medalla"
      className="flex flex-col gap-space-sm p-space-sm @4xl:p-space-md rounded-xl bg-surface-container border border-outline-variant/30 min-w-0"
    >
      {/* Con una columna: botón para plegar / desplegar. Con dos columnas: solo el título. */}
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-expanded={abierto}
        aria-controls="contenido-boceto-medalla"
        className="@4xl:hidden flex items-center justify-between gap-space-xs min-h-11 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
            draw
          </span>
          <span className="font-mono-label text-mono-label uppercase tracking-wider text-on-surface-variant">
            ¿Qué va en cada campo?
          </span>
        </span>
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">
          {abierto ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      <div className="hidden @4xl:flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
          draw
        </span>
        <h3
          id="titulo-boceto-medalla"
          className="m-0 font-mono-label text-mono-label uppercase tracking-wider text-on-surface-variant"
        >
          ¿Qué va en cada campo?
        </h3>
      </div>

      <div
        id="contenido-boceto-medalla"
        className={`${abierto ? 'flex' : 'hidden'} @4xl:flex flex-col @xl:flex-row @4xl:flex-col items-center @xl:items-start @4xl:items-center gap-space-md`}
      >
        <div className="w-full max-w-48 shrink-0">
          <EsquemaMedalla />
        </div>
        <ol className="m-0 p-0 list-none flex flex-col gap-space-xs min-w-0 w-full">
          {partes.map((parte) => (
            <li key={parte.numero} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface">
              <NumeroCampo numero={parte.numero} />
              <span className="min-w-0 break-words">
                <strong className="font-medium">{parte.titulo}</strong>
                <span className="text-on-surface-variant"> → {parte.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
