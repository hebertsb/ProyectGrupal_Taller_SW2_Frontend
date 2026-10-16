import { useState } from 'react';

/** Centipeones → peones con signo ("+0.40"). Un mate forzado se muestra como tal, no como un número enorme. */
function formatearPeones(cp, mate) {
  if (mate) return cp > 0 ? 'Mate a favor' : 'Mate en contra';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
}

function claseCalculo(cp, mate) {
  if (mate) return cp > 0 ? 'text-neon-lime' : 'text-error';
  if (cp > 30) return 'text-neon-lime';
  if (cp < -30) return 'text-error';
  return 'text-on-surface-variant';
}

function formatearTiempo(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

function Dato({ etiqueta, valor, ayuda }) {
  return (
    <div className="flex flex-col px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 min-w-0" title={ayuda}>
      <span className="font-mono-micro text-[9px] text-on-surface-variant uppercase truncate">{etiqueta}</span>
      <span className="font-mono-metric text-[13px] font-bold text-on-surface truncate">{valor}</span>
    </div>
  );
}

/**
 * Cómo decidió Turing: la red propone y pondera (intuición) y la búsqueda de variantes calcula (cálculo).
 * Todo viene de la búsqueda real del backend (`calculo` de /aprendizaje/inferencia) — nada se estima acá.
 * Stockfish no aparece: nunca interviene en esta decisión.
 */
export default function PanelCalculoTuring({ calculo, analizando }) {
  const [formulaAbierta, setFormulaAbierta] = useState(false);

  if (!calculo) {
    return (
      <section className="bg-surface-container/70 border border-outline-variant/30 rounded-xl p-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-neon-purple text-[18px]">calculate</span>
          <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Cálculo de Turing</h2>
        </div>
        <p className="font-mono-label text-[11px] text-on-surface-variant mt-1.5">
          {analizando
            ? 'Analizando…'
            : 'Ejecutá una inferencia para ver cómo combina Turing la intuición de la red con el cálculo de variantes.'}
        </p>
      </section>
    );
  }

  const elegida = calculo.candidatas.find((c) => c.elegida) ?? calculo.candidatas[0];
  const probabilidadMaxima = Math.max(...calculo.candidatas.map((c) => c.probabilidad), 0.0001);

  return (
    <section className="bg-surface-container/70 border border-neon-purple/30 rounded-xl p-3 shadow-md flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="material-symbols-outlined text-neon-purple text-[18px] shrink-0 mt-0.5">calculate</span>
          <div className="flex flex-col min-w-0">
            <h2 className="font-headline-sm text-[13px] font-semibold text-on-surface uppercase tracking-wide">Cálculo de Turing</h2>
            <p className="font-body-sm text-[12px] text-on-surface-variant" aria-live="polite">
              {calculo.corrige_a_la_red ? (
                <>
                  La red prefería <strong className="text-neon-orange">{calculo.jugada_red_sola}</strong>, pero al calcular las variantes Turing
                  juega <strong className="text-neon-lime">{elegida.jugada}</strong>.
                </>
              ) : (
                <>
                  La red y el cálculo coinciden: Turing juega <strong className="text-neon-lime">{elegida.jugada}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
        <span className="font-mono-micro text-[10px] text-neon-lime bg-neon-lime/10 px-1.5 py-0.5 rounded border border-neon-lime/30 shrink-0">
          real
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <Dato etiqueta="Profundidad" valor={`${calculo.profundidad} jugadas`} ayuda="Media-jugadas que calculó hacia adelante" />
        <Dato etiqueta="Posiciones" valor={calculo.nodos.toLocaleString('es-BO')} ayuda="Posiciones analizadas durante el cálculo" />
        <Dato etiqueta="Tiempo" valor={formatearTiempo(calculo.tiempo_ms)} ayuda="Tiempo del cálculo de variantes" />
        <Dato etiqueta="Peso de la red" valor={calculo.peso_red.toLocaleString('es-BO')} ayuda="Cuánto pesa la intuición de la red frente al cálculo" />
      </div>

      <ul className="flex flex-col gap-1.5" aria-label="Candidatas calculadas por Turing, de mejor a peor puntaje">
        {calculo.candidatas.map((c) => {
          const esRedSola = c.jugada === calculo.jugada_red_sola;
          return (
            <li
              key={c.jugada}
              className={`grid grid-cols-[3.25rem_1fr_auto] sm:grid-cols-[4.5rem_1fr_6rem_5rem] items-center gap-x-2 gap-y-1 px-2.5 py-1.5 rounded-lg border ${
                c.elegida ? 'bg-neon-lime/10 border-neon-lime/50' : 'bg-surface-container-lowest border-outline-variant/20'
              }`}
            >
              <span className={`font-headline-sm text-[15px] font-bold ${c.elegida ? 'text-neon-lime' : 'text-on-surface'}`}>{c.jugada}</span>

              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden" role="img" aria-label={`La red le da ${(c.probabilidad * 100).toFixed(1)}%`}>
                  <div className="h-full rounded-full bg-neon-purple" style={{ width: `${Math.max(2, (c.probabilidad / probabilidadMaxima) * 100)}%` }} />
                </div>
                <span className="font-mono-micro text-[9px] text-on-surface-variant">Red {(c.probabilidad * 100).toFixed(1)}%</span>
              </div>

              <span className={`font-mono-metric text-[12px] font-semibold text-right ${claseCalculo(c.calculo_cp, c.mate)}`} title="Lo que calcula Turing (en peones, desde quien mueve)">
                <span className="sm:hidden font-mono-micro text-[9px] text-on-surface-variant font-normal">Cálculo </span>
                {formatearPeones(c.calculo_cp, c.mate)}
              </span>

              <div className="col-span-3 sm:col-span-1 flex items-center justify-end gap-1 flex-wrap">
                {esRedSola && (
                  <span className="px-1.5 py-0.5 rounded font-mono-micro text-[9px] font-bold uppercase text-neon-orange bg-neon-orange/10 border border-neon-orange/40">
                    Red sola
                  </span>
                )}
                {c.elegida && (
                  <span className="px-1.5 py-0.5 rounded font-mono-micro text-[9px] font-bold uppercase text-neon-lime bg-neon-lime/15 border border-neon-lime/40">
                    Elegida
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setFormulaAbierta((v) => !v)}
          aria-expanded={formulaAbierta}
          className="self-start flex items-center gap-1 font-mono-micro text-[10px] text-neon-cyan hover:underline min-h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[14px]">{formulaAbierta ? 'expand_less' : 'help'}</span>
          ¿Cómo se decide?
        </button>
        {formulaAbierta && (
          <p className="font-body-sm text-[12px] text-on-surface-variant bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2.5">
            La <strong className="text-neon-purple">red</strong> reparte probabilidad entre las jugadas según lo que aprendió de partidas de maestros (intuición).
            Turing además <strong className="text-neon-cyan">calcula</strong> las variantes: qué pasa si juega eso, qué responde el rival, y así hasta
            {' '}{calculo.profundidad} jugadas. El puntaje de cada candidata es <em>cálculo + peso × ln(probabilidad de la red)</em>: cuanto
            menos le gusta una jugada a la red, más ventaja de cálculo necesita para ganar. Gana la de mayor puntaje. Stockfish no interviene.
          </p>
        )}
      </div>
    </section>
  );
}
