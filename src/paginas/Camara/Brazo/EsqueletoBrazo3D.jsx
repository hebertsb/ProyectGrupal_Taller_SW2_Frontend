import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { esqueletoDelBrazo, LARGO_CUERPO_PINZA, LARGO_PINZA_DEFECTO } from './esqueleto';

// Cámaras predefinidas (metros, z hacia arriba). `objetivo` es el punto al que mira.
export const VISTAS_3D = {
  iso: { etiqueta: '3D', posicion: [1.5, -1.5, 1.1], objetivo: [0.2, 0, 0.5] },
  lateral: { etiqueta: 'Lateral', posicion: [0.2, -2.6, 0.6], objetivo: [0.2, 0, 0.55] },
  frente: { etiqueta: 'Frente', posicion: [2.6, 0, 0.6], objetivo: [0.2, 0, 0.55] },
  arriba: { etiqueta: 'Arriba', posicion: [0.2, -0.05, 2.7], objetivo: [0.2, 0, 0] },
};
// Como el CR5 real: eslabones blancos gruesos y articulaciones con discos azules. Medidas (m) a ojo, de la foto del brazo.
const COLOR = { eslabon: 0xf1f5f9, junta: 0x60a5fa, elegida: 0xfbbf24, dedo: 0x1e293b, cuerpo: 0x475569, placa: 0x94a3b8 };
const COLOR_INVALIDA = 0xf87171;
const CANTIDAD_ESLABONES = 8; // base, carcasa del hombro, brazo, carcasa del codo, antebrazo, carcasa de la muñeca y dos eslabones de la muñeca (ver `segmentos`)
const DISCOS = [
  { radio: 0.075, ancho: 0.12 },
  { radio: 0.07, ancho: 0.13 },
  { radio: 0.065, ancho: 0.11 },
  { radio: 0.052, ancho: 0.09 },
  { radio: 0.045, ancho: 0.09 },
  { radio: 0.04, ancho: 0.07 },
];
const Y = new THREE.Vector3(0, 1, 0);

function cilindro(radio, material) {
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 24), material);
  malla.frustumCulled = false;
  return malla;
}

/** Coloca un cilindro entre los puntos `a` y `b` con ese radio (la geometría es de radio 1). */
function unir(malla, a, b, radio) {
  const desde = new THREE.Vector3(...a);
  const direccion = new THREE.Vector3(...b).sub(desde);
  const largo = direccion.length();
  malla.position.copy(desde).addScaledVector(direccion, 0.5);
  malla.scale.set(radio, Math.max(largo, 1e-4), radio);
  if (largo > 1e-6) malla.quaternion.setFromUnitVectors(Y, direccion.normalize());
}

/**
 * Esqueleto del brazo en 3D, en un solo canvas: se gira con el mouse o el dedo, se acerca con la rueda y se elige una articulación tocando su
 * disco. `angulos` son J1 a J6 en grados, `apertura` la de la pinza (0 a 1000) y `largoPinza` la distancia de la brida a la punta de los dedos (m).
 * Con `invalida` el brazo se pinta de rojo (pose imposible).
 */
