import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Catálogo de modelos 3D GLTF / GLB disponibles
 */
const MODELOS_CATALOGO = [
  {
    id: 'readyplayer_me',
    nombre: 'Ready Player Me',
    tipo: 'Meta Humanoid',
    icono: 'person',
    ruta: '/models/readyplayer.me.glb',
    descripcion: 'Avatar humanoide completo estilo Meta Avatars con rigging y gestos faciales.',
  },
  {
    id: 'facecap',
    nombre: 'Digital Human ARKit',
    tipo: 'Fotorrealista 52 Morphs',
    icono: 'sentiment_very_satisfied',
    ruta: '/models/facecap.glb',
    descripcion: 'Rostro digital de alta fidelidad con las 52 micro-expresiones de Apple ARKit.',
  },
  {
    id: 'robot_expressive',
    nombre: 'Robot Expresivo',
    tipo: 'Androide 3D',
    icono: 'smart_toy',
    ruta: '/models/RobotExpressive.glb',
    descripcion: 'Robot 3D con expresiones faciales (Angry, Sad, Surprised) y clips horneados.',
  },
  {
    id: 'xbot',
    nombre: 'Mixamo Xbot',
    tipo: 'Rigged Avatar',
    icono: 'accessibility_new',
    ruta: '/models/Xbot.glb',
    descripcion: 'Personaje humanoide con rigging cinemático completo Mixamo.',
  },
  {
    id: 'holograma',
    nombre: 'Ciber-Holograma',
    tipo: 'Procedural',
    icono: 'memory',
    ruta: null,
    descripcion: 'Entidad de IA procedural con pulso tensorial y anillos cuánticos.',
  },
];

/**
 * Motor de Facetas Emocionales: calcula el estado psicológico y la expresión
 * del agente en base a la evaluación, posición, jaques y tiempo de cálculo.
 */
