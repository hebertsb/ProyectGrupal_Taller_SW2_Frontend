import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Generador procedural de piezas de ajedrez 3D holográficas (LatheGeometry)
 */
function crearGeometriaPieza(tipo) {
  let puntos = [];
  if (tipo === 'peon') {
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.14, 0.03),
      new THREE.Vector2(0.10, 0.08),
      new THREE.Vector2(0.07, 0.20),
      new THREE.Vector2(0.10, 0.23),
      new THREE.Vector2(0.06, 0.25),
      new THREE.Vector2(0.08, 0.32),
      new THREE.Vector2(0.05, 0.37),
      new THREE.Vector2(0, 0.40),
    ];
  } else if (tipo === 'torre') {
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.16, 0.04),
      new THREE.Vector2(0.12, 0.09),
      new THREE.Vector2(0.09, 0.32),
      new THREE.Vector2(0.14, 0.35),
      new THREE.Vector2(0.14, 0.46),
      new THREE.Vector2(0.09, 0.46),
      new THREE.Vector2(0, 0.42),
    ];
  } else if (tipo === 'alfil') {
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.17, 0),
      new THREE.Vector2(0.15, 0.04),
      new THREE.Vector2(0.10, 0.10),
      new THREE.Vector2(0.06, 0.32),
      new THREE.Vector2(0.11, 0.35),
      new THREE.Vector2(0.08, 0.39),
      new THREE.Vector2(0.10, 0.49),
      new THREE.Vector2(0.03, 0.55),
      new THREE.Vector2(0, 0.58),
    ];
  } else if (tipo === 'rey') {
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.20, 0),
      new THREE.Vector2(0.18, 0.05),
      new THREE.Vector2(0.12, 0.12),
      new THREE.Vector2(0.08, 0.38),
      new THREE.Vector2(0.14, 0.42),
      new THREE.Vector2(0.09, 0.47),
      new THREE.Vector2(0.13, 0.58),
      new THREE.Vector2(0.03, 0.64),
      new THREE.Vector2(0, 0.68),
    ];
  } else if (tipo === 'caballo') {
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.15, 0.04),
      new THREE.Vector2(0.11, 0.11),
      new THREE.Vector2(0.10, 0.28),
      new THREE.Vector2(0.13, 0.40),
      new THREE.Vector2(0.07, 0.50),
      new THREE.Vector2(0, 0.54),
    ];
  } else {
    // Dama
    puntos = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.19, 0),
      new THREE.Vector2(0.17, 0.05),
      new THREE.Vector2(0.11, 0.12),
      new THREE.Vector2(0.07, 0.36),
      new THREE.Vector2(0.13, 0.40),
      new THREE.Vector2(0.08, 0.44),
      new THREE.Vector2(0.13, 0.54),
      new THREE.Vector2(0.02, 0.60),
      new THREE.Vector2(0, 0.63),
    ];
  }
  return new THREE.LatheGeometry(puntos, 20);
}

/**
 * Avatar 3D MetaPerson Dinámico
 * - Mira SIEMPRE DE FRENTE al usuario (NO sigue el mouse)
 * - Mira abajo al tablero ÚNICAMENTE cuando está pensando/haciendo la jugada
 * - Risa con carcajadas y vaivén animado estilo metaperson_xd (1).gif al tener ventaja
 * - Reacción de enojo con ceño fruncido y negación de cabeza si comete error / jaque
 * - Brazos caídos de forma natural con animación Idle
 */
