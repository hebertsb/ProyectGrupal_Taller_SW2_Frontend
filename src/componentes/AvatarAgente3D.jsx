import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Catálogo de modelos 3D GLTF / GLB disponibles:
 * 1. readyplayer_me: Avatar humanoide realista estilo Meta / Ready Player Me con rigging y morph targets.
 * 2. robot_expressive: Robot 3D humanoide con animaciones completas (Wave, ThumbsUp, Death, Yes, Idle).
 * 3. xbot: Modelo humanoide oficial Mixamo con huesos y animaciones (idle, agree, headShake, sad_pose).
 * 4. holograma: Androide procedural con anillos cuánticos y visor emisivo.
 */
const MODELOS_CATALOGO = [
  {
    id: 'readyplayer_me',
    nombre: 'Ready Player Me',
    tipo: 'Humanoide Meta',
    icono: 'person',
    ruta: '/models/readyplayer.me.glb',
    descripcion: 'Avatar humanoide completo con rigging esquelético y rasgos realistas.',
  },
  {
    id: 'robot_expressive',
    nombre: 'Robot Expresivo',
    tipo: 'Androide 3D',
    icono: 'smart_toy',
    ruta: '/models/RobotExpressive.glb',
    descripcion: 'Robot articulado con clips de animación (saludo, pulgar arriba, derrota, cálculo).',
  },
  {
    id: 'xbot',
    nombre: 'Mixamo Xbot',
    tipo: 'Avatar Rigged',
    icono: 'accessibility_new',
    ruta: '/models/Xbot.glb',
    descripcion: 'Personaje humanoide con rigging completo y cinemática Mixamo.',
  },
  {
    id: 'holograma',
    nombre: 'Ciber-Holograma',
    tipo: 'Procedural',
    icono: 'memory',
    ruta: null,
    descripcion: 'Entidad de IA holográfica con pulso tensorial y anillos cuánticos.',
  },
];

