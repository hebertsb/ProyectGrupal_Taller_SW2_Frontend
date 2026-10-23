// Cinemática directa del Dobot CR5 para dibujar el esqueleto del brazo. Medidas del URDF del proyecto (metros): origen de cada
// articulación respecto de la anterior y su eje. Los ángulos son los del controlador (J1 a J6, en grados).
//
// OJO: el dibujo es una aproximación. Los ángulos que se guardan y se ejecutan en las rutinas son exactos (van directo al controlador), pero
// si el esqueleto no se ve igual que el brazo real en una pose, ajustá acá `signo` (1 o -1) y `desfase` (grados) de esa articulación.
const JUNTAS = [
  { origen: [0, 0, 0.147], eje: [0, 0, 1], signo: 1, desfase: 0 },
  { origen: [0, 0.122, 0], eje: [0, 1, 0], signo: 1, desfase: 0 },
  { origen: [0, -0.116, 0.427], eje: [0, 1, 0], signo: 1, desfase: 0 },
  { origen: [0, 0.116, 0.357], eje: [0, 1, 0], signo: 1, desfase: 0 },
  { origen: [0, 0, 0.116], eje: [0, 0, 1], signo: 1, desfase: 0 },
  { origen: [0, 0, 0.105], eje: [0, 1, 0], signo: 1, desfase: 0 },
];
const CUERPO_PINZA_Z = 0.02;
const DEDOS_Z = 0.097;
export const LARGO_PINZA_DEFECTO = 0.217; // brida a punta de los dedos (m): el modelo (177 mm) más 40 mm de dedos largos; se mide y se guarda en los parámetros
export const LARGO_CUERPO_PINZA = 0.117; // de la brida a donde empiezan los dedos
const SEPARACION_DEDO = 0.008;
const RECORRIDO_DEDO = 0.012;

const IDENTIDAD = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiplicar(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) for (let k = 0; k < 4; k += 1) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return r;
}

function traslacion([x, y, z]) {
  const m = [...IDENTIDAD];
  m[3] = x;
  m[7] = y;
  m[11] = z;
  return m;
}

