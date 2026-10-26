import { useEffect, useState } from 'react';
import { actualizarParametrosBrazo, calibrarTableroBrazo, obtenerParametrosBrazo, tableroCalibradoBrazo } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const PUNTOS = [
  ['a1', 'a1 (esquina de las blancas, a la izquierda)', true],
  ['h1', 'h1 (esquina de las blancas, a la derecha)', true],
  ['a8', 'a8 (esquina de las negras, a la izquierda)', true],
  ['h8', 'h8 (opcional: mejora el ajuste)', false],
];

const redondear = (lista) => lista.map((v) => Math.round(v * 10) / 10);

/**
 * Calibrar el tablero del brazo cuando el tablero cambió (más grande, otro, movido). Se lleva el brazo A MANO (modo arrastre del propio brazo) hasta el centro de cada casilla y se toca
 * «Tomar»: solo se LEE su posición, no se mueve nada. Se guarda en `brazo.json` y se aplica al brazo conectado sin reconectar. Solo con el brazo real.
 */
export default function CalibracionTableroBrazo({ estado, alCambio }) {
  const [tomados, setTomados] = useState({});
  const [cero, setCero] = useState(null);
  const [actual, setActual] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [zTope, setZTope] = useState(null);

  const real = Boolean(estado?.conectado) && !estado?.emulador;
  const puedeTomar = real && Array.isArray(estado?.pose) && Array.isArray(estado?.angulos);
  const completo = ['a1', 'h1', 'a8'].every((c) => tomados[c]) && cero;

  useEffect(() => {
    if (!estado?.conectado) return;
    tableroCalibradoBrazo().then(setActual).catch(() => setActual(null));
    obtenerParametrosBrazo().then((p) => setZTope(p.z_tope ?? null)).catch(() => {});
  }, [estado?.conectado, resultado]);

  async function correr(accion, textoOk) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      await accion();
      if (textoOk) setMensaje(textoOk);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const guardar = () =>
    correr(async () => {
      const respuesta = await calibrarTableroBrazo(tomados, cero);
      setResultado(respuesta);
      setZTope(respuesta.z_tope ?? null);
      alCambio?.();
      setMensaje(
        `Listo. Calibración guardada y aplicada. La altura del tablero se calculó sola de las esquinas (${respuesta.z_tope} mm) y el cementerio y las damas de reserva se pusieron para este tablero (lado ${respuesta.cementerio_aplicado?.lado}). Ya puedes probar mover una pieza.`
      );
    });

  /** La altura de las puntas apoyadas en ESTE tablero: de ella sale hasta dónde baja el brazo (más el margen de agarre de cada pieza). Si se cambió de tablero hay que volver a medirla. */
  const tomarAlturaDelTablero = () =>
    correr(async () => {
      const nuevos = await actualizarParametrosBrazo({ z_tope: redondear([estado.pose[2]])[0] }, real);
      setZTope(nuevos.z_tope ?? null);
    }, 'Altura del tablero guardada. El brazo bajará hasta esa altura más el margen de agarre de cada pieza.');

  const aplicarCementerio = (sugerencia) =>
    correr(() => actualizarParametrosBrazo(sugerencia, true), 'Cementerio y reservas guardados para este tablero.');

  const datos = resultado ?? actual;
  const sugerencia = datos?.sugerencia_cementerio;

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-calibrar-tablero">
      <h3 id="titulo-calibrar-tablero" className="font-body-md text-body-md text-on-surface font-medium">
        Calibrar el tablero del brazo (si lo cambiaste de tamaño o de lugar)
      </h3>
      {datos && (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
          Calibración actual: casillas de <strong>{datos.paso_mm} mm</strong>. a1 en ({datos.casillas.a1[0]}, {datos.casillas.a1[1]}), h1 en ({datos.casillas.h1[0]}, {datos.casillas.h1[1]}).
        </p>
      )}
      {!real && (
        <p className={CLASE_AVISO} role="status">
          Conecta el <strong>brazo real</strong> (no el emulador) para calibrar el tablero.
        </p>
      )}
      <ol className="m-0 pl-5 font-body-sm text-body-sm text-on-surface-variant">
        <li>El tablero y la cámara ya en su lugar definitivo. Si se mueven, hay que volver a calibrar.</li>
        <li>Pon el brazo en modo arrastre (botón del propio brazo) y lleva la punta de la pinza al <strong>centro</strong> de la casilla, a 1 o 2 mm del tablero, con la pinza apuntando hacia abajo igual en todas.</li>
        <li>Toca «Tomar» en esa casilla. Repite con las demás y con la posición de descanso (fuera del encuadre de la cámara).</li>
      </ol>
      <div className="flex flex-col gap-space-xs">
        {PUNTOS.map(([casilla, etiqueta]) => (
          <div key={casilla} className="flex flex-wrap items-center gap-space-xs">
            <button type="button" className={CLASE_BOTON} disabled={!puedeTomar || ocupado} onClick={() => setTomados((t) => ({ ...t, [casilla]: estado.pose }))}>
              Tomar {casilla}
            </button>
            <span className="font-body-sm text-body-sm text-on-surface">
              {etiqueta}: {tomados[casilla] ? `✓ (${redondear(tomados[casilla].slice(0, 3)).join(', ')})` : '—'}
            </span>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-space-xs">
          <button type="button" className={CLASE_BOTON} disabled={!puedeTomar || ocupado} onClick={() => setCero(estado.angulos)}>
            Tomar la posición de descanso
          </button>
          <span className="font-body-sm text-body-sm text-on-surface">Posición de descanso (a donde vuelve el brazo tras cada jugada): {cero ? `✓ (${redondear(cero).join(', ')})` : '—'}</span>
        </div>
      </div>
      <div className="flex flex-col gap-space-xs border border-outline-variant rounded-xl p-space-sm">
        <span className="font-body-sm text-body-sm text-on-surface font-medium">Altura del tablero (se calcula sola al guardar; esto es solo para corregirla a mano)</span>
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
          De esta altura sale hasta dónde baja el brazo a agarrar y a soltar. Con el brazo en modo arrastre, apoya MUY suavemente las puntas de los dedos sobre el tablero, sin empujar, y toca el botón.
          Si esta altura es más baja que el tablero real, el brazo lo aplasta (lo dobla o lo marca). Altura actual: <strong>{zTope ?? 'sin medir'}</strong> mm.
        </p>
        <div>
          <button type="button" className={CLASE_BOTON} disabled={!puedeTomar || ocupado} onClick={tomarAlturaDelTablero}>
            Tomar la altura del tablero (puntas apoyadas)
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!real || !completo || ocupado} onClick={guardar}>
          Guardar y aplicar la calibración
        </button>
        <button type="button" className={CLASE_BOTON} disabled={ocupado || (Object.keys(tomados).length === 0 && !cero)} onClick={() => { setTomados({}); setCero(null); }}>
          Empezar de nuevo
        </button>
      </div>
      {resultado?.avisos?.length > 0 && (
        <ul className={`${CLASE_AVISO} m-0 pl-5`}>
          {resultado.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {sugerencia && (
        <div className="flex flex-col gap-space-xs">
          <p className="font-body-sm text-body-sm text-on-surface m-0">
            Cementerio y reservas propuestos para este tablero (casillas del mismo tamaño): primera casilla ({sugerencia.cementerio_origen.join(', ')}), dama negra ({sugerencia.reservas.dama_negra.join(', ')}). Con el
            tablero más grande, los lugares anteriores ya no sirven.
          </p>
          <div>
            <button type="button" className={CLASE_BOTON} disabled={!real || ocupado} onClick={() => aplicarCementerio(sugerencia)}>
              Aplicar y guardar el cementerio propuesto
            </button>
          </div>
        </div>
      )}
      {mensaje && (
        <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
          {mensaje}
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
