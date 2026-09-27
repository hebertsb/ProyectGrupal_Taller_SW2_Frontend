import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fenAMatriz, nombreCasilla } from '../ajedrez';

// Constantes métricas del mundo 3D
const TAM_CASILLA = 0.8;
const ANCHO_TABLERO = TAM_CASILLA * 8; // 6.4
const ALTO_BASE_TABLERO = 0.25;
const LONG_L1 = 3.1; // Brazo Dobot
const LONG_L2 = 2.8; // Antebrazo Dobot

/**
 * Generador procedural de geometrías Staunton para ajedrez 3D (Revolución Lathe)
 */
function crearGeometriasStaunton() {
  const puntosPorTipo = {
    p: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.20, 0),
      new THREE.Vector2(0.18, 0.04),
      new THREE.Vector2(0.12, 0.10),
      new THREE.Vector2(0.08, 0.28),
      new THREE.Vector2(0.12, 0.33),
      new THREE.Vector2(0.07, 0.36),
      new THREE.Vector2(0.10, 0.44),
      new THREE.Vector2(0.06, 0.50),
      new THREE.Vector2(0, 0.54),
    ],
    r: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0.20, 0.05),
      new THREE.Vector2(0.15, 0.12),
      new THREE.Vector2(0.11, 0.40),
      new THREE.Vector2(0.18, 0.44),
      new THREE.Vector2(0.18, 0.58),
      new THREE.Vector2(0.11, 0.58),
      new THREE.Vector2(0, 0.52),
    ],
    n: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0.19, 0.05),
      new THREE.Vector2(0.14, 0.14),
      new THREE.Vector2(0.12, 0.36),
      new THREE.Vector2(0.17, 0.48),
      new THREE.Vector2(0.09, 0.62),
      new THREE.Vector2(0, 0.66),
    ],
    b: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.21, 0),
      new THREE.Vector2(0.19, 0.05),
      new THREE.Vector2(0.13, 0.13),
      new THREE.Vector2(0.08, 0.40),
      new THREE.Vector2(0.14, 0.44),
      new THREE.Vector2(0.10, 0.50),
      new THREE.Vector2(0.13, 0.62),
      new THREE.Vector2(0.04, 0.70),
      new THREE.Vector2(0, 0.74),
    ],
    q: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.24, 0),
      new THREE.Vector2(0.22, 0.06),
      new THREE.Vector2(0.14, 0.15),
      new THREE.Vector2(0.09, 0.45),
      new THREE.Vector2(0.16, 0.50),
      new THREE.Vector2(0.10, 0.56),
      new THREE.Vector2(0.16, 0.68),
      new THREE.Vector2(0.03, 0.76),
      new THREE.Vector2(0, 0.80),
    ],
    k: [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.25, 0),
      new THREE.Vector2(0.23, 0.06),
      new THREE.Vector2(0.15, 0.16),
      new THREE.Vector2(0.10, 0.48),
      new THREE.Vector2(0.18, 0.54),
      new THREE.Vector2(0.11, 0.60),
      new THREE.Vector2(0.16, 0.74),
      new THREE.Vector2(0.04, 0.82),
      new THREE.Vector2(0, 0.88),
    ],
  };

  const geos = {};
  for (const [k, puntos] of Object.entries(puntosPorTipo)) {
    geos[k] = new THREE.LatheGeometry(puntos, 28);
  }
  return geos;
}

/**
 * Convierte casilla algebraica (ej. 'e2') a coordenadas (x, z) 3D
 */
function casillaACoord(casilla) {
  if (!casilla || casilla.length < 2) return { x: 0, z: 0 };
  const col = 'abcdefgh'.indexOf(casilla[0].toLowerCase());
  const fila = parseInt(casilla[1], 10) - 1; // 0..7
  const x = (col - 3.5) * TAM_CASILLA;
  const z = (fila - 3.5) * TAM_CASILLA;
  return { x, z };
}

/**
 * Simulador y Gemelo Digital 3D del Brazo Dobot CR5AS y Tablero
 */