/** Rotación de `grados` alrededor de `eje` (unitario): fórmula de Rodrigues. */
function rotacion([x, y, z], grados) {
  const a = (grados * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}

const punto = (m, local = [0, 0, 0]) => [
  m[0] * local[0] + m[1] * local[1] + m[2] * local[2] + m[3],
  m[4] * local[0] + m[5] * local[1] + m[6] * local[2] + m[7],
  m[8] * local[0] + m[9] * local[1] + m[10] * local[2] + m[11],
];

/**
 * Las posiciones (x, y, z en metros, z hacia arriba) del esqueleto para unos ángulos y una apertura de la pinza (0 a 1000).
 * `articulaciones` trae la base y el origen de J1 a J6 (siete puntos con la base), `dedos` los segmentos de los dos dedos y `punta` el TCP.
 */
export function esqueletoDelBrazo(angulos, apertura = 1000, largoPinza = LARGO_PINZA_DEFECTO) {
  let m = IDENTIDAD;
  const articulaciones = [[0, 0, 0]];
  const ejes = []; // eje de giro de cada articulación en el mundo (para dibujar los discos)
  const zEslabon = []; // eje z de cada eslabón en el mundo: los eslabones del URDF son cilindros rectos a lo largo de él
  JUNTAS.forEach((junta, i) => {
    const previa = multiplicar(m, traslacion(junta.origen));
    ejes.push([0, 1, 2].map((f) => previa[f * 4] * junta.eje[0] + previa[f * 4 + 1] * junta.eje[1] + previa[f * 4 + 2] * junta.eje[2]));
    m = multiplicar(previa, rotacion(junta.eje, junta.signo * (angulos[i] ?? 0) + junta.desfase));
    articulaciones.push(punto(m));
    zEslabon.push([m[2], m[6], m[10]]);
  });
  // Los eslabones como en el URDF (cilindros rectos a lo largo de su eje z con su radio): los corrimientos laterales del hombro y del codo (±12 cm)
  // quedan como carcasas cortas entre el final de un eslabón y la siguiente articulación. [desde, hasta, radio]
  const sobre = (p, z, largo) => [p[0] + z[0] * largo, p[1] + z[1] * largo, p[2] + z[2] * largo];
  const finBrazo = sobre(articulaciones[2], zEslabon[1], 0.427);
  const finAntebrazo = sobre(articulaciones[3], zEslabon[2], 0.357);
  const segmentos = [
    [articulaciones[0], articulaciones[1], 0.075],
    [articulaciones[1], articulaciones[2], 0.055],
    [articulaciones[2], finBrazo, 0.055],
    [finBrazo, articulaciones[3], 0.05],
    [articulaciones[3], finAntebrazo, 0.045],
    [finAntebrazo, articulaciones[4], 0.045],
    [articulaciones[4], articulaciones[5], 0.04],
    [articulaciones[5], articulaciones[6], 0.038],
  ];
  const cuerpo = multiplicar(m, traslacion([0, 0, CUERPO_PINZA_Z]));
  const separacion = SEPARACION_DEDO + (0.001 + (RECORRIDO_DEDO * Math.min(1000, Math.max(0, apertura))) / 1000);
  const dedo = (lado) => [punto(cuerpo, [lado * separacion, 0, DEDOS_Z]), punto(cuerpo, [lado * separacion, 0, largoPinza - CUERPO_PINZA_Z])];
  return {
    articulaciones,
    ejes,
    segmentos,
    muneca: punto(cuerpo),
    dedos: [dedo(-1), dedo(1)],
    punta: punto(cuerpo, [0, 0, largoPinza - CUERPO_PINZA_Z]),
    largoPinza,
    // Orientación de la brida (ejes x, y, z de la pinza en el mundo) y separación de cada dedo respecto del centro, para dibujar la pinza.
    marco: { origen: articulaciones[6], x: [m[0], m[4], m[8]], y: [m[1], m[5], m[9]], z: [m[2], m[6], m[10]] },
    separacion,
  };
}

// --- Validación de poses (mismas reglas y números que backend/servicios/brazo/geometria_brazo.py; el backend sirve los límites en /limites) ---
export const REGLAS_POR_DEFECTO = {
  limites: [[-360, 360], [-180, 180], [-160, 160], [-360, 360], [-360, 360], [-360, 360]],
  margenMesa: 0.06,
  distanciaMinima: 0.1,
  puntaMinima: 0.003,
  largoPinza: LARGO_PINZA_DEFECTO,
};
const NOMBRES_ESLABONES = ['la columna de la base', 'el hombro', 'el brazo', 'el antebrazo', 'la primera muñeca', 'la segunda muñeca', 'la pinza'];
const GRADOS_POR_MUESTRA = 5;

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const punto3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const limitar = (v, minimo, maximo) => Math.min(maximo, Math.max(minimo, v));

function distanciaEntreSegmentos(a, b, c, d) {
  const u = resta(b, a);
  const v = resta(d, c);
  const w = resta(a, c);
  const uu = punto3(u, u);
  const uv = punto3(u, v);
  const vv = punto3(v, v);
  const uw = punto3(u, w);
  const vw = punto3(v, w);
  const den = uu * vv - uv * uv;
  let s = den < 1e-12 ? 0 : limitar((uv * vw - vv * uw) / den, 0, 1);
  const t = vv > 1e-12 ? limitar((uv * s + vw) / vv, 0, 1) : 0;
  s = uu > 1e-12 ? limitar((uv * t - uw) / uu, 0, 1) : 0;
  const p = [a[0] + u[0] * s - (c[0] + v[0] * t), a[1] + u[1] * s - (c[1] + v[1] * t), a[2] + u[2] * s - (c[2] + v[2] * t)];
  return Math.hypot(...p);
}

/** Por qué una pose no se puede usar (lista vacía si es válida): límites, mesa, tablero y choques entre eslabones. */
export function problemasDePose(angulos, reglas = REGLAS_POR_DEFECTO) {
  const problemas = [];
  angulos.forEach((valor, i) => {
    const [minimo, maximo] = reglas.limites[i];
    if (valor < minimo || valor > maximo) problemas.push(`J${i + 1} (${Math.round(valor)}°) está fuera de su rango real (${minimo}° a ${maximo}°)`);
  });
  if (problemas.length) return problemas;
  const brazo = esqueletoDelBrazo(angulos, 1000, reglas.largoPinza ?? LARGO_PINZA_DEFECTO);
  const nombres = ['el hombro', 'el codo', 'la muñeca', 'la muñeca', 'la brida de la pinza'];
  const bajo = brazo.articulaciones.slice(2, 7).findIndex((p) => p[2] < reglas.margenMesa);
  if (bajo >= 0) problemas.push(`${nombres[bajo]} quedaría a ${(brazo.articulaciones[bajo + 2][2] * 100).toFixed(0)} cm de la mesa (mínimo ${reglas.margenMesa * 100} cm): atraviesa la mesa`);
  if (brazo.muneca[2] < reglas.margenMesa) problemas.push('el cuerpo de la pinza atraviesa la mesa');
  if (brazo.punta[2] < reglas.puntaMinima) problemas.push(`la punta de los dedos quedaría ${((reglas.puntaMinima - brazo.punta[2]) * 100).toFixed(0)} cm por debajo del tablero`);
  const eslabones = [...Array(6).keys()].map((i) => [brazo.articulaciones[i], brazo.articulaciones[i + 1]]);
  eslabones.push([brazo.articulaciones[6], brazo.punta]);
  for (let i = 0; i < 7; i += 1) {
    for (let j = i + 3; j < 7; j += 1) {
      if (distanciaEntreSegmentos(...eslabones[i], ...eslabones[j]) < reglas.distanciaMinima) problemas.push(`${NOMBRES_ESLABONES[i]} y ${NOMBRES_ESLABONES[j]} chocarían entre sí`);
    }
  }
  return problemas;
}

/** Lo mismo que `problemasDePose` a lo largo del camino recto en articulaciones de `desde` a `hasta` (como lo recorre el brazo). */
export function problemasDeTrayectoria(desde, hasta, reglas = REGLAS_POR_DEFECTO) {
  const muestras = Math.max(2, Math.ceil(Math.max(...desde.map((d, i) => Math.abs(hasta[i] - d))) / GRADOS_POR_MUESTRA));
  const vistos = new Set();
  const problemas = [];
  for (let k = 1; k <= muestras; k += 1) {
    const avance = k / muestras;
    problemasDePose(desde.map((d, i) => d + (hasta[i] - d) * avance), reglas).forEach((p) => {
      if (!vistos.has(p)) {
        vistos.add(p);
        problemas.push(`${p} (a un ${Math.round(avance * 100)}% del camino)`);
      }
    });
  }
  return problemas;
}
