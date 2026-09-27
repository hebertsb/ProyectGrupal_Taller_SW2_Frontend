import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

/**
 * `tipo` de `PIEZAS` (frontend) -> nombre de archivo real en
 * `backend/servicios/simulacion/assets/piezas/claro/` (mismo set que ya usa
 * el simulador PyBullet, copiado a `frontend/public/piezas3d/`). El backend
 * llama "reina" al archivo de la dama — es la única que no coincide 1:1, el
 * resto comparte el mismo nombre.
 */
const ARCHIVO_POR_TIPO = {
  rey: 'rey',
  dama: 'reina',
  torre: 'torre',
  alfil: 'alfil',
  caballo: 'caballo',
  peon: 'peon',
};

const RUTA_BASE = '/piezas3d/';
const DURACION_VUELTA_SEGUNDOS = 7; // giro lento a propósito — acompaña, no marea

// Cámara ORTOGRÁFICA a propósito, no perspectiva — con perspectiva el margen
// depende de FOV + distancia + tan(), varias variables que combinadas hacían
// difícil garantizar el resultado sin verlo. Con ortográfica el volumen visible
// se fija directo en las mismas unidades que el tamaño de la pieza.
//
// A diferencia del intento anterior, el frustum NO se calcula a partir del
// aspecto (ancho/alto) del contenedor leído por JS — se deja SIEMPRE
// cuadrado (izq/der = mismo rango que arriba/abajo). El contenedor donde se
// usa este componente es siempre un cuadrado por CSS (ver PanelAprendizaje.jsx,
// clases `w-*/h-*` iguales) — depender encima de una lectura de
// `clientWidth`/`clientHeight` en el momento exacto del montaje (que puede
// leer 0 o un valor transitorio si el contenedor está dentro de un acordeón
// recién abierto) era una fuente de error real que nunca se pudo descartar
// del todo la vez anterior. Fijar el frustum cuadrado elimina esa variable
// de raíz, sin importar qué mida el contenedor en el instante del montaje.
const ALTURA_VISIBLE = 2.3; // alto (y ancho) total de mundo que la cámara muestra, fijo
const DIMENSION_OBJETIVO = 1.9; // alto normalizado de la pieza — 1.9/2.3 ≈ 83% del cuadro
const PISO_Y = -1.05; // base de la pieza; tope queda en -1.05+1.9=0.85 (margen 0.30 arriba, 0.10 abajo)

/** Libera del todo la GPU (geometría, texturas, material) de todo lo que haya dentro del grupo. */
function limpiarGrupo(grupo) {
  for (const hijo of [...grupo.children]) {
    grupo.remove(hijo);
    hijo.traverse((nodo) => {
      if (!nodo.isMesh) return;
      nodo.geometry?.dispose();
      const materiales = Array.isArray(nodo.material) ? nodo.material : [nodo.material];
      for (const material of materiales) {
        if (!material) continue;
        for (const valor of Object.values(material)) {
          if (valor?.isTexture) valor.dispose();
        }
        material.dispose();
      }
    });
  }
}

/**
 * Modelo 3D real de una pieza de ajedrez (OBJ+MTL, el mismo set "claro" que
 * ya usa el simulador PyBullet) girando lento sobre su eje Y — usado en el
 * banner "Aprendé cada pieza" (Panel de Aprendizaje). Reusable: solo
 * necesita `tipo` de pieza.
 *
 * Arquitectura (mismo criterio que ya usan `CerebroNeuronal.jsx` y
 * `AvatarMetaPerson3D.jsx` en este proyecto): el efecto de setup de Three.js
 * (scene/camera/renderer/loop) corre UNA sola vez al montar, con
 * dependencias vacías — nunca se reconstruye por un cambio de prop. Un
 * efecto SEPARADO, con dependencia en `tipo`, carga el modelo nuevo y
 * reemplaza la malla dentro del mismo grupo ya existente, disponiendo la
 * malla anterior antes de agregar la nueva.
 */
