import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import AvatarMetaPerson3D from './AvatarMetaPerson3D';

/**
 * Catálogo de modelos 3D disponibles
 */
const MODELOS_CATALOGO = [
  {
    id: 'metaperson',
    nombre: 'MetaPerson 3D',
    tipo: 'Humanoide 360° Real',
    icono: 'person',
    descripcion: 'Avatar humanoide 3D completo con volumen en todos sus lados (no 2D), 51 micro-expresiones ARKit (Wicked, Suspicious, Confused, XD) y esqueleto cinemático de 73 huesos.',
  },
  {
    id: 'facecap',
    nombre: 'Digital Human',
    tipo: 'Apple ARKit',
    icono: 'sentiment_very_satisfied',
    ruta: '/models/facecap.glb',
    descripcion: 'Rostro digital 3D de alta fidelidad con 52 micro-expresiones de Apple ARKit.',
  },
  {
    id: 'robot_expressive',
    nombre: 'Robot KAIROS',
    tipo: 'Androide 3D',
    icono: 'smart_toy',
    ruta: '/models/RobotExpressive.glb',
    descripcion: 'Robot 3D con expresiones faciales (Angry, Sad, Surprised) y clips horneados.',
  },
  {
    id: 'xbot',
    nombre: 'Mixamo Rig',
    tipo: 'Humanoide Mocap',
    icono: 'accessibility_new',
    ruta: '/models/Xbot.glb',
    descripcion: 'Personaje humanoide con rigging cinemático completo Mixamo.',
  },
];

