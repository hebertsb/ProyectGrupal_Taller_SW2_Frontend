import { useEffect, useRef } from 'react';
import * as THREE from 'three';
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
 * Avatar KAIROS Gran Maestro Cyberpunk
 * - Retrato hiperrealista de la cintura para arriba
 * - Micro-expresiones autónomas: parpadeo orgánico, sacadas oculares, ceño fruncido, smirk
 * - Circuitos cibernéticos en las sienes con pulsos de fotones en tiempo real
 * - Escena 3D con piezas de ajedrez holográficas flotantes y parallax interactivo
 */
export default function AvatarGrandmasterCyber({
  pensando = false,
  facetaActual,
  onResetCamera,
}) {
  const mountRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    let animId;
    const ancho = contenedor.clientWidth || 320;
    const alto = contenedor.clientHeight || 280;

    // 1. Escena y Cámara 3D
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, ancho / alto, 0.1, 100);
    // Cámara optimizada: encuadre de la cintura para arriba (busto + hombros + cabeza)
    camera.position.set(0, 0.08, 2.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    contenedor.appendChild(renderer.domElement);

    // OrbitControls suave para inspección
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.2;
    controls.maxDistance = 3.6;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.target.set(0, 0.05, 0);

    if (onResetCamera) {
      onResetCamera.current = () => {
        camera.position.set(0, 0.08, 2.35);
        controls.target.set(0, 0.05, 0);
        controls.update();
      };
    }

    // 2. Iluminación Cinematográfica
    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0x00e5ff, 2.4);
    luzClave.position.set(1.5, 2.5, 2.0);
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x818cf8, 1.2);
    luzRelleno.position.set(-2.0, 1.0, 1.5);
    scene.add(luzRelleno);

    // Luz de contorno trasera (Rim light cian)
    const luzContorno = new THREE.PointLight(0x00e5ff, 3.5, 6);
    luzContorno.position.set(0, 1.2, -1.5);
    scene.add(luzContorno);

    // Luz dinámica de la faceta emocional (tiñe sutilmente el busto)
    const luzFaceta = new THREE.PointLight(0x00e5ff, 1.8, 3.5);
    luzFaceta.position.set(0, 0.4, 1.1);
    scene.add(luzFaceta);

    // 3. Piezas de Ajedrez Holográficas Flotantes en 3D
    const grupoPiezas = new THREE.Group();
    scene.add(grupoPiezas);

    const matHoloCyan = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.7,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
      metalness: 0.9,
    });

    const piezasConfig = [
      { tipo: 'caballo', pos: [-0.95, 0.35, -0.45], escala: 0.85, rotVel: 0.4 },
      { tipo: 'alfil', pos: [0.95, 0.25, -0.35], escala: 0.8, rotVel: -0.35 },
      { tipo: 'rey', pos: [0.85, -0.35, 0.15], escala: 0.75, rotVel: 0.25 },
      { tipo: 'dama', pos: [-0.85, -0.4, 0.1], escala: 0.78, rotVel: -0.3 },
      { tipo: 'peon', pos: [-0.75, 0.72, -0.6], escala: 0.7, rotVel: 0.45 },
      { tipo: 'peon', pos: [0.75, 0.75, -0.65], escala: 0.68, rotVel: -0.4 },
    ];

    const piezasMeshes = piezasConfig.map((cfg) => {
      const geo = crearGeometriaPieza(cfg.tipo);
      const mesh = new THREE.Mesh(geo, matHoloCyan);
      mesh.position.set(...cfg.pos);
      mesh.scale.setScalar(cfg.escala);
      grupoPiezas.add(mesh);
      return { mesh, cfg };
    });

    // 4. Anillo Holográfico de Telemetría Inferior
    const anilloGeo = new THREE.RingGeometry(0.85, 0.88, 48);
    const anilloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const anilloHolo = new THREE.Mesh(anilloGeo, anilloMat);
    anilloHolo.rotation.x = -Math.PI / 2 + 0.2;
    anilloHolo.position.set(0, -0.85, -0.1);
    scene.add(anilloHolo);

    // 5. Cargar imagen base del Gran Maestro y preparar Canvas de Micro-Expresiones
    const canvasOffscreen = document.createElement('canvas');
    canvasOffscreen.width = 1024;
    canvasOffscreen.height = 1024;
    const ctx = canvasOffscreen.getContext('2d');

    const texture = new THREE.CanvasTexture(canvasOffscreen);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Plano del Busto KAIROS en 3D
    const bustoGeo = new THREE.PlaneGeometry(1.85, 1.85, 32, 32);
    const bustoMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.45,
      metalness: 0.15,
      side: THREE.FrontSide,
    });
    const bustoMesh = new THREE.Mesh(bustoGeo, bustoMat);
    bustoMesh.position.set(0, 0, 0);
    scene.add(bustoMesh);

    // Cargar imagen de alta resolución
    const imgBase = new Image();
    imgBase.crossOrigin = 'anonymous';
    imgBase.src = '/images/kairos_grandmaster.jpg';

    let imgCargada = false;
    imgBase.onload = () => {
      imgCargada = true;
      ctx.drawImage(imgBase, 0, 0, 1024, 1024);
      texture.needsUpdate = true;
    };

    // 6. Seguimiento del ratón para Parallax 3D interactivo
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

    // 7. Variables de Micro-Expresiones y Ciclos Fisiológicos
    let blinkTimer = 0;
    let nextBlinkTime = 3.2;
    let blinkProgress = 0;
    let isBlinking = false;

    let saccadeTimer = 0;
    let saccadeX = 0;
    let saccadeY = 0;
    let targetSaccadeX = 0;
    let targetSaccadeY = 0;

    // Estado animado de sonrisa / smirk interpolado
    let currentSmirk = 0;
    let currentBrowDown = 0;
    let currentBrowUp = 0;

    // 8. Bucle de Animación a 60 FPS
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      const elapsed = clockRef.current.getElapsedTime();

      // A. Actualizar color de la luz y anillos según la faceta emocional autónoma
      if (facetaActual) {
        const colorObj = new THREE.Color(facetaActual.color);
        luzFaceta.color.lerp(colorObj, 0.06);
        anilloMat.color.lerp(colorObj, 0.06);
        matHoloCyan.color.lerp(colorObj, 0.04);
        matHoloCyan.emissive.lerp(colorObj, 0.04);
      }

      // B. Rotación y flotación de las piezas holográficas en 3D
      piezasMeshes.forEach(({ mesh, cfg }, idx) => {
        mesh.rotation.y += cfg.rotVel * delta;
        mesh.position.y = cfg.pos[1] + Math.sin(elapsed * 1.5 + idx * 1.1) * 0.035;
      });
      anilloHolo.rotation.z += 0.005;

      // C. Parallax 3D y Respiración en el Busto KAIROS
      // Respiración armónica de hombros/pecho
      bustoMesh.position.y = Math.sin(elapsed * 1.6) * 0.015;

      // Inclinación de la cabeza con seguimiento suave del ratón
      const mouse = mousePosRef.current;
      const targetRotY = mouse.x * 0.12;
      let targetRotX = -mouse.y * 0.08;

      // Ajuste reactivo al pensamiento de ajedrez
      if (pensando) {
        targetRotX += 0.06; // Cabeza inclinada analizando el tablero
      } else if (facetaActual?.emocion === 'confianza' || facetaActual?.emocion === 'victoria') {
        targetRotX -= 0.03; // Barbilla ligeramente erguida con confianza
      } else if (facetaActual?.emocion === 'alarma' || facetaActual?.emocion === 'tension') {
        bustoMesh.position.z = THREE.MathUtils.lerp(bustoMesh.position.z, -0.04, 0.1);
      } else {
        bustoMesh.position.z = THREE.MathUtils.lerp(bustoMesh.position.z, 0, 0.05);
      }

      bustoMesh.rotation.y = THREE.MathUtils.lerp(bustoMesh.rotation.y, targetRotY, 0.06);
      bustoMesh.rotation.x = THREE.MathUtils.lerp(bustoMesh.rotation.x, targetRotX, 0.06);

      // D. Motor de Micro-Expresiones en el Canvas Offscreen
      if (imgCargada) {
        // Redibujar fondo base original
        ctx.drawImage(imgBase, 0, 0, 1024, 1024);

        // --- 1. PARPADEO ORGÁNICO (Blinking) ---
        blinkTimer += delta;
        if (!isBlinking && blinkTimer > nextBlinkTime) {
          isBlinking = true;
          blinkTimer = 0;
          nextBlinkTime = pensando ? 2.5 + Math.random() * 2.0 : 3.5 + Math.random() * 2.5;
        }

        if (isBlinking) {
          blinkProgress += delta * 6.5; // Duración ~150ms
          if (blinkProgress >= 1.0) {
            isBlinking = false;
            blinkProgress = 0;
          }
        }

        // Curva senoidal suave de apertura y cierre
        const blinkFactor = isBlinking ? Math.sin(blinkProgress * Math.PI) : 0;

        // --- 2. SACADAS OCULARES Y ESCANEO DE TABLERO (Eye Saccades) ---
        saccadeTimer += delta;
        if (pensando) {
          // Mientras calcula la red neuronal v5, escanea archivos de ajedrez (a-h)
          if (saccadeTimer > 0.65) {
            saccadeTimer = 0;
            targetSaccadeX = (Math.random() - 0.5) * 5.0; // Movimiento horizontal en x
            targetSaccadeY = (Math.random() - 0.5) * 2.5; // Movimiento vertical en y
          }
        } else {
          // En reposo, fija la mirada en el rival o en el centro
          if (saccadeTimer > 2.8) {
            saccadeTimer = 0;
            targetSaccadeX = (Math.random() - 0.5) * 2.0;
            targetSaccadeY = 0;
          }
        }
        saccadeX = THREE.MathUtils.lerp(saccadeX, targetSaccadeX, 0.12);
        saccadeY = THREE.MathUtils.lerp(saccadeY, targetSaccadeY, 0.12);

        // --- DIBUJAR OJOS Y PARPADEO ---
        const leftEye = { cx: 432, cy: 404, rx: 26, ry: 13 };
        const rightEye = { cx: 590, cy: 401, rx: 26, ry: 13 };

        // Si hay sacada ocular o parpadeo, procesamos las pupilas y párpados
        [leftEye, rightEye].forEach((eye) => {
          // Desplazamiento leve de pupila si hay escaneo
          if (Math.abs(saccadeX) > 0.2 || Math.abs(saccadeY) > 0.2) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(eye.cx, eye.cy, eye.rx - 4, eye.ry - 2, 0, 0, Math.PI * 2);
            ctx.clip();
            // Desplazar iris ligeramente
            ctx.drawImage(
              imgBase,
              eye.cx - eye.rx,
              eye.cy - eye.ry,
              eye.rx * 2,
              eye.ry * 2,
              eye.cx - eye.rx + saccadeX,
              eye.cy - eye.ry + saccadeY,
              eye.rx * 2,
              eye.ry * 2
            );
            ctx.restore();
          }

          // Cierre orgánico de párpado
          if (blinkFactor > 0.05) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(eye.cx, eye.cy, eye.rx + 2, eye.ry + 2, 0, 0, Math.PI * 2);
            ctx.clip();

            const dropY = eye.cy - eye.ry + eye.ry * 2 * blinkFactor;
            const gradPiel = ctx.createLinearGradient(eye.cx, eye.cy - eye.ry, eye.cx, dropY);
            gradPiel.addColorStop(0, '#5a463a'); // Sombra del hueso superciliar
            gradPiel.addColorStop(0.35, '#a27f6e'); // Tono cutáneo natural
            gradPiel.addColorStop(0.85, '#876556');
            gradPiel.addColorStop(1, '#2d221c'); // Línea de pestañas

            ctx.fillStyle = gradPiel;
            ctx.fillRect(eye.cx - eye.rx - 4, eye.cy - eye.ry - 2, (eye.rx + 4) * 2, dropY - (eye.cy - eye.ry) + 2);

            // Trazo fino de pestañas y pliegue palpebral
            ctx.strokeStyle = '#18120e';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(eye.cx - eye.rx, dropY);
            ctx.quadraticCurveTo(eye.cx, dropY + 2, eye.cx + eye.rx, dropY);
            ctx.stroke();

            ctx.restore();
          }
        });

        // --- 3. MICRO-EXPRESIÓN DE CEJAS (Concentración / Desafío) ---
        const targetBrowDown = pensando ? 3.5 : facetaActual?.cejasDown ? facetaActual.cejasDown * 3 : 0;
        const targetBrowUp = facetaActual?.cejasUp ? facetaActual.cejasUp * 3 : 0;
        currentBrowDown = THREE.MathUtils.lerp(currentBrowDown, targetBrowDown, 0.08);
        currentBrowUp = THREE.MathUtils.lerp(currentBrowUp, targetBrowUp, 0.08);

        if (currentBrowDown > 0.4) {
          // Desplazar ceño hacia abajo y sombra analítica en el entrecejo
          ctx.save();
          // Micro-sombra en el entrecejo (músculo corrugador)
          const gradSombra = ctx.createRadialGradient(512, 360, 2, 512, 360, 22);
          gradSombra.addColorStop(0, 'rgba(30, 20, 15, 0.45)');
          gradSombra.addColorStop(1, 'rgba(30, 20, 15, 0)');
          ctx.fillStyle = gradSombra;
          ctx.beginPath();
          ctx.ellipse(512, 360, 22, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // --- 4. SMIRK DE GRAN MAESTRO / MEDIA SONRISA AUTÓNOMA ---
        const targetSmirk =
          facetaActual?.sonrisa > 0.3
            ? facetaActual.sonrisa * 6.0
            : 0;
        currentSmirk = THREE.MathUtils.lerp(currentSmirk, targetSmirk, 0.08);

        if (currentSmirk > 0.4) {
          // Elevar la comisura derecha de los labios (x: 540..575, y: 585..615)
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(558, 598 - currentSmirk, 18, 14, 0, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            imgBase,
            538,
            584,
            38,
            28,
            538,
            584 - currentSmirk,
            38,
            28
          );
          ctx.restore();
        }

        // --- 5. PULSOS NEURONALES EN CIRCUITOS DE LAS SIENES ---
        const colorCircuito = facetaActual?.color || '#00e5ff';
        const velPulso = pensando ? 3.8 : 1.2;
        const pulsoOffset = (elapsed * velPulso) % 1.0;

        ctx.save();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = colorCircuito;
        ctx.shadowBlur = pensando ? 16 : 8;
        ctx.shadowColor = colorCircuito;

        // Puntos de la sien izquierda (x: 345..392, y: 225..335)
        const rutaSienIzq = [
          { x: 348, y: 228 },
          { x: 362, y: 260 },
          { x: 378, y: 292 },
          { x: 392, y: 335 },
        ];

        // Puntos de la sien derecha (x: 628..672, y: 225..335)
        const rutaSienDer = [
          { x: 672, y: 228 },
          { x: 658, y: 260 },
          { x: 642, y: 292 },
          { x: 628, y: 335 },
        ];

        [rutaSienIzq, rutaSienDer].forEach((ruta) => {
          ctx.beginPath();
          ctx.moveTo(ruta[0].x, ruta[0].y);
          for (let i = 1; i < ruta.length; i++) {
            ctx.lineTo(ruta[i].x, ruta[i].y);
          }
          ctx.stroke();

          // Fotón / paquete de datos viajando a lo largo del circuito
          const idxSeg = Math.floor(pulsoOffset * (ruta.length - 1));
          const tSeg = (pulsoOffset * (ruta.length - 1)) % 1.0;
          const p1 = ruta[idxSeg];
          const p2 = ruta[Math.min(idxSeg + 1, ruta.length - 1)];

          const px = p1.x + (p2.x - p1.x) * tSeg;
          const py = p1.y + (p2.y - p1.y) * tSeg;

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, pensando ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Líneas cibernéticas del cuello / chaqueta
        const cuelloIzq = [{ x: 426, y: 890 }, { x: 426, y: 990 }];
        const cuelloDer = [{ x: 608, y: 890 }, { x: 608, y: 990 }];
        [cuelloIzq, cuelloDer].forEach((cuello) => {
          ctx.beginPath();
          ctx.moveTo(cuello[0].x, cuello[0].y);
          ctx.lineTo(cuello[1].x, cuello[1].y);
          ctx.stroke();
        });

        ctx.restore();

        // Notificar a Three.js que la textura del canvas se actualizó
        texture.needsUpdate = true;
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
  }, [facetaActual, pensando, onResetCamera]);

  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
