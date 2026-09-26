import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { crearMaterialParticulasBrillantes } from '../../componentes/materialParticulasBrillantes';

/**
 * Cerebro de partículas — mapa de activación neuronal REAL del modelo propio (HU6
 * ampliada). Reemplaza al viejo `CerebroHolografico` (nube decorativa sin datos).
 * Nada acá es ilustrativo: cada capa de partículas está atada a un campo real de
 * `/aprendizaje/inferencia` (ver props). La única "licencia" visual es la silueta:
 * se genera con geometría procedural (dos elipsoides deformados con ruido simplex),
 * no hay ningún asset ni modelo de cerebro descargado.
 *
 * Colores — mirroreados de los tokens `--color-neon-*` de src/index.css (WebGL
 * necesita hex numérico, no puede leer variables CSS). Si cambia la paleta ahí,
 * actualizar acá también.
 *   cian    (saliencia)              -> --color-neon-cyan   #00e5ff
 *   violeta (atención por bloque)    -> --color-neon-purple #7c4dff
 *   verde   (jugada elegida)         -> --color-neon-lime   #76ff03
 *   ámbar   (diferencia vs Stockfish)-> --color-neon-orange #ff9100
 *   plateado (analizando)            -> --color-on-surface-variant #bac9cc
 */
const COLOR_SALIENCIA = new THREE.Color(0x00e5ff);
const COLOR_ATENCION = new THREE.Color(0x7c4dff);
const COLOR_MOTORA = new THREE.Color(0x76ff03);
const COLOR_STOCKFISH = new THREE.Color(0xff9100);
const COLOR_ANALIZANDO = new THREE.Color(0xbac9cc);
const COLOR_NUCLEO = new THREE.Color(0x1c3a4a);

// Presupuesto de partículas por capa anatómica.
const POR_CASILLA = 54;
const CANTIDAD_CORTEX = 64 * POR_CASILLA; // 3456 — corteza externa, una zona por casilla del tablero
const BLOQUES_ATENCION = 8; // bloques residuales SE del checkpoint v5
const POR_BLOQUE = 190;
const CANTIDAD_ATENCION = BLOQUES_ATENCION * POR_BLOQUE; // 1520 — capas a distinta profundidad
const CANTIDAD_MOTORA = 520; // "corteza motora" — jugada elegida
const CANTIDAD_HALO = 260; // halo alrededor de la motora — comparación Stockfish
const CANTIDAD_NUCLEO = 900; // relleno ambiental, le da volumen al cerebro
const TOTAL_PARTICULAS =
  CANTIDAD_CORTEX + CANTIDAD_ATENCION + CANTIDAD_MOTORA + CANTIDAD_HALO + CANTIDAD_NUCLEO;

const OFFSET_CORTEX = 0;
const OFFSET_ATENCION = OFFSET_CORTEX + CANTIDAD_CORTEX;
const OFFSET_MOTORA = OFFSET_ATENCION + CANTIDAD_ATENCION;
const OFFSET_HALO = OFFSET_MOTORA + CANTIDAD_MOTORA;
const OFFSET_NUCLEO = OFFSET_HALO + CANTIDAD_HALO;

const RADIO_BASE = 130;
const VELOCIDAD_TRANSICION = 6; // 1/seg — ~500ms para converger ~95% (suavizado exponencial)
const VELOCIDAD_POSICION = 5;

/** Distribución uniforme de N puntos sobre la esfera unitaria (espiral áurea). */
function direccionFibonacci(indice, total) {
  const anguloAureo = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (indice / Math.max(1, total - 1)) * 2;
  const radio = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = anguloAureo * indice;
  return { x: Math.cos(theta) * radio, y, z: Math.sin(theta) * radio };
}

/** Anisotropía del cerebro: más largo adelante/atrás, algo achatado abajo (base del tronco encefálico). */
function anisotropiaCerebro(nx, ny, nz) {
  const achatado = ny < -0.15 ? ny + (ny + 0.15) * 0.55 : ny;
  return { x: nx * 0.98, y: achatado * 0.86, z: nz * 1.24 };
}

/** Separa las dos mitades para simular la fisura interhemisférica (misma idea que el viejo componente decorativo). */
function aplicarFisura(x) {
  const signo = x >= 0 ? 1 : -1;
  const distancia = Math.abs(x);
  const holgura = 6;
  return distancia < 14 ? signo * (holgura + distancia * 0.55) : signo * (holgura + (distancia - 14) * 0.92);
}

