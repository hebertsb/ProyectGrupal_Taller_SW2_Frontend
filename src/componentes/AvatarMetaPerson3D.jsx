import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Avatar 3D MetaPerson Dinámico
 * - Encuadre perfectamente centrado de la cintura para arriba (sin piezas volando)
 * - Mira SIEMPRE DE FRENTE al usuario (contacto visual constante, no sigue el ratón)
 * - Inclina la cabeza y mira abajo al tablero ÚNICAMENTE cuando está pensando/analizando
 * - Risa con carcajadas y vaivén animado estilo metaperson_xd (1).gif al tener ventaja
 * - Reacción de enojo con ceño fruncido y negación de cabeza si comete error / jaque
 * - Postura natural con brazos relajados abajo gracias a la animación Idle horneada
 * - Iluminación de estudio con HDRI real (Poly Haven, CC0 — ver public/hdri/) para que
 *   piel/lentes/tela reflejen entorno de verdad en vez de verse planos
 */

// HDRI de estudio (CC0, Poly Haven — "Studio Small 08": softbox neutro, bajo contraste,
// ideal para retrato). Se cachea en un módulo compartido para no re-descargar/re-parsear
// el archivo cada vez que este efecto se reinicia (pasa seguido: se reinicia por cada
// cambio de faceta emocional).
let promesaTexturaHDRI = null;
function cargarTexturaHDRI() {
  if (!promesaTexturaHDRI) {
    promesaTexturaHDRI = new RGBELoader().loadAsync('/hdri/studio_small_08_1k.hdr');
  }
  return promesaTexturaHDRI;
}

