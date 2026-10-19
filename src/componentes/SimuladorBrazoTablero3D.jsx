import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { fenAMatriz, nombreCasilla } from '../ajedrez';

// Constantes métricas del mundo 3D
const TAM_CASILLA = 0.50;
const ANCHO_TABLERO = TAM_CASILLA * 8; // 4.0
const ALTO_BASE_TABLERO = 0.20;
const LONG_L1 = 3.6; // Brazo Dobot CR5AS
const LONG_L2 = 3.4; // Antebrazo Dobot CR5AS

// Parámetros espaciales calibrados con el laboratorio real (point.json)
const Z_BASE_ROBOT = 4.70; // Base del robot montada detrás del tablero
const Z_DESCANSO_PINZA = 2.65; // Posición de descanso de la pinza sobre el marcador de calibración detrás del tablero

// Posición Cero oficial calibrada del robot real (calibracion_local/brazo.json - alias DESCANSO)
export const ANGULOS_CERO_DEG = {
  j1: -57.14,
  j2: 28.21,
  j3: -149.12,
  j4: 30.90,
  j5: 89.71,
  j6: -27.81,
};

export const ANGULOS_CERO_RAD = {
  j1: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j1),
  j2: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j2),
  j3: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j3),
  j4: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j4),
  j5: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j5),
  j6: THREE.MathUtils.degToRad(ANGULOS_CERO_DEG.j6),
};

// Mapeo a los archivos de modelos 3D reales exportados de Blender/PyBullet
const MAPA_TIPO_A_ARCHIVO = {
  p: 'peon',
  r: 'torre',
  n: 'caballo',
  b: 'alfil',
  q: 'reina',
  k: 'rey',
};

// Escala métrica para ajustar piezas Staunton reales a la cuadrícula de 0.50 unidades
const ESCALA_PIEZAS_STAUNTON = 8.0;

// Cache en memoria para plantillas de modelos 3D (6 tipos x 2 colores)
const cacheModelosPiezas3D = new Map();
let cargaModelosPromise = null;

/**
 * Carga los 12 modelos .obj con sus materiales .mtl y texturas .jpg
 */
function cargarModelosPiezas3D() {
  if (cacheModelosPiezas3D.size === 12) {
    return Promise.resolve(cacheModelosPiezas3D);
  }
  if (cargaModelosPromise) {
    return cargaModelosPromise;
  }

  cargaModelosPromise = (async () => {
    const tipos = ['p', 'r', 'n', 'b', 'q', 'k'];
    const bandos = [
      { esBlanca: true, carpeta: 'claro' },
      { esBlanca: false, carpeta: 'oscuro' },
    ];

    const promesas = [];

    for (const bando of bandos) {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath(`/piezas3d/${bando.carpeta}/`);

      for (const tipo of tipos) {
        const nombreArchivo = MAPA_TIPO_A_ARCHIVO[tipo];
        const clave = `${tipo}_${bando.esBlanca ? 'w' : 'b'}`;

        const tarea = new Promise((resolve) => {
          mtlLoader.load(
            `${nombreArchivo}.mtl`,
            (materials) => {
              materials.preload();

              // Asegurar que las texturas usen sRGB para colores vivos y naturales
              for (const mat of Object.values(materials.materials)) {
                if (mat.map) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                }
                mat.shininess = 25; // Brillo elegante de madera barnizada
              }

              const objLoader = new OBJLoader();
              objLoader.setMaterials(materials);
              objLoader.setPath(`/piezas3d/${bando.carpeta}/`);

              objLoader.load(
                `${nombreArchivo}.obj`,
                (obj) => {
                  obj.scale.set(
                    ESCALA_PIEZAS_STAUNTON,
                    ESCALA_PIEZAS_STAUNTON,
                    ESCALA_PIEZAS_STAUNTON
                  );

                  obj.traverse((child) => {
                    if (child.isMesh) {
                      child.castShadow = true;
                      child.receiveShadow = true;
                    }
                  });

                  cacheModelosPiezas3D.set(clave, obj);
                  resolve();
                },
                undefined,
                (err) => {
                  console.warn(`Error cargando modelo OBJ ${nombreArchivo}:`, err);
                  resolve();
                }
              );
            },
            undefined,
            (err) => {
              console.warn(`Error cargando MTL ${nombreArchivo}:`, err);
              resolve();
            }
          );
        });

        promesas.push(tarea);
      }
    }

    await Promise.all(promesas);
    return cacheModelosPiezas3D;
  })();

  return cargaModelosPromise;
}