export default function AvatarAgente3D({
  pensando = false,
  tipoOponente = 'modelo',
  evaluacionCp = 0,
  ultimoMovimiento = null,
  terminada = false,
  resultado = null,
}) {
  const mountRef = useRef(null);
  const [modeloActivo, setModeloActivo] = useState('readyplayer_me');
  const [cargandoModelo, setCargandoModelo] = useState(false);
  const [progresoCarga, setProgresoCarga] = useState(0);
  const [gestoActivo, setGestoActivo] = useState('En reposo');
  const [urlPersonalizada, setUrlPersonalizada] = useState('');
  const [mostrarCustomInput, setMostrarCustomInput] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  // Referencias mutables para el loop de Three.js
  const controlsRef = useRef(null);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const activeActionRef = useRef(null);
  const bonesRef = useRef({ head: null, neck: null, spine: null });
  const morphMeshesRef = useRef([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const clockRef = useRef(new THREE.Clock());
  const resetCameraRef = useRef(null);
  const triggerGestoRef = useRef(null);

  // Función para transicionar suavemente entre animaciones
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
      setGestoActivo(name);
    }
  }, []);

  // Exponer disparador de gestos manuales / reactivos
  const dispararGesto = useCallback((gesto) => {
    const actions = actionsRef.current;
    const modelo = modeloActivo;

    setGestoActivo(gesto);

    if (modelo === 'robot_expressive' && actions) {
      const mapa = {
        saludo: 'Wave',
        pensar: 'Yes',
        victoria: 'ThumbsUp',
        derrota: 'Death',
        idle: 'Idle',
        celebrar: 'Dance',
      };
      const clip = mapa[gesto] || 'Idle';
      if (actions[clip]) {
        fadeToAction(clip, 0.3);
        if (clip !== 'Idle' && clip !== 'Death') {
          setTimeout(() => fadeToAction('Idle', 0.5), 3200);
        }
      }
    } else if (modelo === 'xbot' && actions) {
      const mapa = {
        saludo: 'agree',
        pensar: 'agree',
        victoria: 'agree',
        derrota: 'sad_pose',
        idle: 'idle',
        duda: 'headShake',
      };
      const clip = mapa[gesto] || 'idle';
      if (actions[clip]) {
        fadeToAction(clip, 0.3);
        if (clip !== 'idle') {
          setTimeout(() => fadeToAction('idle', 0.5), 3000);
        }
      }
    } else {
      // Para Ready Player Me o procedural: el loop anima huesos y morphs
      setTimeout(() => setGestoActivo('En reposo'), 2500);
    }
  }, [modeloActivo, fadeToAction]);

  triggerGestoRef.current = dispararGesto;

  // Reactividad ante el estado del juego (IA pensando)
  useEffect(() => {
    if (pensando) {
      setGestoActivo('Calculando jugada...');
      if (modeloActivo === 'robot_expressive' && actionsRef.current['Yes']) {
        fadeToAction('Yes', 0.3);
      } else if (modeloActivo === 'xbot' && actionsRef.current['agree']) {
        fadeToAction('agree', 0.3);
      }
    } else {
      if (modeloActivo === 'robot_expressive' && actionsRef.current['Idle']) {
        fadeToAction('Idle', 0.4);
      } else if (modeloActivo === 'xbot' && actionsRef.current['idle']) {
        fadeToAction('idle', 0.4);
      }
      setGestoActivo('Atento al tablero');
    }
  }, [pensando, modeloActivo, fadeToAction]);

  // Reactividad al terminar la partida (Victoria / Derrota)
  useEffect(() => {
    if (terminada && resultado) {
      // El jugador es blancas ('w'), la IA es negras ('b')
      if (resultado === '0-1') {
        // Ganó la IA
        dispararGesto('victoria');
      } else if (resultado === '1-0') {
        // Perdió la IA
        dispararGesto('derrota');
      } else {
        dispararGesto('idle');
      }
    }
  }, [terminada, resultado, dispararGesto]);

  // Reactividad a jugadas
  useEffect(() => {
    if (ultimoMovimiento && !pensando && !terminada) {
      if (evaluacionCp > 180) {
        dispararGesto('derrota');
      } else if (evaluacionCp < -180) {
        dispararGesto('victoria');
      }
    }
  }, [ultimoMovimiento, evaluacionCp, pensando, terminada, dispararGesto]);

  // Montaje y Renderizado de Three.js
  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 280;
    const alto = contenedor.clientHeight || 260;

    // 1. Escena y Renderizador WebGL
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, ancho / alto, 0.1, 100);
    camera.position.set(0, 1.45, 2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderer.domElement);

    // 2. Controles de Órbita con amortiguación
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 4.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.target.set(0, 1.3, 0);
    controlsRef.current = controls;

    resetCameraRef.current = () => {
      camera.position.set(0, 1.45, 2.2);
      controls.target.set(0, 1.3, 0);
      controls.update();
    };

    // 3. Sistema de Iluminación de Estudio PBR
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0x00e5ff, 2.8);
    luzClave.position.set(2, 4, 3);
    luzClave.castShadow = true;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x9d4edd, 1.6);
    luzRelleno.position.set(-2.5, 1, 2);
    scene.add(luzRelleno);

    const luzContorno = new THREE.PointLight(0x00e5ff, 3.5, 8);
    luzContorno.position.set(0, 2.2, -1.8);
    scene.add(luzContorno);

    // Luz dinámica de inferencia (pulsa en la cara del avatar)
    const luzPensamiento = new THREE.PointLight(0x00e5ff, 1.0, 3);
    luzPensamiento.position.set(0, 1.5, 0.8);
    scene.add(luzPensamiento);

    // Disco / Plataforma holográfica en la base
    const discoGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.02, 32);
    const discoMat = new THREE.MeshStandardMaterial({
      color: 0x09101d,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const baseDisco = new THREE.Mesh(discoGeo, discoMat);
    baseDisco.position.y = 0;
    scene.add(baseDisco);

    // Anillo exterior brillante
    const anilloGeo = new THREE.RingGeometry(0.74, 0.77, 36);
    const anilloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const anillo = new THREE.Mesh(anilloGeo, anilloMat);
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.012;
    scene.add(anillo);

    // 4. Carga del Modelo seleccionado
    mixerRef.current = null;
    actionsRef.current = {};
    activeActionRef.current = null;
    bonesRef.current = { head: null, neck: null, spine: null };
    morphMeshesRef.current = [];

    const modeloInfo = MODELOS_CATALOGO.find((m) => m.id === modeloActivo);
    const rutaCarga = urlPersonalizada.trim() || modeloInfo?.ruta;

    if (modeloActivo === 'holograma' || !rutaCarga) {
      // MODO PROCEDURAL (CIBER-ANDROIDE KAIROS)
      setCargandoModelo(false);
      const grupoProcedural = new THREE.Group();
      scene.add(grupoProcedural);

      const matMetal = new THREE.MeshStandardMaterial({
        color: 0x111625,
        metalness: 0.9,
        roughness: 0.25,
      });
      const matVisor = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 2.2,
        roughness: 0.1,
      });

      const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), matMetal);
      craneo.position.set(0, 1.45, 0);
      grupoProcedural.add(craneo);

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.25), matVisor);
      visor.position.set(0, 1.48, 0.42);
      grupoProcedural.add(visor);

      const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16), matMetal);
      cuello.position.set(0, 1.15, 0);
      grupoProcedural.add(cuello);
    } else {
      // CARGA DE MODELO GLTF / GLB MEDIANTE GLTFLoader
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
            // Detección de huesos para seguimiento de cabeza
            const nameLower = (obj.name || '').toLowerCase();
            if (nameLower.includes('head') && !bonesRef.current.head) {
              bonesRef.current.head = obj;
            } else if (nameLower.includes('neck') && !bonesRef.current.neck) {
              bonesRef.current.neck = obj;
            } else if (nameLower.includes('spine') && !bonesRef.current.spine) {
              bonesRef.current.spine = obj;
            }
          });

          // Normalizar escala y centrar modelo sobre la base
          const bbox = new THREE.Box3().setFromObject(root);
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const escalaDeseada = 1.75 / (maxDim || 1);
          root.scale.setScalar(escalaDeseada);

          // Ajustar altura a nivel de suelo
          const bboxAjustado = new THREE.Box3().setFromObject(root);
          root.position.y = -bboxAjustado.min.y;
          root.position.x = -(bboxAjustado.min.x + bboxAjustado.max.x) / 2;
          root.position.z = -(bboxAjustado.min.z + bboxAjustado.max.z) / 2;

          scene.add(root);

          // Configurar Animaciones si existen
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            mixerRef.current = mixer;
            const actions = {};

            gltf.animations.forEach((clip) => {
              actions[clip.name] = mixer.clipAction(clip);
            });
            actionsRef.current = actions;

            // Clip inicial por defecto
            const defaultClip =
              actions['Idle'] || actions['idle'] || actions['Standing'] || Object.values(actions)[0];
            if (defaultClip) {
              defaultClip.play();
              activeActionRef.current = defaultClip;
              setGestoActivo('En reposo');
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
          console.error('Error al cargar avatar GLB:', err);
          setErrorCarga('No se pudo cargar el modelo 3D. Seleccionando holograma de respaldo.');
          setCargandoModelo(false);
          setModeloActivo('holograma');
        }
      );
    }

    // 5. Seguimiento del Cursor (Head Tracking)
    const manejarMouseMove = (e) => {
      const rect = contenedor.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };

    window.addEventListener('mousemove', manejarMouseMove);

    // 6. Bucle de Animación (Render Loop)
    let blinkTimer = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Actualizar AnimationMixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Procedural Head Tracking & Eye Blinking para Ready Player Me / Rigged sin clips
      const { head, neck } = bonesRef.current;
      if (head) {
        const targetRotY = mousePosRef.current.x * 0.45;
        const targetRotX = -mousePosRef.current.y * 0.35 + (pensando ? 0.25 : 0);
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.08);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.08);
      }
      if (neck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, mousePosRef.current.x * 0.2, 0.06);
      }

      // Parpadeo ocular procedural (Morph Targets de Ready Player Me)
      blinkTimer += delta;
      if (morphMeshesRef.current.length > 0) {
        const blinkValue = blinkTimer % 3.5 < 0.15 ? Math.sin((blinkTimer % 3.5) * 20) : 0;
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (dict && infl) {
            if (dict['eyeBlinkLeft'] !== undefined) infl[dict['eyeBlinkLeft']] = blinkValue;
            if (dict['eyeBlinkRight'] !== undefined) infl[dict['eyeBlinkRight']] = blinkValue;
          }
        });
      }

      // Pulso dinámico de pensamiento tensorial
      if (pensando) {
        luzPensamiento.intensity = 2.0 + Math.sin(elapsed * 12) * 1.5;
        anillo.rotation.z += 0.04;
      } else {
        luzPensamiento.intensity = 0.8;
        anillo.rotation.z += 0.005;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 7. Limpieza al desmontar
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', manejarMouseMove);
      controls.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [modeloActivo, urlPersonalizada, pensando]);

  return (
    <div className="bg-surface-container-low rounded-xl p-3.5 shadow-xl flex flex-col gap-2.5 border border-outline-variant/30 relative overflow-hidden">
      {/* CABECERA Y METADATOS DEL AGENTE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-80" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00e5ff]" />
          </span>
          <span className="font-mono-micro text-[11px] font-bold text-slate-200 uppercase tracking-wide">
            {modeloActivo === 'readyplayer_me'
              ? 'AVATAR HUMANOIDE // RPM'
              : modeloActivo === 'robot_expressive'
              ? 'ROBOT 3D EXPRESSIVE'
              : modeloActivo === 'xbot'
              ? 'MIXAMO XBOT RIGGED'
              : 'CIBER-HOLOGRAMA'}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-[#00e5ff] border border-[#00e5ff]/30 font-semibold">
          {tipoOponente === 'modelo' ? 'IA v5 AUTÓNOMA' : 'STOCKFISH 16'}
        </span>
      </div>

      {/* SELECTOR DE MODELO 3D (TABS GLTF / GLB / PROCEDURAL) */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[10px] font-mono">
        {MODELOS_CATALOGO.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => {
              setModeloActivo(mod.id);
              setUrlPersonalizada('');
              setMostrarCustomInput(false);
            }}
            className={`py-1.5 px-1 rounded flex flex-col items-center justify-center gap-0.5 transition-all ${
              modeloActivo === mod.id && !mostrarCustomInput
                ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={mod.descripcion}
          >
            <span className="material-symbols-outlined text-[15px]">{mod.icono}</span>
            <span className="truncate w-full text-center">{mod.nombre.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ÁREA DE VISUALIZACIÓN THREE.JS VIEWPORT */}
      <div className="relative w-full h-[250px] rounded-lg overflow-hidden bg-gradient-to-b from-[#0a0d14] to-[#111319] border border-white/10 flex items-center justify-center group">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* SPINNER DE CARGA DEL MODELO GLB */}
        {cargandoModelo && (
          <div className="absolute inset-0 bg-[#0c0e14]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-8 h-8 border-2 border-[#00e5ff]/20 border-t-[#00e5ff] rounded-full animate-spin" />
            <span className="font-mono text-[11px] text-[#00e5ff] tracking-wider animate-pulse">
              DESCARGANDO MODELO 3D ({progresoCarga}%)...
            </span>
          </div>
        )}

        {/* BADGE DE ESTADO DINÁMICO */}
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <div className="px-2 py-0.5 rounded bg-black/60 border border-[#00e5ff]/30 backdrop-blur-md flex items-center gap-1.5 text-[10px] font-mono text-[#00e5ff]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pensando ? 'bg-amber-400 animate-ping' : 'bg-[#00e5ff]'
              }`}
            />
            <span>{gestoActivo}</span>
          </div>
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

        {/* GUÍA TÁCTIL PARA ORBITAR */}
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-500 pointer-events-none opacity-60">
          Arrastra para rotar en 3D
        </div>
      </div>

      {/* BOTONERA DE GESTOS RÁPIDOS Y EMOCIONES (TESTING INTERACTIVO) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>GESTOS Y EXPRESIONES:</span>
          <button
            type="button"
            onClick={() => setMostrarCustomInput(!mostrarCustomInput)}
            className="text-[#00e5ff] hover:underline"
          >
            {mostrarCustomInput ? 'Ocultar URL' : '+ URL Personalizada'}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1 font-mono text-[9px]">
          <button
            type="button"
            onClick={() => triggerGestoRef.current?.('saludo')}
            className="py-1 px-1 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] transition border border-white/5 text-center truncate"
            title="Saludar amistosamente"
          >
            👋 Saludo
          </button>
          <button
            type="button"
            onClick={() => triggerGestoRef.current?.('pensar')}
            className="py-1 px-1 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] transition border border-white/5 text-center truncate"
            title="Simular análisis profundo"
          >
            🤔 Pensar
          </button>
          <button
            type="button"
            onClick={() => triggerGestoRef.current?.('victoria')}
            className="py-1 px-1 rounded bg-surface-container-high hover:bg-emerald-500/20 hover:text-emerald-400 transition border border-white/5 text-center truncate"
            title="Celebrar ventaja o victoria"
          >
            👍 Victoria
          </button>
          <button
            type="button"
            onClick={() => triggerGestoRef.current?.('derrota')}
            className="py-1 px-1 rounded bg-surface-container-high hover:bg-rose-500/20 hover:text-rose-400 transition border border-white/5 text-center truncate"
            title="Reacción ante error o derrota"
          >
            💔 Derrota
          </button>
          <button
            type="button"
            onClick={() => triggerGestoRef.current?.('idle')}
            className="py-1 px-1 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 hover:text-[#00e5ff] transition border border-white/5 text-center truncate"
            title="Regresar a postura de reposo"
          >
            🧍 Reposo
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
