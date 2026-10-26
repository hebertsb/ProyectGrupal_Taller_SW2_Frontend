import { useEffect, useState } from 'react';
import { centrarBajarBrazo, centrarGuardarBrazo, centrarSubirBrazo, moverRelativoBrazo, obtenerParametrosBrazo, tableroCalibradoBrazo } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const PIEZAS = [['p', 'Peón'], ['n', 'Caballo'], ['b', 'Alfil'], ['r', 'Torre'], ['q', 'Dama'], ['k', 'Rey']];
const CAMPO =
  'min-h-[44px] px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const VELOCIDAD_MM_S = 10;

const unitario = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo = Math.hypot(dx, dy) || 1;
  return [dx / largo, dy / largo];
};

/**
 * Centrar la pinza sobre las piezas: si al bajar la pinza queda corrida de la pieza (la deja a un costado de la casilla), se baja sobre una pieza, se empuja la pinza de a 1 mm hasta que
 * quede centrada, y se guarda cuánto se corrió. Desde ahí TODAS las casillas del tablero llevan ese corrimiento. Se mueve en los ejes del tablero (hacia la columna a o h, hacia la fila 1 u 8).
 */
export default function CentradoBrazo({ estado }) {
  const [casilla, setCasilla] = useState('e2');
  const [tipo, setTipo] = useState('p');
  const [paso, setPaso] = useState(1);
  const [ejes, setEjes] = useState(null);
  const [corrimiento, setCorrimiento] = useState(null);
  const [abajo, setAbajo] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const habilitado = estado?.modo === 5 || estado?.modo === 7;
  const moviendo = estado?.tarea?.estado === 'ejecutando';
  const libre = Boolean(estado?.conectado) && !moviendo && !ocupado;

  useEffect(() => {
    if (!estado?.conectado) return;
    tableroCalibradoBrazo()
      .then((t) => t && setEjes({ archivo: unitario(t.casillas.a1, t.casillas.h1), fila: unitario(t.casillas.a1, t.casillas.a8) }))
      .catch(() => setEjes(null));
    obtenerParametrosBrazo().then((p) => setCorrimiento([p.corrimiento_x_mm ?? 0, p.corrimiento_y_mm ?? 0])).catch(() => {});
  }, [estado?.conectado, estado?.destino]);

  async function correr(accion, textoOk) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await accion();
      if (textoOk) setMensaje(typeof textoOk === 'function' ? textoOk(r) : textoOk);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const bajar = () =>
    correr(async () => {
      if (!window.confirm(`El brazo bajará DESPACIO sobre ${casilla.toUpperCase()}, con la pinza abierta (sin cerrarla), y se quedará ahí. ¿Hay una pieza en esa casilla y tenés la mano en la parada de emergencia?`)) return;
      await centrarBajarBrazo(casilla, tipo);
      setAbajo(true);
    }, 'Bajando… cuando termine, mira si los dedos rodean la pieza centrados y corrígelo con las flechas.');

  /** Mueve la pinza `paso` mm hacia uno de los lados del tablero. `eje` es el vector (en el plano del brazo) y `signo` el sentido. */
  const empujar = (eje, signo) => correr(() => moverRelativoBrazo(eje[0] * paso * signo, eje[1] * paso * signo, 0, VELOCIDAD_MM_S));

  const guardar = () =>
    correr(async () => {
      const r = await centrarGuardarBrazo();
      setCorrimiento([r.corrimiento_x_mm, r.corrimiento_y_mm]);
      return r;
    }, (r) => `Guardado: la pinza se corre ${r.corrimiento_x_mm} mm en X y ${r.corrimiento_y_mm} mm en Y para todas las casillas. Sube la pinza y prueba mover una pieza.`);

  const subir = () =>
    correr(async () => {
      await centrarSubirBrazo();
      setAbajo(false);
    }, 'Subiendo y volviendo a la posición de descanso.');

  const flechas = ejes && [
    ['← hacia la columna a', ejes.archivo, -1],
    ['→ hacia la columna h', ejes.archivo, 1],
    ['↑ hacia la fila 8', ejes.fila, 1],
    ['↓ hacia la fila 1', ejes.fila, -1],
  ];

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-centrado">
      <h3 id="titulo-centrado" className="font-body-md text-body-md text-on-surface font-medium">
        Centrar la pinza sobre las piezas (si la deja a un costado de la casilla)
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Pon una pieza en la casilla, baja la pinza sobre ella (con los dedos abiertos, sin cerrar), corrígela de a 1 mm hasta que los dedos queden igual de lejos de la pieza a cada lado y guarda. Todas las casillas
        llevan ese corrimiento. {corrimiento ? `Corrimiento actual: ${corrimiento[0]} mm en X, ${corrimiento[1]} mm en Y.` : ''}
      </p>
      <div className="flex flex-wrap items-end gap-space-xs">
        <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
          Casilla con la pieza
          <input className={`${CAMPO} w-24`} value={casilla} maxLength={2} onChange={(e) => setCasilla(e.target.value.toLowerCase())} disabled={abajo} />
        </label>
        <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
          Pieza
          <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={abajo}>
            {PIEZAS.map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!libre || !habilitado || abajo || !/^[a-h][1-8]$/.test(casilla)} onClick={bajar}>
          1 · Bajar sobre la pieza
        </button>
      </div>
      {abajo && (
        <div className="flex flex-col gap-space-xs">
          <label className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-space-xs">
            Cada toque mueve
            <select className={CAMPO} value={paso} onChange={(e) => setPaso(Number(e.target.value))}>
              {[0.5, 1, 2, 5].map((v) => (
                <option key={v} value={v}>
                  {v} mm
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-space-xs">
            {flechas ? (
              flechas.map(([texto, eje, signo]) => (
                <button key={texto} type="button" className={CLASE_BOTON} disabled={!libre} onClick={() => empujar(eje, signo)}>
                  {texto}
                </button>
              ))
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant">Calibra el tablero primero para tener las direcciones.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!libre} onClick={guardar}>
              2 · Guardar este centrado
            </button>
            <button type="button" className={CLASE_BOTON} disabled={!libre} onClick={subir}>
              3 · Subir
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
