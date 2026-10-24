import { useEffect, useId, useState } from 'react';
import './MedallaFigurita.css';
import { SILUETAS_PIEZA } from './figuritaPiezas';
import {
  describirMedalla,
  normalizarNivel,
  normalizarPieza,
  progresoDeMedalla,
  rangoDeNivel,
} from '../medallas';

/** Escudo exterior (marco) y campo interior de la figurita, en una caja de 100 x 100. */
const FORMA_ESCUDO = 'M50 3L90 15V55C90 78 72 92 50 98C28 92 10 78 10 55V15Z';
const FORMA_CAMPO = 'M50 10L83.5 20V54C83.5 74 68 86 50 91.5C32 86 16.5 74 16.5 54V20Z';

const TAMANOS = ['xs', 'sm', 'md', 'lg'];

/** Cuánto se agranda la silueta de la pieza (caja de 48 x 48) para llenar el campo del escudo. */
const ESCALA_PIEZA = 1.2;
/** Lado (en la caja de 100) de la ilustración subida: entra en el campo del escudo sin tocar el candado ni las estrellas. */
const LADO_ILUSTRACION = 62;

/** Destello de cuatro puntas (las chispas de las legendarias). */
const FORMA_CHISPA = 'M0 -3.4L0.95 -0.95L3.4 0L0.95 0.95L0 3.4L-0.95 0.95L-3.4 0L-0.95 -0.95Z';
const CHISPAS = [
  [22, 30],
  [77, 36],
  [30, 74],
];

/** Estrella de cinco puntas centrada en (cx, cy): las estrellitas de nivel de la figurita. */
function puntosEstrella(cx, cy, radio) {
  const puntos = [];
  for (let i = 0; i < 10; i += 1) {
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radio : radio * 0.45;
    puntos.push(`${(cx + r * Math.cos(angulo)).toFixed(2)},${(cy + r * Math.sin(angulo)).toFixed(2)}`);
  }
  return puntos.join(' ');
}

/** Número chico y estable por medalla: desfasa las animaciones para que las figuritas del álbum no destellen todas a la vez. */
function faseDe(codigo) {
  let suma = 0;
  for (const caracter of String(codigo ?? '')) suma += caracter.charCodeAt(0);
  return suma % 7;
}

function Forma({ forma }) {
  switch (forma.t) {
    case 'c':
      return <circle cx={forma.cx} cy={forma.cy} r={forma.r} />;
    case 'r':
      return <rect x={forma.x} y={forma.y} width={forma.w} height={forma.h} rx={forma.r} />;
    case 's':
      return <path className="fig-forma-s" d={forma.d} />;
    case 'o':
      return <circle className="fig-forma-o" cx={forma.cx} cy={forma.cy} r={forma.r} />;
    default:
      return <path d={forma.d} />;
  }
}

/** Candado de las figuritas bloqueadas, centrado abajo del campo. */
function Candado() {
  return (
    <g transform="translate(50 80)">
      <circle className="fig-candado-fondo" r="10" />
      <path className="fig-candado-arco" d="M-3.2 -1.2V-3.6A3.2 3.2 0 0 1 3.2 -3.6V-1.2" />
      <rect className="fig-candado-cuerpo" x="-4.8" y="-1.4" width="9.6" height="7.4" rx="1.6" />
      <circle className="fig-candado-ojo" cy="2.3" r="1.15" />
    </g>
  );
}

/**
 * Escudo con marco y campo degradados según el nivel (igual para todas las medallas) y, en el centro, la silueta de la
 * pieza o, si hay `imagenUrl`, la ilustración que subió el facilitador (cuadrada, recortada al campo del escudo).
 */
