import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Avatar 3D MetaPerson Dinámico
 * - Encuadre perfectamente centrado de la cintura para arriba (sin piezas volando)
 * - Mira SIEMPRE DE FRENTE al usuario (contacto visual constante, no sigue el ratón)
 * - Inclina la cabeza y mira abajo al tablero ÚNICAMENTE cuando está pensando/analizando
 * - Risa con carcajadas y vaivén animado estilo metaperson_xd (1).gif al tener ventaja
 * - Reacción de enojo con ceño fruncido y negación de cabeza si comete error / jaque
 * - Postura natural con brazos relajados abajo gracias a la animación Idle horneada
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

    // 1. Escena y Cámara 3D (Frontal, perfectamente centrada)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ancho / alto, 0.1, 100);
    // Cámara posicionada de frente enfocando el torso y rostro
    camera.position.set(0, 1.49, 1.15);

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
    controls.minDistance = 0.5;
    controls.maxDistance = 2.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.set(0, 1.44, 0);

    // Función para centrar la cámara exactamente en el rostro/torso
    const centrarEncuadre = () => {
      let targetY = 1.44;
      if (bonesRef.current.head) {
        const headWorld = new THREE.Vector3();
        bonesRef.current.head.getWorldPosition(headWorld);
        if (headWorld.y > 1) {
          targetY = headWorld.y - 0.16; // Nivel de la barbilla/cuello
        }
      }
      controls.target.set(0, targetY, 0);
      camera.position.set(0, targetY + 0.05, 1.15);
      controls.update();
    };

    if (onResetCamera) {
      onResetCamera.current = centrarEncuadre;
    }

    // Adaptación dinámica si cambia el tamaño del contenedor
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

    // 2. Iluminación PBR de Estudio Fotográfico
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0xffffff, 2.8);
    luzClave.position.set(1.5, 3.0, 2.5);
    luzClave.castShadow = true;
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x818cf8, 1.3);
    luzRelleno.position.set(-2.0, 1.2, 1.8);
    scene.add(luzRelleno);

    // Rim Light (Luz de contorno cian para resaltar silueta y hombros)
    const luzContorno = new THREE.PointLight(0x00e5ff, 3.5, 6);
    luzContorno.position.set(0, 2.2, -1.2);
    scene.add(luzContorno);

    // Luz dinámica de emoción facial
    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.5, 3.2);
    luzFaceta.position.set(0, 1.5, 0.7);
    scene.add(luzFaceta);

    // 3. Carga del Modelo 3D MetaPerson (.GLB)
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

        // Centrado geométrico riguroso en los ejes X y Z
        const bbox = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        root.position.x = -center.x;
        root.position.z = -center.z;
        root.position.y = 0; // Pies en el plano base

        scene.add(root);

        // Auto-centrar la cámara exactamente a la altura del rostro del modelo cargado
        centrarEncuadre();

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

    // 4. Timers de parpadeo fisiológico
    let blinkTimer = 0;
    let nextBlinkTime = 3.5;
    let isBlinking = false;
    let blinkProgress = 0;

    // 5. Bucle de Renderizado 3D a 60 FPS
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // Actualizar AnimationMixer (brazos abajo y respiración orgánica)
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // A. Color dinámico de iluminación según la emoción
      if (facetaActual) {
        const colorObj = new THREE.Color(facetaActual.color);
        luzFaceta.color.lerp(colorObj, 0.05);
      }

      // B. Control de Cabeza y Cuello (SIEMPRE DE FRENTE, SIN SEGUIR EL RATÓN)
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

        // Interpolación suave y orgánica
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

      // C. Micro-Expresiones Faciales con Blendshapes Apple ARKit
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
      resizeObserver.disconnect();
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
