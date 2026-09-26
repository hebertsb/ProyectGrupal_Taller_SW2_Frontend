import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { crearMaterialParticulasBrillantes } from '../../componentes/materialParticulasBrillantes';

/**
 * Cerebro de RED — vista ALTERNATIVA a `CerebroNeuronal` (nube de partículas). Mismo
 * contrato de props, mismos datos reales de `/aprendizaje/inferencia`, mismo mapeo de
 * color — la única diferencia es la metáfora visual: acá el mapa de activación se
 * dibuja como nodos (esferas con glow) conectados por aristas (líneas), en vez de una
 * nube continua. Ninguno de los dos es "el bueno": son dos lentes sobre el mismo dato,
 * el usuario elige cuál mirar con el selector de `RazonamientoNeuronal.jsx`.
 *
 * Igual que en `CerebroNeuronal.jsx`, lo único decorativo es la topología (qué nodo se
 * conecta con cuál) — el color y el tamaño de cada nodo/arista siempre vienen de un
 * campo real de la inferencia. No hay 1 nodo por casilla exacto en todas las capas (ver
 * comentario de cada grupo), pero el mapeo saliencia->casilla en la corteza sí es 1:1.
 *
 * Colores — idénticos a `CerebroNeuronal.jsx` (no reinventar la paleta):
 *   cian    (saliencia)              -> #00e5ff
 *   violeta (atención por bloque)    -> #7c4dff
 *   verde   (jugada elegida)         -> #76ff03
 *   ámbar   (diferencia vs Stockfish)-> #ff9100
 *   plateado (analizando)            -> #bac9cc
 */
const COLOR_SALIENCIA = new THREE.Color(0x00e5ff);
const COLOR_ATENCION = new THREE.Color(0x7c4dff);
const COLOR_MOTORA = new THREE.Color(0x76ff03);
const COLOR_STOCKFISH = new THREE.Color(0xff9100);
const COLOR_ANALIZANDO = new THREE.Color(0xbac9cc);
const COLOR_NUCLEO = new THREE.Color(0x1c3a4a);

// ---- Presupuesto de nodos por zona anatómica (mucho más liviano que la nube de
// partículas — acá la legibilidad de las aristas importa más que la densidad) ----
const FILAS = 8;
const COLUMNAS = 8;
const CANTIDAD_CORTEX = FILAS * COLUMNAS; // 64 — un nodo por casilla del tablero, 1:1 con `saliencia`
const BLOQUES_ATENCION = 8; // bloques residuales SE del checkpoint v5 (puede venir vacío)
const NODOS_POR_BLOQUE = 6;
const CANTIDAD_NUCLEO = BLOQUES_ATENCION * NODOS_POR_BLOQUE; // 48 — capas concéntricas, una por bloque
const CANTIDAD_MOTOR_ANILLO = 16;
const CANTIDAD_MOTOR = 1 + CANTIDAD_MOTOR_ANILLO; // 17 — nodo 0 es el "hub" (jugada elegida), el resto un anillo alrededor
const CANTIDAD_HALO = 10; // halo de comparación Stockfish alrededor del cluster motor
const TOTAL_NODOS = CANTIDAD_CORTEX + CANTIDAD_NUCLEO + CANTIDAD_MOTOR + CANTIDAD_HALO;

const OFFSET_CORTEX = 0;
const OFFSET_NUCLEO = OFFSET_CORTEX + CANTIDAD_CORTEX;
const OFFSET_MOTOR = OFFSET_NUCLEO + CANTIDAD_NUCLEO;
const OFFSET_HALO = OFFSET_MOTOR + CANTIDAD_MOTOR;

const RADIO_BASE = 130;
const VELOCIDAD_TRANSICION = 6; // 1/seg — mismo suavizado exponencial que CerebroNeuronal
const VELOCIDAD_POSICION = 5;