/**
 * Generador procedural de geometrías Staunton para ajedrez 3D (Fallback de respaldo)
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
  const robotGroupRef = useRef(null);
  const robotRealGroupRef = useRef(null);
  const robotOficialGroupRef = useRef(null);
  const robotArticuladoRef = useRef(null);
  const casillaDestacadaRef = useRef({ origen: null, destino: null });
  const casillasMapRef = useRef(new Map());

  // Estado HUD para telemetría
  const [telemetria, setTelemetria] = useState({
    estadoRobot: 'EN ESPERA (POSICIÓN CERO / DESCANSO)',
    efectorXYZ: { x: 0, y: -262, z: 235 },
    juntasGrados: { ...ANGULOS_CERO_DEG },
    pinzaActiva: false,
    maniobraProgreso: 0,
  });

  const [vistaCamara, setVistaCamara] = useState('isometrica');
  const [modelosCargados, setModelosCargados] = useState(cacheModelosPiezas3D.size === 12);
  const [modeloRobot, setModeloRobot] = useState('oficial'); // 'oficial' (CR5AS Articulado + PGE-50) | 'escaneo' (FICCT) | 'cinematico'

  // Estado interactivo de pruebas y jugadas
  const [fenInterno, setFenInterno] = useState(fen);
  const [jugadaActiva, setJugadaActiva] = useState(null);
  const [animando, setAnimando] = useState(false);
  const [inputUci, setInputUci] = useState('');

  // Sincronizar FEN externo cuando cambie la partida
  useEffect(() => {
    setFenInterno(fen);
  }, [fen]);

  // Sincronizar jugada externa cuando Turing IA o el rival mueva
  useEffect(() => {
    if (ultimoMovimiento) {
      const uci = typeof ultimoMovimiento === 'string'
        ? ultimoMovimiento
        : ultimoMovimiento.uci || `${ultimoMovimiento.origen || ultimoMovimiento.from || ''}${ultimoMovimiento.destino || ultimoMovimiento.to || ''}`;
      if (uci && uci.length >= 4) {
        setJugadaActiva({ uci, id: Date.now() });
      }
    }
  }, [ultimoMovimiento]);

  // Disparar jugada de prueba manual o preset
  const dispararJugadaPrueba = (uci) => {
    if (animando) return;
    setJugadaActiva({ uci, id: Date.now() });
  };

  const manejarEnvioManual = (e) => {
    e.preventDefault();
    const limpia = inputUci.trim().toLowerCase();
    if (animando || limpia.length < 4) return;
    dispararJugadaPrueba(limpia);
    setInputUci('');
  };

  const reiniciarPosicionPiezas = () => {
    setFenInterno('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    setJugadaActiva(null);
    setTelemetria({
      estadoRobot: 'EN ESPERA (POSICIÓN CERO / DESCANSO)',
      efectorXYZ: { x: 0, y: -262, z: 235 },
      juntasGrados: { ...ANGULOS_CERO_DEG },
      pinzaActiva: false,
      maniobraProgreso: 0,
    });
  };

  // Control de visibilidad entre los modelos del brazo
  useEffect(() => {
    if (robotOficialGroupRef.current) {
      robotOficialGroupRef.current.visible = modeloRobot === 'oficial';
    }
    if (robotRealGroupRef.current) {
      robotRealGroupRef.current.visible = modeloRobot === 'escaneo';
    }
    if (robotGroupRef.current) {
      robotGroupRef.current.visible = modeloRobot === 'cinematico';
    }
  }, [modeloRobot]);

  // Cargar los 12 modelos OBJ Staunton con sus texturas
  useEffect(() => {
    let activo = true;
    cargarModelosPiezas3D().then(() => {
      if (activo) {
        setModelosCargados(true);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  // Mapear piezas del FEN a una lista manejable
  const piezasTablero = useMemo(() => {
    const matriz = fenAMatriz(fenInterno);
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
  }, [fenInterno]);

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

    // Cámara 3D (perspectiva isométrica viendo el tablero desde el lado del jugador de blancas hacia el robot)
    const camera = new THREE.PerspectiveCamera(40, ancho / alto, 0.1, 100);
    camera.position.set(4.8, 5.2, -4.6);
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
    controls.target.set(0, 0.4, 0.8);
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
    luzPuntoBrazo.position.set(0, 3.8, 3.8);
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
    const bandejaCapturasGeo = new THREE.BoxGeometry(0.85, 0.10, ANCHO_TABLERO);
    const bandejaCapturasMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.4,
      metalness: 0.7,
    });
    const bandejaCapturas = new THREE.Mesh(bandejaCapturasGeo, bandejaCapturasMat);
    bandejaCapturas.position.set(ANCHO_TABLERO / 2 + 0.70, 0.05, 0);
    bandejaCapturas.receiveShadow = true;
    scene.add(bandejaCapturas);

    // Hoja de calibración / marcador de posición cero en la mesa (como en el laboratorio real FICCT)
    const hojaCalibGeo = new THREE.PlaneGeometry(0.65, 0.65);
    const canvasCalib = document.createElement('canvas');
    canvasCalib.width = 128;
    canvasCalib.height = 128;
    const ctxCalib = canvasCalib.getContext('2d');
    ctxCalib.fillStyle = '#ffffff';
    ctxCalib.fillRect(0, 0, 128, 128);
    ctxCalib.fillStyle = '#111827';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 0) {
          ctxCalib.fillRect(c * 16, r * 16, 16, 16);
        }
      }
    }
    const texCalib = new THREE.CanvasTexture(canvasCalib);
    const hojaCalibMat = new THREE.MeshBasicMaterial({ map: texCalib });
    const hojaCalib = new THREE.Mesh(hojaCalibGeo, hojaCalibMat);
    hojaCalib.rotation.x = -Math.PI / 2;
    hojaCalib.position.set(0, 0.002, Z_DESCANSO_PINZA);
    hojaCalib.receiveShadow = true;
    scene.add(hojaCalib);

    // 3. Brazo Robótico Dobot CR5AS (6-DOF) Cinemático
    const robotGroup = new THREE.Group();
    robotGroup.position.set(0, 0, Z_BASE_ROBOT); // Ubicado detrás de las piezas negras (modelo IA contrincante)
    robotGroup.rotation.y = Math.PI; // Encarando el tablero hacia el jugador de blancas
    scene.add(robotGroup);

    // Pedestal de montaje industrial
    const pedestalGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.45, 32);
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

    // Pinza física twin-fingers proporcionada para piezas Staunton
    const dedoGeo = new THREE.BoxGeometry(0.06, 0.32, 0.06);
    const dedoIzq = new THREE.Mesh(dedoGeo, matDobotMetal);
    dedoIzq.position.set(-0.16, -0.20, 0);
    const dedoDer = new THREE.Mesh(dedoGeo, matDobotMetal);
    dedoDer.position.set(0.16, -0.20, 0);
    efectorGroup.add(dedoIzq);
    efectorGroup.add(dedoDer);

    robotGroupRef.current = robotGroup;
    robotGroup.visible = false; // Inicialmente visible según modeloRobot

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
      posActual: new THREE.Vector3(0, 2.4, Z_DESCANSO_PINZA),
    };

    // 3b. Modelo 3D Escaneado Real del Brazo Dobot CR5AS con Cámara (FICCT)
    const robotRealGroup = new THREE.Group();
    robotRealGroup.position.set(0, 0, Z_BASE_ROBOT); // Ubicado detrás de las piezas negras
    robotRealGroup.rotation.y = Math.PI / 2; // Orientado hacia el tablero
    robotRealGroup.visible = false;
    scene.add(robotRealGroup);
    robotRealGroupRef.current = robotRealGroup;

    // Placa de montaje industrial / pedestal cilíndrico en la mesa
    const placaRealGeo = new THREE.CylinderGeometry(0.68, 0.76, 0.08, 32);
    const placaRealMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const placaReal = new THREE.Mesh(placaRealGeo, placaRealMat);
    placaReal.position.y = 0.04;
    placaReal.receiveShadow = true;
    placaReal.castShadow = true;
    robotRealGroup.add(placaReal);

    // Anillo de luz cian en la base del pedestal
    const anilloPlacaGeo = new THREE.TorusGeometry(0.69, 0.018, 16, 48);
    const anilloPlacaMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.7,
    });
    const anilloPlaca = new THREE.Mesh(anilloPlacaGeo, anilloPlacaMat);
    anilloPlaca.rotation.x = Math.PI / 2;
    anilloPlaca.position.y = 0.08;
    robotRealGroup.add(anilloPlaca);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/models/robot_arm_camera.glb', (gltf) => {
      const model = gltf.scene;

      // Centrado milimétrico de la base cilíndrica del modelo escaneado:
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.08, 0);
      model.position.set(-0.1504, 0.9522, 0.5833);
      pivot.add(model);

      const escala = 1.75;
      pivot.scale.set(escala, escala, escala);
      pivot.rotation.y = 1.6462;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      robotRealGroup.add(pivot);
    }, undefined, (err) => {
      console.warn('Nota: Modelo robot_arm_camera.glb no disponible, usando cinemático:', err);
    });

    // 3c. Gemelo Digital Oficial Dobot CR5AS Articulado 6-DOF con Pinza DH-Robotics PGE-50-26
    const robotOficialGroup = new THREE.Group();
    robotOficialGroup.position.set(0, 0, Z_BASE_ROBOT); // Ubicado detrás de las piezas negras (modelo IA contrincante)
    robotOficialGroup.rotation.y = Math.PI; // Encarando el tablero hacia el jugador de blancas
    robotOficialGroup.visible = true; // Por defecto visible
    scene.add(robotOficialGroup);
    robotOficialGroupRef.current = robotOficialGroup;

    // Pedestal industrial metálico con anillo LED cian
    const pedestalOficialGeo = new THREE.CylinderGeometry(0.70, 0.78, 0.08, 32);
    const pedestalOficialMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const pedestalOficial = new THREE.Mesh(pedestalOficialGeo, pedestalOficialMat);
    pedestalOficial.position.y = 0.04;
    pedestalOficial.receiveShadow = true;
    pedestalOficial.castShadow = true;
    robotOficialGroup.add(pedestalOficial);

    const anilloOficialGeo = new THREE.TorusGeometry(0.71, 0.016, 16, 48);
    const anilloOficialMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
    });
    const anilloOficial = new THREE.Mesh(anilloOficialGeo, anilloOficialMat);
    anilloOficial.rotation.x = Math.PI / 2;
    anilloOficial.position.y = 0.08;
    robotOficialGroup.add(anilloOficial);

    // Cargar modelo oficial Dobot CR5 con DRACOLoader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    const dobotLoader = new GLTFLoader();
    dobotLoader.setDRACOLoader(dracoLoader);

    dobotLoader.load('/modelos/dobot_cr5.glb', (gltf) => {
      const model = gltf.scene;

      // Escala métrica: convierte milímetros del CAD oficial a unidades de Three.js
      const ESCALA_DOBOT = 0.0078;
      model.scale.set(ESCALA_DOBOT, ESCALA_DOBOT, ESCALA_DOBOT);
      model.position.set(0, 0.08, 0);

      // Extraer nodos articulares J1 a J6 y TOOL
      const j1 = model.getObjectByName('J1');
      const j2 = model.getObjectByName('J2');
      const j3 = model.getObjectByName('J3');
      const j4 = model.getObjectByName('J4');
      const j5 = model.getObjectByName('J5');
      const j6 = model.getObjectByName('J6');
      const tool = model.getObjectByName('TOOL') || j6;

      // Ocultar skins internas / huesos auxiliares
      const skins = [
        'J3SkinKey1', 'J3SkinKey2', 'J3SkinKey3', 'J3SkinKey4', 'J3SkinKey5', 'J3SkinKey6', 'J3SkinKey7',
        'J4SkinKey1', 'J4SkinKey2', 'J4SkinKey3',
        'J5SkinKey1', 'J5SkinKey2', 'J5SkinKey3',
      ];
      skins.forEach((sk) => {
        const obj = model.getObjectByName(sk);
        if (obj) obj.visible = false;
      });

      // Configurar sombras y materiales PBR elegantes
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.metalness = Math.max(child.material.metalness || 0, 0.5);
            child.material.roughness = Math.min(child.material.roughness || 0.5, 0.35);
          }
        }
      });

      // Ensamble fiel de la Pinza Eléctrica DH-Robotics PGE-50-26 según el robot real de FICCT
      const pinzaGroup = new THREE.Group();
      // Orientar la pinza vertical hacia abajo (eje Z de TOOL) y alineada completamente recta (0° en reposo)
      pinzaGroup.rotation.set(Math.PI / 2, Math.PI, 0);
      pinzaGroup.rotateY(THREE.MathUtils.degToRad(60.67));

      // 1. Cuerpo Superior PGE-50: Negro Mate Anodizado (29 x 60 x 20 mm)
      const cuerpoSuperiorGeo = new THREE.BoxGeometry(29, 60, 20);
      const matNegroPGE = new THREE.MeshStandardMaterial({
        color: 0x14161b,
        metalness: 0.85,
        roughness: 0.35,
      });
      const cuerpoSuperior = new THREE.Mesh(cuerpoSuperiorGeo, matNegroPGE);
      cuerpoSuperior.position.set(0, 30, 0);
      cuerpoSuperior.castShadow = true;
      pinzaGroup.add(cuerpoSuperior);

      // Logo vertical "DH-ROBOTICS" y LED en la cara frontal
      const canvasLogo = document.createElement('canvas');
      canvasLogo.width = 128;
      canvasLogo.height = 256;
      const ctxLogo = canvasLogo.getContext('2d');
      ctxLogo.fillStyle = '#14161b';
      ctxLogo.fillRect(0, 0, 128, 256);
      ctxLogo.save();
      ctxLogo.translate(64, 135);
      ctxLogo.rotate(-Math.PI / 2);
      ctxLogo.font = 'bold 18px Arial, sans-serif';
      ctxLogo.fillStyle = '#e2e8f0';
      ctxLogo.textAlign = 'center';
      ctxLogo.fillText('DH-ROBOTICS', 0, 6);
      ctxLogo.restore();
      // LED azul/cian de encendido
      ctxLogo.beginPath();
      ctxLogo.arc(64, 45, 5, 0, Math.PI * 2);
      ctxLogo.fillStyle = '#00e5ff';
      ctxLogo.fill();

      const texLogo = new THREE.CanvasTexture(canvasLogo);
      const placaLogoGeo = new THREE.PlaneGeometry(18, 48);
      const placaLogoMat = new THREE.MeshBasicMaterial({ map: texLogo });
      const placaLogo = new THREE.Mesh(placaLogoGeo, placaLogoMat);
      placaLogo.position.set(0, 32, 10.1);
      pinzaGroup.add(placaLogo);

      // 2. Cuello / Sección Inferior Metálica: Aluminio Plateado Cepillado (29.2 x 37 x 20.2 mm)
      const cuelloMetalGeo = new THREE.BoxGeometry(29.2, 37, 20.2);
      const matAluminioCepillado = new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        metalness: 0.95,
        roughness: 0.22,
      });
      const cuelloMetal = new THREE.Mesh(cuelloMetalGeo, matAluminioCepillado);
      cuelloMetal.position.set(0, 78.5, 0);
      cuelloMetal.castShadow = true;
      pinzaGroup.add(cuelloMetal);

      // Tornillos / Guías de montaje en el cuello metálico
      const tornilloGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 12);
      const matTornillo = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
      [-6, 6].forEach((tx) => {
        const tornilloFrente = new THREE.Mesh(tornilloGeo, matTornillo);
        tornilloFrente.rotation.x = Math.PI / 2;
        tornilloFrente.position.set(tx, 90, 10.2);
        pinzaGroup.add(tornilloFrente);
      });

      // 3. Guías deslizantes inferiores de acero (Sliders PGE-50)
      const correderaGeo = new THREE.BoxGeometry(11, 7, 16);
      const matCorredera = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.92,
        roughness: 0.25,
      });

      // Slider izquierdo (porta-dedo rojo)
      const sliderIzq = new THREE.Group();
      sliderIzq.position.set(-13, 97, 0);
      pinzaGroup.add(sliderIzq);
      const blockSliderIzq = new THREE.Mesh(correderaGeo, matCorredera);
      blockSliderIzq.position.y = 3.5;
      sliderIzq.add(blockSliderIzq);

      // Slider derecho (porta-dedo blanco)
      const sliderDer = new THREE.Group();
      sliderDer.position.set(13, 97, 0);
      pinzaGroup.add(sliderDer);
      const blockSliderDer = new THREE.Mesh(correderaGeo, matCorredera);
      blockSliderDer.position.y = 3.5;
      sliderDer.add(blockSliderDer);

      // 4. Dedos Largos Impresos 3D (Dimensiones reales 11.5 x 53 x 14 mm)
      // DEDO ROJO (PLA)
      const matDedoRojo = new THREE.MeshStandardMaterial({
        color: 0xdc2626, // Rojo intenso del dedo impreso real
        roughness: 0.45,
        metalness: 0.08,
      });

      // DEDO BLANCO (PLA)
      const matDedoBlanco = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Blanco puro del dedo impreso real
        roughness: 0.45,
        metalness: 0.08,
      });

      // Cargar la geometría STL original de los dedos impresos
      const stlLoader = new STLLoader();
      stlLoader.load('/modelos/dedo_pinza.stl', (stlGeo) => {
        stlGeo.computeVertexNormals();
        stlGeo.center();

        const meshDedoBlanco = new THREE.Mesh(stlGeo, matDedoBlanco);
        meshDedoBlanco.position.set(0, 26.5, 0);
        meshDedoBlanco.castShadow = true;
        sliderIzq.add(meshDedoBlanco);

        const meshDedoRojo = new THREE.Mesh(stlGeo, matDedoRojo);
        meshDedoRojo.position.set(0, 26.5, 0);
        meshDedoRojo.castShadow = true;
        sliderDer.add(meshDedoRojo);
      }, undefined, () => {
        // Fallback procedural exacto con las mismas medidas reales
        const dedoGeoProcedural = new THREE.BoxGeometry(11.5, 53, 14);
        const meshDedoBlanco = new THREE.Mesh(dedoGeoProcedural, matDedoBlanco);
        meshDedoBlanco.position.set(0, 26.5, 0);
        meshDedoBlanco.castShadow = true;
        sliderIzq.add(meshDedoBlanco);

        const meshDedoRojo = new THREE.Mesh(dedoGeoProcedural, matDedoRojo);
        meshDedoRojo.position.set(0, 26.5, 0);
        meshDedoRojo.castShadow = true;
        sliderDer.add(meshDedoRojo);
      });

      // 5. Módulo de Cámara Industrial FICCT (montada lateralmente con bracket y cable hacia la muñeca, idéntica al escaneo FICCT)
      const camaraGroup = new THREE.Group();
      // Montada en el costado derecho de la PGE-50 según el escaneo real de la FICCT
      camaraGroup.position.set(28, 22, 4);

      // Bracket metálico de sujeción al cuerpo de la PGE-50
      const bracketGeo = new THREE.BoxGeometry(14, 18, 12);
      const bracketMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.25,
      });
      const bracket = new THREE.Mesh(bracketGeo, bracketMat);
      bracket.position.set(-11, 0, 0);
      camaraGroup.add(bracket);

      // Base inferior oscura de la cámara
      const camBaseGeo = new THREE.BoxGeometry(26, 4, 24);
      const camBaseMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.85,
        roughness: 0.3,
      });
      const camBase = new THREE.Mesh(camBaseGeo, camBaseMat);
      camBase.position.set(0, 13, 0);
      camBase.castShadow = true;
      camaraGroup.add(camBase);

      // Cuerpo blanco industrial de la cámara
      const camCuerpoGeo = new THREE.BoxGeometry(26, 22, 24);
      const camCuerpoMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.25,
        roughness: 0.35,
      });
      const camCuerpo = new THREE.Mesh(camCuerpoGeo, camCuerpoMat);
      camCuerpo.castShadow = true;
      camaraGroup.add(camCuerpo);

      // Tapa superior biselada piramidal (como en el escaneo real FICCT)
      const tapaBiselGeo = new THREE.CylinderGeometry(8, 14, 8, 4);
      const tapaBiselMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.2,
        roughness: 0.3,
      });
      const tapaBisel = new THREE.Mesh(tapaBiselGeo, tapaBiselMat);
      tapaBisel.rotation.y = Math.PI / 4;
      tapaBisel.position.set(0, -15, 0);
      camaraGroup.add(tapaBisel);

      // Conector metálico superior para el cable
      const conectorGeo = new THREE.CylinderGeometry(3.5, 3.5, 6, 16);
      const conectorMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.92,
        roughness: 0.18,
      });
      const conector = new THREE.Mesh(conectorGeo, conectorMat);
      conector.position.set(0, -20, 0);
      camaraGroup.add(conector);

      // Cable negro flexible curvado hacia la muñeca del robot (CatmullRomCurve3)
      const puntosCable = [
        new THREE.Vector3(28, 2, 4),
        new THREE.Vector3(24, -14, 6),
        new THREE.Vector3(12, -26, 2),
        new THREE.Vector3(0, -32, -6),
      ];
      const curvaCable = new THREE.CatmullRomCurve3(puntosCable);
      const cableGeo = new THREE.TubeGeometry(curvaCable, 20, 1.8, 8, false);
      const cableMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.85,
      });
      const cableTubo = new THREE.Mesh(cableGeo, cableMat);
      pinzaGroup.add(cableTubo);

      // Distintivo / logo frontal verde FICCT
      const logoVerdeGeo = new THREE.ConeGeometry(3.5, 5, 3);
      const logoVerdeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 1.2,
      });
      const logoVerde = new THREE.Mesh(logoVerdeGeo, logoVerdeMat);
      logoVerde.rotation.z = Math.PI;
      logoVerde.position.set(0, 0, 12.2);
      camaraGroup.add(logoVerde);

      // Lente frontal oscuro apuntando hacia abajo/frente
      const camLenteGeo = new THREE.CylinderGeometry(6, 6, 5, 24);
      const camLenteMat = new THREE.MeshStandardMaterial({
        color: 0x090a0f,
        metalness: 0.95,
        roughness: 0.08,
      });
      const camLente = new THREE.Mesh(camLenteGeo, camLenteMat);
      camLente.position.set(0, 13, 0);
      camaraGroup.add(camLente);

      // Anillo LED verde esmeralda brillante (como en las fotos reales de la FICCT)
      const camAnilloGeo = new THREE.TorusGeometry(6.2, 0.7, 16, 32);
      const camAnilloMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 1.5,
      });
      const camAnillo = new THREE.Mesh(camAnilloGeo, camAnilloMat);
      camAnillo.rotation.x = Math.PI / 2;
      camAnillo.position.set(0, 15, 0);
      camaraGroup.add(camAnillo);

      pinzaGroup.add(camaraGroup);

      // Haz láser de puntería hacia la casilla (suave y discreto desde las puntas de los dedos)
      const laserOficialGeo = new THREE.CylinderGeometry(0.5, 0.5, 230, 8);
      const laserOficialMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.55,
      });
      const laserOficial = new THREE.Mesh(laserOficialGeo, laserOficialMat);
      laserOficial.position.set(0, 240, 0);
      pinzaGroup.add(laserOficial);

      // Acoplar al nodo TOOL o J6
      if (tool) {
        tool.add(pinzaGroup);
      } else if (j6) {
        j6.add(pinzaGroup);
      }

      // Aplicar postura HOME / POSICIÓN CERO calibrada real [302.86°, 28.21°, -149.12°, 30.90°, 89.71°, -27.81°]
      if (j1) j1.rotation.y = ANGULOS_CERO_RAD.j1;
      if (j2) j2.rotation.z = ANGULOS_CERO_RAD.j2;
      if (j3) j3.rotation.z = ANGULOS_CERO_RAD.j3;
      if (j4) j4.rotation.z = ANGULOS_CERO_RAD.j4;
      if (j5) j5.rotation.y = ANGULOS_CERO_RAD.j5;
      if (j6) j6.rotation.z = ANGULOS_CERO_RAD.j6;

      robotArticuladoRef.current = {
        model,
        j1,
        j2,
        j3,
        j4,
        j5,
        j6,
        tool,
        pinzaGroup,
        sliderIzq,
        sliderDer,
        laser: laserOficial,
      };

      robotOficialGroup.add(model);
    }, undefined, (err) => {
      console.warn('Nota: Modelo dobot_cr5.glb no disponible, usando alternativas:', err);
    });

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

    // Limpiar piezas anteriores de la escena
    piezasMeshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    });
    piezasMeshesRef.current.clear();

    // Crear y posicionar piezas actuales usando los modelos 3D reales Staunton
    piezasTablero.forEach(({ casilla, tipo, esBlanca }) => {
      const clave = `${tipo}_${esBlanca ? 'w' : 'b'}`;
      const plantilla = cacheModelosPiezas3D.get(clave);

      let mesh;
      if (plantilla) {
        mesh = plantilla.clone(true);
      } else {
        const geo = geos[tipo];
        if (!geo) return;
        const mat = (esBlanca ? matPiezaClara : matPiezaOscura).clone();
        mesh = new THREE.Mesh(geo, mat);
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const { x, z } = casillaACoord(casilla);
      mesh.position.set(x, ALTO_BASE_TABLERO + 0.038, z);
      mesh.userData = { casilla, tipo, esBlanca };

      // Orientación precisa en el tablero:
      // Las piezas apuntan hacia adentro del tablero encarando el centro y al rival
      if (tipo === 'n') {
        const col = 'abcdefgh'.indexOf(casilla[0].toLowerCase());
        // Sesgo elegante hacia las columnas centrales d y e (hacia adentro)
        const sesgoCentro = col < 3.5 ? 0.32 : -0.32;
        mesh.rotation.y = esBlanca ? sesgoCentro : (Math.PI - sesgoCentro);
      } else {
        mesh.rotation.y = esBlanca ? 0 : Math.PI;
      }

      scene.add(mesh);
      piezasMeshesRef.current.set(casilla, mesh);
    });
  }, [piezasTablero, modelosCargados]);

  // 3. Cinemática Inversa y Animación de Pick-and-Place para el Dobot CR5AS
  useEffect(() => {
    if (!jugadaActiva || !jugadaActiva.uci) return;

    const origen = jugadaActiva.uci.slice(0, 2);
    const destino = jugadaActiva.uci.slice(2, 4);

    if (!origen || !destino) return;

    setAnimando(true);

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

    // Cinemática Inversa Analítica para Dobot 6-DOF montado en el bando negro (0, 0, Z_BASE_ROBOT) rotado hacia el tablero
    const resolverIKDobot = (targetX, targetY, targetZ) => {
      const baseZ = Z_BASE_ROBOT;
      const dxLocal = -targetX;
      const dzLocal = baseZ - targetZ; // > 0 hacia el tablero

      const j1 = Math.atan2(dxLocal, dzLocal);
      const r = Math.sqrt(dxLocal * dxLocal + dzLocal * dzLocal);
      const dy = targetY - 0.85;

      const dTotal = Math.sqrt(r * r + dy * dy);
      const dClamped = Math.min(LONG_L1 + LONG_L2 - 0.05, Math.max(0.8, dTotal));

      const cosJ3 = (dClamped * dClamped - LONG_L1 * LONG_L1 - LONG_L2 * LONG_L2) / (2 * LONG_L1 * LONG_L2);
      const acosJ3 = Math.acos(THREE.MathUtils.clamp(cosJ3, -1, 1));
      const j3 = -acosJ3;
      const j2 = Math.atan2(r, dy) - Math.atan2(LONG_L2 * Math.sin(-j3), LONG_L1 + LONG_L2 * Math.cos(j3));
      const j4 = -Math.PI / 2 - (j2 + j3);

      return {
        j1,
        j2,
        j3,
        j4,
      };
    };

    // Animación de la maniobra cinemática completa en 5 fases con retorno a Posición Cero calibrada
    let startTime = performance.now();
    const duracionManiobra = 2200; // 2.2 segundos para una maniobra fluida y realista

    const animarManiobra = (ahora) => {
      const transcurrido = ahora - startTime;
      const t = Math.min(1.0, transcurrido / duracionManiobra);

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let curJ1 = ANGULOS_CERO_RAD.j1;
      let curJ2 = ANGULOS_CERO_RAD.j2;
      let curJ3 = ANGULOS_CERO_RAD.j3;
      let curJ4 = ANGULOS_CERO_RAD.j4;
      let curJ5 = ANGULOS_CERO_RAD.j5;
      let curJ6 = ANGULOS_CERO_RAD.j6;
      let estadoTexto = 'CALCULANDO CINEMÁTICA';
      let pinzaActiva = false;

      const yHover = ALTO_BASE_TABLERO + 1.8;
      const yGrip = ALTO_BASE_TABLERO + 0.95;

      const ikHoverOrig = resolverIKDobot(cOrigen.x, yHover, cOrigen.z);
      const ikGripOrig = resolverIKDobot(cOrigen.x, yGrip, cOrigen.z);
      const ikGripDest = resolverIKDobot(cDestino.x, yGrip, cDestino.z);
      const ikHoverDest = resolverIKDobot(cDestino.x, yHover, cDestino.z);

      // Rotación diagonal a 45° para agarre de piezas (giro_diagonal_grados en calibracion_local/brazo.json)
      const j6DiagOrig = THREE.MathUtils.degToRad(74.33) + ikHoverOrig.j1;
      const j6DiagDest = THREE.MathUtils.degToRad(74.33) + ikHoverDest.j1;

      if (t < 0.22) {
        // Fase 1: Desplazarse suavemente de la Posición Cero (recto 0°) a Hover sobre el origen girando a 45° diagonal
        const pSub = t / 0.22;
        curJ1 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j1, ikHoverOrig.j1, pSub);
        curJ2 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j2, ikHoverOrig.j2, pSub);
        curJ3 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j3, ikHoverOrig.j3, pSub);
        curJ4 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j4, ikHoverOrig.j4, pSub);
        curJ5 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j5, Math.PI / 2, pSub);
        curJ6 = THREE.MathUtils.lerp(ANGULOS_CERO_RAD.j6, j6DiagOrig, pSub);
        targetX = THREE.MathUtils.lerp(0, cOrigen.x, pSub);
        targetZ = THREE.MathUtils.lerp(Z_DESCANSO_PINZA, cOrigen.z, pSub);
        targetY = THREE.MathUtils.lerp(2.2, yHover, pSub);
        estadoTexto = `APROXIMACIÓN -> CASILLA ${origen.toUpperCase()}`;
      } else if (t < 0.38) {
        // Fase 2: Descender y sujetar la pieza con dedos orientados en diagonal (45°)
        const pSub = (t - 0.22) / 0.16;
        curJ1 = THREE.MathUtils.lerp(ikHoverOrig.j1, ikGripOrig.j1, pSub);
        curJ2 = THREE.MathUtils.lerp(ikHoverOrig.j2, ikGripOrig.j2, pSub);
        curJ3 = THREE.MathUtils.lerp(ikHoverOrig.j3, ikGripOrig.j3, pSub);
        curJ4 = THREE.MathUtils.lerp(ikHoverOrig.j4, ikGripOrig.j4, pSub);
        curJ5 = Math.PI / 2;
        curJ6 = THREE.MathUtils.degToRad(74.33) + curJ1;
        targetX = cOrigen.x;
        targetZ = cOrigen.z;
        targetY = THREE.MathUtils.lerp(yHover, yGrip, pSub);
        pinzaActiva = pSub > 0.4;
        estadoTexto = `SUJETANDO PIEZA EN ${origen.toUpperCase()} (DIAGONAL 45°)`;
      } else if (t < 0.70) {
        // Fase 3: Elevar y trasladar en curva parabólica hacia el destino manteniendo 45° diagonal
        const pSub = (t - 0.38) / 0.32;
        pinzaActiva = true;
        targetX = THREE.MathUtils.lerp(cOrigen.x, cDestino.x, pSub);
        targetZ = THREE.MathUtils.lerp(cOrigen.z, cDestino.z, pSub);
        targetY = yGrip + Math.sin(pSub * Math.PI) * 1.35;
        const ikArc = resolverIKDobot(targetX, targetY, targetZ);
        curJ1 = ikArc.j1;
        curJ2 = ikArc.j2;
        curJ3 = ikArc.j3;
        curJ4 = ikArc.j4;
        curJ5 = Math.PI / 2;
        curJ6 = THREE.MathUtils.degToRad(74.33) + curJ1;

        if (piezaMesh) {
          piezaMesh.position.set(targetX, targetY - 0.91, targetZ);
        }
        estadoTexto = `TRASLADANDO ${origen.toUpperCase()} -> ${destino.toUpperCase()}`;
      } else if (t < 0.85) {
        // Fase 4: Descender sobre la casilla de destino y soltar a 45° diagonal
        const pSub = (t - 0.70) / 0.15;
        curJ1 = THREE.MathUtils.lerp(ikGripDest.j1, ikHoverDest.j1, pSub);
        curJ2 = THREE.MathUtils.lerp(ikGripDest.j2, ikHoverDest.j2, pSub);
        curJ3 = THREE.MathUtils.lerp(ikGripDest.j3, ikHoverDest.j3, pSub);
        curJ4 = THREE.MathUtils.lerp(ikGripDest.j4, ikHoverDest.j4, pSub);
        curJ5 = Math.PI / 2;
        curJ6 = THREE.MathUtils.degToRad(74.33) + curJ1;
        targetX = cDestino.x;
        targetZ = cDestino.z;
        targetY = THREE.MathUtils.lerp(yGrip, yHover, pSub);
        pinzaActiva = pSub < 0.5;

        if (piezaMesh) {
          piezaMesh.position.set(cDestino.x, ALTO_BASE_TABLERO + 0.038, cDestino.z);
        }
        estadoTexto = `POSICIONANDO EN ${destino.toUpperCase()}`;
      } else {
        // Fase 5: Retornar a la Posición Cero oficial calibrada (girando de regreso a RECTO 0°)
        const pSub = (t - 0.85) / 0.15;
        curJ1 = THREE.MathUtils.lerp(ikHoverDest.j1, ANGULOS_CERO_RAD.j1, pSub);
        curJ2 = THREE.MathUtils.lerp(ikHoverDest.j2, ANGULOS_CERO_RAD.j2, pSub);
        curJ3 = THREE.MathUtils.lerp(ikHoverDest.j3, ANGULOS_CERO_RAD.j3, pSub);
        curJ4 = THREE.MathUtils.lerp(ikHoverDest.j4, ANGULOS_CERO_RAD.j4, pSub);
        curJ5 = THREE.MathUtils.lerp(Math.PI / 2, ANGULOS_CERO_RAD.j5, pSub);
        curJ6 = THREE.MathUtils.lerp(j6DiagDest, ANGULOS_CERO_RAD.j6, pSub);
        targetX = THREE.MathUtils.lerp(cDestino.x, 0, pSub);
        targetZ = THREE.MathUtils.lerp(cDestino.z, Z_DESCANSO_PINZA, pSub);
        targetY = THREE.MathUtils.lerp(yHover, 2.2, pSub);
        estadoTexto = t >= 1.0 ? 'EN ESPERA (POSICIÓN CERO / DESCANSO)' : 'RETORNO A POSICIÓN CERO (DESCANSO)';
      }

      // 1. Articular el Gemelo Oficial Dobot CR5AS con Pinza PGE-50-26
      const robotArt = robotArticuladoRef.current;
      if (robotArt) {
        if (robotArt.j1) robotArt.j1.rotation.y = curJ1;
        if (robotArt.j2) robotArt.j2.rotation.z = curJ2;
        if (robotArt.j3) robotArt.j3.rotation.z = curJ3;
        if (robotArt.j4) robotArt.j4.rotation.z = curJ4;
        if (robotArt.j5) robotArt.j5.rotation.y = curJ5;
        if (robotArt.j6) robotArt.j6.rotation.z = curJ6;

        // Carrera de la pinza eléctrica PGE-50-26 (26 mm totales: +-6 mm agarre, +-13 mm abierta)
        const aperturaOficial = pinzaActiva ? 6.0 : 13.0;
        if (robotArt.sliderIzq) robotArt.sliderIzq.position.x = -aperturaOficial;
        if (robotArt.sliderDer) robotArt.sliderDer.position.x = aperturaOficial;
        if (robotArt.dedoIzq) robotArt.dedoIzq.position.x = -aperturaOficial;
        if (robotArt.dedoDer) robotArt.dedoDer.position.x = aperturaOficial;
      }

      // 2. Articular el Brazo Cinemático Esquemático
      if (robot) {
        if (robot.j1) robot.j1.rotation.y = curJ1;
        if (robot.j2) robot.j2.rotation.z = curJ2;
        if (robot.j3) robot.j3.rotation.z = curJ3;
        if (robot.j4) robot.j4.rotation.z = -curJ2 - curJ3;
        if (robot.efector) {
          const efRot = t >= 1.0 || t < 0.02 ? 0 : Math.PI / 4;
          robot.efector.rotation.y = efRot;
        }

        const aperturaSimple = pinzaActiva ? 0.08 : 0.20;
        if (robot.dedoIzq) robot.dedoIzq.position.x = -aperturaSimple;
        if (robot.dedoDer) robot.dedoDer.position.x = aperturaSimple;
      }

      // Mapeo milimétrico a las coordenadas de laboratorio reales (calibracion_local/brazo.json)
      const realX_mm = t >= 1.0 ? 0 : Math.round(targetX * 42.0);
      const realY_mm = t >= 1.0 ? -262 : Math.round(-455 + (targetZ - 2.275) * 46.0);
      const realZ_mm = t >= 1.0 ? 235 : Math.round(235 + (targetY - yGrip) * 75);

      // Actualizar telemetría para el HUD
      setTelemetria({
        estadoRobot: estadoTexto,
        efectorXYZ: {
          x: realX_mm,
          y: realY_mm,
          z: realZ_mm,
        },
        juntasGrados: {
          j1: Math.round(THREE.MathUtils.radToDeg(curJ1)),
          j2: Math.round(THREE.MathUtils.radToDeg(curJ2)),
          j3: Math.round(THREE.MathUtils.radToDeg(curJ3)),
          j4: Math.round(THREE.MathUtils.radToDeg(curJ4)),
          j5: Math.round(THREE.MathUtils.radToDeg(curJ5)),
          j6: Math.round(THREE.MathUtils.radToDeg(curJ6)),
        },
        pinzaActiva,
        maniobraProgreso: Math.round(t * 100),
      });

      if (t < 1.0) {
        requestAnimationFrame(animarManiobra);
      } else {
        setAnimando(false);
        // Actualizar referencia de la pieza en memoria a la casilla destino
        if (piezaMesh) {
          piezasMeshesRef.current.delete(origen);
          piezasMeshesRef.current.set(destino, piezaMesh);
        }
      }
    };

    requestAnimationFrame(animarManiobra);
  }, [jugadaActiva]);

  // Cambiar preset de cámara
  const cambiarPresetCamara = (preset) => {
    setVistaCamara(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === 'isometrica') {
      camera.position.set(4.8, 5.2, -4.6);
      controls.target.set(0, 0.4, 0.8);
    } else if (preset === 'brazo') {
      // Vista desde detrás del hombro del robot hacia el tablero
      camera.position.set(0, 5.2, 6.8);
      controls.target.set(0, 0.5, 0.0);
    } else if (preset === 'cenital') {
      camera.position.set(0.01, 8.5, 0.5);
      controls.target.set(0, 0.3, 0.5);
    } else if (preset === 'blancas') {
      // Vista del jugador humano sentado frente a las piezas blancas
      camera.position.set(0, 4.0, -5.4);
      controls.target.set(0, 0.5, 0.5);
    } else if (preset === 'negras') {
      // Vista desde el bando de las piezas negras (del robot)
      camera.position.set(0, 4.5, 6.6);
      controls.target.set(0, 0.5, 0.0);
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
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/50 border border-cyan-500/20 text-[11px]">
            <span className="text-slate-400">SET:</span>
            <span className="text-[#00e5ff] font-semibold flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${modelosCargados ? 'bg-[#00e5ff]' : 'bg-amber-400 animate-ping'}`}></span>
              {modelosCargados ? 'STAUNTON 3D REAL' : 'CARGANDO 3D...'}
            </span>
          </div>
        </div>

        {/* SELECTOR DE MODELO DEL BRAZO */}
        <div className="flex items-center gap-1 bg-surface-container-lowest p-0.5 rounded-lg border border-cyan-500/30 text-[10px]">
          <button
            type="button"
            onClick={() => setModeloRobot('oficial')}
            className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
              modeloRobot === 'oficial' ? 'bg-[#00e5ff] text-black font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Gemelo digital oficial Dobot CR5AS articulado con pinza PGE-50-26 y cinemática 6-DOF"
          >
            <span>🦾</span> CR5AS Articulado
          </button>
          <button
            type="button"
            onClick={() => setModeloRobot('escaneo')}
            className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
              modeloRobot === 'escaneo' ? 'bg-[#00e5ff] text-black font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Modelo 3D escaneado con cámara real de la universidad (FICCT)"
          >
            <span>📷</span> Escaneo FICCT
          </button>
          <button
            type="button"
            onClick={() => setModeloRobot('cinematico')}
            className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
              modeloRobot === 'cinematico' ? 'bg-[#00e5ff] text-black font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Brazo esquemático simple 6-DOF"
          >
            <span>📐</span> Cinemática Simple
          </button>
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
            Blancas
          </button>
          <button
            type="button"
            onClick={() => cambiarPresetCamara('negras')}
            className={`px-2 py-1 rounded transition-all ${
              vistaCamara === 'negras' ? 'bg-[#00e5ff] text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Negras
          </button>
        </div>
      </div>

      {/* 1b. BARRA DE PRUEBAS DE JUGADA Y CINEMÁTICA EN VIVO */}
      <div className="relative z-10 w-full px-4 py-1.5 bg-[#080a10]/95 border-b border-[#00e5ff]/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[#00e5ff] font-semibold flex items-center gap-1 text-[11px] mr-1">
            <span>🕹️</span> PROBAR AGARRE:
          </span>
          <button
            type="button"
            onClick={() => dispararJugadaPrueba('e7e5')}
            disabled={animando}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/30 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-40"
            title="Probar agarre y traslado de peón de e7 a e5"
          >
            ▶ Peón e7→e5
          </button>
          <button
            type="button"
            onClick={() => dispararJugadaPrueba('g8f6')}
            disabled={animando}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/30 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-40"
            title="Probar agarre y salto de caballo de g8 a f6"
          >
            ▶ Caballo g8→f6
          </button>
          <button
            type="button"
            onClick={() => dispararJugadaPrueba('d7d5')}
            disabled={animando}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/30 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-40"
            title="Probar agarre de peón dama de d7 a d5"
          >
            ▶ Peón d7→d5
          </button>
          <button
            type="button"
            onClick={() => dispararJugadaPrueba('b8c6')}
            disabled={animando}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/30 text-slate-200 text-[11px] font-semibold transition-all disabled:opacity-40"
            title="Probar agarre de caballo de b8 a c6"
          >
            ▶ Caballo b8→c6
          </button>
        </div>

        {/* Input manual de jugada UCI y botón Reset */}
        <form onSubmit={manejarEnvioManual} className="flex items-center gap-1.5">
          <input
            type="text"
            value={inputUci}
            onChange={(e) => setInputUci(e.target.value.toLowerCase())}
            placeholder="ej. e7e5"
            maxLength={4}
            className="w-16 px-2 py-0.5 rounded bg-black/60 border border-white/20 text-center font-mono text-[11px] text-[#00e5ff] focus:outline-none focus:border-[#00e5ff]"
          />
          <button
            type="submit"
            disabled={animando || inputUci.length < 4}
            className="px-2.5 py-1 rounded bg-[#00e5ff]/20 hover:bg-[#00e5ff] hover:text-black border border-[#00e5ff]/40 text-[#00e5ff] text-[11px] font-bold transition-all disabled:opacity-40"
          >
            Mover
          </button>
          <button
            type="button"
            onClick={reiniciarPosicionPiezas}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-[11px] transition-all ml-1"
            title="Reiniciar piezas y robot a posición inicial"
          >
            ↺ Reset
          </button>
        </form>
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
                PINZA PGE-50: {telemetria.pinzaActiva ? 'AGARRE (ON)' : 'ABIERTA (OFF)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-300 font-semibold">
              <span>X: {telemetria.efectorXYZ.x} mm</span>
              <span>Y: {telemetria.efectorXYZ.y} mm</span>
              <span>Z: {telemetria.efectorXYZ.z} mm</span>
            </div>
            <div className="text-[9px] text-slate-400 pt-1 border-t border-white/5 grid grid-cols-6 gap-1">
              <span>J1: {telemetria.juntasGrados.j1}°</span>
              <span>J2: {telemetria.juntasGrados.j2}°</span>
              <span>J3: {telemetria.juntasGrados.j3}°</span>
              <span>J4: {telemetria.juntasGrados.j4}°</span>
              <span>J5: {telemetria.juntasGrados.j5}°</span>
              <span>J6: {telemetria.juntasGrados.j6}°</span>
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
