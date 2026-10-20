import { useEffect, useRef, useState } from 'react';
import { clicAPixelesImagen, ESQUINAS_ORDEN, indiceDePuntoCercano } from './esquinas';

const RADIO_AGARRE_PX = 28; // en píxeles de pantalla: qué tan cerca hay que tocar un punto para arrastrarlo
const ZOOM_LUPA = 3;
const LADO_LUPA_PX = 128;

/**
 * Foto congelada con las 4 esquinas del tablero encima. Un toque en un lugar libre agrega la siguiente esquina (a1, h1, h8, a8);
 * tocar y arrastrar una esquina ya puesta la mueve, con una lupa para afinar el punto. Con una esquina seleccionada, las flechas la
 * mueven de a 1 px (Mayús: 10 px). El SVG usa el viewBox del tamaño original con el mismo ajuste "contain" que la imagen, así los
 * puntos caen exactamente donde se tocó.
 *
 * `puntos`: array de [x, y] en píxeles de la imagen original (hasta 4); `onCambiar` recibe el array nuevo completo.
 */
export default function CapaEsquinas({ url, puntos, onCambiar, deshabilitada = false }) {
  const contenedorRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [pxPorUnidad, setPxPorUnidad] = useState(1);
  const [arrastrando, setArrastrando] = useState(-1);
  const [seleccionado, setSeleccionado] = useState(-1);

  // Escala de render (px de pantalla por px de imagen) para dimensionar marcadores y radio de agarre.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el || !natural || typeof ResizeObserver === 'undefined') return undefined;
    function medir() {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setPxPorUnidad(Math.min(r.width / natural.ancho, r.height / natural.alto));
    }
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [natural]);

  function puntoDelEvento(e) {
    const rect = contenedorRef.current.getBoundingClientRect();
    return clicAPixelesImagen(rect, natural, e.clientX, e.clientY);
  }

  function alPulsar(e) {
    if (!natural || deshabilitada) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const punto = puntoDelEvento(e);
    if (!punto) return;
    let indice = indiceDePuntoCercano(puntos, punto, RADIO_AGARRE_PX / pxPorUnidad);
    if (indice === -1) {
      if (puntos.length >= ESQUINAS_ORDEN.length) return;
      onCambiar([...puntos, punto]);
      indice = puntos.length;
    }
    setSeleccionado(indice);
    setArrastrando(indice);
    contenedorRef.current.setPointerCapture?.(e.pointerId);
  }

  function alMover(e) {
    if (arrastrando === -1 || !natural) return;
    const punto = puntoDelEvento(e);
    if (!punto) return;
    onCambiar(puntos.map((p, i) => (i === arrastrando ? punto : p)));
  }

  function alSoltar(e) {
    if (arrastrando === -1) return;
    contenedorRef.current?.releasePointerCapture?.(e.pointerId);
    setArrastrando(-1);
  }

  function alTeclear(e) {
    const paso = e.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (!delta || seleccionado === -1 || !puntos[seleccionado] || !natural) return;
    e.preventDefault();
    const [x, y] = puntos[seleccionado];
    const nuevo = [
      Math.min(natural.ancho, Math.max(0, x + delta[0])),
      Math.min(natural.alto, Math.max(0, y + delta[1])),
    ];
    onCambiar(puntos.map((p, i) => (i === seleccionado ? nuevo : p)));
  }

  const u = 1 / pxPorUnidad; // 1 px de pantalla expresado en unidades de la imagen
  const poligono = puntos.map((p) => p.join(',')).join(' ');
  const activo = arrastrando !== -1 ? puntos[arrastrando] : null;
  const zoom = pxPorUnidad * ZOOM_LUPA;

  return (
    <div
      ref={contenedorRef}
      className="relative w-full h-full select-none cursor-crosshair focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      style={{ touchAction: 'none' }}
      tabIndex={0}
      role="application"
      aria-label="Foto del tablero: tocá las esquinas a1, h1, h8 y a8 en ese orden. Con una esquina elegida, las flechas la mueven."
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onKeyDown={alTeclear}
    >
      <img
        src={url}
        alt="Foto congelada de la cámara para calibrar el tablero"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
        onLoad={(e) => setNatural({ ancho: e.currentTarget.naturalWidth, alto: e.currentTarget.naturalHeight })}
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
              <circle
                cx={x}
                cy={y}
                r={14 * u}
                fill="rgba(0,0,0,0.35)"
                stroke={i === seleccionado ? '#ffd400' : '#ffffff'}
                strokeWidth={(i === seleccionado ? 2.5 : 1.5) * u}
              />
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
      {activo && natural && (
        <div
          className={`absolute top-2 ${activo[0] < natural.ancho / 2 ? 'right-2' : 'left-2'} rounded-full border-2 border-white shadow-lg overflow-hidden pointer-events-none`}
          style={{
            width: LADO_LUPA_PX,
            height: LADO_LUPA_PX,
            backgroundImage: `url(${url})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${natural.ancho * zoom}px ${natural.alto * zoom}px`,
            backgroundPosition: `${LADO_LUPA_PX / 2 - activo[0] * zoom}px ${LADO_LUPA_PX / 2 - activo[1] * zoom}px`,
          }}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-0 bottom-0 w-px bg-[#ffd400]" />
          <span className="absolute top-1/2 left-0 right-0 h-px bg-[#ffd400]" />
        </div>
      )}
    </div>
  );
}
