import { useEffect, useState } from 'react';
import { obtenerTuringPorNivel } from '../../api/backend';

/**
 * Cómo juega Turing según el nivel de la partida, frente a Stockfish. Solo cuentan
 * partidas contra Turing ya analizadas con Stockfish (análisis completo).
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

  return (
    <section className="entrenamiento-bloque bg-surface-container-low rounded-xl p-space-lg shadow-md flex flex-col gap-space-md">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Turing frente a Stockfish, por nivel</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Precisión: porcentaje de jugadas de Turing a 50 cp o menos de la mejor jugada de Stockfish.
        Solo cuentan partidas ya analizadas con Stockfish.
      </p>

      {error && (
        <p role="alert" className="font-body-sm text-error">{error}</p>
      )}

      {niveles && niveles.length === 0 && (
        <p className="font-body-sm text-on-surface-variant">
          Todavía no hay partidas de Turing analizadas. Corré el análisis completo de una partida para verla acá.
        </p>
      )}

      {niveles && niveles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[12px] text-on-surface">
            <thead>
              <tr className="text-left text-outline">
                <th className="py-1 pr-3 font-normal">Nivel</th>
                <th className="py-1 pr-3 font-normal">Partidas</th>
                <th className="py-1 pr-3 font-normal">Jugadas</th>
                <th className="py-1 pr-3 font-normal">Precisión</th>
                <th className="py-1 pr-3 font-normal">Pérdida media</th>
                <th className="py-1 font-normal">Blunders</th>
              </tr>
            </thead>
            <tbody>
              {niveles.map((n) => (
                <tr key={n.nivel} className="border-t border-outline-variant/20">
                  <td className="py-1 pr-3">{n.nivel}</td>
                  <td className="py-1 pr-3">{n.partidas_analizadas}</td>
                  <td className="py-1 pr-3">{n.jugadas_analizadas}</td>
                  <td className="py-1 pr-3">{n.precision.toFixed(1)}%</td>
                  <td className="py-1 pr-3">{n.perdida_media_cp.toFixed(0)} cp</td>
                  <td className="py-1">{n.blunders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
