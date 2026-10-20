import { useMemo, useRef, useState } from 'react';
import { nombreClase } from '../../EntrenarCamara/SubirFotosPieza';
import { CLASE_AVISO, CLASE_BOTON, CLASE_TARJETA } from '../estilos';
import useFlujoVivo from '../useFlujoVivo';

const CUADROS_VOTO = 8;

/** Mayoría por casilla entre los últimos cuadros: un error suelto de un cuadro no cambia lo que se muestra. */
function votar(historial) {
  const porCasilla = new Map();
  for (const lectura of historial) {
    for (const [casilla, clase, confianza] of lectura) {
      const votos = porCasilla.get(casilla) ?? new Map();
      const previo = votos.get(clase) ?? { n: 0, suma: 0 };
      votos.set(clase, { n: previo.n + 1, suma: previo.suma + confianza });
      porCasilla.set(casilla, votos);
    }
  }
  const resultado = [];
  for (const [casilla, votos] of porCasilla) {
    const [clase, { n, suma }] = [...votos.entries()].sort((a, b) => b[1].n - a[1].n || b[1].suma - a[1].suma)[0];
    resultado.push({ casilla, clase, confianza: suma / n, estabilidad: n / historial.length, alternativas: [] });
  }
  return resultado;
}

function mensajeError(e) {
  if (e.status === 409) return 'Todavía no hay un modelo de piezas entrenado.';
  if (e.status === 503) return 'La cámara no está disponible.';
  if (e.status === 422) return `No se detectó el tablero: ${e.message}. ¿Está calibrado y completo a la vista?`;
  return e.message;
}

const colorConfianza = (c) => (c >= 0.8 ? 'text-primary' : c >= 0.5 ? 'text-on-surface' : 'text-error');

/**
 * Probador de piezas: la cámara mira el tablero calibrado y el modelo dice qué reconoce en cada casilla (pieza, color y confianza).
 * Poné una pieza en cualquier casilla y mirá si la reconoce. Es video en vivo y se vota entre los últimos 8 cuadros para que un error suelto no cambie el resultado; no guarda nada.
 */
export default function ProbadorPiezas() {
  const [enVivo, setEnVivo] = useState(true);
  const { url, datos, error: errorFlujo } = useFlujoVivo({ modo: 'piezas', activo: enVivo });
  const error = errorFlujo ? mensajeError({ message: errorFlujo, status: /entrenado|409/.test(errorFlujo) ? 409 : 0 }) : null;
  const historialRef = useRef([]);
  const casillas = useMemo(() => {
    if (!datos) return [];
    historialRef.current = [...historialRef.current, datos].slice(-CUADROS_VOTO);
    return votar(historialRef.current);
  }, [datos]);
  const ocupadas = casillas.filter((c) => c.clase !== 'vacia');

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Poné una pieza en el tablero y mirá (en vivo) qué reconoce el modelo en cada casilla. El color del círculo indica la confianza:
        verde (80 % o más), ámbar (50–80 %) o rojo (menos). Requiere el tablero calibrado y un modelo entrenado.
      </p>
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" className={CLASE_BOTON} onClick={() => setEnVivo((v) => !v)} aria-pressed={enVivo}>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">{enVivo ? 'pause' : 'play_arrow'}</span>
            {enVivo ? 'Pausar' : 'Reanudar en vivo'}
          </span>
        </button>
      </div>
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <section className={CLASE_TARJETA} aria-labelledby="titulo-probador-imagen">
          <h3 id="titulo-probador-imagen" className="font-body-md text-body-md text-on-surface font-medium">
            Lo que ve la cámara
          </h3>
          <div className="w-full max-w-lg bg-surface-container rounded-lg overflow-hidden flex items-center justify-center min-h-[8rem]">
            {url ? (
              <img
                src={url}
                alt="Tablero enderezado con las piezas reconocidas marcadas por casilla"
                className="w-full h-auto"
              />
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant p-space-md">Conectando con la cámara…</span>
            )}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Mayúscula = blanca, minúscula = negra (P peón, N caballo, B alfil, R torre, Q dama, K rey).
          </p>
        </section>
        <section className={CLASE_TARJETA} aria-labelledby="titulo-probador-lista">
          <h3 id="titulo-probador-lista" className="font-body-md text-body-md text-on-surface font-medium">
            Piezas reconocidas ({ocupadas.length})
          </h3>
          {datos && ocupadas.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0">No reconoce ninguna pieza: el tablero se ve vacío.</p>
          )}
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {ocupadas.map((c) => (
              <li key={c.casilla} className="flex flex-wrap items-baseline justify-between gap-x-space-sm font-body-sm text-body-sm border-b border-outline-variant pb-1">
                <span className="text-on-surface">
                  <strong>{c.casilla}</strong> · {nombreClase(c.clase)}
                </span>
                <span className={colorConfianza(c.confianza)}>
                  {Math.round(c.confianza * 100)} %
                  {c.confianza < 0.8 && c.alternativas[0] ? (
                    <span className="text-on-surface-variant"> (¿{nombreClase(c.alternativas[0].clase)}?)</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
