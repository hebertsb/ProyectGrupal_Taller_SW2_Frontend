import { useState } from 'react';
import { ensayoMoverPieza, irAPosicionInicialBrazo, moverPiezaBrazo, probarAperturaBrazo } from '../../../api/backend';
import { COLUMNAS } from '../Piezas/fenCaptura';
import CementerioBrazo from './CementerioBrazo';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const CLASE_CAMPO =
  'min-h-[44px] px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm min-w-0';

const FILAS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIEZAS = [['p', 'Peón'], ['n', 'Caballo'], ['b', 'Alfil'], ['r', 'Torre'], ['q', 'Dama'], ['k', 'Rey']];
const ACCIONES = [
  ['llevar', 'Llevar a una casilla vacía'],
  ['capturar', 'Capturar (come la pieza del destino)'],
  ['cementerio', 'Mandar la pieza al cementerio'],
];

/** Primera prueba: elegís la casilla de origen y la de destino y el brazo lleva la pieza. Ensayo primero (no mueve nada). */
export default function MoverPieza({ estado }) {
  // Sin valores por defecto: hay que elegir a propósito. `modo` es qué casilla se elige al tocar el tablero; `null` = selección
  // bloqueada (ya hay origen y destino y un toque suelto no puede cambiarlos).
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [modo, setModo] = useState('origen');
  const [accion, setAccion] = useState('llevar');
  const [tipoPieza, setTipoPieza] = useState('p');
  const [tipoCapturada, setTipoCapturada] = useState('p');
  const [casillaCem, setCasillaCem] = useState(1); // 1 a 30 en pantalla; el backend usa 0 a 29
  const [pasos, setPasos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const alCementerio = accion === 'cementerio';
  const opciones = { captura: accion === 'capturar', tipoCapturada, alCementerio, casillaCementerio: casillaCem - 1 };
  const listo = Boolean(origen) && (alCementerio || Boolean(destino));
  const tarea = estado?.tarea;
  const habilitado = estado?.modo === 5;
  const enCurso = tarea?.estado === 'ejecutando';

  function elegir(casilla) {
    if (!modo || enCurso) return;
    setPasos(null);
    if (modo === 'origen') {
      if (casilla === destino) return; // no puede ser la misma casilla que el destino
      setOrigen(casilla);
      setModo(destino || alCementerio ? null : 'destino');
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

  function cambiarAccion(nueva) {
    setPasos(null);
    setAccion(nueva);
    if (nueva === 'cementerio') {
      setDestino('');
      setModo(origen ? null : 'origen');
    } else {
      setModo(origen && !destino ? 'destino' : origen ? null : 'origen');
    }
  }

  /** Un solo botón para la prueba de captura: el peón negro de c5 come al peón blanco de d4 (el de d4 va a la casilla 1 del cementerio). Pide confirmación antes de mover. */
  async function pruebaRapida() {
    const opcionesPrueba = { captura: true, tipoCapturada: 'p', alCementerio: false, casillaCementerio: 0 };
    setAccion('capturar');
    setTipoPieza('p');
    setTipoCapturada('p');
    setCasillaCem(1);
    setOrigen('c5');
    setDestino('d4');
    setModo(null);
    const plan = await correr(() => ensayoMoverPieza('c5', 'd4', 'p', opcionesPrueba));
    if (!plan) return;
    setPasos(plan);
    if (
      window.confirm(
        'Prueba de captura: el brazo llevará el peón BLANCO de d4 a la casilla 1 del cementerio y después el peón NEGRO de c5 a d4. ¿Están los dos peones en su sitio, el cementerio despejado y tenés la mano en la parada de emergencia?'
      )
    ) {
      await correr(() => moverPiezaBrazo('c5', 'd4', 'p', opcionesPrueba));
    }
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
        ? accion === 'capturar'
          ? 'Ahora toca la casilla de la pieza que se come (destino).'
          : 'Ahora toca la casilla a la que va (destino).'
        : 'Selección lista y bloqueada. Para cambiarla usa los botones de arriba; luego haz el ensayo.';
  const textoConfirmar = alCementerio
    ? `Vas a mover el brazo: tomará la pieza de ${origen.toUpperCase()} y la dejará en la casilla ${casillaCem} del cementerio. ¿La pieza está en ${origen.toUpperCase()}? Ten la mano cerca del botón de parada.`
    : accion === 'capturar'
      ? `Vas a mover el brazo: primero llevará la pieza de ${destino.toUpperCase()} a la casilla ${casillaCem} del cementerio y después la de ${origen.toUpperCase()} a ${destino.toUpperCase()}. ¿Están las dos piezas en su sitio? Ten la mano cerca del botón de parada.`
      : `Vas a mover el brazo: tomará la pieza de ${origen.toUpperCase()} y la dejará en ${destino.toUpperCase()}. ¿La pieza está en ${origen.toUpperCase()} y ${destino.toUpperCase()} está vacía? Ten la mano cerca del botón de parada.`;

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
        3 · Llevar una pieza, capturar o mandarla al cementerio
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Poné la pieza en el <strong>origen</strong>, elegí qué hacer y las casillas en el tablero, mirá el ensayo y ejecutá. Con <em>Capturar</em> el brazo retira primero la
        pieza del destino al cementerio y después hace la jugada: es lo mismo que hace en la partida. Pruébalo primero en el emulador.
      </p>
      <div className="flex flex-wrap items-center gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado || enCurso || !habilitado}
          title={!habilitado ? 'Conectá y habilitá el brazo (o el emulador) primero' : 'Ensayo y ejecución de la captura c5 → d4 con un solo botón'}
          onClick={pruebaRapida}
        >
          ▶ Probar captura: peón negro c5 come peón blanco d4
        </button>
        <span className="font-body-sm text-body-sm text-on-surface-variant">Un solo botón: ensayo, confirmación y captura (el blanco va a la casilla 1 del cementerio).</span>
      </div>
      <div className="flex flex-wrap gap-space-xs" role="radiogroup" aria-label="Qué hacer">
        {ACCIONES.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={accion === id}
            disabled={enCurso}
            className={`${CLASE_BOTON} ${accion === id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => cambiarAccion(id)}
          >
            {texto}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-space-xs">
        <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
          Pieza que se mueve
          <select className={CLASE_CAMPO} value={tipoPieza} disabled={enCurso} onChange={(e) => { setPasos(null); setTipoPieza(e.target.value); }}>
            {PIEZAS.map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado || enCurso || !habilitado || !origen}
          title={!origen ? 'Elegí primero la casilla donde está la pieza (origen)' : 'Baja con la pinza abierta, sin cerrarla, para ver si los dedos rodean la pieza sin tocarla'}
          onClick={async () => {
            if (window.confirm(`El brazo bajará sobre ${origen.toUpperCase()} con la apertura de ${tipoPieza.toUpperCase()}, SIN cerrar la pinza, esperará unos segundos y subirá. ¿Está esa pieza ahí y tenés la mano en la parada?`)) {
              await correr(() => probarAperturaBrazo(origen, tipoPieza));
            }
          }}
        >
          Probar la apertura de esta pieza (baja sin cerrar)
        </button>
        {accion === 'capturar' && (
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Pieza que se come
            <select className={CLASE_CAMPO} value={tipoCapturada} disabled={enCurso} onChange={(e) => { setPasos(null); setTipoCapturada(e.target.value); }}>
              {PIEZAS.map(([id, texto]) => (
                <option key={id} value={id}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
        )}
        {accion !== 'llevar' && (
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Casilla del cementerio (1 a 30)
            <input
              className={`${CLASE_CAMPO} w-24`}
              type="number"
              min="1"
              max="30"
              value={casillaCem}
              disabled={enCurso}
              onChange={(e) => { setPasos(null); setCasillaCem(Math.max(1, Math.min(30, Number(e.target.value) || 1))); }}
            />
          </label>
        )}
      </div>
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
        {!alCementerio && (
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
        )}
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
          disabled={ocupado || enCurso || !estado?.conectado || !listo}
          onClick={async () => setPasos(await correr(() => ensayoMoverPieza(origen, destino, tipoPieza, opciones)))}
        >
          Ensayo (no mueve nada)
        </button>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado || enCurso || !habilitado || !pasos || !listo}
          title={!pasos ? 'Hacé el ensayo primero' : !habilitado ? 'Habilitá el brazo primero' : undefined}
          onClick={async () => {
            if (window.confirm(textoConfirmar)) {
              await correr(() => moverPiezaBrazo(origen, destino, tipoPieza, opciones));
            }
          }}
        >
          {alCementerio ? `Mandar ${origen || '…'} al cementerio` : accion === 'capturar' ? `Capturar ${origen || '…'} → ${destino || '…'}` : `Mover ${origen || '…'} → ${destino || '…'}`}
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
      <details className="font-body-sm text-body-sm text-on-surface">
        <summary className="cursor-pointer text-on-surface-variant min-h-[44px] flex items-center">Cementerio y damas de reserva (dónde están, y probarlos sin pieza)</summary>
        <div className="pt-space-xs">
          <CementerioBrazo pose={estado?.pose} emulador={Boolean(estado?.emulador)} deshabilitado={!habilitado || enCurso} />
        </div>
      </details>
    </section>
  );
}
