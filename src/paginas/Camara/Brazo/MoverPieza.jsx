import { useState } from 'react';
import { ensayoMoverPieza, irAPosicionInicialBrazo, moverPiezaBrazo } from '../../../api/backend';
import { COLUMNAS } from '../Piezas/fenCaptura';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

// El agarre no depende del tipo de pieza (la pinza ya está configurada en los scripts): se manda siempre el mismo.
const TIPO_PIEZA = 'p';
const FILAS = [8, 7, 6, 5, 4, 3, 2, 1];

/** Primera prueba: elegís la casilla de origen y la de destino y el brazo lleva la pieza. Ensayo primero (no mueve nada). */
export default function MoverPieza({ estado }) {
  // Sin valores por defecto: hay que elegir a propósito. `modo` es qué casilla se elige al tocar el tablero; `null` = selección
  // bloqueada (ya hay origen y destino y un toque suelto no puede cambiarlos).
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [modo, setModo] = useState('origen');
  const [pasos, setPasos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const tarea = estado?.tarea;
  const habilitado = estado?.modo === 5;
  const enCurso = tarea?.estado === 'ejecutando';

  function elegir(casilla) {
    if (!modo || enCurso) return;
    setPasos(null);
    if (modo === 'origen') {
      if (casilla === destino) return; // no puede ser la misma casilla que el destino
      setOrigen(casilla);
      setModo(destino ? null : 'destino');
    } else {
      if (casilla === origen) return;
      setDestino(casilla);
      setModo(null); // listo: se bloquea hasta que se pida cambiar algo
    }
  }

  function cambiar(que) {
    setPasos(null);
    setModo(que);
  }

  function borrar() {
    setPasos(null);
    setOrigen('');
    setDestino('');
    setModo('origen');
  }

  const instruccion =
    modo === 'origen'
      ? 'Toca en el tablero la casilla donde está la pieza (origen).'
      : modo === 'destino'
        ? 'Ahora toca la casilla a la que va (destino).'
        : 'Selección lista y bloqueada. Para cambiarla usa los botones de arriba; luego haz el ensayo.';

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
        <button
          type="button"
          className={`${CLASE_BOTON} ${modo === 'origen' ? 'ring-2 ring-primary' : ''}`}
          aria-pressed={modo === 'origen'}
          disabled={enCurso}
          onClick={() => cambiar('origen')}
        >
          <span className="inline-block w-3 h-3 rounded-sm bg-primary mr-2 align-middle" />
          Origen: {origen || '—'}
        </button>
        <button
          type="button"
          className={`${CLASE_BOTON} ${modo === 'destino' ? 'ring-2 ring-primary' : ''}`}
          aria-pressed={modo === 'destino'}
          disabled={enCurso}
          onClick={() => cambiar('destino')}
        >
          <span className="inline-block w-3 h-3 rounded-sm bg-tertiary mr-2 align-middle" />
          Destino: {destino || '—'}
        </button>
        <button type="button" className={CLASE_BOTON} disabled={enCurso || (!origen && !destino)} onClick={borrar}>
          Borrar
        </button>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0" aria-live="polite">
        {instruccion}
      </p>
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
                disabled={!modo || enCurso}
                aria-label={casilla}
                aria-pressed={esOrigen || esDestino}
                className={`aspect-square text-[10px] leading-none disabled:cursor-not-allowed ${!modo && !esOrigen && !esDestino ? 'opacity-60' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  esOrigen
                    ? 'bg-primary text-on-primary font-bold'
                    : esDestino
                      ? 'bg-tertiary text-on-tertiary font-bold'
                      : (i + fila) % 2 === 1
                        ? 'bg-surface-container-highest text-on-surface-variant'
                        : 'bg-surface-container-lowest text-on-surface-variant'
                }`}
              >
                {casilla}
              </button>
            );
          })
        )}
      </div>
      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado || enCurso || !estado?.conectado || !origen || !destino}
          onClick={async () => setPasos(await correr(() => ensayoMoverPieza(origen, destino, TIPO_PIEZA)))}
        >
          Ensayo (no mueve nada)
        </button>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado || enCurso || !habilitado || !pasos || !origen || !destino}
          title={!pasos ? 'Hacé el ensayo primero' : !habilitado ? 'Habilitá el brazo primero' : undefined}
          onClick={async () => {
            if (window.confirm(`Vas a mover el brazo: tomará la pieza de ${origen.toUpperCase()} y la dejará en ${destino.toUpperCase()}. ¿La pieza está en ${origen.toUpperCase()} y ${destino.toUpperCase()} está vacía? Ten la mano cerca del botón de parada.`)) {
              await correr(() => moverPiezaBrazo(origen, destino, TIPO_PIEZA));
            }
          }}
        >
          Mover {origen} → {destino}
        </button>
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado || enCurso || !habilitado}
          title={!habilitado ? 'Habilita el brazo primero' : 'Lleva el brazo a la posición cero de la calibración'}
          onClick={async () => {
            if (window.confirm('El brazo volverá a la posición inicial. Despeja el espacio y ten la mano cerca del botón de parada. ¿Continuar?')) {
              await correr(irAPosicionInicialBrazo);
            }
          }}
        >
          Volver a posición inicial
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
