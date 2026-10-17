import { useEffect, useRef, useState } from 'react';

/** Orden fijo de las esquinas exteriores del área de juego (8x8, sin borde de madera). */
export const ESQUINAS_ORDEN = ['a1', 'h1', 'h8', 'a8'];

export const GUIA_ESQUINAS = {
  a1: 'esquina a1 (la de la torre blanca del lado de la columna a)',
  h1: 'esquina h1 (la de la torre blanca del lado de la columna h)',
  h8: 'esquina h8 (la de la torre negra del lado de la columna h)',
  a8: 'esquina a8 (la de la torre negra del lado de la columna a)',
};

/**
 * Convierte un clic (clientX/clientY) a píxeles de la imagen original, teniendo
 * en cuenta el letterbox de object-fit: contain. Devuelve null si el clic cae
 * fuera del área real de la imagen.
 */
export function clicAPixelesImagen(rect, natural, clientX, clientY) {
  const escala = Math.min(rect.width / natural.ancho, rect.height / natural.alto);
  const anchoVisible = natural.ancho * escala;
  const altoVisible = natural.alto * escala;
  const izquierda = rect.left + (rect.width - anchoVisible) / 2;
  const arriba = rect.top + (rect.height - altoVisible) / 2;
  const x = (clientX - izquierda) / escala;
  const y = (clientY - arriba) / escala;
  if (x < 0 || y < 0 || x > natural.ancho || y > natural.alto) return null;
  return [Math.round(x), Math.round(y)];
}

/**
 * Foto congelada con los clics de calibración encima. El SVG usa el viewBox del
 * tamaño original con el mismo ajuste "contain" que la imagen, así los puntos
 * caen exactamente donde se hizo clic. `puntos` es un array de [x, y] en
 * píxeles de la imagen original; `onAgregar` recibe un nuevo [x, y].
 */
export default function CapaCalibracion({ url, puntos, onAgregar }) {
  const contenedorRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [pxPorUnidad, setPxPorUnidad] = useState(1);

  // Escala de render (px de pantalla por px de imagen) para dimensionar marcadores.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el || !natural || typeof ResizeObserver === 'undefined') return undefined;
    function medir() {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setPxPorUnidad(Math.min(r.width / natural.ancho, r.height / natural.alto));
      }
    }
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [natural]);

  function alPulsar(e) {
    if (!natural || puntos.length >= ESQUINAS_ORDEN.length) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    const punto = clicAPixelesImagen(rect, natural, e.clientX, e.clientY);
    if (punto) onAgregar(punto);
  }

  const u = 1 / pxPorUnidad; // 1 px de pantalla expresado en unidades de la imagen
  const poligono = puntos.map((p) => p.join(',')).join(' ');

  return (
    <div
      ref={contenedorRef}
      className="relative w-full h-full cursor-crosshair select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={alPulsar}
    >
      <img
        src={url}
        alt="Foto congelada de la cámara para calibrar el tablero"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
        onLoad={(e) =>
          setNatural({ ancho: e.currentTarget.naturalWidth, alto: e.currentTarget.naturalHeight })
        }
      />
      {natural && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${natural.ancho} ${natural.alto}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {puntos.length >= 2 && (
            <polyline
              points={puntos.length === 4 ? `${poligono} ${puntos[0].join(',')}` : poligono}
              fill={puntos.length === 4 ? 'rgba(0, 120, 255, 0.15)' : 'none'}
              stroke="#ffd400"
              strokeWidth={2 * u}
              strokeLinejoin="round"
            />
          )}
          {puntos.map(([x, y], i) => (
            <g key={ESQUINAS_ORDEN[i]}>
              <circle cx={x} cy={y} r={14 * u} fill="rgba(0,0,0,0.35)" stroke="#ffffff" strokeWidth={1.5 * u} />
              <circle cx={x} cy={y} r={3 * u} fill="#ffd400" />
              <text
                x={x + 12 * u}
                y={y - 12 * u}
                fontSize={14 * u}
                fontWeight="700"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={3 * u}
                paintOrder="stroke"
              >
                {i + 1} · {ESQUINAS_ORDEN[i]}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