/** Distribución uniforme de N puntos sobre la esfera unitaria (espiral áurea) — igual que en CerebroNeuronal. */
function direccionFibonacci(indice, total) {
  const anguloAureo = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (indice / Math.max(1, total - 1)) * 2;
  const radio = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = anguloAureo * indice;
  return { x: Math.cos(theta) * radio, y, z: Math.sin(theta) * radio };
}

/** Anillo simple en torno a un eje (usado para los nodos de un bloque de atención) — no necesita ser unitario. */
function direccionAnillo(indice, total) {
  const theta = (indice / total) * Math.PI * 2;
  return { x: Math.cos(theta), y: Math.sin(theta * 2) * 0.35, z: Math.sin(theta) };
}

/** Anisotropía del cerebro: más largo adelante/atrás, algo achatado abajo — misma fórmula que CerebroNeuronal. */
function anisotropiaCerebro(nx, ny, nz) {
  const achatado = ny < -0.15 ? ny + (ny + 0.15) * 0.55 : ny;
  return { x: nx * 0.98, y: achatado * 0.86, z: nz * 1.24 };
}

/** Separa las dos mitades para simular la fisura interhemisférica — misma fórmula que CerebroNeuronal. */
function aplicarFisura(x) {
  const signo = x >= 0 ? 1 : -1;
  const distancia = Math.abs(x);
  const holgura = 6;
  return distancia < 14 ? signo * (holgura + distancia * 0.55) : signo * (holgura + (distancia - 14) * 0.92);
}

/** Radio de superficie modulado con ruido simplex — mismo aspecto de sulcos que CerebroNeuronal. */
function radioSurcos(ruido, nx, ny, nz) {
  const n1 = ruido.noise3d(nx * 1.7, ny * 1.7, nz * 1.7);
  const n2 = ruido.noise3d(nx * 4.2 + 12, ny * 4.2 + 12, nz * 4.2 + 12) * 0.5;
  return 1 + (n1 + n2) * 0.16;
}

/** Punto de anclaje del cluster motor (jugada elegida) — misma convención que CerebroNeuronal. */
const CENTRO_MOTORA = { x: 0, y: -0.58, z: 1.02 };
const NORMA_CENTRO_MOTORA = Math.hypot(CENTRO_MOTORA.x, CENTRO_MOTORA.y, CENTRO_MOTORA.z);
const DIR_CENTRO_MOTORA = {
  x: CENTRO_MOTORA.x / NORMA_CENTRO_MOTORA,
  y: CENTRO_MOTORA.y / NORMA_CENTRO_MOTORA,
  z: CENTRO_MOTORA.z / NORMA_CENTRO_MOTORA,
};
const ANCLA_MOTORA = {
  x: CENTRO_MOTORA.x * RADIO_BASE * 0.86,
  y: CENTRO_MOTORA.y * RADIO_BASE * 0.86,
  z: CENTRO_MOTORA.z * RADIO_BASE * 0.86,
};

/**
 * Construye la topología fija de la red: posición de reposo de cada nodo + la lista de
 * aristas (pares de índices de nodo). Se calcula una sola vez al montar — nunca cambia,
 * solo cambian color/tamaño/jitter de lo que ya existe.
 */