export default function EsqueletoBrazo3D({ angulos, apertura = 1000, seleccionada = null, onSeleccionar, vista = 'iso', invalida = false, largoPinza = LARGO_PINZA_DEFECTO }) {
  const contenedor = useRef(null);
  const escena = useRef(null);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;

  useEffect(() => {
    const el = contenedor.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 30);
    camera.up.set(0, 0, 1);
    const controles = new OrbitControls(camera, renderer.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.12;
    controles.minDistance = 0.6;
    controles.maxDistance = 6;

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const luz = new THREE.DirectionalLight(0xffffff, 1.6);
    luz.position.set(1, -1.5, 2.5);
    scene.add(luz);
    const grilla = new THREE.GridHelper(2.4, 24, 0x64748b, 0x334155);
    grilla.rotation.x = Math.PI / 2;
    scene.add(grilla);
    scene.add(new THREE.AxesHelper(0.2));

    const materiales = Object.fromEntries(Object.entries(COLOR).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })]));
    const placa = cilindro(0.11, materiales.placa); // la placa de la base, apoyada en la mesa
    placa.rotation.x = Math.PI / 2;
    placa.scale.set(1, 0.02, 1);
    placa.position.set(0, 0, 0.01);
    scene.add(placa);
    const eslabones = Array.from({ length: CANTIDAD_ESLABONES }, () => cilindro(1, materiales.eslabon));
    const juntas = DISCOS.map((d, i) => {
      const disco = cilindro(d.radio, materiales.junta);
      disco.userData.indice = i;
      return disco;
    });
    // La pinza: un cuerpo y dos dedos cuadrados (cajas) que se mueven con la brida.
    const caja = (material) => {
      const malla = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      malla.matrixAutoUpdate = false;
      malla.frustumCulled = false;
      return malla;
    };
    const cuerpoPinza = caja(materiales.cuerpo);
    const dedos = [caja(materiales.dedo), caja(materiales.dedo)];
    [...eslabones, ...juntas, cuerpoPinza, ...dedos].forEach((o) => scene.add(o));

    const aplicar = (grados, abierta, elegida, roja, largo) => {
      const e = esqueletoDelBrazo(grados, abierta, largo);
      materiales.eslabon.color.setHex(roja ? COLOR_INVALIDA : COLOR.eslabon);
      e.segmentos.forEach(([desde, hasta, radio], i) => unir(eslabones[i], desde, hasta, radio));
      juntas.forEach((disco, i) => {
        disco.position.set(...e.articulaciones[i + 1]);
        disco.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...e.ejes[i]).normalize());
        disco.scale.set(i === elegida ? 1.12 : 1, DISCOS[i].ancho * (i === elegida ? 1.15 : 1), i === elegida ? 1.12 : 1);
        disco.material = i === elegida ? materiales.elegida : materiales.junta;
      });
      const base = new THREE.Matrix4().makeBasis(new THREE.Vector3(...e.marco.x), new THREE.Vector3(...e.marco.y), new THREE.Vector3(...e.marco.z));
      base.setPosition(...e.marco.origen);
      const colocar = (malla, centro, tamano) => {
        malla.matrix.copy(base).multiply(new THREE.Matrix4().makeTranslation(...centro)).multiply(new THREE.Matrix4().makeScale(...tamano));
        malla.matrixWorldNeedsUpdate = true;
      };
      const largoDedo = Math.max(0.02, largo - LARGO_CUERPO_PINZA);
      colocar(cuerpoPinza, [0, 0, LARGO_CUERPO_PINZA / 2], [0.07, 0.04, LARGO_CUERPO_PINZA]);
      colocar(dedos[0], [-e.separacion, 0, LARGO_CUERPO_PINZA + largoDedo / 2], [0.012, 0.024, largoDedo]);
      colocar(dedos[1], [e.separacion, 0, LARGO_CUERPO_PINZA + largoDedo / 2], [0.012, 0.024, largoDedo]);
    };

    const mirar = (nombre) => {
      const v = VISTAS_3D[nombre] ?? VISTAS_3D.iso;
      camera.position.set(...v.posicion);
      controles.target.set(...v.objetivo);
      controles.update();
    };

    const ajustar = () => {
      const ancho = el.clientWidth || 1;
      const alto = el.clientHeight || 1;
      renderer.setSize(ancho, alto);
      camera.aspect = ancho / alto;
      camera.updateProjectionMatrix();
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();

    // Un toque o clic corto (sin arrastrar) sobre un disco elige esa articulación.
    const rayo = new THREE.Raycaster();
    let inicio = null;
    const alBajar = (e) => {
      inicio = [e.clientX, e.clientY];
    };
    const alSubir = (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 5) return;
      const caja = renderer.domElement.getBoundingClientRect();
      rayo.setFromCamera(new THREE.Vector2(((e.clientX - caja.left) / caja.width) * 2 - 1, -((e.clientY - caja.top) / caja.height) * 2 + 1), camera);
      const golpe = rayo.intersectObjects(juntas)[0];
      if (golpe) alSeleccionar.current?.(golpe.object.userData.indice);
    };
    renderer.domElement.addEventListener('pointerdown', alBajar);
    renderer.domElement.addEventListener('pointerup', alSubir);

    renderer.setAnimationLoop(() => {
      controles.update();
      renderer.render(scene, camera);
    });

    escena.current = { aplicar, mirar };
    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', alBajar);
      renderer.domElement.removeEventListener('pointerup', alSubir);
      observador.disconnect();
      controles.dispose();
      scene.traverse((o) => o.geometry?.dispose());
      Object.values(materiales).forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      escena.current = null;
    };
  }, []);

  useEffect(() => {
    escena.current?.aplicar(angulos, apertura, seleccionada, invalida, largoPinza);
  }, [angulos, apertura, seleccionada, invalida, largoPinza]);

  useEffect(() => {
    escena.current?.mirar(vista);
  }, [vista]);

  return <div ref={contenedor} className="w-full h-full" role="img" aria-label="Esqueleto 3D del brazo robótico" />;
}