function ArteEscudo({ uid, nivel, pieza, bloqueada, tamano, imagenUrl = null }) {
  const detallado = tamano === 'md' || tamano === 'lg';
  const conBrillos = !bloqueada && tamano !== 'xs';
  const conCandado = bloqueada && tamano !== 'xs';
  const esLegendaria = nivel === 'legendaria';
  const cantidadEstrellas = rangoDeNivel(nivel);
  const estrellas = Array.from({ length: cantidadEstrellas }, (_, i) => 50 + (i - (cantidadEstrellas - 1) / 2) * 9.6);
  // La pieza (caja de 48 x 48 escalada) queda centrada en el campo; baja si arriba van las estrellitas y sube si abajo va el candado.
  const desplazamientoX = 50 - 24 * ESCALA_PIEZA;
  let desplazamientoY = 23.1;
  if (conCandado) desplazamientoY = 14.8;
  else if (!bloqueada && detallado) desplazamientoY = 26.8;
  const id = (nombre) => `${uid}-${nombre}`;
  const ref = (nombre) => `url(#${id(nombre)})`;

  return (
    <svg className="figurita__svg" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={id('aro')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="fig-parada-rim-1" />
          <stop offset="0.5" className="fig-parada-rim-2" />
          <stop offset="1" className="fig-parada-rim-3" />
        </linearGradient>
        <linearGradient id={id('campo')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="fig-parada-campo-1" />
          <stop offset="1" className="fig-parada-campo-2" />
        </linearGradient>
        <linearGradient id={id('pieza')} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="44">
          <stop offset="0" className="fig-parada-pieza-1" />
          <stop offset="1" className="fig-parada-pieza-2" />
        </linearGradient>
        <radialGradient id={id('luz')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('gloss')} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="60">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('barrido')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('holo')} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" className="fig-parada-holo-1" />
          <stop offset="0.3" className="fig-parada-holo-2" />
          <stop offset="0.55" className="fig-parada-holo-3" />
          <stop offset="0.8" className="fig-parada-holo-4" />
          <stop offset="1" className="fig-parada-holo-1" />
        </linearGradient>
        <clipPath id={id('recorte-escudo')}>
          <path d={FORMA_ESCUDO} />
        </clipPath>
        <clipPath id={id('recorte-campo')}>
          <path d={FORMA_CAMPO} />
        </clipPath>
      </defs>

      <path d={FORMA_ESCUDO} fill={ref('aro')} />
      <path d={FORMA_CAMPO} fill={ref('campo')} />
      <path className="fig-borde-campo" d={FORMA_CAMPO} />
      {!bloqueada && <circle cx="50" cy="54" r="31" fill={ref('luz')} />}

      {esLegendaria && conBrillos && (
        <g clipPath={ref('recorte-campo')}>
          <rect className="figurita__holo" x="0" y="8" width="190" height="86" fill={ref('holo')} />
        </g>
      )}

      {!bloqueada && detallado && (
        <g>
          {estrellas.map((x) => (
            <polygon key={x} className="fig-estrella" points={puntosEstrella(x, 21.5, 3.6)} />
          ))}
        </g>
      )}

      {imagenUrl ? (
        <g clipPath={ref('recorte-campo')}>
          <image
            className="fig-ilustracion"
            href={imagenUrl}
            x={50 - LADO_ILUSTRACION / 2}
            y={conCandado ? 14 : !bloqueada && detallado ? 22 : 21}
            width={LADO_ILUSTRACION}
            height={LADO_ILUSTRACION}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      ) : (
        <g
          className="fig-pieza"
          fill={ref('pieza')}
          transform={`translate(${desplazamientoX} ${desplazamientoY}) scale(${ESCALA_PIEZA})`}
        >
          {SILUETAS_PIEZA[pieza].map((forma, indice) => (
            <Forma key={indice} forma={forma} />
          ))}
        </g>
      )}

      {conBrillos && <path d={FORMA_CAMPO} fill={ref('gloss')} />}
      <path className="fig-resalte-campo" d={FORMA_CAMPO} />
      <path className="fig-contorno" d={FORMA_ESCUDO} />

      {conBrillos && (
        <g clipPath={ref('recorte-escudo')}>
          <rect className="figurita__barrido" x="0" y="-10" width="26" height="130" fill={ref('barrido')} />
        </g>
      )}

      {esLegendaria && conBrillos && detallado && (
        <g>
          {CHISPAS.map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path className="figurita__chispa" d={FORMA_CHISPA} />
            </g>
          ))}
        </g>
      )}

      {conCandado && <Candado />}
    </svg>
  );
}

