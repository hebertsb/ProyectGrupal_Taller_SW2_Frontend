import { useState, useEffect } from 'react';
import AvisoVistaPrevia from '../../componentes/AvisoVistaPrevia';

export default function RazonamientoNeuronal() {
  const [isPaused, setIsPaused] = useState(false);
  const [latency, setLatency] = useState('2.8 ms');

  useEffect(() => {
    let interval;
    if (!isPaused) {
      interval = setInterval(() => {
        const jitter = (2.6 + Math.random() * 0.4).toFixed(1);
        setLatency(`${jitter} ms`);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden flex flex-col justify-between p-space-lg select-none animate-in fade-in duration-500">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(rgba(195, 245, 255, 0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }}></div>

      <AvisoVistaPrevia hu="Módulo 5 · HU6 ampliada" />

      {/* Header Telemetry Strip */}
      <div className="relative z-20 flex items-center justify-between backdrop-blur-xl bg-surface-container-low/70 px-space-md py-space-xs rounded-xl shadow-lg shadow-surface-container-lowest/50">
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span className="font-mono-metric text-mono-metric text-on-surface font-medium tracking-tight">GRAFO DE INFERENCIA EN VIVO</span>
            <span className="font-mono-micro text-mono-micro text-outline uppercase px-space-2xs py-0.5 rounded bg-surface-container-high">v2.4-lite</span>
          </div>
          <div className="h-4 w-[1px] bg-surface-container-highest"></div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Latencia</span>
              <span className="font-mono-label text-mono-label text-primary font-medium">{latency}</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Precisión</span>
              <span className="font-mono-label text-mono-label text-primary-fixed-dim font-medium">94.2%</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">VRAM</span>
              <span className="font-mono-label text-mono-label text-secondary font-medium">1.4 GB</span>
            </div>
            <div className="flex items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Flujo</span>
              <span className="font-mono-label text-mono-label text-tertiary-fixed-dim font-medium">1,480 OPS</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-space-2xs px-space-sm py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-body-sm font-body-sm transition-all shadow-sm active:scale-95 ${isPaused ? 'bg-primary/20 text-primary' : ''}`}
          >
            <span className="material-symbols-outlined text-[16px] text-primary">{isPaused ? 'play_arrow' : 'pause'}</span>
            <span>{isPaused ? 'Reanudar Inferencia' : 'Pausar Inferencia'}</span>
          </button>
          <button className="flex items-center gap-space-2xs px-space-sm py-1.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-body-sm font-body-sm transition-all shadow-md shadow-primary-container/20 active:scale-95 font-medium">
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Exportar ONNX</span>
          </button>
        </div>
      </div>

      {/* Main Visual Stage: Graph Canvas + Compact Side HUD */}
      <div className="relative z-10 flex-1 grid grid-cols-12 gap-space-lg mt-space-md min-h-0">
        
        {/* Center: Spatially Organized Neural Graph (Cols 1-9) */}
        <div className="col-span-9 relative rounded-xl bg-surface-container-lowest/80 backdrop-blur-md overflow-hidden flex items-center justify-center p-space-md shadow-2xl shadow-surface-container-lowest">
          {/* Live Curved Spline Visualizer (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad-cyan-violet" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#00daf3" stopOpacity="0.8"></stop>
                <stop offset="100%" stopColor="#cdbdff" stopOpacity="0.8"></stop>
              </linearGradient>
              <linearGradient id="grad-cyan-pulse" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.2"></stop>
                <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.9"></stop>
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.2"></stop>
              </linearGradient>
              <filter height="140%" id="glow-cyan" width="140%" x="-20%" y="-20%">
                <feGaussianBlur result="blur" stdDeviation="3"></feGaussianBlur>
                <feMerge>
                  <feMergeNode in="blur"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
              </filter>
            </defs>
            {/* Inter-node splines Layer 1 (Tablero -> CNN) */}
            <path d="M 180 280 C 230 280, 230 220, 280 220" fill="none" stroke="#00daf3" strokeOpacity="0.35" strokeWidth="1.5"></path>
            <path d="M 180 280 C 230 280, 230 340, 280 340" fill="none" stroke="#00daf3" strokeOpacity="0.25" strokeWidth="1.5"></path>
            <path className={`animate-[dash_6s_linear_infinite] ${isPaused ? 'animation-paused' : ''}`} d="M 180 280 C 230 280, 230 220, 280 220" fill="none" filter="url(#glow-cyan)" stroke="#00e5ff" strokeDasharray="8 16" strokeWidth="2"></path>
            {/* Splines Layer 2 (CNN -> Multihead Attention) */}
            <path d="M 430 220 C 490 220, 480 280, 540 280" fill="none" stroke="#cdbdff" strokeOpacity="0.4" strokeWidth="1.5"></path>
            <path d="M 430 340 C 490 340, 480 280, 540 280" fill="none" stroke="#00daf3" strokeOpacity="0.3" strokeWidth="1.5"></path>
            <path className={`animate-[dash_4s_linear_infinite] ${isPaused ? 'animation-paused' : ''}`} d="M 430 220 C 490 220, 480 280, 540 280" fill="none" stroke="#cdbdff" strokeDasharray="10 20" strokeWidth="2"></path>
            {/* Splines Layer 3 (Multihead Attention -> Policies & Value Heads) */}
            <path d="M 690 280 C 750 280, 750 190, 800 190" fill="none" stroke="url(#grad-cyan-violet)" strokeOpacity="0.6" strokeWidth="2"></path>
            <path d="M 690 280 C 750 280, 750 370, 800 370" fill="none" stroke="#ffb778" strokeOpacity="0.4" strokeWidth="1.5"></path>
            <path className={`animate-[dash_3s_linear_infinite] ${isPaused ? 'animation-paused' : ''}`} d="M 690 280 C 750 280, 750 190, 800 190" fill="none" filter="url(#glow-cyan)" stroke="#00e5ff" strokeDasharray="12 24" strokeWidth="2.5"></path>
          </svg>

          {/* Node Placement Coordinates */}
          <div className="relative w-full h-full flex items-center justify-between px-space-xl z-10">
            {/* NODE 01: Input Tablero */}
            <div className="group relative w-44 rounded-lg bg-surface-container-low/90 backdrop-blur-xl p-space-sm shadow-xl shadow-surface-container-lowest/60 transition-all hover:bg-surface-container">
              <div className="flex items-center justify-between pb-space-xs">
                <span className="font-mono-micro text-mono-micro text-primary-fixed-dim uppercase tracking-wider">Entrada 8x8x12</span>
                <span className={`w-1.5 h-1.5 rounded-full bg-primary ${!isPaused && 'shadow-[0_0_6px_#00e5ff]'}`}></span>
              </div>
              <div className="font-headline-sm text-headline-sm text-on-surface">Tablero FEN</div>
              <div className="mt-space-xs pt-space-2xs flex justify-between items-center text-on-surface-variant font-mono-micro text-mono-micro">
                <span>Tensor Res</span>
                <span className="text-on-surface font-mono-label text-mono-label">12 canales</span>
              </div>
              <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-container ${!isPaused && 'shadow-[0_0_8px_#00e5ff]'}`}></div>
            </div>

            {/* COLUMN 02: CNN Feature Extraction */}
            <div className="flex flex-col gap-space-2xl">
              <div className="group relative w-48 rounded-lg bg-surface-container-low/90 backdrop-blur-xl p-space-sm shadow-xl shadow-surface-container-lowest/60 transition-all hover:bg-surface-container">
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-surface-container-highest group-hover:bg-primary transition-colors"></div>
                <div className="flex items-center justify-between pb-space-xs">
                  <span className="font-mono-micro text-mono-micro text-primary uppercase tracking-wider">Conv2D Residual</span>
                  <span className="font-mono-micro text-mono-micro text-outline">k=3x3</span>
                </div>
                <div className="font-headline-sm text-headline-sm text-on-surface">Spatial Feats</div>
                <div className="mt-space-xs pt-space-2xs flex justify-between items-center text-on-surface-variant font-mono-micro text-mono-micro">
                  <span>Filtros</span>
                  <span className="text-primary font-mono-label text-mono-label">256 ch</span>
                </div>
                <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-container ${!isPaused && 'shadow-[0_0_8px_#00e5ff]'}`}></div>
              </div>

              <div className="group relative w-48 rounded-lg bg-surface-container-low/90 backdrop-blur-xl p-space-sm shadow-xl shadow-surface-container-lowest/60 transition-all hover:bg-surface-container opacity-85">
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-surface-container-highest"></div>
                <div className="flex items-center justify-between pb-space-xs">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Squeeze & Exc.</span>
                  <span className="font-mono-micro text-mono-micro text-outline">r=16</span>
                </div>
                <div className="font-headline-sm text-headline-sm text-on-surface">Canal Weights</div>
                <div className="mt-space-xs pt-space-2xs flex justify-between items-center text-on-surface-variant font-mono-micro text-mono-micro">
                  <span>Norm</span>
                  <span className="text-on-surface font-mono-label text-mono-label">LayerNorm</span>
                </div>
                <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-secondary ${!isPaused && 'shadow-[0_0_8px_#cdbdff]'}`}></div>
              </div>
            </div>

            {/* NODE 03: Central Attention Core */}
            <div className="group relative w-52 rounded-xl bg-surface-container/95 backdrop-blur-2xl p-space-md shadow-2xl shadow-surface-container-lowest/90 transition-all hover:scale-[1.02]">
              <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary ${!isPaused && 'shadow-[0_0_8px_#00e5ff]'}`}></div>
              <div className="flex items-center justify-between pb-space-xs">
                <span className="font-mono-micro text-mono-micro text-secondary uppercase tracking-widest">Núcleo Central</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono-micro text-mono-micro">8 Heads</span>
              </div>
              <div className="font-headline-lg text-headline-lg text-on-surface">Atención Multi-Cabezal</div>
              <div className="mt-space-sm pt-space-xs flex flex-col gap-1 text-on-surface-variant font-mono-micro text-mono-micro">
                <div className="flex justify-between">
                  <span>Dim. Proyección</span>
                  <span className="text-secondary font-mono-label text-mono-label">512</span>
                </div>
                <div className="flex justify-between">
                  <span>Sparseness</span>
                  <span className="text-on-surface font-mono-label text-mono-label">Top-K (16)</span>
                </div>
              </div>
              <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-secondary ${!isPaused && 'shadow-[0_0_10px_#cdbdff]'}`}></div>
            </div>

            {/* COLUMN 04: Dual Output Heads */}
            <div className="flex flex-col gap-space-2xl">
              <div className="group relative w-48 rounded-lg bg-surface-container-low/90 backdrop-blur-xl p-space-sm shadow-xl shadow-surface-container-lowest/60 transition-all hover:bg-surface-container">
                <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-container ${!isPaused && 'shadow-[0_0_8px_#00e5ff]'}`}></div>
                <div className="flex items-center justify-between pb-space-xs">
                  <span className="font-mono-micro text-mono-micro text-primary uppercase tracking-wider">Cabezal Política</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                </div>
                <div className="font-headline-sm text-headline-sm text-on-surface">Distribución P(a|s)</div>
                <div className="mt-space-xs pt-space-2xs flex justify-between items-center text-on-surface-variant font-mono-micro text-mono-micro">
                  <span>Espacio Jugadas</span>
                  <span className="text-primary font-mono-label text-mono-label">1,968 dims</span>
                </div>
              </div>

              <div className="group relative w-48 rounded-lg bg-surface-container-low/90 backdrop-blur-xl p-space-sm shadow-xl shadow-surface-container-lowest/60 transition-all hover:bg-surface-container">
                <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim ${!isPaused && 'shadow-[0_0_8px_#ffb778]'}`}></div>
                <div className="flex items-center justify-between pb-space-xs">
                  <span className="font-mono-micro text-mono-micro text-tertiary-fixed-dim uppercase tracking-wider">Cabezal Valor</span>
                  <span className="font-mono-micro text-mono-micro text-tertiary-fixed-dim">tanh</span>
                </div>
                <div className="font-headline-sm text-headline-sm text-on-surface">Evaluación V(s)</div>
                <div className="mt-space-xs pt-space-2xs flex justify-between items-center text-on-surface-variant font-mono-micro text-mono-micro">
                  <span>Estimación</span>
                  <span className="text-tertiary-container font-mono-label text-mono-label font-medium">+1.42</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-space-sm left-space-md flex items-center gap-space-xs text-on-surface-variant/40 font-mono-micro text-mono-micro">
            <span>PIPELINE: RESNET-ATTN-CHESS-XL</span>
            <span>•</span>
            <span>FP16 TENSORRT</span>
          </div>
        </div>

        {/* Right Shelf: Compact HUD - Grad-CAM & Candidate Moves (Cols 10-12) */}
        <div className="col-span-3 flex flex-col gap-space-md">
          {/* Component 1: Visual Grad-CAM Attention Matrix (8x8) */}
          <div className="rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col">
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Grad-CAM (Atención)</span>
              </div>
              <span className="font-mono-micro text-mono-micro text-outline">Capa 12</span>
            </div>
            {/* 8x8 Chessboard heatmap grid */}
            <div className="relative aspect-square w-full rounded-lg bg-surface-container-lowest p-2 grid grid-cols-8 grid-rows-8 gap-1 items-center justify-center">
              {/* Row 8 */}
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              {/* Row 7 */}
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-secondary/30"></div>
              <div className="w-full h-full rounded-sm bg-primary/40"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              {/* Row 6 */}
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-primary/20"></div>
              <div className="w-full h-full rounded-sm bg-primary-container/80 shadow-[0_0_8px_rgba(0,229,255,0.6)]"></div>
              <div className="w-full h-full rounded-sm bg-primary/60"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              {/* Row 5 */}
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-secondary/40"></div>
              <div className="w-full h-full rounded-sm bg-primary-container/90 shadow-[0_0_10px_rgba(0,229,255,0.7)]"></div>
              <div className="w-full h-full rounded-sm bg-primary-fixed-dim/90 shadow-[0_0_10px_rgba(0,218,243,0.7)]"></div>
              <div className="w-full h-full rounded-sm bg-secondary/30"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              {/* Row 4 */}
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-secondary/20"></div>
              <div className="w-full h-full rounded-sm bg-primary/40"></div>
              <div className="w-full h-full rounded-sm bg-primary/50"></div>
              <div className="w-full h-full rounded-sm bg-primary/30"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              {/* Row 3 */}
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              {/* Row 2 */}
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              {/* Row 1 */}
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
              <div className="w-full h-full rounded-sm bg-surface-container-high"></div>
              <div className="w-full h-full rounded-sm bg-surface-container"></div>
            </div>
            <div className="flex items-center justify-between mt-space-xs text-on-surface-variant font-mono-micro text-mono-micro">
              <span>Enfoque: e4 / d5 centro</span>
              <span className="text-primary font-medium">98.1% saliencia</span>
            </div>
          </div>

          {/* Component 2: Top 3 Candidatas */}
          <div className="flex-1 rounded-xl bg-surface-container-low/80 backdrop-blur-xl p-space-md shadow-xl shadow-surface-container-lowest flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">analytics</span>
                  <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface font-medium">Top Jugadas Candidatas</span>
                </div>
                <span className="font-mono-micro text-mono-micro text-outline">Argmax</span>
              </div>
              <div className="flex flex-col gap-space-sm mt-space-xs">
                {/* Cand 1 */}
                <div className="flex flex-col gap-1 p-space-xs rounded-lg bg-surface-container/60 hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-mono-label text-mono-label font-medium text-primary">01</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">e2 - e4</span>
                    </div>
                    <span className="font-mono-metric text-mono-metric font-medium text-primary">64%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary-container rounded-full shadow-[0_0_8px_rgba(0,229,255,0.8)]" style={{ width: '64%' }}></div>
                  </div>
                </div>
                {/* Cand 2 */}
                <div className="flex flex-col gap-1 p-space-xs rounded-lg bg-surface-container/30 hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-mono-label text-mono-label text-on-surface-variant">02</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">d2 - d4</span>
                    </div>
                    <span className="font-mono-metric text-mono-metric text-on-surface">21%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: '21%' }}></div>
                  </div>
                </div>
                {/* Cand 3 */}
                <div className="flex flex-col gap-1 p-space-xs rounded-lg bg-surface-container/30 hover:bg-surface-container transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-mono-label text-mono-label text-on-surface-variant">03</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">c2 - c4</span>
                    </div>
                    <span className="font-mono-metric text-mono-metric text-on-surface">9%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-surface-bright rounded-full" style={{ width: '9%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-space-sm flex items-center justify-between font-mono-micro text-mono-micro text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full bg-primary ${!isPaused && 'animate-pulse'}`}></span>
                Monte Carlo Tree Search
              </span>
              <span className="text-on-surface font-mono-label text-mono-label">12.4k Nodos</span>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
        .animation-paused {
          animation-play-state: paused !important;
        }
      `}} />
    </div>
  );
}
