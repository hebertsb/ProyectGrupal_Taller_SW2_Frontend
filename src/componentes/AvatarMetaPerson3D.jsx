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
 * Avatar 3D MetaPerson Completo (Humanoide 360° Real)
 * - Modelo 3D con volumen en todos sus lados (no es 2D)
 * - Encuadre de la cintura para arriba (cuerpo superior, ropa, gafas, cabello)
 * - 51 Apple ARKit Blendshapes para micro-expresiones (Wicked smirk, Suspicious, Confused, XD)
 * - Esqueleto de 73 huesos con respiración, head-tracking y sacadas oculares
 * - Piezas de ajedrez holográficas flotando en 3D
 */
export default function AvatarMetaPerson3D({
  pensando = false,
  facetaActual,
  onResetCamera,
  onProgresoCarga,
  onError,
}) {
  const mountRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const clockRef = useRef(new THREE.Clock());

  // Referencias esqueléticas y morfológicas
  const bonesRef = useRef({
    head: null,
    neck: null,
    neck1: null,
    spine: null,
    spine1: null,
    leftEye: null,
    rightEye: null,
  });
  const morphMeshesRef = useRef([]);

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 320;
    const alto = contenedor.clientHeight || 280;

    // 1. Escena y Cámara 3D
    const scene = new THREE.Scene();
    // Cámara con ángulo de 36° estilo retrato cinematográfico
    const camera = new THREE.PerspectiveCamera(36, ancho / alto, 0.1, 100);
    // Encuadre exacto de la cintura para arriba (cabeza a 1.65m, pecho a 1.45m, cintura a 1.10m)
    camera.position.set(0, 1.54, 1.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderer.domElement);

    // OrbitControls 360° libre
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.55;
    controls.maxDistance = 2.8;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.set(0, 1.48, 0); // Foco en el cuello / rostro

    if (onResetCamera) {
      onResetCamera.current = () => {
        camera.position.set(0, 1.54, 1.05);
        controls.target.set(0, 1.48, 0);
        controls.update();
      };
    }

    // 2. Iluminación PBR de Estudio
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0xffffff, 2.8);
    luzClave.position.set(1.5, 3.0, 2.5);
    luzClave.castShadow = true;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x818cf8, 1.3);
    luzRelleno.position.set(-2.0, 1.2, 1.8);
    scene.add(luzRelleno);

    // Rim Light (Luz de contorno cian para resaltar silueta, hombros y cabello)
    const luzContorno = new THREE.PointLight(0x00e5ff, 3.8, 6);
    luzContorno.position.set(0, 2.2, -1.2);
    scene.add(luzContorno);

    // Luz de Faceta Emocional (tiñe dinámicamente según el estado anímico)
    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.5, 3.2);
    luzFaceta.position.set(0, 1.6, 0.7);
    scene.add(luzFaceta);

    // 3. Piezas de Ajedrez Holográficas Flotando en el Fondo 3D
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
      { tipo: 'caballo', pos: [-0.65, 1.7, -0.45], escala: 0.55, rotVel: 0.4 },
      { tipo: 'alfil', pos: [0.65, 1.65, -0.4], escala: 0.5, rotVel: -0.35 },
      { tipo: 'rey', pos: [0.55, 1.25, -0.3], escala: 0.48, rotVel: 0.25 },
      { tipo: 'dama', pos: [-0.55, 1.2, -0.35], escala: 0.5, rotVel: -0.3 },
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

    // 4. Carga del Modelo 3D MetaPerson (.GLB con todos los lados)
    morphMeshesRef.current = [];
    bonesRef.current = {
      head: null,
      neck: null,
      neck1: null,
      spine: null,
      spine1: null,
      leftEye: null,
      rightEye: null,
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

            // Recolectar mallas con blendshapes faciales (AvatarHead, AvatarEyelashes, etc.)
            if (obj.morphTargetDictionary && Object.keys(obj.morphTargetDictionary).length > 0) {
              morphMeshesRef.current.push(obj);
            }
          }

          // Recolectar huesos clave
          const name = obj.name || '';
          if (name === 'Head') bonesRef.current.head = obj;
          else if (name === 'Neck') bonesRef.current.neck = obj;
          else if (name === 'Neck1') bonesRef.current.neck1 = obj;
          else if (name === 'Spine') bonesRef.current.spine = obj;
          else if (name === 'Spine1' || name === 'Spine2') bonesRef.current.spine1 = obj;
          else if (name === 'LeftEye') bonesRef.current.leftEye = obj;
          else if (name === 'RightEye') bonesRef.current.rightEye = obj;
        });

        // Asegurar que el avatar esté apoyado en Y=0
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

    // 5. Seguimiento del ratón para Head Tracking interactivo
    const manejarMouseMove = (e) => {
      const rect = contenedor.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      };
    };
    window.addEventListener('mousemove', manejarMouseMove);

    // 6. Timers de parpadeo y sacadas oculares
    let blinkTimer = 0;
    let nextBlinkTime = 3.2;
    let blinkProgress = 0;
    let isBlinking = false;

    let saccadeTimer = 0;
    let saccadeOffset = { x: 0, y: 0 };

    // 7. Bucle de Animación 3D a 60 FPS
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // A. Color dinámico de iluminación según la faceta emocional autónoma
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

      // C. Fisiología y Huesos: Respiración y Seguimiento del Cursor
      const { head, neck, neck1, spine, spine1, leftEye, rightEye } = bonesRef.current;

      // Respiración armónica de pecho y cuello
      const respFactor = Math.sin(elapsed * 1.6);
      if (spine) {
        spine.rotation.x = respFactor * 0.012;
      }
      if (spine1) {
        spine1.rotation.x = respFactor * 0.015;
      }

      // Head Tracking y Posturas según el estado de ajedrez
      if (head) {
        saccadeTimer += delta;
        if (pensando && saccadeTimer > 0.75) {
          saccadeTimer = 0;
          saccadeOffset = {
            x: (Math.random() - 0.5) * 0.08,
            y: (Math.random() - 0.5) * 0.05,
          };
        } else if (!pensando && saccadeTimer > 2.5) {
          saccadeTimer = 0;
          saccadeOffset = { x: (Math.random() - 0.5) * 0.02, y: 0 };
        }

        const mouse = mousePosRef.current;
        const targetRotY = mouse.x * 0.28 + saccadeOffset.x;
        let targetRotX = -mouse.y * 0.20 + saccadeOffset.y;
        let targetRotZ = 0;

        // Posturas psicológicas autónomas:
        if (pensando) {
          targetRotX += 0.16; // Cabeza inclinada hacia abajo analizando el tablero
        } else if (facetaActual?.emocion === 'confianza') {
          // Gesto "Wicked" (media sonrisa pícara y cabeza ladeada)
          targetRotX -= 0.04;
          targetRotZ = -0.06;
        } else if (facetaActual?.emocion === 'confianza_alta' || facetaActual?.emocion === 'victoria') {
          // Gesto "XD" (triunfo y cabeza erguida)
          targetRotX -= 0.08;
        } else if (facetaActual?.emocion === 'alarma' || facetaActual?.emocion === 'tension') {
          // Gesto "Confused" (incredulidad / sorpresa / jaque)
          targetRotX -= 0.08;
          targetRotZ = 0.08;
        }

        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.07);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.07);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetRotZ, 0.07);
      }

      if (neck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, mousePosRef.current.x * 0.14, 0.05);
      }
      if (neck1) {
        neck1.rotation.y = THREE.MathUtils.lerp(neck1.rotation.y, mousePosRef.current.x * 0.10, 0.05);
      }

      // Huesos oculares (LeftEye / RightEye)
      if (leftEye && rightEye) {
        const eyeLookY = mousePosRef.current.x * 0.12;
        const eyeLookX = -mousePosRef.current.y * 0.10 + (pensando ? 0.08 : 0);
        leftEye.rotation.y = THREE.MathUtils.lerp(leftEye.rotation.y, eyeLookY, 0.1);
        leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, eyeLookX, 0.1);
        rightEye.rotation.y = THREE.MathUtils.lerp(rightEye.rotation.y, eyeLookY, 0.1);
        rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, eyeLookX, 0.1);
      }

      // D. Micro-Expresiones Faciales con los 51 Blendshapes de Apple ARKit
      blinkTimer += delta;
      if (!isBlinking && blinkTimer > nextBlinkTime) {
        isBlinking = true;
        blinkTimer = 0;
        nextBlinkTime = pensando ? 2.5 + Math.random() * 1.8 : 3.5 + Math.random() * 2.2;
      }
      if (isBlinking) {
        blinkProgress += delta * 7.0; // Duración ~140ms
        if (blinkProgress >= 1.0) {
          isBlinking = false;
          blinkProgress = 0;
        }
      }
      const blinkTarget = isBlinking ? Math.sin(blinkProgress * Math.PI) : 0;

      // Aplicar blendshapes a todas las mallas faciales
      if (morphMeshesRef.current.length > 0) {
        morphMeshesRef.current.forEach((mesh) => {
          const dict = mesh.morphTargetDictionary;
          const infl = mesh.morphTargetInfluences;
          if (!dict || !infl) return;

          const setMorph = (nombre, valor, vel = 0.08) => {
            const idx = dict[nombre];
            if (idx !== undefined) {
              infl[idx] = THREE.MathUtils.lerp(infl[idx], valor, vel);
            }
          };

          // 1. Parpadeo orgánico
          setMorph('eyeBlinkLeft', blinkTarget, 0.35);
          setMorph('eyeBlinkRight', blinkTarget, 0.35);

          // 2. Evaluaciones Emocionales según la Faceta y los GIFs MetaPerson:
          const emocion = facetaActual?.emocion || 'neutral';

          if (pensando) {
            // Cálculo Tensorial v5 (Ceño fruncido, ojos entrecerrados y concentración)
            setMorph('browDownLeft', 0.65, 0.08);
            setMorph('browDownRight', 0.65, 0.08);
            setMorph('browInnerUp', 0.0, 0.08);
            setMorph('eyeSquintLeft', 0.45, 0.08);
            setMorph('eyeSquintRight', 0.45, 0.08);
            setMorph('eyeWideLeft', 0.0, 0.08);
            setMorph('eyeWideRight', 0.0, 0.08);
            setMorph('mouthSmileLeft', 0.0, 0.08);
            setMorph('mouthSmileRight', 0.0, 0.08);
            setMorph('mouthPressLeft', 0.4, 0.08);
            setMorph('mouthPressRight', 0.4, 0.08);
            setMorph('jawOpen', 0.0, 0.08);
            setMorph('eyeLookDownLeft', 0.35, 0.08);
            setMorph('eyeLookDownRight', 0.35, 0.08);
          } else if (emocion === 'confianza') {
            // Faceta "metaperson_wicked.gif": Smirk pícaro asimétrico de Gran Maestro
            setMorph('mouthSmileRight', 0.85, 0.08);
            setMorph('mouthDimpleRight', 0.55, 0.08);
            setMorph('mouthSmileLeft', 0.15, 0.08);
            setMorph('browOuterUpRight', 0.65, 0.08);
            setMorph('browDownLeft', 0.25, 0.08);
            setMorph('browInnerUp', 0.0, 0.08);
            setMorph('eyeSquintRight', 0.35, 0.08);
            setMorph('eyeSquintLeft', 0.15, 0.08);
            setMorph('mouthPressLeft', 0.0, 0.08);
            setMorph('mouthPressRight', 0.0, 0.08);
            setMorph('jawOpen', 0.0, 0.08);
          } else if (emocion === 'confianza_alta' || emocion === 'victoria') {
            // Faceta "metaperson_xd.gif": Sonrisa amplia de triunfo
            setMorph('mouthSmileLeft', 0.9, 0.08);
            setMorph('mouthSmileRight', 0.9, 0.08);
            setMorph('cheekSquintLeft', 0.65, 0.08);
            setMorph('cheekSquintRight', 0.65, 0.08);
            setMorph('browOuterUpLeft', 0.45, 0.08);
            setMorph('browOuterUpRight', 0.45, 0.08);
            setMorph('browDownLeft', 0.0, 0.08);
            setMorph('browDownRight', 0.0, 0.08);
            setMorph('eyeSquintLeft', 0.4, 0.08);
            setMorph('eyeSquintRight', 0.4, 0.08);
            setMorph('jawOpen', 0.18, 0.08);
          } else if (emocion === 'preocupacion') {
            // Faceta "metaperson_suspicious.gif": Ojos entrecerrados y boca tensa bajo presión
            setMorph('eyeSquintLeft', 0.75, 0.08);
            setMorph('eyeSquintRight', 0.75, 0.08);
            setMorph('browDownLeft', 0.55, 0.08);
            setMorph('browDownRight', 0.55, 0.08);
            setMorph('browInnerUp', 0.25, 0.08);
            setMorph('mouthPressLeft', 0.6, 0.08);
            setMorph('mouthPressRight', 0.6, 0.08);
            setMorph('mouthFrownLeft', 0.35, 0.08);
            setMorph('mouthFrownRight', 0.35, 0.08);
            setMorph('mouthSmileLeft', 0.0, 0.08);
            setMorph('mouthSmileRight', 0.0, 0.08);
            setMorph('jawOpen', 0.0, 0.08);
          } else if (emocion === 'alarma' || emocion === 'derrota') {
            // Faceta "metaperson_confused.gif": Alarma / Incredulidad / Peligro de mate
            setMorph('browInnerUp', 0.85, 0.08);
            setMorph('browDownLeft', 0.35, 0.08);
            setMorph('browDownRight', 0.35, 0.08);
            setMorph('eyeWideLeft', 0.85, 0.1);
            setMorph('eyeWideRight', 0.85, 0.1);
            setMorph('eyeSquintLeft', 0.0, 0.08);
            setMorph('eyeSquintRight', 0.0, 0.08);
            setMorph('mouthFrownLeft', 0.45, 0.08);
            setMorph('mouthFrownRight', 0.45, 0.08);
            setMorph('jawOpen', 0.35, 0.08);
            setMorph('mouthSmileLeft', 0.0, 0.08);
            setMorph('mouthSmileRight', 0.0, 0.08);
          } else {
            // Estado Neutral / Apertura
            setMorph('browDownLeft', 0.0, 0.08);
            setMorph('browDownRight', 0.0, 0.08);
            setMorph('browInnerUp', 0.0, 0.08);
            setMorph('eyeSquintLeft', 0.0, 0.08);
            setMorph('eyeSquintRight', 0.0, 0.08);
            setMorph('eyeWideLeft', 0.0, 0.08);
            setMorph('eyeWideRight', 0.0, 0.08);
            setMorph('mouthSmileLeft', 0.0, 0.08);
            setMorph('mouthSmileRight', 0.0, 0.08);
            setMorph('mouthPressLeft', 0.0, 0.08);
            setMorph('mouthPressRight', 0.0, 0.08);
            setMorph('jawOpen', 0.0, 0.08);
          }
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
  }, [facetaActual, pensando, onResetCamera, onProgresoCarga, onError]);

  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