/**
 * Motor de Facetas Emocionales Autónomo: calcula el estado psicológico y la expresión
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
        descripcion: 'La IA ha ganado la partida. Gesto XD triunfante.',
        emocion: 'victoria',
        sonrisa: 0.95,
        cejasUp: 0.35,
        cejasDown: 0.0,
        ojosSquint: 0.3,
        ojosWide: 0.1,
        bocaAbierta: 0.15,
      };
    }
    if (resultado === '1-0') {
      return {
        id: 'DERROTA_RESIGNADA',
        titulo: 'Derrota Reconocida',
        icono: '💔',
        color: '#f43f5e', // Rosa / Carmesí
        descripcion: 'El humano ha superado a la IA. Mirada gacha y resignación.',
        emocion: 'derrota',
        sonrisa: 0.0,
        cejasUp: 0.7,
        cejasDown: 0.4,
        ojosSquint: 0.2,
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
      descripcion: 'Explorando matrices SE-ResNet. Ceño concentrado y análisis de tablero.',
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
      return {
        id: 'MATE_INMINENTE',
        titulo: `Mate en ${Math.abs(mateEn)} (Triunfo IA)`,
        icono: '🏆',
        color: '#f59e0b', // Dorado
        descripcion: 'Red de mate detectada sin escape. Gesto XD victorioso.',
        emocion: 'triunfo',
        sonrisa: 0.9,
        cejasUp: 0.4,
        cejasDown: 0.0,
        ojosSquint: 0.35,
        ojosWide: 0.2,
        bocaAbierta: 0.2,
      };
    } else {
      return {
        id: 'PELIGRO_EXTREMO',
        titulo: `Peligro Crítico: Mate en ${mateEn}`,
        icono: '🚨',
        color: '#ef4444', // Rojo peligro
        descripcion: 'Rey bajo asedio. Gesto Confused de alarma e incredulidad.',
        emocion: 'alarma',
        sonrisa: 0.0,
        cejasUp: 0.85,
        cejasDown: 0.2,
        ojosSquint: 0.0,
        ojosWide: 0.85,
        bocaAbierta: 0.4,
      };
    }
  }

  // 4. Detección de Jaque en la última jugada
  const ultimoSan = typeof ultimoMovimiento === 'string' ? ultimoMovimiento : ultimoMovimiento?.san;
  const esJaque = Boolean(ultimoSan && ultimoSan.includes('+'));

  if (esJaque) {
    const turnoBlancas = cantidadJugadas % 2 === 0;
    if (turnoBlancas) {
      return {
        id: 'JAQUE_ENTREGADO',
        titulo: '¡Jaque al Rey Rival!',
        icono: '⚔️',
        color: '#00e5ff',
        descripcion: 'Ataque frontal. Smirk Wicked desafiante.',
        emocion: 'confianza',
        sonrisa: 0.65,
        cejasUp: 0.35,
        cejasDown: 0.2,
        ojosSquint: 0.35,
        ojosWide: 0.1,
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
        cejasUp: 0.75,
        cejasDown: 0.3,
        ojosSquint: 0.2,
        ojosWide: 0.6,
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
      descripcion: 'Posición dominante. Faceta XD con gran sonrisa y cabeza erguida.',
      emocion: 'confianza_alta',
      sonrisa: 0.85,
      cejasUp: 0.3,
      cejasDown: 0.0,
      ojosSquint: 0.4,
      ojosWide: 0.0,
      bocaAbierta: 0.1,
    };
  }
  if (evaluacionCp <= -60) {
    return {
      id: 'VENTAJA_TACTICA',
      titulo: `Ventaja Táctica (${(evaluacionCp / -100).toFixed(1)})`,
      icono: '😏',
      color: '#34d399',
      descripcion: 'Mejor estructura. Faceta Wicked con media sonrisa pícara.',
      emocion: 'confianza',
      sonrisa: 0.75,
      cejasUp: 0.2,
      cejasDown: 0.1,
      ojosSquint: 0.3,
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
      descripcion: 'Déficit de material. Faceta Confused de preocupación y alerta.',
      emocion: 'alarma',
      sonrisa: 0.0,
      cejasUp: 0.8,
      cejasDown: 0.3,
      ojosSquint: 0.1,
      ojosWide: 0.7,
      bocaAbierta: 0.3,
    };
  }
  if (evaluacionCp >= 60) {
    return {
      id: 'BAJO_PRESION',
      titulo: `Bajo Presión (+${(evaluacionCp / 100).toFixed(1)})`,
      icono: '😟',
      color: '#fb923c',
      descripcion: 'Posición incómoda. Faceta Suspicious con ojos entrecerrados.',
      emocion: 'preocupacion',
      sonrisa: 0.0,
      cejasUp: 0.3,
      cejasDown: 0.55,
      ojosSquint: 0.75,
      ojosWide: 0.0,
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
      descripcion: 'Desarrollando piezas según teoría magistral.',
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
  const [modeloActivo, setModeloActivo] = useState('metaperson');
  const [cargandoModelo, setCargandoModelo] = useState(false);
  const [progresoCarga, setProgresoCarga] = useState(0);
  const [facetaForzada, setFacetaForzada] = useState(null);
  const [mostrarCalibracion, setMostrarCalibracion] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  // Referencias para Three.js en modelos secundarios
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

  // Faceta Emocional calculada autónomamente a partir del juego
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

  // Transición suave entre animaciones para modelos GLTF secundarios
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

  // Animaciones para modelos GLTF secundarios (Robot / Xbot)
  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;

    const emocion = facetaActual.emocion;

    if (modeloActivo === 'robot_expressive') {
      if (emocion === 'pensando') {
        fadeToAction('Yes', 0.3);
      } else if (emocion === 'triunfo' || emocion === 'victoria' || emocion === 'confianza_alta') {
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

  // Montaje de Three.js para modelos GLTF secundarios (FaceCap, Robot, Xbot)
  useEffect(() => {
    if (modeloActivo === 'metaperson') {
      return;
    }

    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 280;
    const alto = contenedor.clientHeight || 260;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, ancho / alto, 0.1, 100);

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
    contenedor.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.6;
    controls.maxDistance = 4.2;
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

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0x00e5ff, 2.6);
    luzClave.position.set(2, 4, 3);
    scene.add(luzClave);

    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.4, 3.2);
    luzFaceta.position.set(0, 1.55, 0.85);
    scene.add(luzFaceta);
    luzFacetaRef.current = luzFaceta;

    const discoGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.02, 32);
    const discoMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
      metalness: 0.9,
    });
    baseDiscoMatRef.current = discoMat;
    const baseDisco = new THREE.Mesh(discoGeo, discoMat);
    scene.add(baseDisco);

    mixerRef.current = null;
    actionsRef.current = {};
    activeActionRef.current = null;
    bonesRef.current = { head: null, neck: null, spine: null };
    morphMeshesRef.current = [];

    const modeloInfo = MODELOS_CATALOGO.find((m) => m.id === modeloActivo);
    const rutaCarga = modeloInfo?.ruta;

    if (rutaCarga) {
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
          setErrorCarga('No se pudo cargar el modelo 3D.');
          setCargandoModelo(false);
        }
      );
    }

    const manejarMouseMove = (e) => {
      const rect = contenedor.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };
    window.addEventListener('mousemove', manejarMouseMove);

    let blinkTimer = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      if (luzFacetaRef.current && facetaActual) {
        const colorObjetivo = new THREE.Color(facetaActual.color);
        luzFacetaRef.current.color.lerp(colorObjetivo, 0.05);
        if (baseDiscoMatRef.current) {
          baseDiscoMatRef.current.emissive.lerp(colorObjetivo, 0.05);
        }
      }

      const { head, neck } = bonesRef.current;
      if (head) {
        const targetRotY = mousePosRef.current.x * 0.45;
        let targetRotX = -mousePosRef.current.y * 0.35;
        if (facetaActual.emocion === 'pensando') targetRotX += 0.22;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.08);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.08);
      }
      if (neck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, mousePosRef.current.x * 0.2, 0.06);
      }

      blinkTimer += delta;
      const isBlinking = blinkTimer % 3.2 < 0.14;
      const blinkTarget = isBlinking ? Math.sin((blinkTimer % 3.2) * 22) : 0;

      if (morphMeshesRef.current.length > 0) {
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (!dict || !infl) return;

          const aplicarLerp = (nombre, objetivo, velocidad = 0.1) => {
            const idx = dict[nombre];
            if (idx !== undefined) {
              infl[idx] = THREE.MathUtils.lerp(infl[idx], objetivo, velocidad);
            }
          };

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
          aplicarLerp('mouthSmile_R', facetaActual.sonrisa * 0.9, 0.08);
          aplicarLerp('jawOpen', facetaActual.bocaAbierta, 0.1);
        });
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
  }, [modeloActivo, facetaActual]);

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

      {/* SELECTOR DE AVATAR (PESTAÑAS ESTILIZADAS) */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[9px] font-mono">
        {MODELOS_CATALOGO.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => {
              setModeloActivo(mod.id);
            }}
            className={`py-1.5 px-0.5 rounded flex flex-col items-center justify-center gap-0.5 transition-all ${
              modeloActivo === mod.id
                ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={mod.descripcion}
          >
            <span className="material-symbols-outlined text-[14px]">{mod.icono}</span>
            <span className="truncate w-full text-center">
              {mod.nombre.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* ÁREA DE VISUALIZACIÓN THREE.JS VIEWPORT (ENCUADRE DE LA CINTURA PARA ARRIBA) */}
      <div className="relative w-full h-[280px] rounded-lg overflow-hidden bg-gradient-to-b from-[#0a0d14] to-[#111319] border border-white/10 flex items-center justify-center group">
        {/* MODELO 1: METAPERSON 3D (HUMANOIDE 360° REAL CON VOLUMEN EN TODOS SUS LADOS) */}
        {modeloActivo === 'metaperson' ? (
          <AvatarMetaPerson3D
            pensando={pensando}
            facetaActual={facetaActual}
            onResetCamera={resetCameraRef}
            onProgresoCarga={setProgresoCarga}
            onError={setErrorCarga}
          />
        ) : (
          /* MODELOS SECUNDARIOS GLTF */
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* SPINNER DE CARGA DEL MODELO GLTF */}
        {cargandoModelo && (
          <div className="absolute inset-0 bg-[#0c0e14]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-8 h-8 border-2 border-[#00e5ff]/20 border-t-[#00e5ff] rounded-full animate-spin" />
            <span className="font-mono text-[11px] text-[#00e5ff] tracking-wider animate-pulse">
              CARGANDO MODELO 3D ({progresoCarga}%)...
            </span>
          </div>
        )}

        {/* BADGE DE FACETA EMOCIONAL EN TIEMPO REAL (100% AUTÓNOMO) */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none max-w-[85%]">
          <div
            className="px-2.5 py-1 rounded bg-black/80 border backdrop-blur-md flex items-center gap-1.5 text-[11px] font-mono shadow-lg transition-all duration-300"
            style={{ borderColor: `${facetaActual.color}77` }}
          >
            <span className="text-[14px]">{facetaActual.icono}</span>
            <span className="font-bold tracking-wide" style={{ color: facetaActual.color }}>
              {facetaActual.titulo}
            </span>
          </div>
          <p className="mt-1 text-[9px] font-mono text-slate-300 drop-shadow-md bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm truncate">
            {facetaActual.descripcion}
          </p>
        </div>

        {/* BOTÓN CENTRAR CÁMARA */}
        <button
          type="button"
          onClick={() => resetCameraRef.current?.()}
          className="absolute bottom-2 right-2 p-1.5 rounded bg-black/60 hover:bg-[#00e5ff]/20 border border-white/10 hover:border-[#00e5ff]/40 text-slate-300 hover:text-[#00e5ff] text-[10px] font-mono transition-all z-10 flex items-center gap-1"
          title="Centrar encuadre frontal de la cintura para arriba"
        >
          <span className="material-symbols-outlined text-[13px]">center_focus_strong</span>
          <span>Centrar</span>
        </button>

        {/* INDICADOR DE INTERACCIÓN 3D REAL */}
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-400 pointer-events-none opacity-60 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />
          <span>Rotación 360° Libre</span>
        </div>
      </div>

      {/* BARRA DE TELEMETRÍA AUTÓNOMA (CERO BOTONES MANUALES) */}
      <div className="flex flex-col gap-1.5 font-mono text-[10px]">
        <div className="p-2 rounded-lg bg-surface-container-lowest border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-semibold tracking-wide">
              {facetaForzada ? 'MODO MANUAL (PRUEBA)' : 'SISTEMA AUTÓNOMO'}
            </span>
          </div>
          <span className="text-slate-400 text-[9px]">
            {pensando ? 'ANALIZANDO JUGADA...' : 'ESPERANDO MOVIMIENTO'}
          </span>
        </div>

        {/* ENLACE DISCRETO PARA MODO CALIBRACIÓN (OPCIONAL PARA DESARROLLO) */}
        <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
          <span>Reactivo a los gestos MetaPerson (Wicked, Suspicious, XD, Confused)</span>
          <button
            type="button"
            onClick={() => setMostrarCalibracion(!mostrarCalibracion)}
            className="text-slate-400 hover:text-[#00e5ff] transition underline decoration-dotted"
          >
            {mostrarCalibracion ? 'Cerrar calibración' : '⚙️ Calibrar expresiones'}
          </button>
        </div>

        {/* BANDEJA COLAPSABLE DE CALIBRACIÓN (OCULTA POR DEFECTO PARA NO SATURAR) */}
        {mostrarCalibracion && (
          <div className="mt-1 p-2 rounded-lg bg-black/60 border border-[#00e5ff]/20 flex flex-col gap-1.5 animate-fadeIn">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>Probar facetas y gestos MetaPerson:</span>
              {facetaForzada && (
                <button
                  type="button"
                  onClick={() => setFacetaForzada(null)}
                  className="text-emerald-400 underline font-bold"
                >
                  Restablecer
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 text-[9px]">
              <button
                type="button"
                onClick={() =>
                  setFacetaForzada({
                    id: 'FORZADO_XD',
                    titulo: 'Risa Viva (XD)',
                    icono: '😆',
                    color: '#f59e0b',
                    descripcion: 'Carcajadas, vaivén de cabeza y risa viva estilo metaperson_xd (1).gif.',
                    emocion: 'confianza_alta',
                    sonrisa: 0.95,
                    cejasUp: 0.4,
                    cejasDown: 0.0,
                    ojosSquint: 0.65,
                    ojosWide: 0.0,
                    bocaAbierta: 0.35,
                  })
                }
                className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-amber-500/20 hover:text-amber-400 border border-white/5 text-center truncate font-bold"
              >
                😆 Risa (XD)
              </button>
              <button
                type="button"
                onClick={() =>
                  setFacetaForzada({
                    id: 'FORZADO_ENOJO',
                    titulo: 'Enojo / Furia',
                    icono: '😡',
                    color: '#ef4444',
                    descripcion: 'Ceño muy fruncido, nariz arrugada y negación con la cabeza.',
                    emocion: 'alarma',
                    sonrisa: 0.0,
                    cejasUp: 0.0,
                    cejasDown: 0.95,
                    ojosSquint: 0.7,
                    ojosWide: 0.0,
                    bocaAbierta: 0.0,
                  })
                }
                className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-rose-500/20 hover:text-rose-400 border border-white/5 text-center truncate font-bold"
              >
                😡 Enojo
              </button>
              <button
                type="button"
                onClick={() =>
                  setFacetaForzada({
                    id: 'FORZADO_PENSANDO',
                    titulo: 'Mirar al Tablero',
                    icono: '♟️',
                    color: '#00e5ff',
                    descripcion: 'Cabeza y ojos orientados hacia abajo analizando la jugada en el tablero.',
                    emocion: 'pensando',
                    sonrisa: 0.0,
                    cejasUp: 0.0,
                    cejasDown: 0.8,
                    ojosSquint: 0.45,
                    ojosWide: 0.0,
                    bocaAbierta: 0.0,
                  })
                }
                className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] border border-white/5 text-center truncate font-bold"
              >
                ♟️ Tablero
              </button>
              <button
                type="button"
                onClick={() =>
                  setFacetaForzada({
                    id: 'FORZADO_WICKED',
                    titulo: 'Wicked Smirk',
                    icono: '😏',
                    color: '#34d399',
                    descripcion: 'Media sonrisa pícara y ceja derecha alzada.',
                    emocion: 'confianza',
                    sonrisa: 0.85,
                    cejasUp: 0.25,
                    cejasDown: 0.1,
                    ojosSquint: 0.35,
                    ojosWide: 0.0,
                    bocaAbierta: 0.0,
                  })
                }
                className="py-1 px-0.5 rounded bg-surface-container-high hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/5 text-center truncate font-bold"
              >
                😏 Smirk
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
