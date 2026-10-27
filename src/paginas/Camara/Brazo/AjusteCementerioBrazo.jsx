import { useEffect, useState } from 'react';
import { cementerioLlevarBrazo, cementerioSoltarBrazo, moverRelativoBrazo, tableroCalibradoBrazo } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';

const PIEZAS = [
  ['p', 'Peón', 8],
  ['n', 'Caballo', 2],
  ['b', 'Alfil', 2],
  ['r', 'Torre', 2],
  ['q', 'Dama', 2],
];
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
 * Enseñar el cementerio llevando una pieza real: se pone una pieza en una casilla del tablero (por ejemplo h2), el brazo la toma, la lleva al lugar que le toca en el cementerio y la deja SUSPENDIDA
 * ahí. Se la corrige con las flechas (de a 1 mm) hasta donde se quiere dejar y se suelta: ahí se guarda su posición. Los peones van en un bloque (cuántos por fila se elige arriba) y las demás
 * piezas en línea recta: el peón 1 fija el punto de partida, el 2 (o el de más lejos) la separación, y la primera pieza de la fila siguiente, la separación entre filas.
 */
export default function AjusteCementerioBrazo({ estado, porPiezas, peonesPorFila = 4, alCambio }) {
  const [zona, setZona] = useState('brazo');
  const [tipo, setTipo] = useState('p');
  const [numero, setNumero] = useState(1);
  const [origen, setOrigen] = useState('h2');
  const [paso, setPaso] = useState(1);
  const [guardarAltura, setGuardarAltura] = useState(false);
  const [ejes, setEjes] = useState(null);
  const [conPieza, setConPieza] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const habilitado = estado?.modo === 5 || estado?.modo === 7;
  const moviendo = estado?.tarea?.estado === 'ejecutando';
  const libre = Boolean(estado?.conectado) && !moviendo && !ocupado;
  const [, nombreTipo, cuantas] = PIEZAS.find(([id]) => id === tipo);
  const nombreSeleccion = `${nombreTipo}${cuantas > 1 ? ` ${numero}` : ''}`;

  useEffect(() => {
    if (!estado?.conectado) return;
    tableroCalibradoBrazo()
      .then((t) => t && setEjes({ archivo: unitario(t.casillas.a1, t.casillas.h1), fila: unitario(t.casillas.a1, t.casillas.a8) }))
      .catch(() => setEjes(null));
  }, [estado?.conectado, estado?.destino]);

  if (!estado?.conectado) return null;

  async function correr(accion, textoOk) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await accion();
      if (textoOk) setMensaje(typeof textoOk === 'function' ? textoOk(r) : textoOk);
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  const llevar = () =>
    correr(async () => {
      if (!window.confirm(`Poné ${nombreSeleccion.toLowerCase() === 'dama' ? 'una dama' : `un ${nombreSeleccion.toLowerCase()}`} en ${origen.toUpperCase()}. El brazo la tomará, la llevará al cementerio y la dejará suspendida ahí SIN soltarla. ¿Está la pieza y tenés la mano en la parada de emergencia?`)) return;
      await cementerioLlevarBrazo({ zona, tipoPieza: tipo, numero, origen });
      setConPieza(true);
    }, 'Llevando la pieza… cuando termine, empujala con las flechas hasta el lugar donde la querés dejar y soltala.');

  const empujar = (dx, dy, dz) => correr(() => moverRelativoBrazo(dx * paso, dy * paso, dz * paso, VELOCIDAD_MM_S));

  const soltar = (guardar) =>
    correr(
      async () => {
        const r = await cementerioSoltarBrazo({ guardar, guardarAltura: guardar && guardarAltura });
        setConPieza(false);
        await alCambio?.();
        return r;
      },
      (r) => (Object.keys(r.cambios ?? {}).length ? `Soltada y guardada: ${Object.entries(r.cambios).map(([c, v]) => `${c} = ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}.` : 'Soltada (sin guardar).')
    );

  const flechas = ejes && [
    ['← hacia la columna a', ejes.archivo[0] * -1, ejes.archivo[1] * -1],
    ['→ hacia la columna h', ejes.archivo[0], ejes.archivo[1]],
    ['↑ hacia la fila 8', ejes.fila[0], ejes.fila[1]],
    ['↓ hacia la fila 1', ejes.fila[0] * -1, ejes.fila[1] * -1],
  ];

  return (
    <section className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-low border border-outline-variant/40" aria-labelledby="titulo-ajuste-cementerio">
      <h4 id="titulo-ajuste-cementerio" className="m-0 font-body-md text-body-md text-on-surface font-medium">
        Enseñar el cementerio llevando una pieza
      </h4>
      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        Poné una pieza en una casilla del tablero (por ejemplo h2). El brazo la toma, la lleva al lugar que le toca en el cementerio y la deja suspendida: movela con las flechas hasta donde la querés
        dejar y soltala; ahí queda guardado. Los peones van en un bloque (el peón 1 es el punto de partida, el 2 fija la separación y el primero de la fila siguiente, la separación entre filas) y las
        demás piezas en línea recta (caballo 1 y 2, alfil 1 y 2…). Repetí con el otro cementerio. Al final probá una dama: es la más alta.
        {porPiezas ? '' : ' (Con «Ordenar el cementerio por piezas» apagado solo se usa el cementerio del brazo.)'}
      </p>
      <div className="flex flex-col gap-space-xs">
        <span className="font-body-sm text-body-sm text-on-surface-variant">Elegí el lugar que vas a enseñar. Los peones se acomodan como bloque; las demás piezas van en una sola línea.</span>
        <div className="flex flex-col gap-2" role="group" aria-label="Pieza y lugar que se va a enseñar">
          <div className="flex flex-col gap-1">
            <span className="font-body-sm text-body-sm text-on-surface">Peones (bloque de 8)</span>
            <div className="grid gap-1 max-w-lg" style={{ gridTemplateColumns: `repeat(${peonesPorFila}, minmax(0, 1fr))` }}>
              {Array.from({ length: 8 }, (_, indice) => indice + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${CLASE_BOTON} ${tipo === 'p' && numero === n ? 'ring-2 ring-primary' : ''}`}
                  aria-pressed={tipo === 'p' && numero === n}
                  disabled={conPieza}
                  onClick={() => { setTipo('p'); setNumero(n); }}
                >
                  Peón {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-body-sm text-body-sm text-on-surface">Piezas en línea recta</span>
            <div className="flex flex-wrap gap-1">
              {PIEZAS.filter(([id]) => id !== 'p').flatMap(([id, texto, cantidad]) =>
                Array.from({ length: cantidad }, (_, indice) => {
                  const n = indice + 1;
                  const seleccionada = tipo === id && numero === n;
                  return (
                    <button
                      key={`${id}-${n}`}
                      type="button"
                      className={`${CLASE_BOTON} ${seleccionada ? 'ring-2 ring-primary' : ''}`}
                      aria-pressed={seleccionada}
                      disabled={conPieza}
                      onClick={() => { setTipo(id); setNumero(n); }}
                    >
                      {texto} {n}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-space-xs">
        <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1 min-w-0">
          Cementerio
          <select className={CAMPO} value={zona} onChange={(e) => setZona(e.target.value)} disabled={conPieza}>
            <option value="brazo">Del brazo (piezas blancas)</option>
            {porPiezas && <option value="jugador">Del jugador (piezas negras)</option>}
          </select>
        </label>
        <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
          Tomar {nombreSeleccion} de
          <input className={`${CAMPO} w-24`} value={origen} maxLength={2} onChange={(e) => setOrigen(e.target.value.toLowerCase())} disabled={conPieza} />
        </label>
        <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!libre || !habilitado || conPieza || !/^[a-h][1-8]$/.test(origen)} onClick={llevar}>
          1 · Tomar y llevar al cementerio
        </button>
      </div>
      {conPieza && (
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
              flechas.map(([texto, dx, dy]) => (
                <button key={texto} type="button" className={CLASE_BOTON} disabled={!libre} onClick={() => empujar(dx, dy, 0)}>
                  {texto}
                </button>
              ))
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant">Calibrá el tablero primero para tener las direcciones.</span>
            )}
            <button type="button" className={CLASE_BOTON} disabled={!libre} onClick={() => empujar(0, 0, -1)}>
              ⤓ más abajo
            </button>
            <button type="button" className={CLASE_BOTON} disabled={!libre} onClick={() => empujar(0, 0, 1)}>
              ⤒ más arriba
            </button>
          </div>
          <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={guardarAltura} onChange={(e) => setGuardarAltura(e.target.checked)} />
            Guardar también la altura a la que la suelto (desnivel de la mesa)
          </label>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!libre} onClick={() => soltar(true)}>
              2 · Soltar aquí y guardar
            </button>
            <button type="button" className={CLASE_BOTON} disabled={!libre} onClick={() => soltar(false)}>
              Soltar sin guardar
            </button>
          </div>
        </div>
      )}
      {mensaje && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface" role="status">
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
