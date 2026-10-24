import { useMemo, useState } from 'react';
import useFlujoVivo from '../useFlujoVivo';
import { ESQUINAS_ORDEN, grillaDeEsquinas } from './esquinas';

/**
 * Vista en vivo de `camara` con la grilla de su calibración guardada dibujada encima, para acomodar el trípode ANTES de sacar la foto de
 * calibración: se mueve la cámara hasta que el tablero real encaje en el contorno amarillo y las líneas blancas caigan sobre las de las casillas.
 * `esquinas` es la calibración vigente (`{a1, h1, h8, a8}` en píxeles) y `resolucion` el `[ancho, alto]` de la foto sobre la que se marcó; sin
 * calibración previa solo se ve la cámara.
 */
export default function GuiaAlineacion({ camara, esquinas, resolucion }) {
  const { url, error, fps } = useFlujoVivo({ modo: 'camara', camara, activo: true });
  const [mostrar, setMostrar] = useState(true);
  const grilla = useMemo(() => grillaDeEsquinas(esquinas), [esquinas]);
  const [ancho, alto] = Array.isArray(resolucion) && resolucion.length === 2 ? resolucion : [1280, 720];
  const letra = Math.max(ancho, alto) / 45;

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="relative w-full aspect-[4/3] bg-surface-container rounded-lg overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt={`Vista en vivo de la cámara ${camara}`} className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant px-space-md text-center">
            {error ?? 'Conectando con la cámara…'}
          </span>
        )}
        {url && (
          <span
            className={`absolute top-2 left-2 z-10 px-2 py-1 rounded-lg font-mono-micro text-mono-micro ${fps > 0 ? 'bg-black/60 text-white' : 'bg-error text-on-error'}`}
            role="status"
          >
            {fps > 0 ? `● EN VIVO · ${fps} fps` : '○ sin señal'}
          </span>
        )}
        {url && mostrar && grilla && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
            {grilla.lineas.map(([[x1, y1], [x2, y2]], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            ))}
            <polygon
              points={grilla.contorno.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none" stroke="#facc15" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            />
            {grilla.contorno.map(([x, y], i) => (
              <g key={ESQUINAS_ORDEN[i]}>
                <circle cx={x} cy={y} r={letra * 0.28} fill="#facc15" />
                <text x={x + letra * 0.5} y={y - letra * 0.4} fontSize={letra} fontWeight="700" fill="#facc15" stroke="#000" strokeWidth={letra * 0.12} paintOrder="stroke">
                  {ESQUINAS_ORDEN[i]}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
      {grilla ? (
        <label className="inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant min-h-[44px]">
          <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
          Mostrar la grilla de la calibración guardada
        </label>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">
          Esta cámara todavía no tiene una calibración guardada, así que no hay grilla de guía: acomoda el tablero completo a la vista.
        </p>
      )}
    </div>
  );
}
