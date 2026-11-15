import { useEffect, useState } from 'react';
import { obtenerTuringPorNivel } from '../../api/backend';

function bandaNivel(nivel) {
  if (nivel <= 6) return { texto: 'Principiante', clase: 'bg-surface-container text-on-surface-variant' };
  if (nivel <= 13) return { texto: 'Intermedio', clase: 'bg-primary/10 text-primary border border-primary/20' };
  return { texto: 'Avanzado', clase: 'bg-neon-lime/10 text-neon-lime border border-neon-lime/20' };
}

/**
 * Cómo juega Turing según el nivel de la partida, frente a Stockfish. Solo cuentan
 * partidas contra Turing ya analizadas con Stockfish (análisis completo).
 * Corresponde a los Puntos 6, 7 y 10 del Marco Teórico (Oráculo y Promoción de Checkpoints).
 */
export default function TuringPorNivel() {
  const [niveles, setNiveles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerTuringPorNivel()
      .then((respuesta) => {
        if (!cancelado) setNiveles(respuesta.niveles ?? []);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || 'No se pudo cargar el resumen de Turing.');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Métricas agregadas
  const totalPartidas = niveles ? niveles.reduce((acc, n) => acc + (n.partidas_analizadas || 0), 0) : 0;
  const totalJugadas = niveles ? niveles.reduce((acc, n) => acc + (n.jugadas_analizadas || 0), 0) : 0;
  const precisionPonderada =
    totalJugadas > 0
      ? niveles.reduce((acc, n) => acc + n.precision * (n.jugadas_analizadas || 0), 0) / totalJugadas
      : 0;

  return (
    <section className="entrenamiento-bloque bg-surface-container-low rounded-2xl p-space-lg shadow-md border border-outline-variant/20 flex flex-col gap-space-md">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">analytics</span>
          <div className="flex flex-col">
            <h2 className="font-headline-sm text-headline-sm text-on-surface m-0">Turing frente a Stockfish, por nivel</h2>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Marco Teórico §6 y §7 · Evaluación comparativa y control de calidad (HU4 / HU6)
            </span>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full font-mono-micro text-[11px] bg-primary/10 text-primary border border-primary/20 font-bold">
          Oráculo de Calibración
        </span>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        <strong>Precisión:</strong> porcentaje de jugadas de Turing a 50 centipeones o menos de la mejor jugada de Stockfish.
        Turing decide de manera 100% autónoma con su red neuronal; Stockfish se utiliza únicamente como oráculo para medir la pérdida y auditar las decisiones.
      </p>

      {/* Tarjetas resumen de métricas globales */}
      {niveles && niveles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col">
            <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Partidas Auditadas</span>
            <span className="font-mono text-xl font-bold text-on-surface">{totalPartidas}</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col">
            <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Jugadas Evaluadas</span>
            <span className="font-mono text-xl font-bold text-primary">{totalJugadas.toLocaleString('es-BO')}</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex flex-col">
            <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Precisión Global Ponderada</span>
            <span className="font-mono text-xl font-bold text-neon-lime">{precisionPonderada.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {error && <p role="alert" className="font-body-sm text-error m-0">{error}</p>}

      {niveles && niveles.length === 0 && (
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/20 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant">history</span>
          <p className="font-body-sm text-on-surface-variant m-0">
            Todavía no hay partidas de Turing analizadas con Stockfish. Al terminar una partida en Sala de Control y correr el análisis completo, aparecerán aquí las métricas discriminadas por nivel.
          </p>
        </div>
      )}

      {niveles && niveles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest/80">
          <table className="w-full font-mono text-[12px] text-on-surface text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/60 text-outline border-b border-outline-variant/20">
                <th className="py-2.5 px-3 font-bold">Nivel</th>
                <th className="py-2.5 px-3 font-bold">Banda</th>
                <th className="py-2.5 px-3 font-bold">Partidas</th>
                <th className="py-2.5 px-3 font-bold">Jugadas</th>
                <th className="py-2.5 px-3 font-bold">Precisión</th>
                <th className="py-2.5 px-3 font-bold">Pérdida media</th>
                <th className="py-2.5 px-3 font-bold">Blunders</th>
              </tr>
            </thead>
            <tbody>
              {niveles.map((n) => {
                const banda = bandaNivel(n.nivel);
                return (
                  <tr key={n.nivel} className="border-t border-outline-variant/10 hover:bg-surface-container/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-primary">{n.nivel}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${banda.clase}`}>
                        {banda.texto}
                      </span>
                    </td>
                    <td className="py-2 px-3">{n.partidas_analizadas}</td>
                    <td className="py-2 px-3">{n.jugadas_analizadas}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{n.precision.toFixed(1)}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                          <div
                            className={`h-full rounded-full ${n.precision >= 70 ? 'bg-neon-lime' : n.precision >= 50 ? 'bg-primary' : 'bg-neon-orange'}`}
                            style={{ width: `${Math.min(100, Math.max(0, n.precision))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-on-surface-variant">{n.perdida_media_cp.toFixed(0)} cp</td>
                    <td className="py-2 px-3">
                      <span className={n.blunders > 0 ? 'text-error font-bold' : 'text-on-surface-variant'}>
                        {n.blunders}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota científica de respaldo para la defensa */}
      <div className="p-3.5 rounded-xl bg-surface-container/80 border border-primary/20 flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">verified</span>
        <p className="font-mono-micro text-mono-micro text-on-surface-variant m-0 leading-relaxed">
          <strong>Fundamento metodológico:</strong> Como establece el Marco Teórico (§1.3 y §6.2), Stockfish se utiliza como <em>oráculo de evaluación científica</em> y nunca en la inferencia inmediata. La red neuronal <strong>Turing (SE-ResNet-8)</strong> realiza su toma de decisiones mediante convolución y legal move masking autónomo, y esta tabla mide empíricamente su consistencia competitiva frente a la poda alfa-beta.
        </p>
      </div>
    </section>
  );
}