export default function AvatarMetaPerson3D({
  pensando = false,
  facetaActual,
  onResetCamera,
  onProgresoCarga,
  onError,
}) {
  const mountRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const mixerRef = useRef(null);

  // Referencias esqueléticas y morfológicas
  const bonesRef = useRef({
    head: null,
    neck: null,
    spine: null,
    spine1: null,
    leftEye: null,
    rightEye: null,
    leftArm: null,
    rightArm: null,
    leftForeArm: null,
    rightForeArm: null,
  });
  const morphMeshesRef = useRef([]);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 320;
    const alto = contenedor.clientHeight || 280;

    // 1. Escena y Cámara 3D (Siempre de frente)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ancho / alto, 0.1, 100);
    // Cámara frontal a la altura del pecho/rostro
    camera.position.set(0, 1.62, 0.88);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderer.domElement);

    // OrbitControls para rotación manual del usuario
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.45;
    controls.maxDistance = 2.4;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.set(0, 1.56, 0);

    if (onResetCamera) {
      onResetCamera.current = () => {
        camera.position.set(0, 1.62, 0.88);
        controls.target.set(0, 1.56, 0);
        controls.update();
      };
    }

    // 2. Iluminación PBR de Estudio
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.45);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0xffffff, 2.8);
    luzClave.position.set(1.5, 3.0, 2.5);
    luzClave.castShadow = true;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x818cf8, 1.3);
    luzRelleno.position.set(-2.0, 1.2, 1.8);
    scene.add(luzRelleno);

    // Rim Light (Luz de contorno cian para silueta)
    const luzContorno = new THREE.PointLight(0x00e5ff, 3.8, 6);
    luzContorno.position.set(0, 2.2, -1.2);
    scene.add(luzContorno);

    // Luz dinámica de emoción
    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.6, 3.2);
    luzFaceta.position.set(0, 1.6, 0.7);
    scene.add(luzFaceta);

    // 3. Piezas de Ajedrez Holográficas en el Fondo 3D
    const grupoPiezas = new THREE.Group();
    scene.add(grupoPiezas);

    const matHoloCyan = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.65,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      metalness: 0.9,
    });

    const piezasConfig = [
      { tipo: 'caballo', pos: [-0.65, 1.75, -0.45], escala: 0.55, rotVel: 0.4 },
      { tipo: 'alfil', pos: [0.65, 1.70, -0.4], escala: 0.5, rotVel: -0.35 },
      { tipo: 'rey', pos: [0.55, 1.35, -0.3], escala: 0.48, rotVel: 0.25 },
      { tipo: 'dama', pos: [-0.55, 1.30, -0.35], escala: 0.5, rotVel: -0.3 },
      { tipo: 'peon', pos: [-0.45, 1.95, -0.55], escala: 0.42, rotVel: 0.45 },
      { tipo: 'peon', pos: [0.45, 1.98, -0.55], escala: 0.4, rotVel: -0.4 },
    ];

    const piezasMeshes = piezasConfig.map((cfg) => {
      const geo = crearGeometriaPieza(cfg.tipo);
      const mesh = new THREE.Mesh(geo, matHoloCyan);
      mesh.position.set(...cfg.pos);
      mesh.scale.setScalar(cfg.escala);
      grupoPiezas.add(mesh);
      return { mesh, cfg };
    });

    // 4. Carga del Modelo 3D MetaPerson (.GLB)
    morphMeshesRef.current = [];
    mixerRef.current = null;
    bonesRef.current = {
      head: null,
      neck: null,
      spine: null,
      spine1: null,
      leftEye: null,
      rightEye: null,
      leftArm: null,
      rightArm: null,
      leftForeArm: null,
      rightForeArm: null,
    };

    const loader = new GLTFLoader();
    loader.load(
      '/models/metaperson.glb',
      (gltf) => {
        const root = gltf.scene;

        root.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;

            // Recolectar mallas con blendshapes faciales
            if (obj.morphTargetDictionary && Object.keys(obj.morphTargetDictionary).length > 0) {
              morphMeshesRef.current.push(obj);
            }
          }

          // Recolectar huesos clave
          const name = obj.name || '';
          if (name === 'Head') bonesRef.current.head = obj;
          else if (name === 'Neck') bonesRef.current.neck = obj;
          else if (name === 'Spine') bonesRef.current.spine = obj;
          else if (name === 'Spine1' || name === 'Spine2') bonesRef.current.spine1 = obj;
          else if (name === 'LeftEye') bonesRef.current.leftEye = obj;
          else if (name === 'RightEye') bonesRef.current.rightEye = obj;
          else if (name === 'LeftArm') bonesRef.current.leftArm = obj;
          else if (name === 'RightArm') bonesRef.current.rightArm = obj;
          else if (name === 'LeftForeArm') bonesRef.current.leftForeArm = obj;
          else if (name === 'RightForeArm') bonesRef.current.rightForeArm = obj;
        });

        // Activar la animación Idle horneada para postura natural de brazos abajo
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;

          const idleClip =
            gltf.animations.find((a) => a.name.toLowerCase().includes('idle')) ||
            gltf.animations[0];

          if (idleClip) {
            const action = mixer.clipAction(idleClip);
            action.setEffectiveTimeScale(0.95);
            action.play();
          }
        } else {
          // Salvaguarda
          if (bonesRef.current.leftArm) bonesRef.current.leftArm.rotation.z = -1.25;
          if (bonesRef.current.rightArm) bonesRef.current.rightArm.rotation.z = 1.25;
        }

        root.position.set(0, 0, 0);
        scene.add(root);

        onProgresoCarga?.(100);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          onProgresoCarga?.(pct);
        }
      },
      (err) => {
        console.error('Error cargando metaperson.glb:', err);
        onError?.('No se pudo cargar el modelo MetaPerson 3D.');
      }
    );

    // 5. Timers de parpadeo
    let blinkTimer = 0;
    let nextBlinkTime = 3.2;
    let blinkProgress = 0;
    let isBlinking = false;

    // 6. Bucle de Animación 3D a 60 FPS
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Actualizar AnimationMixer (brazos abajo y respiración de cuerpo)
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // A. Color dinámico de iluminación según la faceta emocional
      if (facetaActual) {
        const colorObj = new THREE.Color(facetaActual.color);
        luzFaceta.color.lerp(colorObj, 0.05);
        matHoloCyan.color.lerp(colorObj, 0.04);
        matHoloCyan.emissive.lerp(colorObj, 0.04);
      }

      // B. Rotación suave de las piezas holográficas en 3D
      piezasMeshes.forEach(({ mesh, cfg }, idx) => {
        mesh.rotation.y += cfg.rotVel * delta;
        mesh.position.y = cfg.pos[1] + Math.sin(elapsed * 1.5 + idx * 1.1) * 0.025;
      });

      // C. Control Fisiológico de Cabeza y Cuello (SIEMPRE DE FRENTE, NO SIGUE EL MOUSE)
      const { head, neck, spine1, leftEye, rightEye } = bonesRef.current;
      const emocion = facetaActual?.emocion || 'neutral';

      if (head) {
        let targetRotX = 0;
        let targetRotY = 0;
        let targetRotZ = 0;

        if (pensando) {
          // --- 1. MIRAR AL TABLERO ÚNICAMENTE CUANDO VA A JUGAR / CALCULAR ---
          targetRotX = 0.28; // Cabeza inclinada hacia abajo analizando el tablero
          targetRotY = (Math.sin(elapsed * 2.5) * 0.04); // Leve paneo analizando casillas
          targetRotZ = 0;
        } else if (emocion === 'confianza_alta' || emocion === 'victoria' || emocion === 'triunfo') {
          // --- 2. RISA VIVA COMO metaperson_xd (1).gif (Carcajadas y Vaivén de Alegría) ---
          const laughWave = Math.sin(elapsed * 13);
          const laughBody = Math.sin(elapsed * 6.5);
          targetRotX = -0.06 + laughWave * 0.045; // Cabeza cabecea alegremente de risa
          targetRotZ = laughBody * 0.035; // Leve vaivén juguetón
          targetRotY = 0; // De frente al usuario riéndose

          if (spine1) {
            spine1.rotation.x = laughWave * 0.015; // Pecho vibra con la risa
          }
        } else if (emocion === 'confianza') {
          // Gesto Wicked: Media sonrisa pícara, cabeza de frente con leve inclinación
          targetRotX = -0.03;
          targetRotZ = -0.05;
          targetRotY = 0;
        } else if (emocion === 'alarma' || emocion === 'derrota' || emocion === 'preocupacion' || emocion === 'tension') {
          // --- 3. REACCIÓN DE ENOJO / FRUSTRACIÓN (Negación de cabeza y ceño fruncido) ---
          const angryShake = Math.sin(elapsed * 8);
          targetRotY = angryShake * 0.10; // Sacude la cabeza diciendo "NO" con fastidio
          targetRotX = 0.07; // Mandíbula tensa hacia adelante
          targetRotZ = 0;
        } else {
          // Posición Neutral / Apertura: Perfectamente de frente y sereno
          targetRotX = 0;
          targetRotY = 0;
          targetRotZ = 0;
        }

        // Interpolación fluida
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.08);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.08);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetRotZ, 0.08);
      }

      if (neck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, 0, 0.06);
      }

      // Huesos Oculares: Miran abajo al tablero SOLO cuando piensa; de frente el resto del tiempo
      if (leftEye && rightEye) {
        let eyeTargetX = 0;
        let eyeTargetY = 0;

        if (pensando) {
          eyeTargetX = 0.20; // Ojos orientados hacia el tablero
          eyeTargetY = Math.sin(elapsed * 3) * 0.04;
        } else {
          eyeTargetX = 0; // Ojos al frente mirando al jugador
          eyeTargetY = 0;
        }

        leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, eyeTargetX, 0.12);
        leftEye.rotation.y = THREE.MathUtils.lerp(leftEye.rotation.y, eyeTargetY, 0.12);
        rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, eyeTargetX, 0.12);
        rightEye.rotation.y = THREE.MathUtils.lerp(rightEye.rotation.y, eyeTargetY, 0.12);
      }

      // D. Micro-Expresiones Faciales con Blendshapes Apple ARKit
      blinkTimer += delta;
      if (!isBlinking && blinkTimer > nextBlinkTime) {
        isBlinking = true;
        blinkTimer = 0;
        nextBlinkTime = pensando ? 2.5 + Math.random() * 1.8 : 3.5 + Math.random() * 2.2;
      }
      if (isBlinking) {
        blinkProgress += delta * 7.0;
        if (blinkProgress >= 1.0) {
          isBlinking = false;
          blinkProgress = 0;
        }
      }
      const blinkTarget = isBlinking ? Math.sin(blinkProgress * Math.PI) : 0;

      // Aplicar morph targets a la cabeza y pestañas
      if (morphMeshesRef.current.length > 0) {
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (!dict || !infl) return;

          const setMorph = (nombre, valor, vel = 0.09) => {
            const idx = dict[nombre];
            if (idx !== undefined) {
              infl[idx] = THREE.MathUtils.lerp(infl[idx], valor, vel);
            }
          };

          // Parpadeo orgánico
          setMorph('eyeBlinkLeft', blinkTarget, 0.35);
          setMorph('eyeBlinkRight', blinkTarget, 0.35);

          if (pensando) {
            // --- 1. MIENTRAS PIENSA: MIRANDO AL TABLERO CON CEÑO CONCENTRADO ---
            setMorph('browDownLeft', 0.8, 0.09);
            setMorph('browDownRight', 0.8, 0.09);
            setMorph('browInnerUp', 0.0, 0.09);
            setMorph('eyeSquintLeft', 0.45, 0.09);
            setMorph('eyeSquintRight', 0.45, 0.09);
            setMorph('eyeWideLeft', 0.0, 0.09);
            setMorph('eyeWideRight', 0.0, 0.09);
            setMorph('mouthSmileLeft', 0.0, 0.09);
            setMorph('mouthSmileRight', 0.0, 0.09);
            setMorph('mouthPressLeft', 0.5, 0.09);
            setMorph('mouthPressRight', 0.5, 0.09);
            setMorph('jawOpen', 0.0, 0.09);
            setMorph('mouthOpen', 0.0, 0.09);
            setMorph('noseSneerLeft', 0.0, 0.09);
            setMorph('noseSneerRight', 0.0, 0.09);
            setMorph('eyeLookDownLeft', 0.75, 0.09);
            setMorph('eyeLookDownRight', 0.75, 0.09);
          } else if (emocion === 'confianza_alta' || emocion === 'victoria' || emocion === 'triunfo') {
            // --- 2. RISA VIVA Y CARCAJADA COMO metaperson_xd (1).gif ---
            const laughJaw = 0.22 + Math.sin(elapsed * 13) * 0.14; // Apertura pulsante de risa
            setMorph('mouthSmileLeft', 0.95, 0.1);
            setMorph('mouthSmileRight', 0.95, 0.1);
            setMorph('mouthSmile', 0.9, 0.1);
            setMorph('mouthDimpleLeft', 0.55, 0.09);
            setMorph('mouthDimpleRight', 0.55, 0.09);
            setMorph('jawOpen', laughJaw, 0.15);
            setMorph('mouthOpen', laughJaw, 0.15);
            setMorph('cheekSquintLeft', 0.85, 0.09);
            setMorph('cheekSquintRight', 0.85, 0.09);
            setMorph('eyeSquintLeft', 0.65, 0.09);
            setMorph('eyeSquintRight', 0.65, 0.09);
            setMorph('browOuterUpLeft', 0.5, 0.09);
            setMorph('browOuterUpRight', 0.5, 0.09);
            setMorph('browDownLeft', 0.0, 0.09);
            setMorph('browDownRight', 0.0, 0.09);
            setMorph('browInnerUp', 0.2, 0.09);
            setMorph('mouthPressLeft', 0.0, 0.09);
            setMorph('mouthPressRight', 0.0, 0.09);
            setMorph('noseSneerLeft', 0.0, 0.09);
            setMorph('noseSneerRight', 0.0, 0.09);
            setMorph('eyeLookDownLeft', 0.0, 0.09);
            setMorph('eyeLookDownRight', 0.0, 0.09);
          } else if (emocion === 'confianza') {
            // Faceta Wicked: Media sonrisa de satisfacción y ceja arqueada
            setMorph('mouthSmileRight', 0.85, 0.09);
            setMorph('mouthDimpleRight', 0.55, 0.09);
            setMorph('mouthSmileLeft', 0.15, 0.09);
            setMorph('browOuterUpRight', 0.65, 0.09);
            setMorph('browDownLeft', 0.25, 0.09);
            setMorph('browInnerUp', 0.0, 0.09);
            setMorph('eyeSquintRight', 0.35, 0.09);
            setMorph('eyeSquintLeft', 0.15, 0.09);
            setMorph('jawOpen', 0.0, 0.09);
            setMorph('eyeLookDownLeft', 0.0, 0.09);
            setMorph('eyeLookDownRight', 0.0, 0.09);
          } else if (emocion === 'alarma' || emocion === 'derrota' || emocion === 'preocupacion' || emocion === 'tension') {
            // --- 3. REACCIÓN DE ENOJO Y FASTIDIO ANTE ERROR O JAQUE ---
            setMorph('browDownLeft', 0.95, 0.09);
            setMorph('browDownRight', 0.95, 0.09);
            setMorph('browInnerUp', 0.0, 0.09);
            setMorph('noseSneerLeft', 0.7, 0.09); // Nariz arrugada con furia
            setMorph('noseSneerRight', 0.7, 0.09);
            setMorph('mouthFrownLeft', 0.8, 0.09);
            setMorph('mouthFrownRight', 0.8, 0.09);
            setMorph('mouthPressLeft', 0.85, 0.09);
            setMorph('mouthPressRight', 0.85, 0.09);
            setMorph('mouthSmileLeft', 0.0, 0.09);
            setMorph('mouthSmileRight', 0.0, 0.09);
            setMorph('eyeSquintLeft', 0.7, 0.09);
            setMorph('eyeSquintRight', 0.7, 0.09);
            setMorph('jawOpen', 0.0, 0.09);
            setMorph('eyeLookDownLeft', 0.0, 0.09);
            setMorph('eyeLookDownRight', 0.0, 0.09);
          } else {
            // Estado Neutral / Apertura: Sereno y de frente
            setMorph('browDownLeft', 0.0, 0.09);
            setMorph('browDownRight', 0.0, 0.09);
            setMorph('browInnerUp', 0.0, 0.09);
            setMorph('eyeSquintLeft', 0.0, 0.09);
            setMorph('eyeSquintRight', 0.0, 0.09);
            setMorph('mouthSmileLeft', 0.0, 0.09);
            setMorph('mouthSmileRight', 0.0, 0.09);
            setMorph('mouthPressLeft', 0.0, 0.09);
            setMorph('mouthPressRight', 0.0, 0.09);
            setMorph('jawOpen', 0.0, 0.09);
            setMorph('noseSneerLeft', 0.0, 0.09);
            setMorph('noseSneerRight', 0.0, 0.09);
            setMorph('eyeLookDownLeft', 0.0, 0.09);
            setMorph('eyeLookDownRight', 0.0, 0.09);
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
  }, [facetaActual, pensando, onResetCamera, onProgresoCarga, onError]);

  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
