/**
 * Cerebro holográfico 3D — visualización decorativa (Canvas 2D con proyección
 * manual en perspectiva, sin librerías 3D). Puramente ilustrativa: la
 * arquitectura real (CNN simple, ver PLAN_RAZONAMIENTO_NEURAL_BACKEND.md) no
 * tiene lóbulos, hemisferios ni cabezales de atención — esto es una metáfora
 * visual del "cerebro" del modelo para la demo, no un mapeo de activaciones
 * reales.
 *
 * Autocontenido: genera ~520 nodos con anatomía procedural una sola vez,
 * anima con requestAnimationFrame y limpia todo (rAF + listeners de window)
 * al desmontar para no dejar el loop corriendo si el usuario navega afuera.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const COLORES = {
  cyan: '#00e5ff',
  blue: '#0070f3',
  purple: '#7c4dff',
  orange: '#ff9100',
  lime: '#76ff03',
};

function ondulacionSurcos(u, v) {
  const wave1 = Math.sin(u * 7 + Math.cos(v * 6)) * 8;
  const wave2 = Math.cos(v * 8 + Math.sin(u * 5)) * 6;
  const surco = Math.sin(u * 12) * Math.sin(v * 10) * 4;
  return wave1 + wave2 - Math.abs(surco);
}

function generarAnatomia() {
  const nodes = [];
  const totalNodos = 520;

  for (let i = 0; i < totalNodos - 80; i++) {
    const esIzquierdo = i % 2 === 0;
    const u = Math.random() * Math.PI;
    const v = (Math.random() - 0.5) * Math.PI;
    const gyri = ondulacionSurcos(u, v);

    const rx = 135 + gyri;
    const ry = 95 + Math.sin(u) * 20 + gyri * 0.7;
    const rz = 160 + gyri;

    let x = Math.sin(u) * Math.cos(v) * rx;
    const y = -Math.sin(v) * ry;
    let z = Math.cos(u) * rz;

    let region = 'frontal';
    let color = COLORES.purple;
    if (z > 60) {
      region = 'occipital';
      color = COLORES.blue;
      x *= 0.85;
    } else if (z < -30 && y < 10) {
      region = 'prefrontal';
      color = COLORES.purple;
    } else if (y < 0 && Math.abs(z) < 60) {
      region = 'parietal';
      color = COLORES.cyan;
    } else if (y >= 10 && Math.abs(z) < 70) {
      region = 'temporal';
      color = COLORES.orange;
    }

    if (Math.random() < 0.1) color = COLORES.orange;
    else if (Math.random() < 0.08) color = COLORES.lime;

    const signo = esIzquierdo ? -1 : 1;
    const offsetFisura = 18;
    const distDelCentro = Math.abs(x);
    x = distDelCentro < 18
      ? signo * (offsetFisura + distDelCentro * 0.5)
      : signo * (offsetFisura + (distDelCentro - 18) * 0.88);

    nodes.push({
      baseX: x, baseY: y, baseZ: z,
      x: 0, y: 0, z: 0, scale: 1,
      color,
      size: Math.random() * 2.2 + 1.4,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.04,
      isLeft: esIzquierdo,
      region,
    });
  }

  // Cerebelo (motor / decisión final)
  for (let j = 0; j < 80; j++) {
    const esIzquierdo = j % 2 === 0;
    const signo = esIzquierdo ? -1 : 1;
    const angulo = Math.random() * Math.PI * 2;
    const radio = Math.random() * 45;
    const cx = signo * (16 + Math.cos(angulo) * (radio * 0.7));
    const cy = 60 + Math.sin(angulo) * (radio * 0.4);
    const cz = 75 + Math.sin(angulo * 2) * 20;
    nodes.push({
      baseX: cx, baseY: cy, baseZ: cz,
      x: 0, y: 0, z: 0, scale: 1,
      color: COLORES.lime,
      size: Math.random() * 1.8 + 1.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.03 + Math.random() * 0.05,
      isLeft: esIzquierdo,
      region: 'cerebellum',
    });
  }

  const connections = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];
      if (n1.isLeft !== n2.isLeft && Math.abs(n1.baseY) > 20) continue;
      const dx = n1.baseX - n2.baseX;
      const dy = n1.baseY - n2.baseY;
      const dz = n1.baseZ - n2.baseZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 34) {
        connections.push({
          source: i, target: j,
          particlePos: Math.random(),
          speed: 0.007 + Math.random() * 0.015,
          activePulse: Math.random() < 0.3,
        });
      }
    }
  }

  const flujosFisura = [];
  for (let f = 0; f < 25; f++) {
    flujosFisura.push({
      z: (Math.random() - 0.5) * 240,
      y: -40 + Math.random() * 80,
      speed: 0.8 + Math.random() * 1.5,
      color: Math.random() > 0.5 ? COLORES.cyan : COLORES.purple,
    });
  }

  return { nodes, connections, flujosFisura };
}

const CerebroHolografico = forwardRef(function CerebroHolografico(_props, ref) {
  const canvasRef = useRef(null);
  const contenedorRef = useRef(null);
  const simRef = useRef(null);

  const prefiereMenosMovimiento = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [pausado, setPausado] = useState(!!prefiereMenosMovimiento);
  const [autoRotar, setAutoRotar] = useState(!prefiereMenosMovimiento);
  const [fisuraExpandida, setFisuraExpandida] = useState(false);
  const [sensibilidadAlta, setSensibilidadAlta] = useState(false);

  useImperativeHandle(ref, () => ({
    dispararPulso() {
      if (simRef.current) simRef.current.activeShockwave = 1.0;
    },
  }));

  // Mantener la config leída por el loop de render sincronizada sin reiniciar el efecto.
  useEffect(() => {
    if (!simRef.current) return;
    simRef.current.isPaused = pausado;
    simRef.current.autoRotate = autoRotar;
    simRef.current.separationAmount = fisuraExpandida ? 36 : 14;
    simRef.current.sensitivityMultiplier = sensibilidadAlta ? 1.8 : 1.0;
  }, [pausado, autoRotar, fisuraExpandida, sensibilidadAlta]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const { nodes, connections, flujosFisura } = generarAnatomia();

    const sim = {
      isPaused: pausado,
      autoRotate: autoRotar,
      rotationAngleY: 0.35,
      rotationAngleX: 0.15,
      separationAmount: fisuraExpandida ? 36 : 14,
      sensitivityMultiplier: sensibilidadAlta ? 1.8 : 1.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      activeShockwave: 0,
    };
    simRef.current = sim;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function alBajarMouse(e) {
      sim.isDragging = true;
      sim.lastMouseX = e.clientX;
      sim.lastMouseY = e.clientY;
    }
    function alSoltarMouse() {
      sim.isDragging = false;
    }
    function alMoverMouse(e) {
      if (!sim.isDragging) return;
      const dx = e.clientX - sim.lastMouseX;
      const dy = e.clientY - sim.lastMouseY;
      sim.rotationAngleY += dx * 0.008;
      sim.rotationAngleX = Math.max(-0.6, Math.min(0.6, sim.rotationAngleX + dy * 0.006));
      sim.lastMouseX = e.clientX;
      sim.lastMouseY = e.clientY;
    }
    canvas.addEventListener('mousedown', alBajarMouse);
    window.addEventListener('mouseup', alSoltarMouse);
    window.addEventListener('mousemove', alMoverMouse);

    let animationFrameId;

    function render() {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (sim.autoRotate && !sim.isPaused && !sim.isDragging) {
        sim.rotationAngleY += 0.004 * sim.sensitivityMultiplier;
      }
      if (sim.activeShockwave > 0) sim.activeShockwave -= 0.02;

      const cosY = Math.cos(sim.rotationAngleY);
      const sinY = Math.sin(sim.rotationAngleY);
      const cosX = Math.cos(sim.rotationAngleX);
      const sinX = Math.sin(sim.rotationAngleX);
      const fov = 420;

      for (const node of nodes) {
        node.pulse += node.pulseSpeed * sim.sensitivityMultiplier;
        let nx = node.baseX;
        const ny = node.baseY;
        const nz = node.baseZ;
        if (sim.separationAmount > 0) nx += (node.isLeft ? -1 : 1) * sim.separationAmount;

        const x1 = nx * cosY - nz * sinY;
        const z1 = nx * sinY + nz * cosY;
        const y2 = ny * cosX - z1 * sinX;
        const z2 = ny * sinX + z1 * cosX + 310;
        const scale = fov / (fov + z2);
        node.x = centerX + x1 * scale;
        node.y = centerY + y2 * scale;
        node.z = z2;
        node.scale = scale;
      }

      ctx.lineWidth = 1;
      for (const flujo of flujosFisura) {
        if (!sim.isPaused) {
          flujo.z += flujo.speed * sim.sensitivityMultiplier;
          if (flujo.z > 140) flujo.z = -140;
        }
        const fy2 = flujo.y * cosX - (flujo.z * sinY) * sinX;
        const fz2 = (flujo.z * sinY) * cosX + 310;
        const fscale = fov / (fov + fz2);
        const px = centerX + (flujo.z * -sinY) * fscale;
        const py = centerY + fy2 * fscale;

        ctx.beginPath();
        ctx.arc(px, py, 1.4 * fscale, 0, Math.PI * 2);
        ctx.fillStyle = flujo.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = flujo.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.lineWidth = 0.7;
      for (const conn of connections) {
        const n1 = nodes[conn.source];
        const n2 = nodes[conn.target];
        const avgZ = (n1.z + n2.z) / 2;
        const depthAlpha = Math.max(0.04, Math.min(0.65, 1 - avgZ / 550));

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        if (n1.region === 'cerebellum' && n2.region === 'cerebellum') {
          ctx.strokeStyle = `rgba(118, 255, 3, ${depthAlpha * 0.5})`;
        } else if (n1.color === COLORES.purple || n2.color === COLORES.purple) {
          ctx.strokeStyle = `rgba(124, 77, 255, ${depthAlpha * 0.45})`;
        } else {
          ctx.strokeStyle = `rgba(0, 229, 255, ${depthAlpha * 0.4})`;
        }
        ctx.stroke();

        if (!sim.isPaused && conn.activePulse) {
          conn.particlePos += conn.speed * sim.sensitivityMultiplier;
          if (conn.particlePos > 1) conn.particlePos = 0;
          const px = n1.x + (n2.x - n1.x) * conn.particlePos;
          const py = n1.y + (n2.y - n1.y) * conn.particlePos;
          ctx.beginPath();
          ctx.arc(px, py, 1.2 * n1.scale, 0, Math.PI * 2);
          ctx.fillStyle = n1.color;
          ctx.fill();
        }
      }

      const ordenados = nodes.slice().sort((a, b) => b.z - a.z);
      for (const node of ordenados) {
        const tamPulsante = node.size * (1 + Math.sin(node.pulse) * 0.35) * node.scale;

        ctx.beginPath();
        ctx.arc(node.x, node.y, tamPulsante * 2.3, 0, Math.PI * 2);
        ctx.fillStyle = node.color === COLORES.cyan
          ? 'rgba(0, 229, 255, 0.12)'
          : node.color === COLORES.purple
            ? 'rgba(124, 77, 255, 0.12)'
            : node.color === COLORES.lime
              ? 'rgba(118, 255, 3, 0.14)'
              : 'rgba(255, 145, 0, 0.12)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, tamPulsante, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowBlur = 8 * node.scale;
        ctx.shadowColor = node.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (sim.activeShockwave > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (1 - sim.activeShockwave) * (width * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 229, 255, ${sim.activeShockwave * 0.75})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    }
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', alBajarMouse);
      window.removeEventListener('mouseup', alSoltarMouse);
      window.removeEventListener('mousemove', alMoverMouse);
      simRef.current = null;
    };
    // Se genera la anatomía y se monta el loop una sola vez; pausado/autoRotar/etc.
    // se leen del sim vía el efecto de sincronización de arriba, sin reiniciar esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={contenedorRef} className="flex flex-col gap-2 h-full">
      <div className="relative w-full flex-1 min-h-[320px] rounded-xl bg-surface-container-lowest border border-outline-variant/40 overflow-hidden flex items-center justify-center"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.07) 0%, rgba(12, 14, 20, 0.8) 75%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 24px 24px, 24px 24px',
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" aria-hidden="true" />
        <div className="absolute top-2.5 left-3 z-10 font-mono-micro text-[9px] text-outline flex items-center gap-2 pointer-events-none">
          <span className="border border-outline-variant/30 px-1.5 py-0.5 rounded bg-surface-container-lowest/80 backdrop-blur">
            ROTACIÓN 3D: {autoRotar ? 'ACTIVA' : 'FIJA'}
          </span>
          <span className="border border-outline-variant/30 px-1.5 py-0.5 rounded bg-surface-container-lowest/80 backdrop-blur">
            {fisuraExpandida ? 'FISURA: EXPANDIDA (+22mm)' : 'HEMISFERIOS: BILATERAL'}
          </span>
        </div>
        <div className="absolute top-2.5 right-3 z-10 font-mono-micro text-[9px] text-neon-cyan flex items-center gap-1 bg-surface-container-lowest/80 backdrop-blur px-2 py-0.5 rounded border border-neon-cyan/30 pointer-events-none">
          <span className="material-symbols-outlined text-[13px]">neurology</span> MORFOLOGÍA CORTICAL 3D
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setPausado((p) => !p)}
          className="px-2 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-micro text-[10px] flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[15px] text-neon-cyan">{pausado ? 'play_circle' : 'pause_circle'}</span>
          <span>{pausado ? 'Reanudar' : 'Pausar Pulsos'}</span>
        </button>
        <button
          type="button"
          onClick={() => setAutoRotar((r) => !r)}
          className={`px-2 py-1.5 rounded-lg hover:bg-surface-bright text-on-surface font-mono-micro text-[10px] flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${autoRotar ? 'bg-neon-blue/20' : 'bg-surface-container-high'}`}
        >
          <span className="material-symbols-outlined text-[15px] text-neon-blue">sync</span>
          <span>{autoRotar ? 'Rotar 3D' : 'Fijar Ángulo'}</span>
        </button>
        <button
          type="button"
          onClick={() => setFisuraExpandida((f) => !f)}
          className={`px-2 py-1.5 rounded-lg hover:bg-surface-bright text-on-surface font-mono-micro text-[10px] flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${fisuraExpandida ? 'bg-neon-purple/20' : 'bg-surface-container-high'}`}
        >
          <span className="material-symbols-outlined text-[15px] text-neon-purple">view_column</span>
          <span>{fisuraExpandida ? 'Fisura Expandida' : 'Fisura Central'}</span>
        </button>
        <button
          type="button"
          onClick={() => setSensibilidadAlta((s) => !s)}
          className={`px-2 py-1.5 rounded-lg hover:bg-surface-bright font-mono-micro text-[10px] flex items-center justify-center gap-1.5 border border-neon-lime/30 text-neon-lime transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${sensibilidadAlta ? 'bg-neon-lime/20' : 'bg-surface-container-high'}`}
        >
          <span className="material-symbols-outlined text-[15px]">flash_on</span>
          <span>Sensibilidad {sensibilidadAlta ? '+80%' : '+0%'}</span>
        </button>
      </div>
    </div>
  );
});

export default CerebroHolografico;
