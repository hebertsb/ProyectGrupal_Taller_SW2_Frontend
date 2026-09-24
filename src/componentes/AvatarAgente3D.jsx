import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Avatar 3D Interactivo del Agente Autónomo (HU7 / Sprint 3).
 *
 * Renderizado en WebGL con Three.js:
 * - Geometría robótica procedural con materiales PBR metálicos y visor emisivo.
 * - Seguimiento de mirada reactivo (head tracking suave hacia el cursor del usuario).
 * - Animaciones de respiración, pulso sináptico y cálculo tensorial según el estado de la partida.
 * - Soporte para estados: 'neutral', 'pensando' (inferencia red v5), 'ventaja' o 'desafio'.
 */
export default function AvatarAgente3D({
  pensando = false,
  tipoOponente = 'modelo',
  evaluacionCp = 0,
  ultimoMovimiento = null,
  tamano = 'normal', // 'compacto', 'normal', 'ampliado'
}) {
  const mountRef = useRef(null);
  const [estadoTexto, setEstadoTexto] = useState('En espera');

  useEffect(() => {
    const contenedor = mountRef.current;
    if (!contenedor) return;

    const ancho = contenedor.clientWidth || 240;
    const alto = contenedor.clientHeight || 240;

    // 1. Escena, Cámara y Renderizador WebGL
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, ancho / alto, 0.1, 1000);
    camera.position.set(0, 0.4, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    contenedor.appendChild(renderer.domElement);

    // 2. Iluminación Cinematográfica PBR
    const luzAmbiente = new THREE.AmbientLight(0x0a192f, 2.5);
    scene.add(luzAmbiente);

    const luzClave = new THREE.DirectionalLight(0x00e5ff, 3.0);
    luzClave.position.set(2, 4, 3);
    scene.add(luzClave);

    const luzRelleno = new THREE.DirectionalLight(0x7c4dff, 2.0);
    luzRelleno.position.set(-3, -1, 2);
    scene.add(luzRelleno);

    const luzContorno = new THREE.PointLight(0x00e5ff, 4.0, 10);
    luzContorno.position.set(0, 2, -2);
    scene.add(luzContorno);

    // Luz dinámica del visor (pulsa cuando piensa)
    const luzVisor = new THREE.PointLight(0x00e5ff, 2.5, 3);
    luzVisor.position.set(0, 0.35, 1.2);
    scene.add(luzVisor);

    // 3. Construcción del Agente Robótico 3D
    const grupoAvatar = new THREE.Group();
    scene.add(grupoAvatar);

    // Materiales
    const materialMetalOscuro = new THREE.MeshStandardMaterial({
      color: 0x111625,
      metalness: 0.9,
      roughness: 0.25,
    });

    const materialPlacaTitanio = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.35,
    });

    const materialCromo = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.95,
      roughness: 0.1,
    });

    const materialVisorEmisivo = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.5,
    });

    const materialNucleoDorado = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Cabeza Principal
    const grupoCabeza = new THREE.Group();
    grupoAvatar.add(grupoCabeza);

    // Casco Craneal
    const geoCraneo = new THREE.SphereGeometry(0.85, 32, 32);
    geoCraneo.scale(0.9, 1.05, 0.95);
    const craneo = new THREE.Mesh(geoCraneo, materialMetalOscuro);
    grupoCabeza.add(craneo);

    // Placas Laterales
    const geoPlaca = new THREE.CylinderGeometry(0.86, 0.86, 0.4, 24, 1, true, 0.5, 1.2);
    const placaIzq = new THREE.Mesh(geoPlaca, materialPlacaTitanio);
    placaIzq.rotation.y = Math.PI / 2;
    placaIzq.position.y = 0.1;
    grupoCabeza.add(placaIzq);

    const placaDer = new THREE.Mesh(geoPlaca, materialPlacaTitanio);
    placaDer.rotation.y = -Math.PI / 2;
    placaDer.position.y = 0.1;
    grupoCabeza.add(placaDer);

    // Visor Óptico / Ojos Cibernéticos
    const geoVisor = new THREE.BoxGeometry(0.95, 0.22, 0.35);
    const visor = new THREE.Mesh(geoVisor, materialVisorEmisivo);
    visor.position.set(0, 0.18, 0.72);
    grupoCabeza.add(visor);

    // Ojos / Sensores duales dentro del visor
    const geoLente = new THREE.CylinderGeometry(0.065, 0.065, 0.15, 16);
    geoLente.rotateX(Math.PI / 2);
    const matLente = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const lenteIzq = new THREE.Mesh(geoLente, matLente);
    lenteIzq.position.set(-0.25, 0.18, 0.88);
    grupoCabeza.add(lenteIzq);

    const lenteDer = new THREE.Mesh(geoLente, matLente);
    lenteDer.position.set(0.25, 0.18, 0.88);
    grupoCabeza.add(lenteDer);

    // Mentón / Mandíbula estilizada
    const geoMenton = new THREE.ConeGeometry(0.45, 0.5, 4);
    geoMenton.rotateY(Math.PI / 4);
    const menton = new THREE.Mesh(geoMenton, materialPlacaTitanio);
    menton.position.set(0, -0.65, 0.4);
    grupoCabeza.add(menton);

    // Cuello Robótico / Anillos Articulados
    const grupoCuello = new THREE.Group();
    grupoCuello.position.y = -0.9;
    grupoAvatar.add(grupoCuello);

    const geoAnillo = new THREE.TorusGeometry(0.42, 0.06, 16, 32);
    geoAnillo.rotateX(Math.PI / 2);
    const anillo1 = new THREE.Mesh(geoAnillo, materialCromo);
    anillo1.position.y = 0.1;
    grupoCuello.add(anillo1);

    const anillo2 = new THREE.Mesh(geoAnillo, materialMetalOscuro);
    anillo2.position.y = -0.15;
    anillo2.scale.set(1.15, 1.15, 1.15);
    grupoCuello.add(anillo2);

    // Anillo Giroscópico Holográfico (Orbita alrededor del agente)
    const geoHalo = new THREE.TorusGeometry(1.35, 0.02, 16, 64);
    const matHalo = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    const halo1 = new THREE.Mesh(geoHalo, matHalo);
    halo1.rotation.x = Math.PI / 3;
    grupoAvatar.add(halo1);

    const halo2 = new THREE.Mesh(geoHalo, matHalo);
    halo2.rotation.x = -Math.PI / 4;
    halo2.scale.set(1.18, 1.18, 1.18);
    grupoAvatar.add(halo2);

    // Nube de Partículas Sinápticas (Red Neuronal)
    const totalParticulas = 60;
    const geoParticulas = new THREE.BufferGeometry();
    const posiciones = new Float32Array(totalParticulas * 3);

    for (let i = 0; i < totalParticulas * 3; i += 3) {
      const radio = 1.3 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      posiciones[i] = radio * Math.cos(phi) * Math.cos(theta);
      posiciones[i + 1] = radio * Math.sin(phi);
      posiciones[i + 2] = radio * Math.cos(phi) * Math.sin(theta);
    }

    geoParticulas.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    const matParticulas = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.045,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const nubeParticulas = new THREE.Points(geoParticulas, matParticulas);
    grupoAvatar.add(nubeParticulas);

    // 4. Variables de Animación y Tracking de Cursor
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const manejarMouseMove = (e) => {
      const rect = contenedor.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = Math.max(-1, Math.min(1, x));
      mouseY = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener('mousemove', manejarMouseMove);

    // 5. Loop de Renderizado (60 FPS)
    let animationFrameId;
    let reloj = new THREE.Clock();

    const animar = () => {
      animationFrameId = requestAnimationFrame(animar);
      const tiempo = reloj.getElapsedTime();

      // Respiración sutil / Flotación
      grupoAvatar.position.y = Math.sin(tiempo * 1.5) * 0.06;

      // Rotación de halos y partículas orbitales
      halo1.rotation.z = tiempo * 0.4;
      halo2.rotation.y = tiempo * -0.3;
      nubeParticulas.rotation.y = tiempo * 0.15;

      // Seguimiento suave del mouse (Head Tracking con Damping)
      targetRotY = mouseX * 0.45;
      targetRotX = -mouseY * 0.35;
      grupoCabeza.rotation.y += (targetRotY - grupoCabeza.rotation.y) * 0.08;
      grupoCabeza.rotation.x += (targetRotX - grupoCabeza.rotation.x) * 0.08;

      // Modulación según estado (Pensando vs En Espera)
      if (pensando) {
        // Pulso rápido de energía (Inferencia activa)
        const pulso = Math.sin(tiempo * 12) * 0.5 + 0.5;
        materialVisorEmisivo.emissiveIntensity = 2.0 + pulso * 2.5;
        luzVisor.intensity = 2.5 + pulso * 3.0;
        halo1.rotation.z = tiempo * 1.8;
        nubeParticulas.rotation.y = tiempo * 0.8;
        // Cabeza se inclina analizando la posición
        grupoCabeza.rotation.x += (0.15 - grupoCabeza.rotation.x) * 0.1;
      } else {
        // Pulso calmo de respiración
        const pulso = Math.sin(tiempo * 2.5) * 0.5 + 0.5;
        materialVisorEmisivo.emissiveIntensity = 1.8 + pulso * 0.6;
        luzVisor.intensity = 2.0 + pulso * 0.8;
      }

      // Reacción al balance táctico (evaluacionCp)
      if (evaluacionCp > 150) {
        // Ventaja de la IA: resplandor cian esmeralda
        materialVisorEmisivo.emissive.setHex(0x10b981);
        luzVisor.color.setHex(0x10b981);
      } else if (evaluacionCp < -150) {
        // En apuros: alerta ámbar
        materialVisorEmisivo.emissive.setHex(0xf59e0b);
        luzVisor.color.setHex(0xf59e0b);
      } else {
        materialVisorEmisivo.emissive.setHex(0x00e5ff);
        luzVisor.color.setHex(0x00e5ff);
      }

      renderer.render(scene, camera);
    };

    animar();

    // 6. Redimensionamiento Responsivo
    const manejarResize = () => {
      if (!contenedor) return;
      const w = contenedor.clientWidth;
      const h = contenedor.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', manejarResize);

    // 7. Limpieza al Desmontar
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', manejarMouseMove);
      window.removeEventListener('resize', manejarResize);
      if (contenedor.contains(renderer.domElement)) {
        contenedor.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geoCraneo.dispose();
      geoVisor.dispose();
      geoHalo.dispose();
      geoParticulas.dispose();
    };
  }, [pensando, evaluacionCp]);

  // Actualizar texto del estado
  useEffect(() => {
    if (pensando) {
      setEstadoTexto('Calculando inferencia neural...');
    } else if (evaluacionCp > 200) {
      setEstadoTexto('Posición dominante (+)');
    } else if (evaluacionCp < -200) {
      setEstadoTexto('Buscando contrajuego táctico');
    } else {
      setEstadoTexto('Atento a tu movimiento');
    }
  }, [pensando, evaluacionCp]);

  const esModelo = tipoOponente === 'modelo';

  return (
    <div className="relative flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-b from-surface-container-high/60 to-surface-container-lowest/80 border border-outline-variant/30 shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Halo de luz decorativo de fondo */}
      <div
        className={`absolute -top-10 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          pensando
            ? 'bg-primary/40 scale-125'
            : evaluacionCp > 150
            ? 'bg-emerald-500/25'
            : 'bg-primary/20'
        }`}
      />

      {/* Cabecera del Agente */}
      <div className="w-full flex items-center justify-between z-10 mb-1 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              pensando
                ? 'bg-primary animate-ping'
                : esModelo
                ? 'bg-primary shadow-[0_0_8px_#00e5ff]'
                : 'bg-amber-400'
            }`}
          />
          <div className="flex flex-col">
            <span className="font-mono-micro text-[11px] font-bold text-on-surface tracking-wider uppercase">
              {esModelo ? 'NOVA v5 · SE-ResNet-8' : 'STOCKFISH 16'}
            </span>
            <span className="font-mono-micro text-[9px] text-outline">
              {esModelo ? 'Gran Maestro FIDE (Autónomo)' : 'Motor de Cálculo Minimax'}
            </span>
          </div>
        </div>

        <span className="font-mono-micro text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest/80 text-primary-fixed-dim border border-primary/20">
          {pensando ? '⚡ PROCESANDO' : '● EN LÍNEA'}
        </span>
      </div>

      {/* Canvas 3D de Three.js */}
      <div
        ref={mountRef}
        className="w-full h-44 sm:h-52 relative flex items-center justify-center cursor-grab active:cursor-grabbing"
        title="Avatar 3D interactivo: mueve el cursor para que siga tu mirada"
      />

      {/* Globo de Diálogo / Estado Cognitivo */}
      <div className="w-full z-10 mt-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/20 shadow-inner">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0 animate-pulse">
            psychology
          </span>
          <span className="font-mono-micro text-[10px] text-on-surface-variant truncate">
            {estadoTexto}
          </span>
        </div>
        {ultimoMovimiento && (
          <span className="font-mono-micro text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10 shrink-0">
            Último: {ultimoMovimiento}
          </span>
        )}
      </div>
    </div>
  );
}