export default function SimuladorBrazoTablero3D({
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  ultimoMovimiento = null,
  pensando = false,
  onCasillaClick,
  className = '',
}) {
  const mountRef = useRef(null);
  const animFrameRef = useRef(null);
  const escenaRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  // Referencias a los componentes de la simulación
  const piezasMeshesRef = useRef(new Map()); // casilla -> mesh
  const robotRef = useRef(null);
  const casillaDestacadaRef = useRef({ origen: null, destino: null });
  const casillasMapRef = useRef(new Map());

  // Estado HUD para telemetría
  const [telemetria, setTelemetria] = useState({
    estadoRobot: 'EN ESPERA (HOME)',
    efectorXYZ: { x: -4.2, y: 3.2, z: 0 },
    juntasGrados: { j1: 0, j2: -25, j3: 45, j4: -20, j5: 0, j6: 0 },
    pinzaActiva: false,
    maniobraProgreso: 0,
  });

  const [vistaCamara, setVistaCamara] = useState('isometrica');

  // Mapear piezas del FEN a una lista manejable
  const piezasTablero = useMemo(() => {
    const matriz = fenAMatriz(fen);
    const piezas = [];
    for (let f = 0; f < 8; f++) {
      for (let c = 0; c < 8; c++) {
        const char = matriz[f][c];
        if (char) {
          const casilla = nombreCasilla(f, c);
          const esBlanca = char === char.toUpperCase();
          const tipo = char.toLowerCase();
          piezas.push({ casilla, tipo, esBlanca });
        }
      }
    }
    return piezas;
  }, [fen]);

  // 1. Inicialización de la escena Three.js
  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    const ancho = contenedor.clientWidth || 640;
    const alto = contenedor.clientHeight || 520;

    // Escena y Niebla ambiental
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.035);
    escenaRef.current = scene;

    // Cámara 3D
    const camera = new THREE.PerspectiveCamera(40, ancho / alto, 0.1, 100);
    camera.position.set(6.2, 6.8, 6.8);
    cameraRef.current = camera;

    // Renderizador WebGL de alta precisión
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    contenedor.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // No pasar por debajo del suelo
    controls.minDistance = 3.5;
    controls.maxDistance = 18.0;
    controls.target.set(0, 0.6, 0);
    controlsRef.current = controls;

    // Iluminación PBR de estudio para ajedrez y robótica
    const luzAmbiente = new THREE.AmbientLight(0xdbeafe, 0.9);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0xffffff, 2.5);
    luzClave.position.set(5.0, 9.0, 4.0);
    luzClave.castShadow = true;
    luzClave.shadow.mapSize.width = 2048;
    luzClave.shadow.mapSize.height = 2048;
    luzClave.shadow.bias = -0.0005;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x00e5ff, 1.2);
    luzRelleno.position.set(-6.0, 4.0, -4.0);
    scene.add(luzRelleno);

    const luzPuntoBrazo = new THREE.PointLight(0x00e5ff, 2.0, 8);
    luzPuntoBrazo.position.set(-4.0, 3.5, 0);
    scene.add(luzPuntoBrazo);

    // Suelo reflectante con cuadrícula tecnológica
    const sueloGeo = new THREE.PlaneGeometry(30, 30);
    const sueloMat = new THREE.MeshStandardMaterial({
      color: 0x0e131d,
      roughness: 0.35,
      metalness: 0.8,
    });
    const suelo = new THREE.Mesh(sueloGeo, sueloMat);
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -0.01;
    suelo.receiveShadow = true;
    scene.add(suelo);

    // Grid Cyber perimetral
    const gridHelper = new THREE.GridHelper(26, 26, 0x00e5ff, 0x1e293b);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // 2. Construcción del Tablero 3D
    const grupoTablero = new THREE.Group();
    scene.add(grupoTablero);

    // Base del Tablero de Nogal Oscuro con marco biselado
    const baseTableroGeo = new THREE.BoxGeometry(ANCHO_TABLERO + 0.9, ALTO_BASE_TABLERO, ANCHO_TABLERO + 0.9);
    const baseTableroMat = new THREE.MeshStandardMaterial({
      color: 0x18110b,
      roughness: 0.3,
      metalness: 0.4,
    });
    const baseTablero = new THREE.Mesh(baseTableroGeo, baseTableroMat);
    baseTablero.position.y = ALTO_BASE_TABLERO / 2;
    baseTablero.receiveShadow = true;
    baseTablero.castShadow = true;
    grupoTablero.add(baseTablero);

    // Marco interior cian con neón
    const marcoCianGeo = new THREE.BoxGeometry(ANCHO_TABLERO + 0.15, 0.02, ANCHO_TABLERO + 0.15);
    const marcoCianMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8,
    });
    const marcoCian = new THREE.Mesh(marcoCianGeo, marcoCianMat);
    marcoCian.position.y = ALTO_BASE_TABLERO + 0.005;
    grupoTablero.add(marcoCian);

    // 64 Casillas 3D
    const casillasMap = new Map();
    const casillaGeo = new THREE.BoxGeometry(TAM_CASILLA * 0.97, 0.035, TAM_CASILLA * 0.97);

    const matCasillaClara = new THREE.MeshStandardMaterial({
      color: 0xe2d9c8, // Mármol / Arce claro
      roughness: 0.2,
      metalness: 0.15,
    });
    const matCasillaOscura = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f, // Nogal oscuro
      roughness: 0.3,
      metalness: 0.2,
    });

    for (let fila = 0; fila < 8; fila++) {
      for (let col = 0; col < 8; col++) {
        const esClara = (fila + col) % 2 !== 0;
        const nombre = `${'abcdefgh'[col]}${fila + 1}`;
        const x = (col - 3.5) * TAM_CASILLA;
        const z = (fila - 3.5) * TAM_CASILLA;

        const meshCasilla = new THREE.Mesh(casillaGeo, (esClara ? matCasillaClara : matCasillaOscura).clone());
        meshCasilla.position.set(x, ALTO_BASE_TABLERO + 0.02, z);
        meshCasilla.receiveShadow = true;
        meshCasilla.userData = { casilla: nombre, esClara };
        grupoTablero.add(meshCasilla);
        casillasMap.set(nombre, meshCasilla);
      }
    }
    casillasMapRef.current = casillasMap;

    // Bandeja de Capturas lateral (para piezas eliminadas por el brazo)
    const bandejaCapturasGeo = new THREE.BoxGeometry(1.2, 0.12, ANCHO_TABLERO);
    const bandejaCapturasMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.4,
      metalness: 0.7,
    });
    const bandejaCapturas = new THREE.Mesh(bandejaCapturasGeo, bandejaCapturasMat);
    bandejaCapturas.position.set(ANCHO_TABLERO / 2 + 1.1, 0.06, 0);
    bandejaCapturas.receiveShadow = true;
    scene.add(bandejaCapturas);

    // 3. Brazo Robótico Dobot CR5AS (6-DOF) Cinemático
    const robotGroup = new THREE.Group();
    robotGroup.position.set(-4.4, 0, 0); // Ubicado en el flanco izquierdo
    scene.add(robotGroup);

    // Pedestal de montaje industrial
    const pedestalGeo = new THREE.CylinderGeometry(0.7, 0.85, 0.45, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.225;
    pedestal.castShadow = true;
    robotGroup.add(pedestal);

    // Base Dobot (J1 - Yaw)
    const j1Group = new THREE.Group();
    j1Group.position.set(0, 0.45, 0);
    robotGroup.add(j1Group);

    const baseDobotGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.4, 32);
    const matDobotBlanco = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Blanco mate característico de Dobot CR5
      roughness: 0.25,
      metalness: 0.1,
    });
    const matDobotMetal = new THREE.MeshStandardMaterial({
      color: 0x334155, // Titanio / aluminio anodizado
      roughness: 0.2,
      metalness: 0.85,
    });
    const matDobotCian = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
    });

    const baseDobot = new THREE.Mesh(baseDobotGeo, matDobotBlanco);
    baseDobot.position.y = 0.2;
    baseDobot.castShadow = true;
    j1Group.add(baseDobot);

    // Anillo LED indicador en la base
    const ledAnilloGeo = new THREE.TorusGeometry(0.5, 0.025, 16, 48);
    const ledAnillo = new THREE.Mesh(ledAnilloGeo, matDobotCian);
    ledAnillo.rotation.x = Math.PI / 2;
    ledAnillo.position.y = 0.38;
    j1Group.add(ledAnillo);

    // Hombro (J2 - Pitch)
    const j2Group = new THREE.Group();
    j2Group.position.set(0, 0.4, 0);
    j1Group.add(j2Group);

    const hombroJointGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.5, 32);
    const hombroJoint = new THREE.Mesh(hombroJointGeo, matDobotMetal);
    hombroJoint.rotation.z = Math.PI / 2;
    hombroJoint.castShadow = true;
    j2Group.add(hombroJoint);

    // Eslabón 1: Brazo Superior (L1)
    const l1Group = new THREE.Group();
    j2Group.add(l1Group);

    const l1MeshGeo = new THREE.BoxGeometry(0.36, LONG_L1, 0.32);
    const l1Mesh = new THREE.Mesh(l1MeshGeo, matDobotBlanco);
    l1Mesh.position.y = LONG_L1 / 2;
    l1Mesh.castShadow = true;
    l1Group.add(l1Mesh);

    // Codo (J3 - Pitch)
    const j3Group = new THREE.Group();
    j3Group.position.set(0, LONG_L1, 0);
    l1Group.add(j3Group);

    const codoJointGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.44, 32);
    const codoJoint = new THREE.Mesh(codoJointGeo, matDobotMetal);
    codoJoint.rotation.z = Math.PI / 2;
    codoJoint.castShadow = true;
    j3Group.add(codoJoint);

    // Eslabón 2: Antebrazo (L2)
    const l2Group = new THREE.Group();
    j3Group.add(l2Group);

    const l2MeshGeo = new THREE.BoxGeometry(0.28, LONG_L2, 0.26);
    const l2Mesh = new THREE.Mesh(l2MeshGeo, matDobotBlanco);
    l2Mesh.position.y = LONG_L2 / 2;
    l2Mesh.castShadow = true;
    l2Group.add(l2Mesh);

    // Muñeca J4 / J5
    const j4Group = new THREE.Group();
    j4Group.position.set(0, LONG_L2, 0);
    l2Group.add(j4Group);

    const munecaJoint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), matDobotMetal);
    munecaJoint.castShadow = true;
    j4Group.add(munecaJoint);

    // Efector Final con Gripper y Haz Láser
    const efectorGroup = new THREE.Group();
    efectorGroup.position.set(0, 0.35, 0);
    j4Group.add(efectorGroup);

    const electroimanGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.3, 24);
    const electroiman = new THREE.Mesh(electroimanGeo, matDobotMetal);
    electroiman.castShadow = true;
    efectorGroup.add(electroiman);

    // Haz guía láser cian hacia abajo
    const laserGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.2, 8);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65 });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.y = -0.6;
    efectorGroup.add(laser);

    // Pinza física twin-fingers
    const dedoGeo = new THREE.BoxGeometry(0.05, 0.22, 0.06);
    const dedoIzq = new THREE.Mesh(dedoGeo, matDobotMetal);
    dedoIzq.position.set(-0.11, -0.15, 0);
    const dedoDer = new THREE.Mesh(dedoGeo, matDobotMetal);
    dedoDer.position.set(0.11, -0.15, 0);
    efectorGroup.add(dedoIzq);
    efectorGroup.add(dedoDer);

    robotRef.current = {
      group: robotGroup,
      j1: j1Group,
      j2: j2Group,
      j3: j3Group,
      j4: j4Group,
      efector: efectorGroup,
      laser,
      dedoIzq,
      dedoDer,
      targetPos: new THREE.Vector3(0, 2.5, 0),
      posActual: new THREE.Vector3(-4.4, 2.8, 0),
    };

    // 4. Adaptación a Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(contenedor);

    // 5. Bucle de Renderizado Continuo (60 FPS)
    const reloj = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = reloj.getDelta();
      const elapsed = reloj.getElapsedTime();

      // Pulsación del anillo LED Dobot y guía láser
      ledAnillo.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 4.0) * 0.3;
      laser.material.opacity = 0.4 + Math.sin(elapsed * 6.0) * 0.25;

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Sincronización y Creación de Piezas 3D según el FEN
  useEffect(() => {
    const scene = escenaRef.current;
    if (!scene) return;

    const geos = crearGeometriasStaunton();

    const matPiezaClara = new THREE.MeshStandardMaterial({
      color: 0xf5f0e6, // Marfil cálido
      roughness: 0.15,
      metalness: 0.15,
    });
    const matPiezaOscura = new THREE.MeshStandardMaterial({
      color: 0x1e2530, // Ébano cyber
      roughness: 0.25,
      metalness: 0.6,
    });

    // Limpiar piezas anteriores
    piezasMeshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    });
    piezasMeshesRef.current.clear();

    // Crear y posicionar piezas actuales
    piezasTablero.forEach(({ casilla, tipo, esBlanca }) => {
      const geo = geos[tipo];
      if (!geo) return;

      const mat = (esBlanca ? matPiezaClara : matPiezaOscura).clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const { x, z } = casillaACoord(casilla);
      mesh.position.set(x, ALTO_BASE_TABLERO + 0.035, z);
      mesh.userData = { casilla, tipo, esBlanca };

      // Si es caballo, rotar hacia el bando rival
      if (tipo === 'n') {
        mesh.rotation.y = esBlanca ? Math.PI : 0;
      }

      scene.add(mesh);
      piezasMeshesRef.current.set(casilla, mesh);
    });
  }, [piezasTablero]);

  // 3. Cinemática Inversa y Animación de Pick-and-Place para el Dobot CR5AS
  useEffect(() => {
    if (!ultimoMovimiento) return;

    const origen = typeof ultimoMovimiento === 'string'
      ? ultimoMovimiento.slice(0, 2)
      : ultimoMovimiento.origen || ultimoMovimiento.from || ultimoMovimiento.uci?.slice(0, 2);

    const destino = typeof ultimoMovimiento === 'string'
      ? ultimoMovimiento.slice(2, 4)
      : ultimoMovimiento.destino || ultimoMovimiento.to || ultimoMovimiento.uci?.slice(2, 4);

    if (!origen || !destino) return;

    // Resaltar casillas origen y destino
    const casillas = casillasMapRef.current;
    casillas.forEach((m, k) => {
      if (k === origen) {
        m.material.emissive = new THREE.Color(0xfbbf24); // Amarillo origen
        m.material.emissiveIntensity = 0.55;
      } else if (k === destino) {
        m.material.emissive = new THREE.Color(0x10b981); // Esmeralda destino
        m.material.emissiveIntensity = 0.55;
      } else {
        m.material.emissive = new THREE.Color(0x000000);
        m.material.emissiveIntensity = 0;
      }
    });

    const cOrigen = casillaACoord(origen);
    const cDestino = casillaACoord(destino);
    const robot = robotRef.current;
    if (!robot) return;

    const piezaMesh = piezasMeshesRef.current.get(origen);

    // Animación de la maniobra cinemática completa en 6 fases
    let startTime = performance.now();
    const duracionManiobra = 2200; // 2.2 segundos para una maniobra fluida y realista

    const animarManiobra = (ahora) => {
      const transcurrido = ahora - startTime;
      const t = Math.min(1.0, transcurrido / duracionManiobra);

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let estadoTexto = 'CALCULANDO CINEMÁTICA';
      let pinzaActiva = false;

      const yHover = ALTO_BASE_TABLERO + 1.6;
      const yGrip = ALTO_BASE_TABLERO + 0.65;

      if (t < 0.22) {
        // Fase 1: Desplazarse de Home a Hover sobre el origen
        const pSub = t / 0.22;
        targetX = THREE.MathUtils.lerp(-2.0, cOrigen.x, pSub);
        targetZ = THREE.MathUtils.lerp(0.0, cOrigen.z, pSub);
        targetY = THREE.MathUtils.lerp(3.0, yHover, pSub);
        estadoTexto = `APROXIMACIÓN -> CASILLA ${origen.toUpperCase()}`;
      } else if (t < 0.38) {
        // Fase 2: Descender y sujetar la pieza
        const pSub = (t - 0.22) / 0.16;
        targetX = cOrigen.x;
        targetZ = cOrigen.z;
        targetY = THREE.MathUtils.lerp(yHover, yGrip, pSub);
        pinzaActiva = pSub > 0.5;
        estadoTexto = `SUJETANDO PIEZA EN ${origen.toUpperCase()}`;
      } else if (t < 0.70) {
        // Fase 3: Elevar y trasladar en curva parabólica hacia el destino
        const pSub = (t - 0.38) / 0.32;
        pinzaActiva = true;
        targetX = THREE.MathUtils.lerp(cOrigen.x, cDestino.x, pSub);
        targetZ = THREE.MathUtils.lerp(cOrigen.z, cDestino.z, pSub);
        // Arco parabólico
        targetY = yGrip + Math.sin(pSub * Math.PI) * 1.35;

        // La pieza se traslada junto al efector
        if (piezaMesh) {
          piezaMesh.position.set(targetX, targetY - 0.55, targetZ);
        }
        estadoTexto = `TRASLADANDO ${origen.toUpperCase()} -> ${destino.toUpperCase()}`;
      } else if (t < 0.85) {
        // Fase 4: Descender sobre la casilla de destino y soltar
        const pSub = (t - 0.70) / 0.15;
        pinzaActiva = pSub < 0.5;
        targetX = cDestino.x;
        targetZ = cDestino.z;
        targetY = THREE.MathUtils.lerp(yGrip + 0.4, yGrip, pSub);

        if (piezaMesh) {
          piezaMesh.position.set(cDestino.x, ALTO_BASE_TABLERO + 0.035, cDestino.z);
        }
        estadoTexto = `POSICIONANDO EN ${destino.toUpperCase()}`;
      } else {
        // Fase 5: Retornar a la posición de espera (Home)
        const pSub = (t - 0.85) / 0.15;
        targetX = THREE.MathUtils.lerp(cDestino.x, -2.5, pSub);
        targetZ = THREE.MathUtils.lerp(cDestino.z, 0.0, pSub);
        targetY = THREE.MathUtils.lerp(yGrip, 3.2, pSub);
        estadoTexto = 'RETORNO A HOME (STANDBY)';
      }

      // Cinemática Inversa Analítica para Dobot 6-DOF
      const basePos = robot.group.position; // (-4.4, 0, 0)
      const dx = targetX - basePos.x;
      const dz = targetZ - basePos.z;
      const r = Math.sqrt(dx * dx + dz * dz);
      const dy = targetY - 0.85; // Altura relativa al hombro

      // J1: Rotación Yaw de la base hacia el objetivo
      const anguloJ1 = Math.atan2(dz, dx);
      robot.j1.rotation.y = anguloJ1;

      // J2 y J3: Resolución planar de 2 eslabones (L1 y L2)
      const dTotal = Math.sqrt(r * r + dy * dy);
      const dClamped = Math.min(LONG_L1 + LONG_L2 - 0.05, Math.max(1.0, dTotal));

      const cosJ3 = (dClamped * dClamped - LONG_L1 * LONG_L1 - LONG_L2 * LONG_L2) / (2 * LONG_L1 * LONG_L2);
      const anguloJ3 = -Math.acos(THREE.MathUtils.clamp(cosJ3, -1, 1));
      const anguloJ2 = Math.atan2(r, dy) - Math.atan2(LONG_L2 * Math.sin(-anguloJ3), LONG_L1 + LONG_L2 * Math.cos(anguloJ3));

      robot.j2.rotation.z = -anguloJ2;
      robot.j3.rotation.z = -anguloJ3;

      // J4: Orientar el efector verticalmente hacia abajo perpendicular al tablero
      robot.j4.rotation.z = anguloJ2 + anguloJ3;

      // Animación de los dedos de la pinza
      const aperturaDedos = pinzaActiva ? 0.06 : 0.12;
      robot.dedoIzq.position.x = -aperturaDedos;
      robot.dedoDer.position.x = aperturaDedos;

      // Actualizar telemetría para el HUD
      setTelemetria({
        estadoRobot: estadoTexto,
        efectorXYZ: {
          x: parseFloat(targetX.toFixed(2)),
          y: parseFloat(targetY.toFixed(2)),
          z: parseFloat(targetZ.toFixed(2)),
        },
        juntasGrados: {
          j1: Math.round(THREE.MathUtils.radToDeg(anguloJ1)),
          j2: Math.round(THREE.MathUtils.radToDeg(anguloJ2)),
          j3: Math.round(THREE.MathUtils.radToDeg(anguloJ3)),
          j4: Math.round(THREE.MathUtils.radToDeg(robot.j4.rotation.z)),
          j5: 0,
          j6: 0,
        },
        pinzaActiva,
        maniobraProgreso: Math.round(t * 100),
      });

      if (t < 1.0) {
        requestAnimationFrame(animarManiobra);
      }
    };

    requestAnimationFrame(animarManiobra);
  }, [ultimoMovimiento]);

  // Cambiar preset de cámara
  const cambiarPresetCamara = (preset) => {
    setVistaCamara(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === 'isometrica') {
      camera.position.set(6.2, 6.8, 6.8);
      controls.target.set(0, 0.6, 0);
    } else if (preset === 'brazo') {
      camera.position.set(-6.5, 4.2, 3.8);
      controls.target.set(-1.0, 1.2, 0);
    } else if (preset === 'cenital') {
      camera.position.set(0.01, 9.5, 0);
      controls.target.set(0, 0.4, 0);
    } else if (preset === 'blancas') {
      camera.position.set(0, 4.6, 6.2);
      controls.target.set(0, 0.6, 0);
    }
    controls.update();
  };

  return (
    <div className={`relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden bg-[#0a0d14] border border-[#00e5ff]/30 shadow-2xl flex flex-col ${className}`}>
      {/* 1. BARRA SUPERIOR DE TELEMETRÍA Y CONTROLES DEL ROBOT */}
      <div className="relative z-10 w-full px-4 py-2.5 bg-[#0c0e14]/90 backdrop-blur-md border-b border-[#00e5ff]/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00e5ff]"></span>
            </span>
            <span className="text-slate-200 font-bold tracking-wider">
              DOBOT CR5AS <span className="text-[#00e5ff]">6-DOF</span>
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[11px]">
            <span className="text-slate-400">ESTADO:</span>
            <span className={`font-semibold ${telemetria.pinzaActiva ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
              {telemetria.estadoRobot}
            </span>
          </div>
        </div>

        {/* SELECTOR DE PRESETS DE CÁMARA */}
        <div className="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-lg border border-white/10 text-[10px]">
          <button
            type="button"
            onClick={() => cambiarPresetCamara('isometrica')}
            className={`px-2 py-1 rounded transition-all ${
              vistaCamara === 'isometrica' ? 'bg-[#00e5ff] text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Isométrica
          </button>
          <button
            type="button"
            onClick={() => cambiarPresetCamara('brazo')}
            className={`px-2 py-1 rounded transition-all ${
              vistaCamara === 'brazo' ? 'bg-[#00e5ff] text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vista Robot
          </button>
          <button
            type="button"
            onClick={() => cambiarPresetCamara('cenital')}
            className={`px-2 py-1 rounded transition-all ${
              vistaCamara === 'cenital' ? 'bg-[#00e5ff] text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cenital
          </button>
          <button
            type="button"
            onClick={() => cambiarPresetCamara('blancas')}
            className={`px-2 py-1 rounded transition-all ${
              vistaCamara === 'blancas' ? 'bg-[#00e5ff] text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Jugador
          </button>
        </div>
      </div>

      {/* 2. ÁREA PRINCIPAL THREE.JS VIEWPORT */}
      <div className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full min-h-[460px]" />

        {/* HUD FLOTANTE: COORDENADAS EFECTOR Y JUNTAS */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 font-mono text-[10px]">
          <div className="px-3 py-2 rounded-lg bg-black/80 backdrop-blur-md border border-[#00e5ff]/30 text-slate-300 shadow-xl flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4 text-[#00e5ff] font-bold border-b border-white/10 pb-1">
              <span>EFECTOR XYZ (mm)</span>
              <span className={telemetria.pinzaActiva ? 'text-amber-400' : 'text-slate-400'}>
                GRIPPER: {telemetria.pinzaActiva ? 'CERRADO (ON)' : 'ABIERTO (OFF)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-300">
              <span>X: {(telemetria.efectorXYZ.x * 100).toFixed(0)}</span>
              <span>Y: {(telemetria.efectorXYZ.y * 100).toFixed(0)}</span>
              <span>Z: {(telemetria.efectorXYZ.z * 100).toFixed(0)}</span>
            </div>
            <div className="text-[9px] text-slate-400 pt-1 border-t border-white/5 flex gap-2">
              <span>J1: {telemetria.juntasGrados.j1}°</span>
              <span>J2: {telemetria.juntasGrados.j2}°</span>
              <span>J3: {telemetria.juntasGrados.j3}°</span>
              <span>J4: {telemetria.juntasGrados.j4}°</span>
            </div>
          </div>
        </div>

        {/* INDICADOR DE INTERACCIÓN 3D */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none text-[10px] font-mono text-slate-400 opacity-70 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />
          <span>Rotación 360° • Zoom • Órbita Libre</span>
        </div>
      </div>
    </div>
  );
}