function construirTopologiaRed() {
  const ruido = new SimplexNoise();
  const posiciones = new Float32Array(TOTAL_NODOS * 3);
  const colores = new Float32Array(TOTAL_NODOS * 3);
  const tamanos = new Float32Array(TOTAL_NODOS);

  function escribirNodo(indice, x, y, z, color, tamano) {
    const base = indice * 3;
    posiciones[base] = x;
    posiciones[base + 1] = y;
    posiciones[base + 2] = z;
    colores[base] = color.r;
    colores[base + 1] = color.g;
    colores[base + 2] = color.b;
    tamanos[indice] = tamano;
  }

  // ---- Corteza: grilla 8x8 (rank x file, mismo orden que chess.SQUARES a1..h8) ----
  // proyectada sobre la superficie del cerebro — da una malla tipo "globo terráqueo"
  // en vez de la dispersión de Fibonacci, para que las aristas fila/columna se vean
  // como una malla prolija en vez de cruzarse al azar.
  for (let fila = 0; fila < FILAS; fila++) {
    const y = 1 - (fila / (FILAS - 1)) * 2;
    const radioAnillo = Math.sqrt(Math.max(0, 1 - y * y));
    for (let columna = 0; columna < COLUMNAS; columna++) {
      const theta = (columna / COLUMNAS) * Math.PI * 2;
      const nx = Math.cos(theta) * radioAnillo;
      const nz = Math.sin(theta) * radioAnillo;
      const forma = anisotropiaCerebro(nx, y, nz);
      const escala = RADIO_BASE * radioSurcos(ruido, nx, y, nz);
      const indice = OFFSET_CORTEX + fila * COLUMNAS + columna;
      escribirNodo(
        indice,
        aplicarFisura(forma.x * escala),
        forma.y * escala,
        forma.z * escala,
        COLOR_NUCLEO,
        3.2,
      );
    }
  }

  // ---- Núcleo: 8 capas concéntricas (una por bloque residual SE), 6 nodos en anillo cada una ----
  for (let bloque = 0; bloque < BLOQUES_ATENCION; bloque++) {
    const radioBloque = RADIO_BASE * (0.8 - bloque * 0.075);
    for (let j = 0; j < NODOS_POR_BLOQUE; j++) {
      const dir = direccionAnillo(j, NODOS_POR_BLOQUE);
      const forma = anisotropiaCerebro(dir.x, dir.y, dir.z);
      const jitter = 0.94 + (ruido.noise3d(dir.x * 3 + bloque, dir.y * 3 + bloque, dir.z * 3 + bloque) + 1) * 0.03;
      const indice = OFFSET_NUCLEO + bloque * NODOS_POR_BLOQUE + j;
      escribirNodo(
        indice,
        aplicarFisura(forma.x * radioBloque * jitter),
        forma.y * radioBloque * jitter,
        forma.z * radioBloque * jitter,
        COLOR_NUCLEO,
        3.6,
      );
    }
  }

  // ---- Cluster motor: hub (jugada elegida) + anillo de 16 nodos alrededor ----
  escribirNodo(OFFSET_MOTOR, ANCLA_MOTORA.x, ANCLA_MOTORA.y, ANCLA_MOTORA.z, COLOR_NUCLEO, 5.5);
  for (let i = 0; i < CANTIDAD_MOTOR_ANILLO; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_MOTOR_ANILLO);
    const mezcla = 0.82;
    const vx = DIR_CENTRO_MOTORA.x * mezcla + dir.x * (1 - mezcla);
    const vy = DIR_CENTRO_MOTORA.y * mezcla + dir.y * (1 - mezcla);
    const vz = DIR_CENTRO_MOTORA.z * mezcla + dir.z * (1 - mezcla);
    const norma = Math.hypot(vx, vy, vz) || 1;
    const radioBlob = RADIO_BASE * 0.24;
    escribirNodo(
      OFFSET_MOTOR + 1 + i,
      (vx / norma) * radioBlob + ANCLA_MOTORA.x,
      (vy / norma) * radioBlob + ANCLA_MOTORA.y,
      (vz / norma) * radioBlob + ANCLA_MOTORA.z,
      COLOR_NUCLEO,
      3.4,
    );
  }

  // ---- Halo (comparación Stockfish) — cascarón de nodos alrededor del cluster motor ----
  for (let i = 0; i < CANTIDAD_HALO; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_HALO);
    const radioBlob = RADIO_BASE * 0.36;
    escribirNodo(
      OFFSET_HALO + i,
      dir.x * radioBlob + ANCLA_MOTORA.x,
      dir.y * radioBlob + ANCLA_MOTORA.y,
      dir.z * radioBlob + ANCLA_MOTORA.z,
      new THREE.Color(0x000000),
      0,
    );
  }

  // ---- Aristas: pares [nodoA, nodoB] ----
  const aristas = [];

  // Corteza: vecinos de fila (anillo cerrado, incluye el "wrap" columna 7 -> columna 0)
  // y vecinos de columna (meridianos, sin wrap arriba/abajo) — mismo espíritu que una
  // grilla 8x8, da una malla legible en vez de una nube de líneas cruzadas.
  for (let fila = 0; fila < FILAS; fila++) {
    for (let columna = 0; columna < COLUMNAS; columna++) {
      const a = OFFSET_CORTEX + fila * COLUMNAS + columna;
      const bFila = OFFSET_CORTEX + fila * COLUMNAS + ((columna + 1) % COLUMNAS);
      aristas.push([a, bFila]);
      if (fila < FILAS - 1) {
        const bColumna = OFFSET_CORTEX + (fila + 1) * COLUMNAS + columna;
        aristas.push([a, bColumna]);
      }
    }
  }

  // Núcleo: anillo dentro de cada bloque + un radio que encadena bloque con bloque
  // (de más superficial a más profundo), sugiriendo el flujo de profundidad de la red.
  for (let bloque = 0; bloque < BLOQUES_ATENCION; bloque++) {
    const base = OFFSET_NUCLEO + bloque * NODOS_POR_BLOQUE;
    for (let j = 0; j < NODOS_POR_BLOQUE; j++) {
      aristas.push([base + j, base + ((j + 1) % NODOS_POR_BLOQUE)]);
    }
    if (bloque < BLOQUES_ATENCION - 1) {
      aristas.push([base, base + NODOS_POR_BLOQUE]);
    }
  }

  // Cluster motor: estrella (hub -> cada nodo del anillo) + unas cruzadas entre nodos
  // del anillo, para que se vea como un cluster denso, no una simple rueda.
  for (let i = 0; i < CANTIDAD_MOTOR_ANILLO; i++) {
    aristas.push([OFFSET_MOTOR, OFFSET_MOTOR + 1 + i]);
    aristas.push([OFFSET_MOTOR + 1 + i, OFFSET_MOTOR + 1 + ((i + 5) % CANTIDAD_MOTOR_ANILLO)]);
  }

  // Puente corteza -> hub motor: unos pocos nodos de la corteza (repartidos parejo)
  // representan la vía de integración de la señal hacia la decisión final.
  const NODOS_PUENTE = [0, 11, 22, 33, 44, 55];
  for (const indiceCortex of NODOS_PUENTE) {
    aristas.push([OFFSET_CORTEX + indiceCortex, OFFSET_MOTOR]);
  }

  return { posiciones, colores, tamanos, aristas };
}

