import { useState, useEffect } from 'react';
import AvisoVistaPrevia from '../../componentes/AvisoVistaPrevia';
import { listarPartidas } from '../../api/backend';

function estadoLegible(partida) {
  if (!partida.terminada) return { texto: 'JUGANDO', clase: 'bg-surface-bright text-primary' };
  if (partida.resultado === '1-0') return { texto: 'GANASTE', clase: 'bg-surface-bright text-primary' };
  if (partida.resultado === '0-1') return { texto: 'GANÓ EL MOTOR', clase: 'bg-surface-bright text-secondary' };
  return { texto: 'TABLAS', clase: 'bg-surface-bright text-outline' };
}

export default function Administracion() {
  const [depth, setDepth] = useState(28);
  const [cores, setCores] = useState(12);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [telemetry, setTelemetry] = useState('[14:22:04.119] ACTUATOR_MOVE_VALIDATED: e2e4 | EVAL: +0.42 | INFERENCE_LATENCY: 1.18ms | CHECKSUM_OK');
  const [partidas, setPartidas] = useState([]);

  useEffect(() => {
    const logs = [
      '[14:22:04.119] ACTUATOR_MOVE_VALIDATED: e2e4 | EVAL: +0.42 | INFERENCE_LATENCY: 1.18ms | CHECKSUM_OK',
      '[14:22:05.620] INFERENCE_STEP: d7d5 | NODES: 44.1M | DEPTH: 28 | TIME_PER_MOVE: 412ms',
      '[14:22:07.001] GRIPPER_SENSOR: Retención piezoeléctrica estable | TORSION: 0.11 N·m',
      '[14:22:08.432] VISION_FRAME: Tablero verificado | Casillas 64/64 coherentes | NO_OCCLUSION'
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % logs.length;
      setTelemetry(logs[idx]);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    listarPartidas().then(setPartidas).catch(() => setPartidas([]));
  }, []);

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <AvisoVistaPrevia hu="Módulo 9 · HU10/HU11" descripcionCorta="Sesiones = datos reales del backend. Orquestación, hardware y auditoría siguen siendo vista previa." />

      {/* Top Executive Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low px-space-lg py-space-md rounded-xl shadow-md">
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,229,255,0.7)]"></span>
            <span className="font-mono-micro text-mono-micro tracking-widest uppercase text-on-surface-variant">Nodo Maestro</span>
            <span className="font-mono-metric text-mono-metric text-on-surface font-medium ml-space-xs">KAIROS-NODE-01</span>
          </div>
          <div className="hidden md:flex items-center gap-space-xs text-on-surface-variant">
            <span className="font-mono-micro text-mono-micro uppercase text-outline">Cluster</span>
            <span className="font-mono-label text-mono-label text-primary-fixed">RT-EU-CENTRAL</span>
          </div>
          <div className="hidden lg:flex items-center gap-space-xs text-on-surface-variant">
            <span className="font-mono-micro text-mono-micro uppercase text-outline">Uptime</span>
            <span className="font-mono-label text-mono-label text-on-surface">14d 08h 22m</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label" type="button">
            <span className="material-symbols-outlined text-[16px] text-primary">sync</span>
            <span>SINCRONIZAR</span>
          </button>
          <button className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-primary hover:bg-primary-fixed text-on-primary font-body-sm text-body-sm rounded-lg transition-all shadow-[0_0_12px_rgba(0,229,255,0.35)]" type="button">
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>GUARDAR CAMBIOS</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout (3 Structural Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Column 1: Sesiones — datos reales del backend (GET /partida) */}
        <section className="lg:col-span-4 flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Sesiones (reales)</span>
            </div>
            <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-primary-fixed-dim">
              {partidas.length} EN REGISTRO
            </span>
          </div>

          {partidas.length === 0 && (
            <span className="font-mono-micro text-mono-micro text-outline px-space-xs">
              Todavía no se creó ninguna partida en este backend.
            </span>
          )}

          {partidas.slice(0, 5).map((partida) => {
            const estado = estadoLegible(partida);
            return (
              <div key={partida.id} className="group flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-9 h-9 rounded-full bg-surface-bright flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-body-sm font-medium text-on-surface">#{partida.id.slice(0, 6)}</span>
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant">Stockfish · nivel {partida.nivel} · {partida.tipo}</span>
                    </div>
                  </div>
                  <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${estado.clase}`}>
                    {estado.texto}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-space-2xs font-mono-micro text-mono-micro text-on-surface-variant">
                  <span>{partida.cantidad_jugadas} jugadas</span>
                </div>
              </div>
            );
          })}

          {/* Resumen — real */}
          <div className="p-space-md rounded-xl bg-surface-container-lowest flex items-center justify-between mt-space-2xs">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-mono-micro text-mono-micro uppercase text-outline">Partidas físicas (con brazo)</span>
              <span className="font-mono-metric text-mono-metric text-on-surface">
                0 / {partidas.length} — todavía no existe ese flujo (HU9)
              </span>
            </div>
          </div>
        </section>

        {/* Column 2: Orquestación de Motores */}
        <section className="lg:col-span-4 flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">memory</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Orquestación</span>
            </div>
            <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Inferencias RT</span>
          </div>
          {/* Engine Selectors (Radio Tiles) */}
          <div className="flex flex-col gap-space-xs">
            <label className="cursor-pointer flex items-center justify-between p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-space-sm">
                <input defaultChecked className="accent-primary-container h-4 w-4 bg-surface-container-lowest" name="engine" type="radio" value="stockfish"/>
                <div className="flex flex-col">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface">Stockfish 16 NNUE</span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant">AVX2 + WDL Estimator</span>
                </div>
              </div>
              <span className="font-mono-label text-mono-label text-primary font-medium">3500+</span>
            </label>
            <label className="cursor-pointer flex items-center justify-between p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-space-sm">
                <input className="accent-primary-container h-4 w-4 bg-surface-container-lowest" name="engine" type="radio" value="maia"/>
                <div className="flex flex-col">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface">Maia Chess</span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant">Red Leela Lichess-1900</span>
                </div>
              </div>
              <span className="font-mono-label text-mono-label text-secondary font-medium">HUMANO</span>
            </label>
            <label className="cursor-pointer flex items-center justify-between p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-space-sm">
                <input className="accent-primary-container h-4 w-4 bg-surface-container-lowest" name="engine" type="radio" value="tensorrt"/>
                <div className="flex flex-col">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface">TensorRT Kairos Net</span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant">FP16 CUDA Core Engine</span>
                </div>
              </div>
              <span className="font-mono-label text-mono-label text-tertiary-fixed-dim font-medium">0.8ms</span>
            </label>
          </div>
          {/* Minimal Sliders */}
          <div className="flex flex-col gap-space-md pt-space-xs">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Profundidad (Plies)</span>
                <span className="font-mono-metric text-mono-metric text-primary">{depth}</span>
              </div>
              <input onChange={(e) => setDepth(Number(e.target.value))} className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary-container" max="45" min="10" type="range" value={depth}/>
            </div>
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Núcleos de CPU</span>
                <span className="font-mono-metric text-mono-metric text-primary">{cores} Cores</span>
              </div>
              <input onChange={(e) => setCores(Number(e.target.value))} className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary-container" max="16" min="1" type="range" value={cores}/>
            </div>
          </div>
          {/* Human Style Toggle */}
          <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container mt-space-2xs">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm font-medium text-on-surface">Modo Estilo Humano</span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant">Atenuación estocástica de errores</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input defaultChecked className="sr-only peer" type="checkbox"/>
              <div className="w-10 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>
        </section>

        {/* Column 3: Despliegue de Hardware & Versiones */}
        <section className="lg:col-span-4 flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">precision_manufacturing</span>
              <span className="font-headline-sm text-headline-sm text-on-surface">Hardware & Versión</span>
            </div>
            <span className="font-mono-micro text-mono-micro uppercase text-primary font-medium">ACTIVO</span>
          </div>
          {/* Version Selector Card */}
          <div className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container">
            <span className="font-mono-micro text-mono-micro uppercase text-outline">Software Kernel</span>
            <div className="relative">
              <select className="w-full appearance-none bg-surface-container-lowest text-on-surface px-space-sm py-space-xs rounded-lg font-mono-metric text-mono-metric outline-none cursor-pointer" defaultValue="2.4.1">
                <option value="2.4.1">v2.4.1 Estable (Build 9410)</option>
                <option value="2.4.0">v2.4.0 Estable (LTS)</option>
                <option value="2.5.0-rc">v2.5.0-rc3 (Experimental)</option>
              </select>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-space-sm top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
            </div>
            <div className="grid grid-cols-2 gap-space-xs pt-space-2xs">
              <button className="flex items-center justify-center gap-space-xs py-space-2xs px-space-sm rounded-lg bg-surface-bright hover:bg-surface-container-highest text-primary font-body-sm text-body-sm transition-colors" type="button">
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                <span>Promover</span>
              </button>
              <button className="flex items-center justify-center gap-space-xs py-space-2xs px-space-sm rounded-lg bg-surface-bright hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors" type="button">
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Rollback</span>
              </button>
            </div>
          </div>
          {/* Vision Pipeline Latency Breakdown */}
          <div className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container">
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro uppercase text-outline">Pipeline de Visión</span>
              <span className="font-mono-metric text-mono-metric text-on-surface">2.2ms Total</span>
            </div>
            {/* Multi-Segment Latency Bar */}
            <div className="w-full h-2 rounded-full bg-surface-container-lowest overflow-hidden flex">
              <div className="h-full bg-primary shadow-[0_0_8px_rgba(0,229,255,0.8)]" style={{ width: '81.8%' }}></div>
              <div className="h-full bg-secondary" style={{ width: '18.2%' }}></div>
            </div>
            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              <div className="flex flex-col p-space-xs rounded-lg bg-surface-container-lowest">
                <div className="flex items-center gap-space-2xs">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">YOLOv8 Board</span>
                </div>
                <span className="font-mono-metric text-mono-metric text-on-surface mt-space-2xs">1.8 ms</span>
              </div>
              <div className="flex flex-col p-space-xs rounded-lg bg-surface-container-lowest">
                <div className="flex items-center gap-space-2xs">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">OpenCV Warp</span>
                </div>
                <span className="font-mono-metric text-mono-metric text-on-surface mt-space-2xs">0.4 ms</span>
              </div>
            </div>
          </div>
          {/* Hardware Gripper Status */}
          <div className="p-space-md rounded-xl bg-surface-container-lowest flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-primary">precision_manufacturing</span>
              <div className="flex flex-col">
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Gripper Electromagnético</span>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">Presión calibrada 0.82 N</span>
              </div>
            </div>
            <span className="font-mono-micro text-mono-micro text-primary-fixed-dim bg-surface-container-high px-space-xs py-space-2xs rounded-full">OPTIMAL</span>
          </div>
        </section>
      </div>

      {/* Collapsible Executive Console & Audit Bar */}
      <div className="w-full bg-surface-container-low rounded-xl shadow-md overflow-hidden transition-all mt-4">
        <div 
          className="flex items-center justify-between px-space-lg py-space-sm cursor-pointer hover:bg-surface-container transition-colors" 
          onClick={() => setIsConsoleOpen(!isConsoleOpen)}
        >
          <div className="flex items-center gap-space-md overflow-hidden min-w-0">
            <div className="flex items-center gap-space-xs shrink-0">
              <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
              <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-outline">Auditoría en Tiempo Real</span>
            </div>
            <div className="w-[1px] h-3 bg-outline-variant shrink-0"></div>
            <div className="flex items-center gap-space-xs overflow-hidden min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></span>
              <span className="font-mono-metric text-mono-metric text-on-surface-variant truncate">
                {telemetry}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0 ml-space-md">
            <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant hidden sm:inline">LOG BUFFER (64KB)</span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200" style={{ transform: isConsoleOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
          </div>
        </div>
        
        {/* Collapsible Terminal Drawer */}
        {isConsoleOpen && (
          <div className="px-space-lg pb-space-md pt-space-xs bg-surface-container-lowest font-mono-label text-mono-label flex flex-col gap-space-2xs text-on-surface-variant border-t-0 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between text-outline pb-space-2xs">
              <span>EVENTO / DISPOSITIVO</span>
              <span>ESTADO</span>
            </div>
            <div className="flex items-center justify-between py-space-2xs hover:bg-surface-container px-space-xs rounded">
              <span className="text-on-surface">[14:22:04.119] KAIROS_IK: Waypoints calculados (12) hacia d7d5</span>
              <span className="text-primary font-medium">SUCCESS</span>
            </div>
            <div className="flex items-center justify-between py-space-2xs hover:bg-surface-container px-space-xs rounded">
              <span className="text-on-surface">[14:22:03.980] ENGINE_STOCKFISH: Nodo evaluado a profundidad 28 (38.2 MNPS)</span>
              <span className="text-primary font-medium">OK</span>
            </div>
            <div className="flex items-center justify-between py-space-2xs hover:bg-surface-container px-space-xs rounded">
              <span className="text-on-surface">[14:22:02.450] CAM_OVERHEAD_0: Frame #441029 procesado en 1.82ms</span>
              <span className="text-on-surface-variant">LOCKED</span>
            </div>
            <div className="flex items-center justify-between py-space-2xs hover:bg-surface-container px-space-xs rounded">
              <span className="text-on-surface">[14:22:00.012] HEARTBEAT_CONTROLLER: Conexión persistente WebRTC activa</span>
              <span className="text-primary-fixed-dim">SYNC</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
