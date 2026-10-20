import { useState } from 'react';
import { ensayoMoverPieza, moverPiezaBrazo } from '../../../api/backend';
import { COLUMNAS } from '../Piezas/fenCaptura';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const TIPOS = [['p', 'Peón'], ['n', 'Caballo'], ['b', 'Alfil'], ['r', 'Torre'], ['q', 'Dama'], ['k', 'Rey']];
const FILAS = [8, 7, 6, 5, 4, 3, 2, 1];

/** Primera prueba: elegís la casilla de origen y la de destino y el brazo lleva la pieza. Ensayo primero (no mueve nada). */
export default function MoverPieza({ estado }) {
  const [origen, setOrigen] = useState('e2');
  const [destino, setDestino] = useState('e4');
  const [modo, setModo] = useState('origen'); // qué casilla se elige al tocar el tablero
  const [tipo, setTipo] = useState('p');
  const [pasos, setPasos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const tarea = estado?.tarea;
  const habilitado = estado?.modo === 5;
  const enCurso = tarea?.estado === 'ejecutando';

  function elegir(casilla) {
    setPasos(null);
    if (modo === 'origen') {
      setOrigen(casilla);
      setModo('destino');
    } else {
      setDestino(casilla);
    }
  }

  async function correr(accion) {
    setOcupado(true);
    setError(null);
    try {
      return await accion();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-mover-pieza">
      <h3 id="titulo-mover-pieza" className="font-body-md text-body-md text-on-surface font-medium">
        3 · Llevar una pieza de una casilla a otra
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Poné la pieza en el <strong>origen</strong>, elegí origen y destino en el tablero, mirá el ensayo y ejecutá. Hoy no resuelve capturas:
        el destino tiene que estar vacío.
      </p>
      <div className="flex flex-wrap gap-space-xs" role="group" aria-label="Qué casilla elegir al tocar el tablero">
        <button type="button" className={modo === 'origen' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={modo === 'origen'} onClick={() => setModo('origen')}>
          Origen: {origen}
        </button>
        <button type="button" className={modo === 'destino' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={modo === 'destino'} onClick={() => setModo('destino')}>
          Destino: {destino}
        </button>
        <select
          className="min-h-[44px] px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setPasos(null);
          }}
          aria-label="Tipo de pieza"
        >
          {TIPOS.map(([l, n]) => (
            <option key={l} value={l}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-8 w-full max-w-sm mx-auto border border-outline-variant" role="group" aria-label="Tablero para elegir origen y destino">
        {FILAS.flatMap((fila) =>
          [...COLUMNAS].map((columna, i) => {
            const casilla = `${columna}${fila}`;
            const esOrigen = casilla === origen;
            const esDestino = casilla === destino;
            return (
              <button
                key={casilla}
                type="button"
                onClick={() => elegir(casilla)}
                aria-label={casilla}
                aria-pressed={esOrigen || esDestino}
                className={`aspect-square text-[10px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  esOrigen
                    ? 'bg-primary text-on-primary font-bold'
                    : esDestino
                      ? 'bg-tertiary text-on-tertiary font-bold'
                      : (i + fila) % 2 === 1
                        ? 'bg-surface-container-highest text-on-surface-variant'
                        : 'bg-surface-container-lowest text-on-surface-variant'
                }`}
              >
                {esOrigen ? 'de' : esDestino ? 'a' : casilla}
              </button>
            );
          })
        )}
      </div>
      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado || enCurso || !estado?.conectado}
          onClick={async () => setPasos(await correr(() => ensayoMoverPieza(origen, destino, tipo)))}
        >
          Ensayo (no mueve nada)
        </button>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado || enCurso || !habilitado || !pasos}
          title={!pasos ? 'Hacé el ensayo primero' : !habilitado ? 'Habilitá el brazo primero' : undefined}
          onClick={async () => {
            if (window.confirm(`¿Mover la pieza de ${origen} a ${destino}? Tené la mano cerca del botón de parada.`)) {
              await correr(() => moverPiezaBrazo(origen, destino, tipo));
            }
          }}
        >
          Mover {origen} → {destino}
        </button>
      </div>
      {pasos && (
        <ol className="m-0 pl-5 font-body-sm text-body-sm text-on-surface">
          {pasos.map((p, i) => (
            <li key={i} className={enCurso || tarea?.estado === 'terminada' ? '' : ''}>
              {p.paso}
              {p.pose && <span className="text-on-surface-variant"> — ({p.pose.slice(0, 3).map((n) => n.toFixed(0)).join(', ')})</span>}
            </li>
          ))}
        </ol>
      )}
      {tarea && tarea.estado !== 'inactiva' && (
        <p
          className={tarea.estado === 'error' ? CLASE_AVISO : 'font-body-sm text-body-sm text-on-surface m-0'}
          role={tarea.estado === 'error' ? 'alert' : 'status'}
        >
          {tarea.descripcion}: <strong>{tarea.estado}</strong>
          {tarea.mensaje ? ` — ${tarea.mensaje}` : ''}
        </p>
      )}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
