const VEREDICTO = {
  true: ['Origen y destino cambiaron', 'text-primary'],
  false: ['Origen o destino sin cambio', 'text-error'],
};

function Imagen({ titulo, ayuda, src }) {
  return (
    <figure className="m-0 flex flex-col gap-1 min-w-0">
      <figcaption className="font-body-sm text-body-sm text-on-surface font-medium">{titulo}</figcaption>
      <img src={src} alt={titulo} className="w-full h-auto rounded-lg border border-outline-variant bg-surface-container" />
      <span className="font-body-sm text-body-sm text-on-surface-variant">{ayuda}</span>
    </figure>
  );
}

/**
 * Cómo decide el seguimiento: la foto base (la posición que ya conoce), la foto de ahora, el mapa de cuánto cambió cada casilla y las jugadas legales que más se
 * parecen a lo que cambió, con lo que les sobra y les falta. Una jugada solo cuenta si cambiaron su casilla de origen y la de destino.
 */
export default function VistaDecision({ vista }) {
  if (!vista?.disponible) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Todavía no hay fotos para comparar: esperá la foto base.</p>;
  }
  const casillas = Object.entries(vista.puntajes ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-space-sm" aria-label="Cómo decide el seguimiento">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
        <Imagen titulo="1 · Foto base (antes)" ayuda="La posición que la app ya conoce." src={vista.base} />
        <Imagen titulo="2 · Foto de ahora" ayuda="Lo que ve la cámara en este momento." src={vista.actual} />
        <Imagen
          titulo="3 · Diferencia"
          ayuda={`Rojo = cambió (el número es cuánto). Borde amarillo = pasa el umbral de ${vista.umbral}. Flecha verde = la jugada elegida.`}
          src={vista.diferencia}
        />
      </div>

      <p className="font-body-sm text-body-sm text-on-surface m-0 break-words">
        <strong>Decisión:</strong> {vista.decision || '—'}
      </p>

      <div className="font-body-sm text-body-sm text-on-surface-variant">
        {vista.cambiadas.length > 0 ? (
          <>
            Casillas que cambiaron respecto a la base: <strong className="text-on-surface">{vista.cambiadas.join(', ')}</strong>
          </>
        ) : vista.entre_cuadros.length > 0 ? (
          <>
            Se mueve algo entre un cuadro y el siguiente: <strong className="text-on-surface">{vista.entre_cuadros.join(', ')}</strong>. Se espera a que quede quieto.
          </>
        ) : (
          'Ninguna casilla cambió respecto a la base.'
        )}
        {casillas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1" aria-label="Cambio por casilla">
            {casillas.slice(0, 12).map(([casilla, puntaje]) => (
              <span
                key={casilla}
                className={`px-2 py-0.5 rounded-md border font-mono-micro text-mono-micro ${puntaje >= vista.umbral ? 'border-primary text-on-surface' : 'border-outline-variant'}`}
              >
                {casilla} {puntaje}
              </span>
            ))}
          </div>
        )}
      </div>

      {vista.candidatas.length > 0 ? (
        <div className="flex flex-col gap-1 min-w-0">
          <p className="font-body-sm text-body-sm text-on-surface m-0">
            Jugadas legales de las {vista.turno} que más se parecen (hay {vista.legales} en total):
          </p>
          <div className="overflow-x-auto">
            <table className="w-full font-body-sm text-body-sm text-left border-collapse">
              <thead className="text-on-surface-variant">
                <tr>
                  <th className="pr-space-sm py-1 font-medium">Jugada</th>
                  <th className="pr-space-sm py-1 font-medium">Cambiaría</th>
                  <th className="pr-space-sm py-1 font-medium">Cambió y no es suyo</th>
                  <th className="pr-space-sm py-1 font-medium">Le falta</th>
                  <th className="py-1 font-medium">Veredicto</th>
                </tr>
              </thead>
              <tbody>
                {vista.candidatas.map((c, i) => {
                  const [texto, color] = VEREDICTO[c.valida];
                  return (
                    <tr key={c.uci} className={`border-t border-outline-variant ${i === 0 ? 'font-medium' : ''}`}>
                      <td className="pr-space-sm py-1 font-mono-micro text-mono-micro">{c.san}</td>
                      <td className="pr-space-sm py-1 font-mono-micro text-mono-micro">{c.casillas.join(' ')}</td>
                      <td className="pr-space-sm py-1 font-mono-micro text-mono-micro">{c.sobran.join(' ') || '—'}</td>
                      <td className="pr-space-sm py-1 font-mono-micro text-mono-micro">{c.faltan.join(' ') || '—'}</td>
                      <td className={`py-1 ${color}`}>{texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Se acepta la jugada si cambiaron su origen y su destino y sobra o falta como mucho una casilla (en ese caso se confirma un segundo más). Si lo que cambió es solo
            el origen o solo una captura retirada, es una jugada a medias y se espera.
          </p>
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
          Sin casillas cambiadas no se evalúa ninguna jugada. Hay {vista.legales} jugadas legales de las {vista.turno}.
        </p>
      )}
    </div>
  );
}