/**
 * Una figurita coleccionable a partir de una medalla del contrato (`GET /usuario/medallas`). Sirve para cualquier
 * medalla que mande el backend: el escudo (forma, color y brillo según el `nivel`) es el mismo para todas, dibujado en
 * SVG en línea; en el centro va la silueta de su `pieza` o, si trae `imagen_url`, la ilustración que subió el facilitador
 * (si no carga, vuelve a la silueta). Ganada: a todo color y con un brillo sutil. Bloqueada: gris, con candado y, si
 * se mide con un contador (`meta` > 1), una barra fina con el avance.
 *
 * Props:
 *  - `medalla`: objeto del contrato (`codigo, nombre, nivel, pieza, meta, progreso, ganada, imagen_url`).
 *  - `tamano`: `xs` (~28 px, ranking), `sm` (~56), `md` (~96) o `lg` (~200).
 *  - `decorativa`: la oculta a los lectores de pantalla (cuando el texto de al lado ya dice lo mismo).
 *  - `vistaPrevia`: la dibuja como ganada sin hablar de su estado (para el facilitador que carga imágenes).
 *  - `titulo`: texto de ayuda al pasar el mouse.
 *  - `mostrarProgreso`: `false` esconde la barra de avance de las bloqueadas.
 *
 * El estado no depende solo del color: las bloqueadas llevan candado y, para los lectores de pantalla, un texto como
 * "Medalla Torre Incansable, nivel plata, bloqueada, 3 de 5".
 */
export default function MedallaFigurita({
  medalla,
  tamano = 'md',
  decorativa = false,
  vistaPrevia = false,
  titulo = null,
  mostrarProgreso = true,
  className = '',
}) {
  // `useId` puede traer ":" o "«»": se limpian para usar el id dentro de `url(#...)`.
  const uid = `fig${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [urlRota, setUrlRota] = useState(null);
  const urlImagen = typeof medalla?.imagen_url === 'string' && medalla.imagen_url !== '' ? medalla.imagen_url : null;

  // Una imagen que no carga (archivo borrado, red) no deja la figurita vacía: vuelve a la silueta de la pieza.
  useEffect(() => {
    if (!urlImagen) return undefined;
    let activa = true;
    const prueba = new Image();
    prueba.onerror = () => {
      if (activa) setUrlRota(urlImagen);
    };
    prueba.src = urlImagen;
    return () => {
      activa = false;
    };
  }, [urlImagen]);

  const nivel = normalizarNivel(medalla?.nivel);
  const pieza = normalizarPieza(medalla?.pieza);
  const tam = TAMANOS.includes(tamano) ? tamano : 'md';
  const ganada = vistaPrevia || medalla?.ganada === true;
  const bloqueada = !ganada;
  const imagenUrl = urlImagen !== null && urlRota !== urlImagen ? urlImagen : null;
  const etiqueta = describirMedalla(medalla, { vistaPrevia });
  const { actual, meta, proporcion } = progresoDeMedalla(medalla);
  const mostrarBarra = bloqueada && mostrarProgreso && tam !== 'xs' && meta > 1;
  const conTexto = tam === 'md' || tam === 'lg';

  const accesibilidad = decorativa ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': etiqueta };

  const clases = [
    'figurita',
    `figurita--${tam}`,
    ganada ? 'figurita--ganada' : 'figurita--bloqueada',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={clases}
      data-nivel-medalla={nivel}
      title={titulo ?? undefined}
      style={{ '--fig-fase': faseDe(medalla?.codigo) }}
      {...accesibilidad}
    >
      <span className="figurita__arte">
        <ArteEscudo uid={uid} nivel={nivel} pieza={pieza} bloqueada={bloqueada} tamano={tam} imagenUrl={imagenUrl} />
      </span>

      {mostrarBarra && (
        <span className="figurita__progreso" aria-hidden="true">
          <span className="figurita__pista">
            <span className="figurita__relleno" style={{ width: `${Math.round(proporcion * 100)}%` }} />
          </span>
          {conTexto && (
            <span className="figurita__progreso-texto">
              {actual}/{meta}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