// El glb de MetaPerson/Avaturn exporta casi todos los materiales con
// metalness=1/roughness=1 (metal opaco totalmente rugoso) — sin mapa de entorno eso se ve
// prácticamente negro/plano, y es la causa real del aspecto "plástico de videojuego viejo"
// que reportó el usuario (más que la resolución de textura). Se corrige por nombre exacto
// de material (extraídos del glb) a valores físicamente razonables por tipo de superficie;
// lo que no está en esta tabla se deja tal cual lo exportó el modelo (ej. el lente de los
// lentes y el pelo ya venían bien configurados: vidrio con IOR y cabello mate).
// Nombres de material verificados directamente del glb con Blender (bpy) antes de
// escribir esto — ver la sesión de inspección del avatar nuevo (avatar_avaturn_v2.glb).
const AJUSTES_MATERIAL = {
  AvatarBody: { metalness: 0, roughness: 0.6 }, // piel: dieléctrica, mayormente difusa
  AvatarHead: { metalness: 0, roughness: 0.6 },
  AvatarLeftEyeball: { metalness: 0, roughness: 0.15 }, // globo ocular húmedo/brillante
  AvatarRightEyeball: { metalness: 0, roughness: 0.15 },
  AvatarLeftCornea: { metalness: 0, roughness: 0.05 }, // córnea: casi un vidrio, muy brillante
  AvatarRightCornea: { metalness: 0, roughness: 0.05 },
  AvatarEyelashes: { metalness: 0, roughness: 0.8 },
  AvatarTeethLower: { metalness: 0, roughness: 0.35 },
  AvatarTeethUpper: { metalness: 0, roughness: 0.35 },
  glasses: { metalness: 0.3, roughness: 0.35 }, // armazón: leve brillo
  haircut: { metalness: 0, roughness: 0.75 },
  outfit: { metalness: 0, roughness: 0.85 }, // tela: mate
};
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

  // `facetaActual`/`pensando` se leen cuadro a cuadro dentro de animate() más abajo, pero
  // NO deben estar en las dependencias del efecto pesado de configuración (ver más abajo) —
  // eso era la causa real de un bug reportado ("el avatar no reacciona bien"): si el objeto
  // `facetaActual` se recalcula con una referencia nueva en cada render del padre (algo
  // habitual aunque los valores lógicos no cambien), el efecto entero se reiniciaba —
  // recreando el WebGLRenderer y recargando el modelo de 13MB desde cero cada vez, tan
  // seguido que el navegador llegaba a descartar contextos WebGL por exceso ("Too many
  // active WebGL contexts", confirmado en consola). El modelo nunca llegaba a estabilizarse,
  // por eso ningún ajuste de mirada/postura se notaba. Guardarlos en refs actualizadas en
  // cada render (sin depender de un efecto) le da a animate() el valor más reciente sin
  // que el efecto pesado tenga que volver a correr.
  const facetaActualRef = useRef(facetaActual);
  facetaActualRef.current = facetaActual;
  const pensandoRef = useRef(pensando);
  pensandoRef.current = pensando;

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
    // Con luz de entorno real (HDRI) sumada a las luces de estudio ya existentes hay más
    // luz total entrando en la escena que antes — se baja la exposición para no quemar
    // los brillos de piel/lentes (antes compensaba la falta total de luz de entorno).
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderer.domElement);

    // Iluminación basada en imagen (IBL): sin esto, los materiales dieléctricos/metálicos
    // de la malla no tienen de dónde reflejar entorno y se ven planos aunque las luces de
    // estudio de abajo estén prendidas — es la luz "ambiental realista" que le falta a la
    // escena. Solo se usa para ILUMINAR (`scene.environment`); el fondo se deja transparente
    // como ya estaba, para no romper la estética HUD oscura del resto de la UI.
    let hdriCancelado = false;
    let envMapTextura = null;
    cargarTexturaHDRI()
      .then((hdrTexture) => {
        if (hdriCancelado) return;
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        envMapTextura = pmremGenerator.fromEquirectangular(hdrTexture).texture;
        scene.environment = envMapTextura;
        pmremGenerator.dispose();
      })
      .catch((err) => {
        console.error('No se pudo cargar el HDRI de iluminación del avatar:', err);
      });

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

    // Rotación de reposo REAL (bind pose) de los huesos de mirada — se captura apenas
    // se encuentran, antes de tocar el clip Idle. Verificado con datos del glb: el bind
    // pose de Head/Neck NO es {0,0,0} (Head ≈ -13.5° en X, Neck ≈ +25.6° en X) — lerpear
    // contra {0,0,0} literal (como hacía el código viejo) nunca converge a "de frente"
    // real, converge a una pose desviada de la real. Todo objetivo de mirada de acá en
    // más se calcula relativo a esto, no en absoluto.
    let poseReposo = { head: null, neck: null, leftEye: null, rightEye: null };

    const loader = new GLTFLoader();
    loader.load(
      '/models/avatar_avaturn_v2.glb',
      (gltf) => {
        const root = gltf.scene;

        root.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;

            // Corrige metalness/roughness por nombre de material real del glb (ver
            // AJUSTES_MATERIAL arriba) — el modelo trae casi todo como metal totalmente
            // rugoso, que es la causa concreta del aspecto plástico/plano reportado.
            const ajuste = obj.material && AJUSTES_MATERIAL[obj.material.name];
            if (ajuste) {
              if (ajuste.metalness !== undefined) obj.material.metalness = ajuste.metalness;
              if (ajuste.roughness !== undefined) obj.material.roughness = ajuste.roughness;
              obj.material.needsUpdate = true;
            }

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

        // Capturar el bind pose ANTES de que el clip Idle toque nada.
        poseReposo = {
          head: bonesRef.current.head ? bonesRef.current.head.rotation.clone() : null,
          neck: bonesRef.current.neck ? bonesRef.current.neck.rotation.clone() : null,
          leftEye: bonesRef.current.leftEye ? bonesRef.current.leftEye.rotation.clone() : null,
          rightEye: bonesRef.current.rightEye ? bonesRef.current.rightEye.rotation.clone() : null,
        };

        // Activar la animación Idle horneada para postura natural de brazos abajo
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;

          const idleClipOriginal =
            gltf.animations.find((a) => a.name.toLowerCase().includes('idle')) ||
            gltf.animations[0];

          if (idleClipOriginal) {
            // Verificado en el glb: este clip (IdleV4.2) SÍ anima Head.rotation y
            // Neck.rotation, cuadro a cuadro — el mixer las pisa cada frame ANTES de que
            // corra el código de mirada de abajo (mismo tick, orden: mixer.update()
            // primero, lerp de mirada después), así que el lerp nunca gana: en el frame
            // siguiente el mixer vuelve a pisarlo. Por eso la mirada nunca asentaba en
            // "de frente" real. Se filtran esos tracks del clip: el resto (brazos,
            // respiración de columna) sigue animado igual, la mirada queda 100% a cargo
            // del código de abajo, sin pelea.
            const HUESOS_MIRADA = ['Head', 'Neck', 'LeftEye', 'RightEye'];
            const idleClip = idleClipOriginal.clone();
            idleClip.tracks = idleClip.tracks.filter((track) => {
              const nombreNodo = track.name.split('.')[0];
              return !HUESOS_MIRADA.some((h) => nombreNodo === h || nombreNodo.endsWith('/' + h));
            });

            const action = mixer.clipAction(idleClip);
            action.setEffectiveTimeScale(0.95);
            action.play();
          }
        } else {
          // Salvaguarda: avatar_avaturn_v2.glb no trae ninguna animación horneada
          // (verificado: no existe la clave "animations" en el JSON del glb), así
          // que esta rama es siempre la que se ejecuta con el rig actual. El bind
          // pose de este archivo ES un T-pose real.
          //
          // Un solo eje (rotateX/Y/Z con ángulo adivinado a prueba y error) NO
          // alcanza acá: se probó primero en Blender, pero Blender reconstruye su
          // propio "roll"/espacio de hueso al importar un glTF, que NO es el mismo
          // espacio local del nodo crudo que usa Three.js — un ángulo que se ve
          // perfecto en el render de Blender puede terminar cruzando los brazos en
          // el navegador real (pasó). La forma correcta y verificable es calcular
          // el cuaternión delta directo desde los datos crudos del glTF (rotación
          // de LeftArm/RightArm + cadena de padres + traslación de LeftForeArm/
          // RightForeArm como dirección "a lo largo del brazo"), resolviendo qué
          // rotación adicional lleva esa dirección al vector mundial deseado.
          // El objetivo no es recto hacia abajo (0,-1,0) — pegaba el brazo al
          // cuerpo y se veía rígido/antinatural — sino 18° hacia afuera desde la
          // vertical, una pose de reposo relajada. Se verificó numéricamente que
          // la dirección final del brazo coincide exactamente con ese objetivo.
          // Valores específicos de este rig — no asumir que sirven si cambia el
          // archivo del avatar.
          if (bonesRef.current.leftArm) {
            bonesRef.current.leftArm.quaternion.multiply(
              new THREE.Quaternion(0.56683491, 0.05147953, -0.01976129, 0.8219839),
            );
          }
          if (bonesRef.current.rightArm) {
            bonesRef.current.rightArm.quaternion.multiply(
              new THREE.Quaternion(0.56683495, -0.05147909, 0.01976134, 0.8219839),
            );
          }
          // Codo con leve flexión hacia adelante (mismo método: cuaternión calculado
          // desde los datos crudos, tomando en cuenta la rotación del brazo superior
          // ya aplicada arriba) — sin esto el antebrazo queda perfectamente rígido
          // en línea recta con el brazo, que es lo que se veía "muy pegado"/tieso.
          if (bonesRef.current.leftForeArm) {
            bonesRef.current.leftForeArm.quaternion.multiply(
              new THREE.Quaternion(0.03473546, -0.00098028, 0.08719485, 0.99558503),
            );
          }
          if (bonesRef.current.rightForeArm) {
            bonesRef.current.rightForeArm.quaternion.multiply(
              new THREE.Quaternion(0.03473887, 0.00079205, -0.08719541, 0.99558503),
            );
          }
        }

        // Centrado geométrico riguroso en los ejes X y Z
        const bbox = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        root.position.x = -center.x;
        root.position.z = -center.z;
        root.position.y = 0; // Pies en el plano base
        // El offset de 0.32 rad estaba calibrado para el glb anterior (metaperson.glb) —
        // este archivo (avatar_avaturn_v2.glb) es de otro export y viene orientado distinto.
        // Verificado en Blender (render sin rotar, cámara de frente): este SÍ mira de frente
        // sin ningún ajuste. Si al cambiar de modelo esto vuelve a desalinearse, no asumir
        // el mismo offset — volver a verificar por separado para cada archivo.
        root.rotation.y = 0;

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
        console.error('Error cargando avatar_avaturn_v2.glb:', err);
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
      const facetaActualLeida = facetaActualRef.current;
      const pensandoLeido = pensandoRef.current;
      if (facetaActualLeida) {
        const colorObj = new THREE.Color(facetaActualLeida.color);
        luzFaceta.color.lerp(colorObj, 0.05);
      }

      // B. Control de Cabeza y Cuello (SIEMPRE DE FRENTE, SIN SEGUIR EL RATÓN)
      const { head, neck, spine1, leftEye, rightEye } = bonesRef.current;
      const emocion = facetaActualLeida?.emocion || 'neutral';

      // Todo objetivo de acá abajo es RELATIVO al bind pose real capturado al cargar
      // (`poseReposo`), no un valor absoluto — "de frente" es "igual al bind pose", no
      // "{0,0,0}". Con el clip Idle ya filtrado para estos huesos (ver arriba), esta es
      // ahora la única lógica que toca su rotación — sin nadie más peleando encima.
      const baseHead = poseReposo.head;
      const baseNeck = poseReposo.neck;

      if (head && baseHead) {
        let targetRotX = baseHead.x;
        let targetRotY = baseHead.y;
        let targetRotZ = baseHead.z;

        if (pensandoLeido) {
          // --- 1. MIRAR AL TABLERO ÚNICAMENTE CUANDO VA A JUGAR / CALCULAR ---
          targetRotX = baseHead.x + 0.28; // Cabeza inclinada hacia abajo analizando el tablero
          targetRotY = baseHead.y + Math.sin(elapsed * 2.5) * 0.04; // Leve paneo analizando casillas
          targetRotZ = baseHead.z;
        } else if (emocion === 'confianza_alta' || emocion === 'victoria' || emocion === 'triunfo') {
          // --- 2. SONRISA CÁLIDA DE VICTORIA (antes: cabeceo rápido que se leía como
          // risa nerviosa/forzada en una cara realista — bajado de frecuencia y amplitud
          // para que se vea como alguien genuinamente contento, no agitado) ---
          const laughWave = Math.sin(elapsed * 7);
          const laughBody = Math.sin(elapsed * 5);
          targetRotX = baseHead.x - 0.04 + laughWave * 0.025; // Leve asentimiento de satisfacción
          targetRotZ = baseHead.z + laughBody * 0.02; // Vaivén sutil
          targetRotY = baseHead.y; // De frente al usuario

          if (spine1) {
            spine1.rotation.x = laughWave * 0.008; // Respiración relajada, no vibración
          }
        } else if (emocion === 'confianza') {
          // Gesto Wicked: Media sonrisa pícara, cabeza de frente con leve inclinación
          targetRotX = baseHead.x - 0.03;
          targetRotZ = baseHead.z - 0.05;
          targetRotY = baseHead.y;
        } else if (emocion === 'alarma' || emocion === 'derrota' || emocion === 'preocupacion' || emocion === 'tension') {
          // --- 3. REACCIÓN DE ENOJO / FRUSTRACIÓN (Negación de cabeza y ceño fruncido) ---
          const angryShake = Math.sin(elapsed * 8);
          targetRotY = baseHead.y + angryShake * 0.10; // Sacude la cabeza diciendo "NO" con fastidio
          targetRotX = baseHead.x + 0.07; // Mandíbula tensa hacia adelante
          targetRotZ = baseHead.z;
        }
        // Posición Neutral / Apertura: ya queda cubierta por los valores iniciales (= baseHead)

        // Interpolación suave y orgánica
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetRotY, 0.08);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetRotX, 0.08);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetRotZ, 0.08);
      }

      if (neck && baseNeck) {
        neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, baseNeck.y, 0.06);
      }

      // Huesos Oculares: Miran abajo al tablero SOLO cuando piensa; de frente el resto del tiempo
      if (leftEye && rightEye && poseReposo.leftEye && poseReposo.rightEye) {
        let offsetX = 0;
        let offsetY = 0;

        if (pensandoLeido) {
          offsetX = 0.20; // Ojos orientados hacia el tablero
          offsetY = Math.sin(elapsed * 3) * 0.04;
        }

        leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, poseReposo.leftEye.x + offsetX, 0.12);
        leftEye.rotation.y = THREE.MathUtils.lerp(leftEye.rotation.y, poseReposo.leftEye.y + offsetY, 0.12);
        rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, poseReposo.rightEye.x + offsetX, 0.12);
        rightEye.rotation.y = THREE.MathUtils.lerp(rightEye.rotation.y, poseReposo.rightEye.y + offsetY, 0.12);
      }

      // C. Micro-Expresiones Faciales con Blendshapes Apple ARKit
      blinkTimer += delta;
      if (!isBlinking && blinkTimer > nextBlinkTime) {
        isBlinking = true;
        blinkTimer = 0;
        nextBlinkTime = pensandoLeido ? 2.5 + Math.random() * 1.8 : 3.5 + Math.random() * 2.2;
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

          if (pensandoLeido) {
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
            // --- 2. SONRISA CÁLIDA DE VICTORIA (antes: todo al máximo a la vez —
            // boca+mejillas+ojos+cejas — se leía como cara desencajada en vez de
            // alegría genuina en una cara realista; bajado a valores de una sonrisa
            // real, sin apilar 'mouthSmile' encima de 'mouthSmileLeft/Right') ---
            const laughJaw = 0.10 + Math.sin(elapsed * 7) * 0.06; // Boca entreabierta suave, no flapping
            setMorph('mouthSmileLeft', 0.65, 0.08);
            setMorph('mouthSmileRight', 0.65, 0.08);
            setMorph('mouthDimpleLeft', 0.35, 0.08);
            setMorph('mouthDimpleRight', 0.35, 0.08);
            setMorph('jawOpen', laughJaw, 0.1);
            setMorph('mouthOpen', laughJaw, 0.1);
            setMorph('cheekSquintLeft', 0.45, 0.08);
            setMorph('cheekSquintRight', 0.45, 0.08);
            setMorph('eyeSquintLeft', 0.3, 0.08);
            setMorph('eyeSquintRight', 0.3, 0.08);
            setMorph('browOuterUpLeft', 0.2, 0.08);
            setMorph('browOuterUpRight', 0.2, 0.08);
            setMorph('browDownLeft', 0.0, 0.08);
            setMorph('browDownRight', 0.0, 0.08);
            setMorph('browInnerUp', 0.08, 0.08);
            setMorph('mouthPressLeft', 0.0, 0.08);
            setMorph('mouthPressRight', 0.0, 0.08);
            setMorph('noseSneerLeft', 0.0, 0.08);
            setMorph('noseSneerRight', 0.0, 0.08);
            setMorph('eyeLookDownLeft', 0.0, 0.08);
            setMorph('eyeLookDownRight', 0.0, 0.08);
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
      hdriCancelado = true;
      if (envMapTextura) envMapTextura.dispose(); // el envMap prefiltrado es propio de este renderer, no el HDRI crudo cacheado
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // Deliberadamente vacío: este efecto arma el renderer/cámara/escena y carga el modelo
    // UNA SOLA VEZ al montar. `facetaActual`/`pensando` se leen vía ref (ver arriba) para no
    // reiniciar todo esto en cada cambio de emoción. `onResetCamera` es en sí mismo un ref
    // (se le asigna `.current`, no se lo invoca), así que su identidad ya es estable.
    // `onProgresoCarga`/`onError` solo se usan una vez, durante la carga inicial del GLB —
    // usar el valor de la primera vez que este efecto corre es exactamente lo que se
    // necesita acá, no hace falta reactividad sobre ellos tampoco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
