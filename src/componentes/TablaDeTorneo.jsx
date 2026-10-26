/** Texto de un resultado de torneo: `1-0` ganó el de las blancas, `0-1` el de las negras, `1/2-1/2` tablas, `0-0` quedó sin terminar. */
export function textoDeResultado(resultado) {
  if (resultado === '1-0') return 'Ganaron blancas';
  if (resultado === '0-1') return 'Ganaron negras';
  if (resultado === '1/2-1/2') return 'Tablas';
  if (resultado === '0-0') return 'Sin terminar';
  return 'Jugándose';
}

/** `3.5` → «3,5»: los puntos de un torneo van con coma y sin decimales de más. */
export function textoDePuntos(puntos) {
  return String(puntos).replace('.', ',');
}

export const NOMBRE_ESTADO_TORNEO = { inscripcion: 'Inscripciones abiertas', en_juego: 'En juego', terminado: 'Terminado' };

/**
 * Tabla de posiciones de un torneo y las partidas de su ronda. `yoId` resalta al jugador que mira; `alMirar(codigo)` (solo el docente) abre una partida en vivo.
 * Se ve bien desde 360 px: la tabla se desplaza dentro de su caja, nunca la página.
 */
export default function TablaDeTorneo({ torneo, yoId = null, alMirar = null }) {
  const filas = torneo.clasificacion ?? [];
  const partidas = torneo.partidas_de_la_ronda ?? [];
  return (
    <div className="flex flex-col gap-space-sm min-w-0">
      {filas.length === 0 ? (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay jugadores inscritos.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full min-w-[20rem] border-collapse font-body-sm text-body-sm">
            <caption className="sr-only">Tabla de posiciones de {torneo.nombre}</caption>
            <thead>
              <tr className="bg-surface-container-high text-left font-mono-micro text-mono-micro uppercase text-on-surface-variant">
                <th scope="col" className="px-space-sm py-space-xs w-10">#</th>
                <th scope="col" className="px-space-sm py-space-xs">Jugador</th>
                <th scope="col" className="px-space-sm py-space-xs text-right">Pts</th>
                <th scope="col" className="px-space-sm py-space-xs text-right">Gan.</th>
                <th scope="col" className="px-space-sm py-space-xs text-right">Part.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id} className={`border-t border-outline-variant/20 ${fila.id === yoId ? 'bg-primary/10 font-medium' : ''}`}>
                  <td className="px-space-sm py-space-xs font-mono-micro text-mono-micro">{fila.puesto}</td>
                  <td className="px-space-sm py-space-xs text-on-surface break-words">
                    {fila.nombre}
                    {fila.id === yoId && <span className="ml-space-xs font-mono-micro text-mono-micro text-primary">(vos)</span>}
                    {fila.rango && <span className="block font-mono-micro text-mono-micro text-on-surface-variant">{fila.rango}</span>}
                  </td>
                  <td className="px-space-sm py-space-xs text-right font-medium">{textoDePuntos(fila.puntos)}</td>
                  <td className="px-space-sm py-space-xs text-right">{fila.victorias}</td>
                  <td className="px-space-sm py-space-xs text-right">{fila.partidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {partidas.length > 0 && (
        <div className="flex flex-col gap-space-2xs">
          <h4 className="m-0 font-mono-micro text-mono-micro uppercase tracking-wide text-on-surface-variant">
            Ronda {torneo.ronda_actual} de {torneo.rondas}
          </h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
            {partidas.map((partida, indice) => {
              const esMia = yoId != null && (partida.blancas?.id === yoId || partida.negras?.id === yoId);
              return (
                <li
                  key={partida.codigo ?? `d-${indice}`}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-xs px-space-sm py-space-xs rounded-lg ${
                    esMia ? 'bg-primary/10 border border-primary/30' : 'bg-surface-container'
                  }`}
                >
                  {partida.descanso ? (
                    <span className="font-body-sm text-body-sm text-on-surface-variant break-words">
                      {(partida.blancas ?? partida.negras)?.nombre} descansa esta ronda (suma 1 punto)
                    </span>
                  ) : (
                    <>
                      <span className="font-body-sm text-body-sm text-on-surface break-words min-w-0">
                        <span aria-label="blancas">⬜</span> {partida.blancas?.nombre ?? '—'} <span className="text-on-surface-variant">vs</span>{' '}
                        <span aria-label="negras">⬛</span> {partida.negras?.nombre ?? '—'}
                      </span>
                      <span className="flex items-center gap-space-xs shrink-0">
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant">{textoDeResultado(partida.resultado)}</span>
                        {alMirar && partida.codigo && !partida.resultado && (
                          <button
                            type="button"
                            onClick={() => alMirar(partida.codigo)}
                            className="px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            Mirar
                          </button>
                        )}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
