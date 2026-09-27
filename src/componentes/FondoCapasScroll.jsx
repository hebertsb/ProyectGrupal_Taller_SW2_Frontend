import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Fondo ambiente con capas a distintas "profundidades" que se mueven a
 * velocidades distintas al hacer scroll (parallax clásico) — le da vida a
 * una pantalla larga (ej. Panel de Aprendizaje) sin competir con el
 * contenido, que siempre queda arriba (esto renderiza `position: fixed`,
 * detrás de todo, con `pointer-events-none`).
 *
 * Mismo patrón de setup/cleanup de Three.js que `PiezaModelo3D.jsx` — el
 * efecto corre una sola vez, con dependencias vacías. La posición de scroll
 * se lee de un ref actualizado por un listener pasivo, nunca dispara un
 * re-render de React (si no, cada pixel de scroll re-renderizaría el
 * componente entero).
 */
const CAPAS = [
  { radio: 1.9, profundidadZ: -7, colorHex: 0x00e5ff, opacidad: 0.09, factorParallax: 0.12, x: -3.4, yBase: -1 },
  { radio: 1.3, profundidadZ: -4, colorHex: 0x7c4dff, opacidad: 0.11, factorParallax: 0.24, x: 3.1, yBase: 4 },
  { radio: 0.9, profundidadZ: -2, colorHex: 0x00daf3, opacidad: 0.13, factorParallax: 0.42, x: -2.2, yBase: 9 },
  { radio: 1.1, profundidadZ: -5, colorHex: 0xff9100, opacidad: 0.07, factorParallax: 0.18, x: 2.6, yBase: 14 },
];

export default function FondoCapasScroll() {
  const mountRef = useRef(null);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return undefined;

    const prefiereMenosMovimiento =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    contenedor.appendChild(renderer.domElement);

    const mallas = CAPAS.map((capa) => {
      // Esferas grandes y translúcidas, sin luces (MeshBasicMaterial) —
      // funcionan como manchas de luz difusas, no como objetos "sólidos".
      const geometria = new THREE.SphereGeometry(capa.radio, 24, 24);
      const material = new THREE.MeshBasicMaterial({
        color: capa.colorHex,
        transparent: true,
        opacity: capa.opacidad,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const malla = new THREE.Mesh(geometria, material);
      malla.position.set(capa.x, capa.yBase, capa.profundidadZ);
      scene.add(malla);
      return malla;
    });

    function alRedimensionar() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', alRedimensionar);

    // Posición de scroll en un ref, no en estado de React — actualizarla en
    // cada evento de scroll con `setState` re-renderizaría todo el panel en
    // cada pixel scrolleado.
    const scrollActualRef = { valor: window.scrollY };
    function alScrollear() {
      scrollActualRef.valor = window.scrollY;
    }
    window.addEventListener('scroll', alScrollear, { passive: true });

    let idAnimacion;
    function animar() {
      idAnimacion = requestAnimationFrame(animar);
      if (!prefiereMenosMovimiento) {
        const scroll = scrollActualRef.valor;
        mallas.forEach((malla, indice) => {
          const capa = CAPAS[indice];
          // Capas "más lejanas" (factorParallax chico) se mueven menos que
          // las "más cercanas" — esa diferencia de velocidad es lo que da
          // la sensación de profundidad real al scrollear.
          malla.position.y = capa.yBase - (scroll * capa.factorParallax) / 60;
        });
      }
      renderer.render(scene, camera);
    }
    animar();

    return () => {
      cancelAnimationFrame(idAnimacion);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('scroll', alScrollear);
      for (const malla of mallas) {
        malla.geometry.dispose();
        malla.material.dispose();
      }
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    />
  );
}