/** Mezcla un color base con un color de dato real según una intensidad 0..1 — igual que CerebroNeuronal. */
function mezclarColor(destino, base, dato, intensidad) {
  destino.copy(base).lerp(dato, THREE.MathUtils.clamp(intensidad, 0, 1));
}

export default function CerebroRed({
  saliencia,
  atencionPorBloque,
  jugadaElegida,
  probabilidadTop1 = 0,
  diferenciaCp = 0,
  analizando = false,
  compacto = false,
}) {
  const mountRef = useRef(null);
  const propsRef = useRef({ saliencia, atencionPorBloque, jugadaElegida, probabilidadTop1, diferenciaCp, analizando });
  propsRef.current = { saliencia, atencionPorBloque, jugadaElegida, probabilidadTop1, diferenciaCp, analizando };

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return undefined;

    const prefiereMenosMovimiento =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const { posiciones, colores, tamanos, aristas } = construirTopologiaRed();
    const cantidadAristas = aristas.length;

    // ---- Geometría de nodos (Points, mismo material con glow que la nube de partículas) ----
    const geometriaNodos = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posiciones.slice(), 3);
    const colorAttr = new THREE.BufferAttribute(colores.slice(), 3);
    const sizeAttr = new THREE.BufferAttribute(tamanos.slice(), 1);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    geometriaNodos.setAttribute('position', posAttr);
    geometriaNodos.setAttribute('aColor', colorAttr);
    geometriaNodos.setAttribute('aSize', sizeAttr);
    const materialNodos = crearMaterialParticulasBrillantes({ atenuacion: 820, nucleo: 0.22 });
    const puntosNodos = new THREE.Points(geometriaNodos, materialNodos);

    // ---- Geometría de aristas (LineSegments) — posición/color se sincronizan cada frame
    // desde los nodos que conecta, así siguen el drift/asentamiento sin duplicar lógica. ----
    const posArista = new Float32Array(cantidadAristas * 2 * 3);
    const colorArista = new Float32Array(cantidadAristas * 2 * 3);
    const componentesNucleo = [COLOR_NUCLEO.r, COLOR_NUCLEO.g, COLOR_NUCLEO.b];
    for (let i = 0; i < cantidadAristas; i++) {
      const [a, b] = aristas[i];
      for (let v = 0; v < 3; v++) {
        posArista[i * 6 + v] = posiciones[a * 3 + v];
        posArista[i * 6 + 3 + v] = posiciones[b * 3 + v];
        colorArista[i * 6 + v] = componentesNucleo[v];
        colorArista[i * 6 + 3 + v] = componentesNucleo[v];
      }
    }
    const geometriaAristas = new THREE.BufferGeometry();
    const posAristaAttr = new THREE.BufferAttribute(posArista, 3);
    const colorAristaAttr = new THREE.BufferAttribute(colorArista, 3);
    posAristaAttr.setUsage(THREE.DynamicDrawUsage);
    colorAristaAttr.setUsage(THREE.DynamicDrawUsage);
    geometriaAristas.setAttribute('position', posAristaAttr);
    geometriaAristas.setAttribute('color', colorAristaAttr);
    const materialAristas = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lineasAristas = new THREE.LineSegments(geometriaAristas, materialAristas);

    const grupo = new THREE.Group();
    grupo.add(lineasAristas); // las líneas primero, para que los nodos (con glow) queden encima
    grupo.add(puntosNodos);

    const ancho = contenedor.clientWidth || 320;
    const alto = contenedor.clientHeight || 320;
    const scene = new THREE.Scene();
    scene.add(grupo);
    const camera = new THREE.PerspectiveCamera(compacto ? 48 : 42, ancho / alto, 1, 3000);
    camera.position.set(0, compacto ? 24 : 40, compacto ? 300 : 430);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    contenedor.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = compacto ? 150 : 200;
    controls.maxDistance = compacto ? 550 : 850;
    controls.target.set(0, 0, 0);

    const resizeObserver = new ResizeObserver((entradas) => {
      for (const entrada of entradas) {
        const { width, height } = entrada.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(contenedor);

    // Arreglos de trabajo: color/tamaño OBJETIVO por nodo, recalculados cuando cambian
    // los props reales (nunca en cada frame) — mismo patrón que CerebroNeuronal.
    const colorObjetivoNodos = new Float32Array(TOTAL_NODOS * 3);
    const tamObjetivoNodos = new Float32Array(TOTAL_NODOS);
    const colorObjetivoAristas = new Float32Array(cantidadAristas * 2 * 3);
    const colorPos = new THREE.Color();

    function escribirObjetivoNodo(indice, color, tamano) {
      const base = indice * 3;
      colorObjetivoNodos[base] = color.r;
      colorObjetivoNodos[base + 1] = color.g;
      colorObjetivoNodos[base + 2] = color.b;
      tamObjetivoNodos[indice] = tamano;
    }

    function recalcularObjetivoDatos() {
      const { saliencia: sal, atencionPorBloque: atn, jugadaElegida: jug, probabilidadTop1: prob, diferenciaCp: diff } =
        propsRef.current;
      const salienciaSegura = Array.isArray(sal) && sal.length === 64 ? sal : new Array(64).fill(0);
      const atencionSegura = Array.isArray(atn) ? atn : [];

      // Corteza: cada nodo toma el valor real de saliencia de su casilla (índice 1:1).
      for (let i = 0; i < CANTIDAD_CORTEX; i++) {
        const valor = salienciaSegura[i] ?? 0;
        mezclarColor(colorPos, COLOR_NUCLEO, COLOR_SALIENCIA, valor);
        escribirObjetivoNodo(OFFSET_CORTEX + i, colorPos, 3 + valor * 9);
      }

      // Núcleo: si el checkpoint no tiene bloques SE, `atencionSegura` viene vacío — la
      // zona se apaga (intensidad 0) en vez de inventar un valor, igual que en CerebroNeuronal.
      for (let bloque = 0; bloque < BLOQUES_ATENCION; bloque++) {
        const valor = atencionSegura[bloque] ?? 0;
        mezclarColor(colorPos, COLOR_NUCLEO, COLOR_ATENCION, valor);
        for (let j = 0; j < NODOS_POR_BLOQUE; j++) {
          escribirObjetivoNodo(OFFSET_NUCLEO + bloque * NODOS_POR_BLOQUE + j, colorPos, 3.2 + valor * 9);
        }
      }

      // Cluster motor: intensidad = confianza de la jugada elegida (0 si todavía no hay jugada).
      const intensidadMotora = jug ? THREE.MathUtils.clamp(prob, 0.08, 1) : 0;
      mezclarColor(colorPos, COLOR_NUCLEO, COLOR_MOTORA, intensidadMotora);
      escribirObjetivoNodo(OFFSET_MOTOR, colorPos, 4.5 + intensidadMotora * 12);
      for (let i = 0; i < CANTIDAD_MOTOR_ANILLO; i++) {
        escribirObjetivoNodo(OFFSET_MOTOR + 1 + i, colorPos, 2.6 + intensidadMotora * 8);
      }

      // Halo: referencia de calidad vs Stockfish — nunca decide la jugada, solo compara.
      const intensidadHalo = jug ? THREE.MathUtils.clamp(Math.abs(diff ?? 0) / 150, 0, 1) : 0;
      mezclarColor(colorPos, new THREE.Color(0x000000), COLOR_STOCKFISH, intensidadHalo);
      for (let i = 0; i < CANTIDAD_HALO; i++) {
        escribirObjetivoNodo(OFFSET_HALO + i, colorPos, intensidadHalo * 11);
      }

      // Aristas: cada una toma el promedio de sus dos nodos extremos — no hace falta
      // guardar un dato propio, la arista solo "conduce" lo que ya vale cada nodo.
      for (let i = 0; i < cantidadAristas; i++) {
        const [a, b] = aristas[i];
        const baseA = a * 3;
        const baseB = b * 3;
        for (let v = 0; v < 3; v++) {
          const promedio = (colorObjetivoNodos[baseA + v] + colorObjetivoNodos[baseB + v]) / 2;
          colorObjetivoAristas[i * 6 + v] = promedio;
          colorObjetivoAristas[i * 6 + 3 + v] = promedio;
        }
      }
    }
    recalcularObjetivoDatos();

    const sim = { ultimoAnalizando: propsRef.current.analizando };
    const clock = new THREE.Clock();
    let idAnimacion;

    function actualizarDriftNodos(tiempo, delta) {
      const posArr = posAttr.array;
      const amplitud = prefiereMenosMovimiento ? 0 : 4.5;
      for (let i = 0; i < TOTAL_NODOS; i++) {
        const base = i * 3;
        const bx = posiciones[base];
        const by = posiciones[base + 1];
        const bz = posiciones[base + 2];
        const n = ruidoDrift(bx, by, bz, tiempo);
        const objetivoX = bx + n * amplitud;
        const objetivoY = by + Math.cos(n * 3.1) * amplitud * 0.6;
        const objetivoZ = bz + Math.sin(n * 2.4) * amplitud;
        const factor = 1 - Math.exp(-VELOCIDAD_POSICION * delta);
        posArr[base] = THREE.MathUtils.lerp(posArr[base], objetivoX, factor);
        posArr[base + 1] = THREE.MathUtils.lerp(posArr[base + 1], objetivoY, factor);
        posArr[base + 2] = THREE.MathUtils.lerp(posArr[base + 2], objetivoZ, factor);
      }
      posAttr.needsUpdate = true;

      const colorArr = colorAttr.array;
      const sizeArr = sizeAttr.array;
      const factorColor = 1 - Math.exp(-VELOCIDAD_TRANSICION * delta);
      for (let i = 0; i < TOTAL_NODOS; i++) {
        const base = i * 3;
        colorArr[base] = THREE.MathUtils.lerp(colorArr[base], COLOR_ANALIZANDO.r * 0.85, factorColor);
        colorArr[base + 1] = THREE.MathUtils.lerp(colorArr[base + 1], COLOR_ANALIZANDO.g * 0.85, factorColor);
        colorArr[base + 2] = THREE.MathUtils.lerp(colorArr[base + 2], COLOR_ANALIZANDO.b * 0.85, factorColor);
        const objetivoTam = 3.4 + Math.sin(tiempo * 3 + i * 0.35) * 1.1;
        sizeArr[i] = THREE.MathUtils.lerp(sizeArr[i], objetivoTam, factorColor);
      }
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    // Ruido 4D propio para el drift de "analizando" (instancia separada de la que
    // esculpió la topología — no hace falta compartir semilla, solo da variación orgánica).
    const ruidoBase = new SimplexNoise();
    function ruidoDrift(x, y, z, tiempo) {
      return ruidoBase.noise4d(x * 0.012, y * 0.012, z * 0.012, tiempo * 0.35);
    }

    function asentarPosicionesNodos(delta) {
      const posArr = posAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_POSICION * delta);
      for (let i = 0; i < TOTAL_NODOS; i++) {
        const base = i * 3;
        posArr[base] = THREE.MathUtils.lerp(posArr[base], posiciones[base], factor);
        posArr[base + 1] = THREE.MathUtils.lerp(posArr[base + 1], posiciones[base + 1], factor);
        posArr[base + 2] = THREE.MathUtils.lerp(posArr[base + 2], posiciones[base + 2], factor);
      }
      posAttr.needsUpdate = true;
    }

    function lerpNodosHaciaObjetivo(delta) {
      const colorArr = colorAttr.array;
      const sizeArr = sizeAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_TRANSICION * delta);
      for (let i = 0; i < TOTAL_NODOS; i++) {
        const base = i * 3;
        colorArr[base] = THREE.MathUtils.lerp(colorArr[base], colorObjetivoNodos[base], factor);
        colorArr[base + 1] = THREE.MathUtils.lerp(colorArr[base + 1], colorObjetivoNodos[base + 1], factor);
        colorArr[base + 2] = THREE.MathUtils.lerp(colorArr[base + 2], colorObjetivoNodos[base + 2], factor);
        sizeArr[i] = THREE.MathUtils.lerp(sizeArr[i], tamObjetivoNodos[i], factor);
      }
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    function lerpAristasHaciaObjetivo(delta, analizandoActual) {
      const colorArr = colorAristaAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_TRANSICION * delta);
      for (let i = 0; i < cantidadAristas * 2; i++) {
        const base = i * 3;
        const rObjetivo = analizandoActual ? COLOR_ANALIZANDO.r * 0.7 : colorObjetivoAristas[base];
        const gObjetivo = analizandoActual ? COLOR_ANALIZANDO.g * 0.7 : colorObjetivoAristas[base + 1];
        const bObjetivo = analizandoActual ? COLOR_ANALIZANDO.b * 0.7 : colorObjetivoAristas[base + 2];
        colorArr[base] = THREE.MathUtils.lerp(colorArr[base], rObjetivo, factor);
        colorArr[base + 1] = THREE.MathUtils.lerp(colorArr[base + 1], gObjetivo, factor);
        colorArr[base + 2] = THREE.MathUtils.lerp(colorArr[base + 2], bObjetivo, factor);
      }
      colorAristaAttr.needsUpdate = true;
    }

    function sincronizarAristasConNodos() {
      const posNodos = posAttr.array;
      const posArr = posAristaAttr.array;
      for (let i = 0; i < cantidadAristas; i++) {
        const [a, b] = aristas[i];
        for (let v = 0; v < 3; v++) {
          posArr[i * 6 + v] = posNodos[a * 3 + v];
          posArr[i * 6 + 3 + v] = posNodos[b * 3 + v];
        }
      }
      posAristaAttr.needsUpdate = true;
    }

    function actualizarPulsoMotora(tiempo) {
      const { jugadaElegida: jug, probabilidadTop1: prob } = propsRef.current;
      if (!jug) return;
      const pulso = 0.85 + Math.sin(tiempo * 2.4) * 0.15 * THREE.MathUtils.clamp(prob, 0, 1);
      const sizeArr = sizeAttr.array;
      sizeArr[OFFSET_MOTOR] = tamObjetivoNodos[OFFSET_MOTOR] * pulso;
      for (let i = 0; i < CANTIDAD_MOTOR_ANILLO; i++) {
        sizeArr[OFFSET_MOTOR + 1 + i] = tamObjetivoNodos[OFFSET_MOTOR + 1 + i] * pulso;
      }
      sizeAttr.needsUpdate = true;
    }

    function animar() {
      idAnimacion = requestAnimationFrame(animar);
      const delta = Math.min(clock.getDelta(), 0.1);
      const tiempo = clock.getElapsedTime();

      if (!prefiereMenosMovimiento) {
        grupo.rotation.y += 0.05 * delta;
      }
      controls.update();

      const analizandoActual = propsRef.current.analizando;
      if (analizandoActual !== sim.ultimoAnalizando) {
        if (!analizandoActual) {
          // Se acaba de resolver la inferencia: recalcular el objetivo con los datos nuevos.
          recalcularObjetivoDatos();
        }
        sim.ultimoAnalizando = analizandoActual;
      }

      if (analizandoActual) {
        actualizarDriftNodos(tiempo, delta);
        materialAristas.opacity = 0.55 + Math.sin(tiempo * 3) * 0.15;
      } else {
        asentarPosicionesNodos(delta);
        lerpNodosHaciaObjetivo(delta);
        actualizarPulsoMotora(tiempo);
        materialAristas.opacity = 0.85;
      }
      lerpAristasHaciaObjetivo(delta, analizandoActual);
      sincronizarAristasConNodos();

      renderer.render(scene, camera);
    }
    animar();

    return () => {
      cancelAnimationFrame(idAnimacion);
      resizeObserver.disconnect();
      controls.dispose();
      geometriaNodos.dispose();
      geometriaAristas.dispose();
      materialNodos.dispose();
      materialAristas.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // Se remonta solo si cambia `compacto` (encuadre de cámara); el resto de los props
    // se lee en vivo desde `propsRef` dentro del loop para no reconstruir la escena
    // entera en cada inferencia (mismo motivo que CerebroNeuronal: evita "Too many
    // active WebGL contexts" si un objeto nuevo por render disparara este efecto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compacto]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" aria-hidden="true" />;
}