/** Radio de superficie modulado con ruido simplex multi-octava — da el aspecto de sulcos/circunvoluciones. */
function radioSurcos(ruido, nx, ny, nz) {
  const n1 = ruido.noise3d(nx * 1.7, ny * 1.7, nz * 1.7);
  const n2 = ruido.noise3d(nx * 4.2 + 12, ny * 4.2 + 12, nz * 4.2 + 12) * 0.5;
  return 1 + (n1 + n2) * 0.16;
}

function construirAnatomia() {
  const ruido = new SimplexNoise();
  const posiciones = new Float32Array(TOTAL_PARTICULAS * 3);
  const colores = new Float32Array(TOTAL_PARTICULAS * 3);
  const tamanos = new Float32Array(TOTAL_PARTICULAS);
  const casillaPorParticula = new Int16Array(CANTIDAD_CORTEX);
  const bloquePorParticula = new Int8Array(CANTIDAD_ATENCION);

  // ---- Corteza (saliencia, 64 casillas) ----
  for (let i = 0; i < CANTIDAD_CORTEX; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_CORTEX);
    const forma = anisotropiaCerebro(dir.x, dir.y, dir.z);
    const escala = RADIO_BASE * radioSurcos(ruido, dir.x, dir.y, dir.z);
    const px = aplicarFisura(forma.x * escala);
    const py = forma.y * escala;
    const pz = forma.z * escala;
    const base = (OFFSET_CORTEX + i) * 3;
    posiciones[base] = px;
    posiciones[base + 1] = py;
    posiciones[base + 2] = pz;

    // Grilla 8x8 determinística a partir del ángulo del punto en la esfera unitaria
    // (antes de aplicar la fisura/anisotropía) — mismo orden que chess.SQUARES (a1..h8).
    const theta = Math.atan2(dir.z, dir.x); // -PI..PI
    const columna = Math.min(7, Math.max(0, Math.floor(((theta + Math.PI) / (Math.PI * 2)) * 8)));
    const phi = Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)); // 0 (arriba) .. PI (abajo)
    const filaDesdeArriba = Math.min(7, Math.max(0, Math.floor((phi / Math.PI) * 8)));
    const fila = 7 - filaDesdeArriba; // arriba del cerebro = rangos altos (solo convención visual)
    casillaPorParticula[i] = fila * 8 + columna;

    colores[base] = COLOR_NUCLEO.r;
    colores[base + 1] = COLOR_NUCLEO.g;
    colores[base + 2] = COLOR_NUCLEO.b;
    tamanos[OFFSET_CORTEX + i] = 2.1;
  }

  // ---- Atención por bloque (8 capas concéntricas, más adentro = más profundo) ----
  for (let b = 0; b < BLOQUES_ATENCION; b++) {
    const radioBloque = RADIO_BASE * (0.82 - b * 0.082);
    for (let j = 0; j < POR_BLOQUE; j++) {
      const indiceGlobal = b * POR_BLOQUE + j;
      const dir = direccionFibonacci(j, POR_BLOQUE);
      const forma = anisotropiaCerebro(dir.x, dir.y, dir.z);
      const jitter = 0.94 + (ruido.noise3d(dir.x * 3 + b, dir.y * 3 + b, dir.z * 3 + b) + 1) * 0.03;
      const base = (OFFSET_ATENCION + indiceGlobal) * 3;
      posiciones[base] = aplicarFisura(forma.x * radioBloque * jitter);
      posiciones[base + 1] = forma.y * radioBloque * jitter;
      posiciones[base + 2] = forma.z * radioBloque * jitter;
      bloquePorParticula[indiceGlobal] = b;

      colores[base] = COLOR_NUCLEO.r;
      colores[base + 1] = COLOR_NUCLEO.g;
      colores[base + 2] = COLOR_NUCLEO.b;
      tamanos[OFFSET_ATENCION + indiceGlobal] = 2.3;
    }
  }

  // ---- Corteza motora (jugada elegida) — lóbulo propio, adelante/abajo del cerebro ----
  const centroMotora = { x: 0, y: -0.58, z: 1.02 };
  const normaCentro = Math.hypot(centroMotora.x, centroMotora.y, centroMotora.z);
  const dirCentro = {
    x: centroMotora.x / normaCentro,
    y: centroMotora.y / normaCentro,
    z: centroMotora.z / normaCentro,
  };
  for (let i = 0; i < CANTIDAD_MOTORA; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_MOTORA);
    // Cono angosto alrededor del centro de la corteza motora (mezcla 82% centro / 18% esfera completa).
    const mezcla = 0.82;
    const vx = dirCentro.x * mezcla + dir.x * (1 - mezcla);
    const vy = dirCentro.y * mezcla + dir.y * (1 - mezcla);
    const vz = dirCentro.z * mezcla + dir.z * (1 - mezcla);
    const norma = Math.hypot(vx, vy, vz) || 1;
    const radioBlob = RADIO_BASE * 0.24;
    const base = (OFFSET_MOTORA + i) * 3;
    posiciones[base] = (vx / norma) * radioBlob + centroMotora.x * RADIO_BASE * 0.86;
    posiciones[base + 1] = (vy / norma) * radioBlob + centroMotora.y * RADIO_BASE * 0.86;
    posiciones[base + 2] = (vz / norma) * radioBlob + centroMotora.z * RADIO_BASE * 0.86;

    colores[base] = COLOR_NUCLEO.r;
    colores[base + 1] = COLOR_NUCLEO.g;
    colores[base + 2] = COLOR_NUCLEO.b;
    tamanos[OFFSET_MOTORA + i] = 2.6;
  }

  // ---- Halo (comparación Stockfish) — cascarón alrededor de la corteza motora ----
  for (let i = 0; i < CANTIDAD_HALO; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_HALO);
    const radioBlob = RADIO_BASE * 0.36;
    const base = (OFFSET_HALO + i) * 3;
    posiciones[base] = dir.x * radioBlob + centroMotora.x * RADIO_BASE * 0.86;
    posiciones[base + 1] = dir.y * radioBlob + centroMotora.y * RADIO_BASE * 0.86;
    posiciones[base + 2] = dir.z * radioBlob + centroMotora.z * RADIO_BASE * 0.86;

    colores[base] = 0;
    colores[base + 1] = 0;
    colores[base + 2] = 0;
    tamanos[OFFSET_HALO + i] = 3.2;
  }

  // ---- Núcleo (relleno ambiental, solo da volumen — no representa un dato específico) ----
  for (let i = 0; i < CANTIDAD_NUCLEO; i++) {
    const dir = direccionFibonacci(i, CANTIDAD_NUCLEO);
    const forma = anisotropiaCerebro(dir.x, dir.y, dir.z);
    // Distribución uniforme en volumen (no solo cáscara): radio ~ cbrt(random).
    const radioRel = Math.cbrt(Math.random()) * 0.55;
    const base = (OFFSET_NUCLEO + i) * 3;
    posiciones[base] = aplicarFisura(forma.x * RADIO_BASE * radioRel);
    posiciones[base + 1] = forma.y * RADIO_BASE * radioRel;
    posiciones[base + 2] = forma.z * RADIO_BASE * radioRel;

    colores[base] = COLOR_NUCLEO.r * 0.5;
    colores[base + 1] = COLOR_NUCLEO.g * 0.5;
    colores[base + 2] = COLOR_NUCLEO.b * 0.5;
    tamanos[OFFSET_NUCLEO + i] = 1.5;
  }

  return { ruido, posiciones, colores, tamanos, casillaPorParticula, bloquePorParticula };
}

