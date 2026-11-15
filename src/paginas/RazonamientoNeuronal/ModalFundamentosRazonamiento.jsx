import { useState } from 'react';

const SECCIONES = [
  {
    id: 'tensor',
    titulo: 'Tensor 8×8×12 (§2)',
    icono: 'grid_view',
    resumen: 'Codificación espacial y rotación canónica',
    contenido: (
      <div className="flex flex-col gap-3 font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
        <p>
          El tablero se modela como un tensor binario <strong className="text-on-surface">X ∈ {'{'}0, 1{'}'}<sup>8×8×12</sup></strong> (64 casillas × 12 canales de piezas: 6 del bando en turno y 6 del adversario).
        </p>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-cyan font-bold uppercase">Invarianza de Perspectiva Canónica</span>
          <p className="text-on-surface">
            ρ(s, c) = s si Blancas, (63 − s) si Negras. La red siempre percibe que sus piezas avanzan hacia adelante, duplicando la densidad de entrenamiento.
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-purple font-bold uppercase">Espacio de 4.096 Clases con Máscara Legal</span>
          <p className="text-on-surface">
            Salida de 64×64 = 4.096 logits. Solo las jugadas legales M(s) compiten en el Softmax final, garantizando 100% de cumplimiento de las reglas FIDE.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'arquitectura',
    titulo: 'SE-ResNet-8 (§3)',
    icono: 'memory',
    resumen: '8 bloques residuales con atención por canales',
    contenido: (
      <div className="flex flex-col gap-3 font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
        <p>
          Arquitectura neuronal profunda <strong className="text-on-surface">SE-ResNet-8</strong> con 192 canales y 8.565.952 parámetros entrenables, inspirada en AlphaZero y Maia Chess.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1">
            <span className="font-mono-micro text-[10px] text-neon-cyan font-bold uppercase">Conexiones Residuales</span>
            <p className="font-mono-micro text-[11px] text-on-surface">
              F(x) + x preserva el gradiente a través de las capas profundas, permitiendo modelar clavadas y líneas abiertas complejas.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1">
            <span className="font-mono-micro text-[10px] text-neon-purple font-bold uppercase">Bloque Squeeze &amp; Excitation</span>
            <p className="font-mono-micro text-[11px] text-on-surface">
              Comprime el espacio 8×8 por pooling global y recalibra con sigmoide los canales críticos (ej. ataque al enroque o columnas abiertas).
            </p>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between font-mono-micro text-[11px]">
          <span className="text-outline">Inferencia en CPU:</span>
          <span className="text-neon-lime font-bold font-mono">10 a 15 ms por jugada</span>
        </div>
      </div>
    ),
  },
  {
    id: 'xai',
    titulo: 'Explicabilidad XAI (§9)',
    icono: 'psychology',
    resumen: 'Saliencia por gradiente y candidatas contrastivas',
    contenido: (
      <div className="flex flex-col gap-3 font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
        <p>
          Módulo de Inteligencia Artificial Explicable (XAI) que descarta el paradigma de &ldquo;caja negra&rdquo; para fines pedagógicos y académicos.
        </p>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-cyan font-bold uppercase">1. Mapa de Saliencia por Gradiente (§9.1)</span>
          <p className="text-on-surface">
            Calcula la derivada absoluta ∂z / ∂X sobre las 64 casillas del escaque. Revela exactamente qué sectores del tablero provocaron la activación de la jugada.
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-lime font-bold uppercase">2. Candidatas Contrastivas y Poda Táctica (§9.3)</span>
          <p className="text-on-surface">
            Evalúa las top-3 jugadas con chequeos deterministas en O(1) (mate en 1, pieza colgada) para descartar errores antes de mover la pieza.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'calculo',
    titulo: 'Turing con Cálculo (§12)',
    icono: 'calculate',
    resumen: 'Intuición de red + Búsqueda Negamax Alfa-Beta',
    contenido: (
      <div className="flex flex-col gap-3 font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
        <p>
          Combina la <strong className="text-on-surface">intuición de la red de política</strong> con <strong className="text-on-surface">cálculo explícito de variantes</strong> a 2-3 plies sin motores externos.
        </p>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-neon-purple/40 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-purple font-bold uppercase">Fórmula de Decisión Integrada</span>
          <p className="font-mono text-[12px] text-neon-cyan font-bold">
            S(a) = C(a) + w · ln P(a | s)
          </p>
          <p className="text-on-surface text-[10px]">
            Donde C(a) es la evaluación del árbol de búsqueda (material + tablas posicionales) y w · ln P pondera la intuición aprendida de maestros.
          </p>
        </div>
        <p className="font-mono-micro text-[11px] text-on-surface">
          En 40 partidas de prueba (v6 con cálculo vs v6 sola), la búsqueda alcanzó un rendimiento del 92.5% (+436 Elo), eliminando colgadas a profundidad 3.
        </p>
      </div>
    ),
  },
  {
    id: 'oraculo',
    titulo: 'Oráculo Stockfish (§1 y §6)',
    icono: 'fact_check',
    resumen: 'Benchmarking y evaluación, nunca en inferencia',
    contenido: (
      <div className="flex flex-col gap-3 font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
        <p>
          Principio metodológico fundamental del proyecto: <strong className="text-on-surface">Stockfish jamás decide las jugadas de Turing</strong>.
        </p>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-neon-orange/40 flex flex-col gap-1.5 font-mono-micro text-[11px]">
          <span className="text-neon-orange font-bold uppercase">Rol Exclusivo como Oráculo de Evaluación</span>
          <p className="text-on-surface">
            Stockfish se consulta de forma asíncrona solo tras haberse realizado la jugada, para medir la pérdida en centipeones (cp) y brindar retroalimentación pedagógica al jugador.
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 font-mono-micro text-[11px]">
          <span className="text-outline uppercase">Auditoría Científica de Checkpoints (§10)</span>
          <p className="text-on-surface">
            Permite medir de forma reproducible la tasa de errores graves (blunders ≥ 300 cp) y la coincidencia con maestros antes de aprobar cualquier nueva versión.
          </p>
        </div>
      </div>
    ),
  },
];

export default function ModalFundamentosRazonamiento({ abierto, alCerrar }) {
  const [seccionActiva, setSeccionActiva] = useState('tensor');

  if (!abierto) return null;

  const actual = SECCIONES.find((s) => s.id === seccionActiva) ?? SECCIONES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-fundamentos-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl bg-surface-container-high border border-outline-variant/40 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">school</span>
            <div>
              <h2 id="titulo-fundamentos-modal" className="font-headline-sm text-[14px] font-bold text-on-surface uppercase tracking-wide">
                Fundamentos Científicos del Razonamiento
              </h2>
              <p className="font-mono-micro text-[10px] text-on-surface-variant">
                Marco Teórico IA · SE-ResNet-8 · XAI Contrastiva · Negamax
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="p-1 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            title="Cerrar ventana"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Selector de pestañas */}
        <div className="flex items-center gap-1 px-3 py-2 bg-surface-container-lowest/80 border-b border-outline-variant/20 overflow-x-auto">
          {SECCIONES.map((sec) => {
            const activa = sec.id === seccionActiva;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSeccionActiva(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-micro text-[11px] whitespace-nowrap transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  activa
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{sec.icono}</span>
                {sec.titulo}
              </button>
            );
          })}
        </div>

        {/* Contenido principal */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <span className="font-headline-sm text-[13px] font-semibold text-primary uppercase tracking-wide">
              {actual.titulo}
            </span>
            <span className="font-mono-micro text-[10px] text-outline">
              {actual.resumen}
            </span>
          </div>

          {actual.contenido}
        </div>

        {/* Pie */}
        <div className="px-4 py-2.5 border-t border-outline-variant/30 bg-surface-container-low flex items-center justify-between">
          <span className="font-mono-micro text-[10px] text-outline">
            Documentación oficial: docs/marco_teorico_ia_entrenamiento.md
          </span>
          <button
            type="button"
            onClick={alCerrar}
            className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-micro text-[11px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
