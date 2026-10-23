/**
 * Siluetas de las 6 piezas de ajedrez que se dibujan en el centro de cada figurita (ver MedallaFigurita.jsx).
 * Datos puros, sin JSX: cada pieza es una lista de formas en una caja de 48 x 48, todas apoyadas en la misma base
 * (y = 43.5) y con el mismo estilo (relleno degradado + contorno), para que se vean parte de un mismo set.
 *
 * Tipos de forma:
 *  - `p`: camino relleno (`d`)
 *  - `r`: rectángulo relleno con esquinas redondeadas (`x`, `y`, `w`, `h`, `r`)
 *  - `c`: círculo relleno (`cx`, `cy`, `r`)
 *  - `s`: línea de detalle, solo trazo, con el color de corte (`d`)
 *  - `o`: punto de detalle (el ojo del caballo), relleno con el color de corte (`cx`, `cy`, `r`)
 */

/** Base compartida por las seis piezas. */
const BASE = { t: 'r', x: 10, y: 38.5, w: 28, h: 5, r: 2 };

/** Claves = los valores de `pieza` que manda el backend. */
export const SILUETAS_PIEZA = {
  peon: [
    { t: 'c', cx: 24, cy: 14, r: 6.2 },
    { t: 'r', x: 17, y: 20.8, w: 14, h: 3.6, r: 1.8 },
    { t: 'p', d: 'M20 24C20 29 17.5 33 14 38.5H34C30.5 33 28 29 28 24Z' },
    BASE,
  ],
  torre: [
    { t: 'p', d: 'M13 7h5v4h3V7h6v4h3V7h5v10H13Z' },
    { t: 'p', d: 'M16 17h16l1.5 17h-19Z' },
    { t: 'r', x: 12, y: 33.5, w: 24, h: 5, r: 1.2 },
    BASE,
  ],
  alfil: [
    { t: 'c', cx: 24, cy: 6.8, r: 2.6 },
    { t: 'p', d: 'M24 9.4C31.5 14 33 20 30.5 25C29.6 26.8 28.6 27.6 28 29H20C19.4 27.6 18.4 26.8 17.5 25C15 20 16.5 14 24 9.4Z' },
    { t: 'r', x: 16.5, y: 28.5, w: 15, h: 3.4, r: 1.7 },
    { t: 'p', d: 'M20.2 31.5C20.2 34.5 18.5 36.5 15.5 38.5H32.5C29.5 36.5 27.8 34.5 27.8 31.5Z' },
    BASE,
    { t: 's', d: 'M26.6 13.4L21.2 19.8' },
  ],
  caballo: [
    {
      t: 'p',
      d: 'M9 25C10 21 12 17.5 15 14.5L16.5 11.5L18.5 7L21.5 10.5C30 11 37 20 35.5 31L34.5 38.5H14C14.5 33 18 30.5 20 26.5C17.5 26.5 15.5 28 13 28.5C10.5 29 8 27.5 9 25Z',
    },
    BASE,
    { t: 's', d: 'M24 13.5C30 16 33.5 21.5 32.8 27.5' },
    { t: 'o', cx: 16.4, cy: 17.4, r: 1.3 },
  ],
  dama: [
    { t: 'p', d: 'M14 34L10.5 14L14.5 23.5L17.5 10L20.6 21L24 8.5L27.4 21L30.5 10L33.5 23.5L37.5 14L34 34Z' },
    { t: 'c', cx: 10.5, cy: 12.6, r: 2.3 },
    { t: 'c', cx: 17.5, cy: 8.6, r: 2.3 },
    { t: 'c', cx: 24, cy: 7, r: 2.3 },
    { t: 'c', cx: 30.5, cy: 8.6, r: 2.3 },
    { t: 'c', cx: 37.5, cy: 12.6, r: 2.3 },
    { t: 'r', x: 12.5, y: 33.5, w: 23, h: 5, r: 1.4 },
    BASE,
  ],
  rey: [
    { t: 'r', x: 22.5, y: 2.5, w: 3, h: 11, r: 0.8 },
    { t: 'r', x: 19, y: 5.8, w: 10, h: 3, r: 0.8 },
    { t: 'p', d: 'M24 13.5C31.5 13.5 36.5 18.5 35 25.5C34.2 29 32.5 31.5 32 34H16C15.5 31.5 13.8 29 13 25.5C11.5 18.5 16.5 13.5 24 13.5Z' },
    { t: 'r', x: 12, y: 33.5, w: 24, h: 5, r: 1.4 },
    BASE,
  ],
};

/** Orden en que se listan las piezas (también sirve para validar el valor que manda el backend). */
export const CLAVES_PIEZA = Object.keys(SILUETAS_PIEZA);