/** Mezcla un color base con un color de dato real según una intensidad 0..1. */
function mezclarColor(destino, base, dato, intensidad) {
  destino.copy(base).lerp(dato, THREE.MathUtils.clamp(intensidad, 0, 1));
}

export default function CerebroNeuronal({
  saliencia,
  atencionPorBloque,
  jugadaElegida,
  probabilidadTop1 = 0,
  diferenciaCp = 0,
  analizando = false,
  // Modo compacto: mismo sistema de partículas y mismos datos reales, solo un
  // encuadre de cámara más cerrado para caber bien en una tarjeta chica (ej. la
  // miniatura dentro de Sala de Control) — no cambia la cantidad de partículas.
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

    const anatomia = construirAnatomia();
    const { ruido, posiciones, casillaPorParticula, bloquePorParticula } = anatomia;

    const geometria = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(anatomia.posiciones.slice(), 3);
    const colorAttr = new THREE.BufferAttribute(anatomia.colores, 3);
    const sizeAttr = new THREE.BufferAttribute(anatomia.tamanos, 1);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    geometria.setAttribute('position', posAttr);
    geometria.setAttribute('aColor', colorAttr);
    geometria.setAttribute('aSize', sizeAttr);

    const material = crearMaterialParticulasBrillantes({ atenuacion: 950 });
    const puntos = new THREE.Points(geometria, material);
    const grupo = new THREE.Group();
    grupo.add(puntos);

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

    // Arreglos de trabajo (JS-side, no van a GPU directamente): color/tamaño OBJETIVO
    // por partícula, recalculados cuando cambian los props reales.
    const colorObjetivo = new Float32Array(TOTAL_PARTICULAS * 3);
    const tamObjetivo = new Float32Array(TOTAL_PARTICULAS);
    const colorPos = new THREE.Color();

    function recalcularObjetivoDatos() {
      const { saliencia: sal, atencionPorBloque: atn, jugadaElegida: jug, probabilidadTop1: prob, diferenciaCp: diff } =
        propsRef.current;
      const salienciaSegura = Array.isArray(sal) && sal.length === 64 ? sal : new Array(64).fill(0);
      const atencionSegura = Array.isArray(atn) ? atn : [];

      // Corteza: cada partícula toma el valor real de saliencia de su casilla.
      for (let i = 0; i < CANTIDAD_CORTEX; i++) {
        const valor = salienciaSegura[casillaPorParticula[i]] ?? 0;
        mezclarColor(colorPos, COLOR_NUCLEO, COLOR_SALIENCIA, valor);
        const base = (OFFSET_CORTEX + i) * 3;
        colorObjetivo[base] = colorPos.r;
        colorObjetivo[base + 1] = colorPos.g;
        colorObjetivo[base + 2] = colorPos.b;
        tamObjetivo[OFFSET_CORTEX + i] = 1.7 + valor * 3.2;
      }

      // Atención por bloque: si el checkpoint no tiene bloques SE, `atencionSegura` viene
      // vacío — se oculta la capa entera (intensidad 0) en vez de inventar un valor.
      for (let i = 0; i < CANTIDAD_ATENCION; i++) {
        const bloque = bloquePorParticula[i];
        const valor = atencionSegura[bloque] ?? 0;
        mezclarColor(colorPos, COLOR_NUCLEO, COLOR_ATENCION, valor);
        const base = (OFFSET_ATENCION + i) * 3;
        colorObjetivo[base] = colorPos.r;
        colorObjetivo[base + 1] = colorPos.g;
        colorObjetivo[base + 2] = colorPos.b;
        tamObjetivo[OFFSET_ATENCION + i] = 1.6 + valor * 3.2;
      }

      // Corteza motora: intensidad = confianza de la jugada elegida (0 si todavía no hay jugada).
      const intensidadMotora = jug ? THREE.MathUtils.clamp(prob, 0.08, 1) : 0;
      mezclarColor(colorPos, COLOR_NUCLEO, COLOR_MOTORA, intensidadMotora);
      for (let i = 0; i < CANTIDAD_MOTORA; i++) {
        const base = (OFFSET_MOTORA + i) * 3;
        colorObjetivo[base] = colorPos.r;
        colorObjetivo[base + 1] = colorPos.g;
        colorObjetivo[base + 2] = colorPos.b;
        tamObjetivo[OFFSET_MOTORA + i] = 1.4 + intensidadMotora * 4.2;
      }

      // Halo: referencia de calidad vs Stockfish — nunca decide la jugada, solo compara.
      // diff ~0 -> casi invisible; diff grande -> halo ámbar más intenso.
      const intensidadHalo = jug ? THREE.MathUtils.clamp(Math.abs(diff ?? 0) / 150, 0, 1) : 0;
      mezclarColor(colorPos, new THREE.Color(0x000000), COLOR_STOCKFISH, intensidadHalo);
      for (let i = 0; i < CANTIDAD_HALO; i++) {
        const base = (OFFSET_HALO + i) * 3;
        colorObjetivo[base] = colorPos.r;
        colorObjetivo[base + 1] = colorPos.g;
        colorObjetivo[base + 2] = colorPos.b;
        tamObjetivo[OFFSET_HALO + i] = 1.2 + intensidadHalo * 3.6;
      }

      // Núcleo: siempre un resplandor ambiental tenue y fijo (da volumen, no representa un dato puntual).
      for (let i = 0; i < CANTIDAD_NUCLEO; i++) {
        const base = (OFFSET_NUCLEO + i) * 3;
        colorObjetivo[base] = COLOR_NUCLEO.r * 0.55;
        colorObjetivo[base + 1] = COLOR_NUCLEO.g * 0.55;
        colorObjetivo[base + 2] = COLOR_NUCLEO.b * 0.55;
        tamObjetivo[OFFSET_NUCLEO + i] = 1.3;
      }
    }
    recalcularObjetivoDatos();

    const sim = { ultimoAnalizando: propsRef.current.analizando };

    const clock = new THREE.Clock();
    let idAnimacion;

    function actualizarDrift(tiempo, delta) {
      const posArr = posAttr.array;
      const amplitud = prefiereMenosMovimiento ? 0 : 5.5;
      for (let i = 0; i < TOTAL_PARTICULAS; i++) {
        const base = i * 3;
        const bx = posiciones[base];
        const by = posiciones[base + 1];
        const bz = posiciones[base + 2];
        const n = ruido.noise4d(bx * 0.012, by * 0.012, bz * 0.012, tiempo * 0.35);
        const objetivoX = bx + n * amplitud;
        const objetivoY = by + Math.cos(n * 3.1) * amplitud * 0.6;
        const objetivoZ = bz + Math.sin(n * 2.4) * amplitud;
        posArr[base] = THREE.MathUtils.lerp(posArr[base], objetivoX, 1 - Math.exp(-VELOCIDAD_POSICION * delta));
        posArr[base + 1] = THREE.MathUtils.lerp(posArr[base + 1], objetivoY, 1 - Math.exp(-VELOCIDAD_POSICION * delta));
        posArr[base + 2] = THREE.MathUtils.lerp(posArr[base + 2], objetivoZ, 1 - Math.exp(-VELOCIDAD_POSICION * delta));
      }
      posAttr.needsUpdate = true;

      const colorArr = colorAttr.array;
      const sizeArr = sizeAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_TRANSICION * delta);
      for (let i = 0; i < TOTAL_PARTICULAS; i++) {
        const base = i * 3;
        colorArr[base] = THREE.MathUtils.lerp(colorArr[base], COLOR_ANALIZANDO.r * 0.85, factor);
        colorArr[base + 1] = THREE.MathUtils.lerp(colorArr[base + 1], COLOR_ANALIZANDO.g * 0.85, factor);
        colorArr[base + 2] = THREE.MathUtils.lerp(colorArr[base + 2], COLOR_ANALIZANDO.b * 0.85, factor);
        sizeArr[i] = THREE.MathUtils.lerp(sizeArr[i], 1.9, factor);
      }
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    function asentarPosiciones(delta) {
      const posArr = posAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_POSICION * delta);
      for (let i = 0; i < TOTAL_PARTICULAS; i++) {
        const base = i * 3;
        posArr[base] = THREE.MathUtils.lerp(posArr[base], posiciones[base], factor);
        posArr[base + 1] = THREE.MathUtils.lerp(posArr[base + 1], posiciones[base + 1], factor);
        posArr[base + 2] = THREE.MathUtils.lerp(posArr[base + 2], posiciones[base + 2], factor);
      }
      posAttr.needsUpdate = true;
    }

    function lerpHaciaObjetivo(delta) {
      const colorArr = colorAttr.array;
      const sizeArr = sizeAttr.array;
      const factor = 1 - Math.exp(-VELOCIDAD_TRANSICION * delta);
      for (let i = 0; i < TOTAL_PARTICULAS; i++) {
        const base = i * 3;
        colorArr[base] = THREE.MathUtils.lerp(colorArr[base], colorObjetivo[base], factor);
        colorArr[base + 1] = THREE.MathUtils.lerp(colorArr[base + 1], colorObjetivo[base + 1], factor);
        colorArr[base + 2] = THREE.MathUtils.lerp(colorArr[base + 2], colorObjetivo[base + 2], factor);
        sizeArr[i] = THREE.MathUtils.lerp(sizeArr[i], tamObjetivo[i], factor);
      }
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    function actualizarPulsoMotora(tiempo) {
      const { jugadaElegida: jug, probabilidadTop1: prob } = propsRef.current;
      if (!jug) return;
      const pulso = 0.85 + Math.sin(tiempo * 2.4) * 0.15 * THREE.MathUtils.clamp(prob, 0, 1);
      const sizeArr = sizeAttr.array;
      for (let i = 0; i < CANTIDAD_MOTORA; i++) {
        sizeArr[OFFSET_MOTORA + i] = tamObjetivo[OFFSET_MOTORA + i] * pulso;
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
        actualizarDrift(tiempo, delta);
      } else {
        const distanciaPos = asentarPosiciones(delta);
        const distanciaColor = lerpHaciaObjetivo(delta);
        actualizarPulsoMotora(tiempo);
        // Cuando ya convergió, se podría dejar de escribir cada frame — se mantiene simple
        // y el costo de escribir estos arreglos ya es bajo para este volumen de partículas.
        void distanciaPos;
        void distanciaColor;
      }

      renderer.render(scene, camera);
    }
    animar();

    return () => {
      cancelAnimationFrame(idAnimacion);
      resizeObserver.disconnect();
      controls.dispose();
      geometria.dispose();
      material.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // Se remonta solo si cambia `compacto` (encuadre de cámara); el resto de los props
    // se lee en vivo desde `propsRef` dentro del loop para no reconstruir la escena
    // entera en cada inferencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compacto]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" aria-hidden="true" />;
}