function calcularFacetaEmocional({
  pensando,
  evaluacionCp = 0,
  mateEn = null,
  terminada = false,
  resultado = null,
  cantidadJugadas = 0,
  ultimoMovimiento = null,
}) {
  // 1. Partida Terminada
  if (terminada) {
    if (resultado === '0-1') {
      return {
        id: 'VICTORIA_MAGISTRAL',
        titulo: 'Victoria Magistral',
        icono: '👑',
        color: '#10b981', // Esmeralda
        descripcion: 'La IA ha ganado la partida. Júbilo y sonrisa triunfante.',
        emocion: 'victoria',
        sonrisa: 0.9,
        cejasUp: 0.3,
        cejasDown: 0.0,
        ojosSquint: 0.2,
        ojosWide: 0.1,
        bocaAbierta: 0.0,
      };
    }
    if (resultado === '1-0') {
      return {
        id: 'DERROTA_RESIGNADA',
        titulo: 'Derrota Reconocida',
        icono: '💔',
        color: '#f43f5e', // Rosa / Carmesí
        descripcion: 'El humano ha superado a la IA. Mirada gacha y tristeza resignada.',
        emocion: 'derrota',
        sonrisa: 0.0,
        cejasUp: 0.6,
        cejasDown: 0.5,
        ojosSquint: 0.3,
        ojosWide: 0.0,
        bocaAbierta: 0.0,
      };
    }
    return {
      id: 'TABLAS_EQUILIBRIO',
      titulo: 'Tablas Acordadas',
      icono: '🤝',
      color: '#00e5ff',
      descripcion: 'Partida concluida en empate técnico.',
      emocion: 'neutral',
      sonrisa: 0.2,
      cejasUp: 0.0,
      cejasDown: 0.0,
      ojosSquint: 0.0,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 2. IA pensando activamente en este instante (Inferencia v5)
  if (pensando) {
    return {
      id: 'PENSAMIENTO_PROFUNDO',
      titulo: 'Cálculo Tensorial v5',
      icono: '🧠',
      color: '#00e5ff', // Cian de alta concentración
      descripcion: 'Explorando matrices SE-ResNet. Ceño concentrado y sacadas oculares.',
      emocion: 'pensando',
      sonrisa: 0.0,
      cejasUp: 0.1,
      cejasDown: 0.65, // Ceño fruncido
      ojosSquint: 0.55, // Ojos entrecerrados
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 3. Red de Mate Anunciada
  if (mateEn !== null && mateEn !== undefined) {
    if (mateEn < 0) {
      // Mate a favor de la IA (Negras)
      return {
        id: 'MATE_INMINENTE',
        titulo: `Mate en ${Math.abs(mateEn)} (Triunfo IA)`,
        icono: '🏆',
        color: '#f59e0b', // Dorado
        descripcion: 'Red de mate detectada sin escape. Sonrisa amplia y desafiante.',
        emocion: 'triunfo',
        sonrisa: 0.85,
        cejasUp: 0.35,
        cejasDown: 0.0,
        ojosSquint: 0.3,
        ojosWide: 0.2,
        bocaAbierta: 0.1,
      };
    } else {
      // Mate a favor del Jugador (Blancas)
      return {
        id: 'PELIGRO_EXTREMO',
        titulo: `Peligro Crítico: Mate en ${mateEn}`,
        icono: '🚨',
        color: '#ef4444', // Rojo peligro
        descripcion: 'Rey negro bajo asedio inevitable. Alarma y ojos desorbitados.',
        emocion: 'alarma',
        sonrisa: 0.0,
        cejasUp: 0.8,
        cejasDown: 0.2,
        ojosSquint: 0.0,
        ojosWide: 0.85,
        bocaAbierta: 0.45,
      };
    }
  }

  // 4. Detección de Jaque en la última jugada
  const ultimoSan = typeof ultimoMovimiento === 'string' ? ultimoMovimiento : ultimoMovimiento?.san;
  const esJaque = Boolean(ultimoSan && ultimoSan.includes('+'));

  if (esJaque) {
    // Si la última jugada fue par (IA acaba de mover), la IA entregó el jaque
    const turnoBlancas = cantidadJugadas % 2 === 0;
    if (turnoBlancas) {
      return {
        id: 'JAQUE_ENTREGADO',
        titulo: '¡Jaque al Rey Rival!',
        icono: '⚔️',
        color: '#00e5ff',
        descripcion: 'Ataque frontal. Mirada penetrante e inquisitiva al rival.',
        emocion: 'desafio',
        sonrisa: 0.45,
        cejasUp: 0.4,
        cejasDown: 0.2,
        ojosSquint: 0.3,
        ojosWide: 0.2,
        bocaAbierta: 0.0,
      };
    } else {
      return {
        id: 'JAQUE_RECIBIDO',
        titulo: 'Rey Propio en Jaque',
        icono: '🛡️',
        color: '#f97316', // Naranja
        descripcion: 'Rey amenazado. Búsqueda urgente de casillas de escape.',
        emocion: 'tension',
        sonrisa: 0.0,
        cejasUp: 0.7,
        cejasDown: 0.3,
        ojosSquint: 0.2,
        ojosWide: 0.5,
        bocaAbierta: 0.2,
      };
    }
  }

  // 5. Según la evaluación en Centipawns (Perspectiva IA: Negativo = Ventaja Negras/IA)
  if (evaluacionCp <= -220) {
    return {
      id: 'GRAN_VENTAJA',
      titulo: `Gran Ventaja IA (${(evaluacionCp / -100).toFixed(1)})`,
      icono: '😎',
      color: '#10b981', // Verde
      descripcion: 'Posición dominante. Sonrisa confiada y cabeza erguida.',
      emocion: 'confianza_alta',
      sonrisa: 0.75,
      cejasUp: 0.2,
      cejasDown: 0.0,
      ojosSquint: 0.35,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }
  if (evaluacionCp <= -60) {
    return {
      id: 'VENTAJA_TACTICA',
      titulo: `Ventaja Táctica (${(evaluacionCp / -100).toFixed(1)})`,
      icono: '😏',
      color: '#34d399',
      descripcion: 'Iniciativa y mejor estructura. Media sonrisa y mirada firme.',
      emocion: 'confianza',
      sonrisa: 0.45,
      cejasUp: 0.15,
      cejasDown: 0.1,
      ojosSquint: 0.2,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }
  if (evaluacionCp >= 220) {
    return {
      id: 'DESVENTAJA_SEVERA',
      titulo: `Desventaja Severa (+${(evaluacionCp / 100).toFixed(1)})`,
      icono: '😰',
      color: '#ef4444',
      descripcion: 'Déficit de material o ataque rival. Ceño preocupado y tensión.',
      emocion: 'alarma',
      sonrisa: 0.0,
      cejasUp: 0.75,
      cejasDown: 0.3,
      ojosSquint: 0.1,
      ojosWide: 0.6,
      bocaAbierta: 0.25,
    };
  }
  if (evaluacionCp >= 60) {
    return {
      id: 'BAJO_PRESION',
      titulo: `Bajo Presión (+${(evaluacionCp / 100).toFixed(1)})`,
      icono: '😟',
      color: '#fb923c',
      descripcion: 'Posición incómoda. Mirada tensa y ligera duda.',
      emocion: 'preocupacion',
      sonrisa: 0.0,
      cejasUp: 0.55,
      cejasDown: 0.35,
      ojosSquint: 0.25,
      ojosWide: 0.1,
      bocaAbierta: 0.0,
    };
  }

  // 6. Apertura temprana
  if (cantidadJugadas <= 6) {
    return {
      id: 'APERTURA',
      titulo: 'Fase de Apertura',
      icono: '📚',
      color: '#38bdf8',
      descripcion: 'Desarrollando piezas según patrones de Grandes Maestros.',
      emocion: 'neutral_atenta',
      sonrisa: 0.1,
      cejasUp: 0.0,
      cejasDown: 0.1,
      ojosSquint: 0.1,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 7. Por defecto: Posición Equilibrada
  return {
    id: 'EQUILIBRIO',
    titulo: 'Posición Equilibrada',
    icono: '⚖️',
    color: '#00e5ff',
    descripcion: 'Partida pareja. Evaluación neutral de variantes.',
    emocion: 'neutral',
    sonrisa: 0.0,
    cejasUp: 0.0,
    cejasDown: 0.0,
    ojosSquint: 0.0,
    ojosWide: 0.0,
    bocaAbierta: 0.0,
  };
}

export default function AvatarAgente3D({
  pensando = false,
  tipoOponente = 'modelo',
  evaluacionCp = 0,
  mateEn = null,
  ultimoMovimiento = null,
  cantidadJugadas = 0,
  terminada = false,
  resultado = null,
}) {
  const mountRef = useRef(null);
  const [modeloActivo, setModeloActivo] = useState('readyplayer_me');
  const [cargandoModelo, setCargandoModelo] = useState(false);
  const [progresoCarga, setProgresoCarga] = useState(0);
  const [facetaForzada, setFacetaForzada] = useState(null);
  const [urlPersonalizada, setUrlPersonalizada] = useState('');
  const [mostrarCustomInput, setMostrarCustomInput] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  // Referencias para el loop y el renderer
  const controlsRef = useRef(null);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const activeActionRef = useRef(null);
  const bonesRef = useRef({ head: null, neck: null, spine: null });
  const morphMeshesRef = useRef([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const clockRef = useRef(new THREE.Clock());
  const resetCameraRef = useRef(null);
  const luzFacetaRef = useRef(null);
  const baseDiscoMatRef = useRef(null);

  // Calcular la Faceta Emocional actual (automática o forzada por prueba)
  const facetaActual = useMemo(() => {
    if (facetaForzada) return facetaForzada;
    return calcularFacetaEmocional({
      pensando,
      evaluacionCp,
      mateEn,
      terminada,
      resultado,
      cantidadJugadas,
      ultimoMovimiento,
    });
  }, [facetaForzada, pensando, evaluacionCp, mateEn, terminada, resultado, cantidadJugadas, ultimoMovimiento]);

  // Transición suave entre animaciones
  const fadeToAction = useCallback((name, duration = 0.4) => {
    const actions = actionsRef.current;
    if (!actions || !actions[name]) return;

    const previousAction = activeActionRef.current;
    const nextAction = actions[name];

    if (previousAction !== nextAction) {
      if (previousAction) {
        previousAction.fadeOut(duration);
      }
      nextAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();

      activeActionRef.current = nextAction;
    }
  }, []);

  // Reaccionar a la faceta emocional con animaciones horneadas (Robot / Xbot)
  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;

    const emocion = facetaActual.emocion;

    if (modeloActivo === 'robot_expressive') {
      if (emocion === 'pensando') {
        fadeToAction('Yes', 0.3);
      } else if (emocion === 'triunfo' || emocion === 'victoria') {
        fadeToAction('ThumbsUp', 0.4);
      } else if (emocion === 'alarma' || emocion === 'derrota') {
        fadeToAction('Death', 0.5);
      } else if (emocion === 'preocupacion') {
        fadeToAction('No', 0.3);
      } else {
        fadeToAction('Idle', 0.5);
      }
    } else if (modeloActivo === 'xbot') {
      if (emocion === 'pensando' || emocion === 'confianza' || emocion === 'victoria') {
        fadeToAction('agree', 0.3);
      } else if (emocion === 'preocupacion' || emocion === 'alarma') {
        fadeToAction('headShake', 0.3);
      } else if (emocion === 'derrota') {
        fadeToAction('sad_pose', 0.5);
      } else {
        fadeToAction('idle', 0.4);
      }
    }
  }, [facetaActual, modeloActivo, fadeToAction]);

  // Montaje y Renderizado de Three.js
  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 280;
    const alto = contenedor.clientHeight || 260;

    // 1. Escena y Cámara
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, ancho / alto, 0.1, 100);

    // Ajustar posición de cámara según el modelo (facecap es un rostro close-up, readyplayer es cuerpo)
    if (modeloActivo === 'facecap') {
      camera.position.set(0, 1.45, 1.15);
    } else {
      camera.position.set(0, 1.42, 2.15);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.6;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, modeloActivo === 'facecap' ? 1.4 : 1.3, 0);
    controlsRef.current = controls;

    resetCameraRef.current = () => {
      if (modeloActivo === 'facecap') {
        camera.position.set(0, 1.45, 1.15);
        controls.target.set(0, 1.4, 0);
      } else {
        camera.position.set(0, 1.42, 2.15);
        controls.target.set(0, 1.3, 0);
      }
      controls.update();
    };

    // 3. Iluminación Dinámica
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0x00e5ff, 2.6);
    luzClave.position.set(2, 4, 3);
    luzClave.castShadow = true;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x8b5cf6, 1.5);
    luzRelleno.position.set(-2.5, 1, 2);
    scene.add(luzRelleno);

    const luzContorno = new THREE.PointLight(0x00e5ff, 3.2, 8);
    luzContorno.position.set(0, 2.2, -1.8);
    scene.add(luzContorno);

    // Luz de Faceta Emocional (tiñe el rostro según el estado anímico)
    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.4, 3.2);
    luzFaceta.position.set(0, 1.55, 0.85);
    scene.add(luzFaceta);
    luzFacetaRef.current = luzFaceta;

    // Plataforma / Disco holográfico
    const discoGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.02, 32);
    const discoMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    baseDiscoMatRef.current = discoMat;
    const baseDisco = new THREE.Mesh(discoGeo, discoMat);
    baseDisco.position.y = 0;
    scene.add(baseDisco);

    const anilloGeo = new THREE.RingGeometry(0.71, 0.74, 36);
    const anilloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const anillo = new THREE.Mesh(anilloGeo, anilloMat);
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.012;
    scene.add(anillo);

    // 4. Carga del Modelo
    mixerRef.current = null;
    actionsRef.current = {};
    activeActionRef.current = null;
    bonesRef.current = { head: null, neck: null, spine: null };
    morphMeshesRef.current = [];

    const modeloInfo = MODELOS_CATALOGO.find((m) => m.id === modeloActivo);
    const rutaCarga = urlPersonalizada.trim() || modeloInfo?.ruta;

    if (modeloActivo === 'holograma' || !rutaCarga) {
      setCargandoModelo(false);
      const grupoProcedural = new THREE.Group();
      scene.add(grupoProcedural);

      const matMetal = new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.9, roughness: 0.25 });
      const matVisor = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2.2 });

      const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), matMetal);
      craneo.position.set(0, 1.45, 0);
      grupoProcedural.add(craneo);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.25), matVisor);
      visor.position.set(0, 1.48, 0.42);
      grupoProcedural.add(visor);
    } else {
      setCargandoModelo(true);
      setErrorCarga(null);
      setProgresoCarga(0);

      const loader = new GLTFLoader();
      loader.load(
        rutaCarga,
        (gltf) => {
          const root = gltf.scene;
          root.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              if (obj.morphTargetDictionary) {
                morphMeshesRef.current.push(obj);
              }
            }
            const nameLower = (obj.name || '').toLowerCase();
            if (nameLower.includes('head') && !bonesRef.current.head) {
              bonesRef.current.head = obj;
            } else if (nameLower.includes('neck') && !bonesRef.current.neck) {
              bonesRef.current.neck = obj;
            } else if (nameLower.includes('spine') && !bonesRef.current.spine) {
              bonesRef.current.spine = obj;
            }
          });

          // Normalizar y centrar escala
          const bbox = new THREE.Box3().setFromObject(root);
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const escalaDeseada = modeloActivo === 'facecap' ? 1.1 : 1.75 / (maxDim || 1);
          root.scale.setScalar(escalaDeseada);

          const bboxAjustado = new THREE.Box3().setFromObject(root);
          if (modeloActivo === 'facecap') {
            root.position.set(0, 1.4, 0);
          } else {
            root.position.y = -bboxAjustado.min.y;
            root.position.x = -(bboxAjustado.min.x + bboxAjustado.max.x) / 2;
            root.position.z = -(bboxAjustado.min.z + bboxAjustado.max.z) / 2;
          }

          scene.add(root);

          // Configurar Animaciones
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            mixerRef.current = mixer;
            const actions = {};
            gltf.animations.forEach((clip) => {
              actions[clip.name] = mixer.clipAction(clip);
            });
            actionsRef.current = actions;

            const defaultClip =
              actions['Idle'] || actions['idle'] || actions['Standing'] || Object.values(actions)[0];
            if (defaultClip) {
              defaultClip.play();
              activeActionRef.current = defaultClip;
            }
          }

          setCargandoModelo(false);
          setProgresoCarga(100);
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            setProgresoCarga(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('Error al cargar avatar:', err);
          setErrorCarga('No se pudo cargar el modelo 3D. Seleccionando holograma de respaldo.');
          setCargandoModelo(false);
          setModeloActivo('holograma');
        }
      );
    }

    // 5. Head Tracking
    const manejarMouseMove = (e) => {
      const rect = contenedor.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };

    window.addEventListener('mousemove', manejarMouseMove);

    // 6. Bucle de Animación con Interpolación de Micro-Expresiones
    let blinkTimer = 0;
    let saccadeTimer = 0;
    let saccadeOffset = { x: 0, y: 0 };

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Actualizar AnimationMixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // A. Actualizar color de la luz ambiental según la faceta emocional
      if (luzFacetaRef.current && facetaActual) {
        const colorObjetivo = new THREE.Color(facetaActual.color);
        luzFacetaRef.current.color.lerp(colorObjetivo, 0.05);
        if (baseDiscoMatRef.current) {
          baseDiscoMatRef.current.emissive.lerp(colorObjetivo, 0.05);
        }
      }

      // B. Procedural Head Tracking con micro-movimientos de cálculo
      const { head, neck } = bonesRef.current;
      if (head) {
        // Sacadas oculares / micro-movimientos al pensar
        saccadeTimer += delta;
        if (facetaActual.emocion === 'pensando' && saccadeTimer > 0.8) {
          saccadeTimer = 0;
          saccadeOffset = {
            x: (Math.random() - 0.5) * 0.12,
            y: (Math.random() - 0.5) * 0.08,
          };
        } else if (facetaActual.emocion !== 'pensando') {
          saccadeOffset = { x: 0, y: 0 };
        }

        const targetRotY = mousePosRef.current.x * 0.45 + saccadeOffset.x;
        let targetRotX = -mousePosRef.current.y * 0.35 + saccadeOffset.y;

        // Si está pensando, inclina la cabeza hacia abajo analizando el tablero
        if (facetaActual.emocion === 'pensando') {
          targetRotX += 0.22;
        } else if (facetaActual.emocion === 'confianza_alta') {
          targetRotX -= 0.12; // Barbilla ligeramente erguida
        } else if (facetaActual.emocion === 'derrota') {
          targetRotX += 0.32; // Cabeza gacha
        }

        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.08);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.08);
      }
      if (neck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, mousePosRef.current.x * 0.2, 0.06);
      }

      // C. Interpolación Dinámica de Blendshapes (Micro-expresiones en tiempo real)
      blinkTimer += delta;
      const blinkCadence = facetaActual.emocion === 'pensando' ? 4.5 : 3.0;
      const isBlinking = blinkTimer % blinkCadence < 0.14;
      const blinkTarget = isBlinking ? Math.sin((blinkTimer % blinkCadence) * 22) : 0;

      if (morphMeshesRef.current.length > 0) {
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (!dict || !infl) return;

          // Helper para aplicar lerp a un blendshape
          const aplicarLerp = (nombre, objetivo, velocidad = 0.1) => {
            const idx = dict[nombre];
            if (idx !== undefined) {
              infl[idx] = THREE.MathUtils.lerp(infl[idx], objetivo, velocidad);
            }
          };

          // 1. Ready Player Me (mouthSmile, mouthOpen, eyeBlink)
          aplicarLerp('mouthSmile', facetaActual.sonrisa, 0.08);
          aplicarLerp('mouthOpen', facetaActual.bocaAbierta, 0.1);
          aplicarLerp('eyeBlinkLeft', blinkTarget, 0.25);
          aplicarLerp('eyeBlinkRight', blinkTarget, 0.25);

          // 2. Robot Expressive (Head: Angry, Surprised, Sad)
          if (dict['Angry'] !== undefined) {
            const angryTarget = facetaActual.emocion === 'alarma' || facetaActual.emocion === 'tension' ? 0.8 : 0;
            aplicarLerp('Angry', angryTarget, 0.08);
          }
          if (dict['Surprised'] !== undefined) {
            const surprisedTarget = facetaActual.ojosWide > 0.4 ? 0.85 : 0;
            aplicarLerp('Surprised', surprisedTarget, 0.1);
          }
          if (dict['Sad'] !== undefined) {
            const sadTarget = facetaActual.emocion === 'derrota' || facetaActual.emocion === 'preocupacion' ? 0.85 : 0;
            aplicarLerp('Sad', sadTarget, 0.08);
          }

          // 3. Digital Human ARKit (facecap.glb - Full 52 Blendshapes)
          aplicarLerp('eyeBlink_L', blinkTarget, 0.3);
          aplicarLerp('eyeBlink_R', blinkTarget, 0.3);

          aplicarLerp('browDown_L', facetaActual.cejasDown, 0.08);
          aplicarLerp('browDown_R', facetaActual.cejasDown, 0.08);
          aplicarLerp('browInnerUp', facetaActual.cejasUp, 0.08);

          aplicarLerp('eyeSquint_L', facetaActual.ojosSquint, 0.08);
          aplicarLerp('eyeSquint_R', facetaActual.ojosSquint, 0.08);
          aplicarLerp('eyeWide_L', facetaActual.ojosWide, 0.1);
          aplicarLerp('eyeWide_R', facetaActual.ojosWide, 0.1);

          aplicarLerp('mouthSmile_L', facetaActual.sonrisa, 0.08);
          aplicarLerp('mouthSmile_R', facetaActual.sonrisa * 0.9, 0.08); // Leve asimetría natural
          aplicarLerp('jawOpen', facetaActual.bocaAbierta, 0.1);

          if (facetaActual.emocion === 'preocupacion' || facetaActual.emocion === 'derrota') {
            aplicarLerp('mouthFrown_L', 0.55, 0.08);
            aplicarLerp('mouthFrown_R', 0.55, 0.08);
          } else {
            aplicarLerp('mouthFrown_L', 0.0, 0.08);
            aplicarLerp('mouthFrown_R', 0.0, 0.08);
          }

          if (facetaActual.emocion === 'pensando') {
            aplicarLerp('mouthPress_L', 0.3, 0.08);
            aplicarLerp('mouthPress_R', 0.3, 0.08);
          } else {
            aplicarLerp('mouthPress_L', 0.0, 0.08);
            aplicarLerp('mouthPress_R', 0.0, 0.08);
          }
        });
      }

      // D. Pulso de pensamiento en iluminación
      if (facetaActual.emocion === 'pensando') {
        if (luzFacetaRef.current) {
          luzFacetaRef.current.intensity = 1.8 + Math.sin(elapsed * 10) * 1.0;
        }
        anillo.rotation.z += 0.04;
      } else {
        if (luzFacetaRef.current) {
          luzFacetaRef.current.intensity = 1.2;
        }
        anillo.rotation.z += 0.005;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', manejarMouseMove);
      controls.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [modeloActivo, urlPersonalizada, facetaActual]);

  return (
    <div className="bg-surface-container-low rounded-xl p-3.5 shadow-xl flex flex-col gap-2.5 border border-outline-variant/30 relative overflow-hidden">
      {/* CABECERA Y METADATOS DEL AGENTE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
              style={{ backgroundColor: facetaActual.color }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: facetaActual.color }}
            />
          </span>
          <span className="font-mono-micro text-[11px] font-bold text-slate-200 uppercase tracking-wide">
            {MODELOS_CATALOGO.find((m) => m.id === modeloActivo)?.nombre || 'AVATAR 3D'}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-[#00e5ff] border border-[#00e5ff]/30 font-semibold">
          {tipoOponente === 'modelo' ? 'IA v5 AUTÓNOMA' : 'STOCKFISH 16'}
        </span>
      </div>

      {/* SELECTOR DE MODELO 3D (TABS GLTF / GLB) */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[9px] font-mono">
        {MODELOS_CATALOGO.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => {
              setModeloActivo(mod.id);
              setUrlPersonalizada('');
              setMostrarCustomInput(false);
            }}
            className={`py-1.5 px-0.5 rounded flex flex-col items-center justify-center gap-0.5 transition-all ${
              modeloActivo === mod.id && !mostrarCustomInput
                ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={mod.descripcion}
          >
            <span className="material-symbols-outlined text-[14px]">{mod.icono}</span>
            <span className="truncate w-full text-center">{mod.nombre.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ÁREA DE VISUALIZACIÓN THREE.JS VIEWPORT */}
      <div className="relative w-full h-[260px] rounded-lg overflow-hidden bg-gradient-to-b from-[#0a0d14] to-[#111319] border border-white/10 flex items-center justify-center group">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* SPINNER DE CARGA DEL MODELO */}
        {cargandoModelo && (
          <div className="absolute inset-0 bg-[#0c0e14]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-8 h-8 border-2 border-[#00e5ff]/20 border-t-[#00e5ff] rounded-full animate-spin" />
            <span className="font-mono text-[11px] text-[#00e5ff] tracking-wider animate-pulse">
              DESCARGANDO MODELO 3D ({progresoCarga}%)...
            </span>
          </div>
        )}

        {/* BADGE DE FACETA EMOCIONAL EN TIEMPO REAL */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none max-w-[85%]">
          <div
            className="px-2.5 py-1 rounded bg-black/75 border backdrop-blur-md flex items-center gap-1.5 text-[11px] font-mono shadow-lg transition-all duration-300"
            style={{ borderColor: `${facetaActual.color}66` }}
          >
            <span className="text-[13px]">{facetaActual.icono}</span>
            <span className="font-bold tracking-wide" style={{ color: facetaActual.color }}>
              {facetaActual.titulo}
            </span>
          </div>
          <p className="mt-1 text-[9px] font-mono text-slate-400 drop-shadow-md bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm truncate">
            {facetaActual.descripcion}
          </p>
        </div>

        {/* BOTÓN CENTRAR CÁMARA */}
        <button
          type="button"
          onClick={() => resetCameraRef.current?.()}
          className="absolute bottom-2 right-2 p-1.5 rounded bg-black/60 hover:bg-[#00e5ff]/20 border border-white/10 hover:border-[#00e5ff]/40 text-slate-300 hover:text-[#00e5ff] text-[10px] font-mono transition-all z-10 flex items-center gap-1"
          title="Centrar y reajustar cámara frontal"
        >
          <span className="material-symbols-outlined text-[13px]">center_focus_strong</span>
          <span>Centrar</span>
        </button>

        {/* GUÍA TÁCTIL */}
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-500 pointer-events-none opacity-60">
          Arrastra para rotar 360°
        </div>
      </div>

      {/* BANDEJA DE CONTROL DE FACETAS Y MICRO-EXPRESIONES (TESTING INTERACTIVO) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span>FACETA ACTUAL:</span>
            {facetaForzada ? (
              <button
                type="button"
                onClick={() => setFacetaForzada(null)}
                className="text-[#00e5ff] underline hover:text-white"
              >
                (Restablecer a Juego Real)
              </button>
            ) : (
              <span className="text-emerald-400 font-bold">• Reactivo al Juego</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setMostrarCustomInput(!mostrarCustomInput)}
            className="text-[#00e5ff] hover:underline"
          >
            {mostrarCustomInput ? 'Ocultar URL' : '+ URL Personalizada'}
          </button>
        </div>

        {/* BOTONES PARA PROBAR MICRO-EXPRESIONES DIRECTAMENTE */}
        <div className="grid grid-cols-5 gap-1 font-mono text-[9px]">
          <button
            type="button"
            onClick={() =>
              setFacetaForzada({
                id: 'FORZADO_PENSAR',
                titulo: 'Cálculo Intenso',
                icono: '🧠',
                color: '#00e5ff',
                descripcion: 'Ceño fruncido, ojos entrecerrados y concentración tensorial.',
                emocion: 'pensando',
                sonrisa: 0.0,
                cejasUp: 0.1,
                cejasDown: 0.7,
                ojosSquint: 0.6,
                ojosWide: 0.0,
                bocaAbierta: 0.0,
              })
            }
            className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] transition border border-white/5 text-center truncate"
            title="Probar micro-expresión de pensamiento profundo"
          >
            🧠 Pensar
          </button>
          <button
            type="button"
            onClick={() =>
              setFacetaForzada({
                id: 'FORZADO_CONFIANZA',
                titulo: 'Confianza Táctica',
                icono: '😏',
                color: '#34d399',
                descripcion: 'Sonrisa asimétrica, ceja arqueada y barbilla alta.',
                emocion: 'confianza',
                sonrisa: 0.65,
                cejasUp: 0.25,
                cejasDown: 0.0,
                ojosSquint: 0.2,
                ojosWide: 0.0,
                bocaAbierta: 0.0,
              })
            }
            className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-emerald-500/20 hover:text-emerald-400 transition border border-white/5 text-center truncate"
            title="Probar sonrisa de ventaja táctica"
          >
            😏 Confianza
          </button>
          <button
            type="button"
            onClick={() =>
              setFacetaForzada({
                id: 'FORZADO_TRIUNFO',
                titulo: 'Triunfo Decisivo',
                icono: '🏆',
                color: '#f59e0b',
                descripcion: 'Sonrisa amplia triunfal y ojos iluminados.',
                emocion: 'triunfo',
                sonrisa: 0.9,
                cejasUp: 0.35,
                cejasDown: 0.0,
                ojosSquint: 0.2,
                ojosWide: 0.2,
                bocaAbierta: 0.1,
              })
            }
            className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-amber-500/20 hover:text-amber-400 transition border border-white/5 text-center truncate"
            title="Probar expresión de victoria inminente"
          >
            🏆 Triunfo
          </button>
          <button
            type="button"
            onClick={() =>
              setFacetaForzada({
                id: 'FORZADO_PRESION',
                titulo: 'Bajo Presión',
                icono: '😟',
                color: '#fb923c',
                descripcion: 'Boca en arco hacia abajo, cejas preocupadas y tensión.',
                emocion: 'preocupacion',
                sonrisa: 0.0,
                cejasUp: 0.6,
                cejasDown: 0.4,
                ojosSquint: 0.25,
                ojosWide: 0.1,
                bocaAbierta: 0.0,
              })
            }
            className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-orange-500/20 hover:text-orange-400 transition border border-white/5 text-center truncate"
            title="Probar faceta de preocupación bajo ataque"
          >
            😟 Presión
          </button>
          <button
            type="button"
            onClick={() =>
              setFacetaForzada({
                id: 'FORZADO_SORPRESA',
                titulo: '¡Sorpresa / Blunder!',
                icono: '💥',
                color: '#ef4444',
                descripcion: 'Ojos muy abiertos, boca abierta en asombro y cejas disparadas.',
                emocion: 'alarma',
                sonrisa: 0.0,
                cejasUp: 0.85,
                cejasDown: 0.1,
                ojosSquint: 0.0,
                ojosWide: 0.9,
                bocaAbierta: 0.45,
              })
            }
            className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-rose-500/20 hover:text-rose-400 transition border border-white/5 text-center truncate"
            title="Probar expresión de sorpresa o giro inesperado"
          >
            💥 Sorpresa
          </button>
        </div>

        {/* INPUT DE URL PERSONALIZADA (READY PLAYER ME .GLB) */}
        {mostrarCustomInput && (
          <div className="mt-1 p-2 rounded bg-surface-container-lowest border border-[#00e5ff]/30 flex flex-col gap-1.5 text-[11px] font-mono">
            <span className="text-slate-300 text-[10px]">
              Ingresa cualquier URL pública de Ready Player Me (.glb):
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="https://models.readyplayer.me/...glb"
                value={urlPersonalizada}
                onChange={(e) => setUrlPersonalizada(e.target.value)}
                className="flex-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white text-[10px] focus:outline-none focus:border-[#00e5ff]"
              />
              <button
                type="button"
                onClick={() => setModeloActivo('custom')}
                disabled={!urlPersonalizada.trim()}
                className="px-2.5 py-1 rounded bg-[#00e5ff] text-black font-bold disabled:opacity-40 text-[10px]"
              >
                Cargar
              </button>
            </div>
            {errorCarga && <span className="text-rose-400 text-[9px]">{errorCarga}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
