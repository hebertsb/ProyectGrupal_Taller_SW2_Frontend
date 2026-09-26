import * as THREE from 'three';

/**
 * Material compartido para las visualizaciones de "partículas brillantes" (cerebro
 * de Razonamiento Neuronal y avatar del agente) — mismo lenguaje visual en las dos:
 * puntos circulares con caída suave de brillo hacia el borde, tamaño con atenuación
 * por distancia a cámara, y blending aditivo (se suman los brillos al superponerse,
 * como luces reales, en vez de taparse unos a otros).
 *
 * Cada partícula controla su propio color (`aColor`) y tamaño base (`aSize`) vía
 * BufferAttributes — así cada visualización puede recolorear/redimensionar sus
 * partículas por separado sin tocar el material.
 */
const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uAtenuacion;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(aSize, 0.0) * uPixelRatio * (uAtenuacion / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uNucleo;
  varying vec3 vColor;
  void main() {
    float distancia = length(gl_PointCoord - vec2(0.5));
    if (distancia > 0.5) discard;
    // Forma spec-correcta de smoothstep (edge0 < edge1): 1.0 en el núcleo sólido,
    // cae a 0.0 hacia el borde. uNucleo chico = glow grande y difuso (cerebro);
    // uNucleo cerca de 0.5 = punto chico y nítido, con poco halo (avatar).
    float alfa = 1.0 - smoothstep(uNucleo, 0.5, distancia);
    gl_FragColor = vec4(vColor, alfa);
  }
`;

export function crearMaterialParticulasBrillantes({ atenuacion = 900, nucleo = 0.05 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1 },
      uAtenuacion: { value: atenuacion },
      uNucleo: { value: nucleo },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
