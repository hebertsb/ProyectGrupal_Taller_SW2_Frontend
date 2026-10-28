/**
 * Escena 3D de la landing: un Dobot CR5 estilizado que toma el peón de e7 y lo deja en e5, en un ciclo de 8 s.
 * Es solo una ilustración (no lee el estado del brazo real). Avisa con `alCambiarFase` en qué tramo del ciclo está
 * para que la landing muestre el chip de estado sincronizado.
 *
 * `pedidoCamara` y `pedidoJugada` son contadores: cada vez que suben se cambia el ángulo de la cámara o se reinicia la jugada.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CICLO_S = 8;
// Ángulos de cámara que se recorren con «Perspectiva 3D».
const CAMARAS = [
  [0, 16, 24],
  [16, 13, 18],
  [-16, 13, 18],
  [0, 26, 8],
];

export function faseDelCiclo(t) {
  if (t < 1.5) return 'pensando';
  if (t < 3.4) return 'agarre';
  if (t < 5.8) return 'trayectoria';
  return 'realizada';
}

export default function EscenaBrazoAjedrez({ alCambiarFase, pedidoCamara = 0, pedidoJugada = 0 }) {
  const contenedorRef = useRef(null);
  const controlRef = useRef({ camara: () => {}, reiniciar: () => {} });
  const alCambiarFaseRef = useRef(alCambiarFase);
  alCambiarFaseRef.current = alCambiarFase;

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ancho = contenedor.clientWidth || 360;
    const alto = contenedor.clientHeight || 320;
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(40, ancho / alto, 0.1, 1000);
    const objetivoCamara = new THREE.Vector3(...CAMARAS[0]);
    camara.position.copy(objetivoCamara);
    camara.lookAt(0, 1.6, 0.2);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return undefined; // sin WebGL: queda el fondo del contenedor
    }
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    contenedor.appendChild(renderer.domElement);

    // Desde r155 las luces son físicas: se multiplican por π y sin caída para conservar el brillo del diseño original.
    escena.add(new THREE.AmbientLight(0xffffff, 0.95 * Math.PI));
    const luzAzul = new THREE.PointLight(0x00d2ff, 4 * Math.PI, 50, 0);
    luzAzul.position.set(-14, 18, 14);
    escena.add(luzAzul);
    const luzVerde = new THREE.PointLight(0x00e676, 4.5 * Math.PI, 50, 0);
    luzVerde.position.set(14, 18, -8);
    escena.add(luzVerde);
    const luzCenital = new THREE.DirectionalLight(0xffffff, 1.2 * Math.PI);
    luzCenital.position.set(0, 25, 5);
    escena.add(luzCenital);

    const grupo = new THREE.Group();
    escena.add(grupo);

    // --- Tablero ---
    const casilla = 1.6;
    const desfase = (8 * casilla) / 2 - casilla / 2;
    const matOscura = new THREE.MeshPhongMaterial({ color: 0x060f1b, emissive: 0x02162a, specular: 0x00d2ff, shininess: 45 });
    const matClara = new THREE.MeshPhongMaterial({ color: 0x0b2133, emissive: 0x003328, specular: 0x00e676, shininess: 60 });

    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(8 * casilla + 1.4, 0.6, 8 * casilla + 1.4),
      new THREE.MeshPhongMaterial({ color: 0x03070f, specular: 0x00d2ff, shininess: 30 }),
    );
    pedestal.position.y = -0.31;
    grupo.add(pedestal);

    const borde = new THREE.Mesh(
      new THREE.BoxGeometry(8 * casilla + 0.35, 0.08, 8 * casilla + 0.35),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true }),
    );
    borde.position.y = 0.02;
    grupo.add(borde);

    const geoCasilla = new THREE.BoxGeometry(casilla * 0.94, 0.2, casilla * 0.94);
    for (let f = 0; f < 8; f++) {
      for (let c = 0; c < 8; c++) {
        const malla = new THREE.Mesh(geoCasilla, (f + c) % 2 === 1 ? matOscura : matClara);
        malla.position.set(c * casilla - desfase, 0, f * casilla - desfase);
        grupo.add(malla);
      }
    }

    // --- Piezas ---
    const matDorada = new THREE.MeshPhongMaterial({ color: 0xf5b700, emissive: 0x3a2800, specular: 0xffea88, shininess: 90 });
    const matNegra = new THREE.MeshPhongMaterial({ color: 0x111c29, emissive: 0x021122, specular: 0x00d2ff, shininess: 85 });

    function peon(material) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.3, 16), material);
      base.position.y = 0.15;
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.7, 16), material);
      cuerpo.position.y = 0.6;
      const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 16), material);
      anillo.rotation.x = Math.PI / 2;
      anillo.position.y = 0.95;
      const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), material);
      cabeza.position.y = 1.25;
      g.add(base, cuerpo, anillo, cabeza);
      return g;
    }

    function caballo(material) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.35, 16), material);
      base.position.y = 0.17;
      const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.55), material);
      cabeza.position.set(0, 0.85, 0.1);
      cabeza.rotation.x = -0.28;
      const hocico = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.42), material);
      hocico.position.set(0, 0.95, 0.42);
      g.add(base, cabeza, hocico);
      return g;
    }

    [
      { f: 1, c: 1, tipo: peon, mat: matNegra },
      { f: 1, c: 2, tipo: peon, mat: matNegra },
      { f: 1, c: 5, tipo: peon, mat: matNegra },
      { f: 0, c: 1, tipo: caballo, mat: matNegra },
      { f: 0, c: 6, tipo: caballo, mat: matNegra },
      { f: 6, c: 1, tipo: peon, mat: matDorada },
      { f: 6, c: 2, tipo: peon, mat: matDorada },
      { f: 6, c: 6, tipo: peon, mat: matDorada },
      { f: 7, c: 6, tipo: caballo, mat: matDorada },
      { f: 4, c: 2, tipo: caballo, mat: matNegra },
    ].forEach(({ f, c, tipo, mat }) => {
      const pieza = tipo(mat);
      pieza.position.set(c * casilla - desfase, 0.1, f * casilla - desfase);
      grupo.add(pieza);
    });

    const peonMovido = peon(matDorada);
    grupo.add(peonMovido);
    const origen = new THREE.Vector3(4 * casilla - desfase, 0.1, 6 * casilla - desfase);
    const destino = new THREE.Vector3(4 * casilla - desfase, 0.1, 4 * casilla - desfase);

    const anilloDestino = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0x00e676, side: THREE.DoubleSide }),
    );
    anilloDestino.rotation.x = -Math.PI / 2;
    anilloDestino.position.set(destino.x, 0.12, destino.z);
    const anilloOrigen = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.68, 32),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide }),
    );
    anilloOrigen.rotation.x = -Math.PI / 2;
    anilloOrigen.position.set(origen.x, 0.12, origen.z);
    grupo.add(anilloDestino, anilloOrigen);

    const puntosArco = [];
    for (let i = 0; i <= 30; i++) {
      const k = i / 30;
      puntosArco.push(new THREE.Vector3(
        THREE.MathUtils.lerp(origen.x, destino.x, k),
        0.2 + Math.sin(k * Math.PI) * 2.2,
        THREE.MathUtils.lerp(origen.z, destino.z, k),
      ));
    }
    grupo.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(puntosArco),
      new THREE.LineBasicMaterial({ color: 0x00e676 }),
    ));

    // --- Brazo Dobot CR5 ---
    const matBlanco = new THREE.MeshPhongMaterial({ color: 0xf2f6fa, specular: 0xffffff, shininess: 90 });
    const matJunta = new THREE.MeshPhongMaterial({ color: 0x1b2432, specular: 0x475569, shininess: 75 });
    const matAzul = new THREE.MeshPhongMaterial({ color: 0x0066d6, emissive: 0x002244 });
    const matCian = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const matLed = new THREE.MeshBasicMaterial({ color: 0x00e676 });

    const robot = new THREE.Group();
    robot.position.set(0, 0, -desfase - 1.8);
    grupo.add(robot);

    const brida = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 0.55, 32), matJunta);
    brida.position.y = 0.28;
    const anilloBase = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.045, 8, 32), matCian);
    anilloBase.rotation.x = Math.PI / 2;
    anilloBase.position.y = 0.55;
    robot.add(brida, anilloBase);

    const torreta = new THREE.Group();
    torreta.position.y = 0.58;
    robot.add(torreta);
    const torretaMalla = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.95, 24), matBlanco);
    torretaMalla.position.y = 0.48;
    torreta.add(torretaMalla);

    const hombro = new THREE.Group();
    hombro.position.set(0, 0.95, 0);
    torreta.add(hombro);
    const tamborHombro = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.35, 20), matJunta);
    tamborHombro.rotation.z = Math.PI / 2;
    tamborHombro.position.y = 0.35;
    hombro.add(tamborHombro);

    const brazo = new THREE.Group();
    brazo.position.set(0, 0.35, 0);
    hombro.add(brazo);
    const brazoMalla = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 4.2, 20), matBlanco);
    brazoMalla.position.y = 2.1;
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.52, 1.2, 20), matAzul);
    banda.position.y = 2.1;
    brazo.add(brazoMalla, banda);

    const codo = new THREE.Group();
    codo.position.set(0, 4.1, 0);
    brazo.add(codo);
    const tamborCodo = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.1, 20), matJunta);
    tamborCodo.rotation.z = Math.PI / 2;
    codo.add(tamborCodo);

    const antebrazo = new THREE.Group();
    codo.add(antebrazo);
    const antebrazoMalla = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 3.8, 20), matBlanco);
    antebrazoMalla.position.y = 1.9;
    antebrazo.add(antebrazoMalla);

    const muneca = new THREE.Group();
    muneca.position.set(0, 3.7, 0);
    antebrazo.add(muneca);
    muneca.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.5, 16), matJunta));
    const basePinza = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.85), matJunta);
    basePinza.position.y = -0.45;
    const camaraCaja = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.42), matBlanco);
    camaraCaja.position.set(0.46, -0.45, 0.2);
    const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16), matCian);
    lente.rotation.x = Math.PI / 2;
    lente.position.set(0.46, -0.45, 0.42);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), matLed);
    led.position.set(0, -0.45, 0.45);
    muneca.add(basePinza, camaraCaja, lente, led);

    const matDedo = new THREE.MeshPhongMaterial({ color: 0xd3dce6, specular: 0xffffff, shininess: 80 });
    const geoDedo = new THREE.BoxGeometry(0.12, 0.85, 0.24);
    const dedoIzq = new THREE.Group();
    dedoIzq.position.set(-0.35, -0.8, 0);
    const dedoDer = new THREE.Group();
    dedoDer.position.set(0.35, -0.8, 0);
    [dedoIzq, dedoDer].forEach((dedo) => {
      const barra = new THREE.Mesh(geoDedo, matDedo);
      barra.position.y = -0.4;
      dedo.add(barra);
      muneca.add(dedo);
    });

    // --- Animación ---
    const reloj = new THREE.Clock();
    let desfaseCiclo = 0;
    let faseAnterior = null;
    let idFrame = 0;
    let visible = true;

    function pose(t) {
      let apertura = 0.36;
      const pos = new THREE.Vector3(origen.x, 0.1, origen.z);
      if (t < 1.5) {
        torreta.rotation.y = 0.26 + Math.sin(t * 2.5) * 0.02;
        brazo.rotation.x = 0.95;
        antebrazo.rotation.x = -1.45;
        muneca.rotation.x = 0.5;
        matLed.color.setHex(0x00d2ff);
      } else if (t < 2.6) {
        const p = (t - 1.5) / 1.1;
        torreta.rotation.y = 0.26;
        brazo.rotation.x = 0.95 + p * 0.35;
        antebrazo.rotation.x = -1.45 - p * 0.28;
        muneca.rotation.x = 0.5 - p * 0.07;
        apertura = 0.36 - p * 0.08;
        matLed.color.setHex(0xf5b700);
      } else if (t < 3.4) {
        const p = (t - 2.6) / 0.8;
        torreta.rotation.y = 0.26;
        brazo.rotation.x = 1.3 - p * 0.35;
        antebrazo.rotation.x = -1.73 + p * 0.28;
        muneca.rotation.x = 0.43 + p * 0.07;
        apertura = 0.24;
        pos.y = 0.1 + p * 1.6;
        matLed.color.setHex(0x00e676);
      } else if (t < 5.8) {
        const p = (t - 3.4) / 2.4;
        const s = 0.5 - 0.5 * Math.cos(p * Math.PI);
        torreta.rotation.y = THREE.MathUtils.lerp(0.26, -0.18, s);
        brazo.rotation.x = 0.95 + Math.sin(s * Math.PI) * 0.18;
        antebrazo.rotation.x = -1.45;
        muneca.rotation.x = 0.5;
        apertura = 0.24;
        pos.set(
          THREE.MathUtils.lerp(origen.x, destino.x, s),
          Math.sin(s * Math.PI) * 2.2 + 1.2,
          THREE.MathUtils.lerp(origen.z, destino.z, s),
        );
        matLed.color.setHex(0x00e676);
      } else if (t < 6.8) {
        const p = (t - 5.8) / 1.0;
        torreta.rotation.y = -0.18;
        brazo.rotation.x = 0.95 + p * 0.32;
        antebrazo.rotation.x = -1.45 - p * 0.25;
        muneca.rotation.x = 0.5 - p * 0.07;
        apertura = 0.24 + p * 0.06;
        pos.set(destino.x, Math.max(0.1, 1.2 - p * 1.1), destino.z);
        matLed.color.setHex(0x00e676);
      } else {
        const p = (t - 6.8) / 1.2;
        torreta.rotation.y = -0.18 + p * 0.44;
        brazo.rotation.x = 1.27 - p * 0.32;
        antebrazo.rotation.x = -1.7 + p * 0.25;
        muneca.rotation.x = 0.43 + p * 0.07;
        pos.set(destino.x, 0.1, destino.z);
        matLed.color.setHex(0x00d2ff);
      }
      dedoIzq.position.x = -apertura;
      dedoDer.position.x = apertura;
      peonMovido.position.copy(pos);
    }

    function dibujar() {
      const transcurrido = reloj.getElapsedTime();
      const t = (((transcurrido - desfaseCiclo) % CICLO_S) + CICLO_S) % CICLO_S;
      grupo.rotation.y = Math.sin(transcurrido * 0.2) * 0.06;
      grupo.rotation.x = Math.sin(transcurrido * 0.15) * 0.025;
      pose(t);
      anilloDestino.scale.setScalar(1 + Math.sin(transcurrido * 4.5) * 0.12);
      anilloOrigen.scale.setScalar(1 + Math.cos(transcurrido * 4.5) * 0.12);
      camara.position.lerp(objetivoCamara, 0.06);
      camara.lookAt(0, 1.6, 0.2);
      renderer.render(escena, camara);

      const fase = faseDelCiclo(t);
      if (fase !== faseAnterior) {
        faseAnterior = fase;
        alCambiarFaseRef.current?.(fase);
      }
    }

    function bucle() {
      idFrame = requestAnimationFrame(bucle);
      if (visible) dibujar();
    }

    if (sinMovimiento) {
      // Con movimiento reducido se dibuja la jugada ya hecha, quieta.
      pose(7.5);
      renderer.render(escena, camara);
      alCambiarFaseRef.current?.('realizada');
    } else {
      bucle();
    }

    controlRef.current = {
      camara: (indice) => {
        objetivoCamara.set(...CAMARAS[indice % CAMARAS.length]);
        if (sinMovimiento) {
          camara.position.copy(objetivoCamara);
          camara.lookAt(0, 1.6, 0.2);
          renderer.render(escena, camara);
        }
      },
      reiniciar: () => {
        // Arranca desde el descenso de la pinza.
        desfaseCiclo = reloj.getElapsedTime() - 1.5;
      },
    };

    const alRedimensionar = () => {
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      if (!w || !h) return;
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (sinMovimiento) renderer.render(escena, camara);
    };
    const observadorTamano = new ResizeObserver(alRedimensionar);
    observadorTamano.observe(contenedor);
    // Fuera de pantalla no se dibuja: ahorra batería en el celular.
    const observadorVista = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
    });
    observadorVista.observe(contenedor);

    return () => {
      cancelAnimationFrame(idFrame);
      observadorTamano.disconnect();
      observadorVista.disconnect();
      escena.traverse((objeto) => {
        if (objeto.geometry) objeto.geometry.dispose();
        if (objeto.material) objeto.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (pedidoCamara > 0) controlRef.current.camara(pedidoCamara);
  }, [pedidoCamara]);

  useEffect(() => {
    if (pedidoJugada > 0) controlRef.current.reiniciar();
  }, [pedidoJugada]);

  return <div ref={contenedorRef} className="w-full h-full" aria-hidden="true" />;
}