export default function PiezaModelo3D({ tipo, pausado = false, className = '' }) {
  const mountRef = useRef(null);
  const grupoRef = useRef(null);
  // El loop de render lee `pausado` en vivo desde un ref (no se reconstruye
  // nada al pausar/reanudar) — mismo patrón que `propsRef` en CerebroNeuronal.jsx.
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  // ===== Efecto de setup — una sola vez, nunca se recrea =====
  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return undefined;

    const prefiereMenosMovimiento =
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const scene = new THREE.Scene();
    // Frustum cuadrado y fijo — ver comentario junto a ALTURA_VISIBLE arriba.
    const camera = new THREE.OrthographicCamera(
      -ALTURA_VISIBLE / 2,
      ALTURA_VISIBLE / 2,
      ALTURA_VISIBLE / 2,
      -ALTURA_VISIBLE / 2,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);

    // Grupo vacío al principio — el efecto de carga (más abajo) le va agregando
    // y sacando la malla real según `tipo`, sin que este efecto se entere.
    const grupo = new THREE.Group();
    scene.add(grupo);
    grupoRef.current = grupo;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const luzPrincipal = new THREE.DirectionalLight(0xffffff, 0.9);
    luzPrincipal.position.set(2.5, 3, 4);
    scene.add(luzPrincipal);
    const luzRelleno = new THREE.DirectionalLight(0xffffff, 0.35);
    luzRelleno.position.set(-3, -1, -2);
    scene.add(luzRelleno);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Tamaño inicial de resolución — se corrige apenas el ResizeObserver dispare
    // (todos los navegadores modernos lo disparan una vez de entrada, con el
    // tamaño real ya asentado). Un valor inicial razonable evita un frame en
    // baja resolución si por lo que sea el observer tardara.
    const anchoInicial = contenedor.clientWidth || 176;
    const altoInicial = contenedor.clientHeight || 176;
    renderer.setSize(anchoInicial, altoInicial);
    // Tamaño VISUAL del canvas siempre al 100% de su contenedor por CSS — el
    // encuadre (frustum cuadrado) ya no depende de esto, solo la nitidez.
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    contenedor.appendChild(renderer.domElement);

    const resizeObserver = new ResizeObserver((entradas) => {
      for (const entrada of entradas) {
        const { width, height } = entrada.contentRect;
        if (width > 0 && height > 0) {
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(contenedor);

    const clock = new THREE.Clock();
    let idAnimacion;
    function animar() {
      idAnimacion = requestAnimationFrame(animar);
      const delta = Math.min(clock.getDelta(), 0.1);
      if (!prefiereMenosMovimiento && !pausadoRef.current) {
        grupo.rotation.y += ((Math.PI * 2) / DURACION_VUELTA_SEGUNDOS) * delta;
      }
      renderer.render(scene, camera);
    }
    animar();

    return () => {
      cancelAnimationFrame(idAnimacion);
      resizeObserver.disconnect();
      limpiarGrupo(grupo); // por si quedó una malla cargada al desmontar
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Efecto de carga de modelo — corre de nuevo solo si cambia `tipo` =====
  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return undefined;

    const archivo = ARCHIVO_POR_TIPO[tipo] ?? tipo;
    let cancelado = false;

    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(RUTA_BASE);
    mtlLoader.load(
      `${archivo}.mtl`,
      (materiales) => {
        if (cancelado) return;
        materiales.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materiales);
        objLoader.setPath(RUTA_BASE);
        objLoader.load(
          `${archivo}.obj`,
          (objeto) => {
            if (cancelado) return;

            // Centrado + escala uniforme por ALTURA (eje Y), no por la dimensión
            // más grande de cada pieza — normalizar por Math.max(x,y,z) hacía que
            // piezas con base más ancha que alta (ej. alfil vs. rey) terminaran con
            // alturas visuales distintas entre sí.
            const bboxOriginal = new THREE.Box3().setFromObject(objeto);
            const tamanoOriginal = new THREE.Vector3();
            bboxOriginal.getSize(tamanoOriginal);
            const alturaReal = tamanoOriginal.y || 1;
            objeto.scale.setScalar(DIMENSION_OBJETIVO / alturaReal);

            // Recalcula el bbox YA escalado (con la matriz puesta al día a mano,
            // porque todavía no pasó por el loop de render) y ubica la pieza según
            // sus extremos reales post-escala, no según un offset calculado ANTES
            // de escalar — ese fue el bug real: el pivote del .obj no está en el
            // centro geométrico (algunos vienen con el pivote en la base), y fijar
            // `position` antes de aplicar `scale` no lo compensa, porque la
            // traducción no se reescala junto con la geometría. Con esto la base
            // de la pieza queda siempre exacto en PISO_Y sin importar dónde venga
            // el pivote de cada modelo.
            objeto.updateMatrixWorld(true);
            const bboxEscalado = new THREE.Box3().setFromObject(objeto);
            const centroEscalado = new THREE.Vector3();
            bboxEscalado.getCenter(centroEscalado);
            objeto.position.x -= centroEscalado.x;
            objeto.position.z -= centroEscalado.z;
            objeto.position.y += PISO_Y - bboxEscalado.min.y;

            // Dispone la malla anterior recién ahora, con la nueva ya lista para
            // reemplazarla — evita un frame en blanco entre una pieza y la siguiente.
            limpiarGrupo(grupo);
            grupo.add(objeto);
          },
          undefined,
          (error) => {
            console.error(`No se pudo cargar el modelo 3D de la pieza "${archivo}".`, error);
          }
        );
      },
      undefined,
      (error) => {
        console.error(`No se pudo cargar el material de la pieza "${archivo}".`, error);
      }
    );

    return () => {
      // Si `tipo` vuelve a cambiar antes de que termine de cargar, la carga en
      // curso se descarta al llegar — nunca agrega una malla vieja/fuera de tiempo
      // encima de la que ya se haya puesto entre medio.
      cancelado = true;
    };
  }, [tipo]);

  // Un solo div real — el que monta el canvas. Nada más se renderiza acá.
  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
