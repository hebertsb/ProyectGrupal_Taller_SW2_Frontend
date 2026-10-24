import { useCallback, useEffect, useState } from 'react';
import { actualizarParametrosBrazo, obtenerParametrosBrazo, probarLugarBrazo } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';

const CAMPO =
  'min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const LUGARES = [
  ['cementerio_origen', null, 'Primera casilla del cementerio', true],
  ['cementerio_paso', null, 'Paso entre casillas de una fila (dx, dy mm)', false],
  ['cementerio_paso_fila', null, 'Paso entre filas (dx, dy mm)', false],
  ['reservas', 'dama_negra', 'Dama negra de reserva (la que usa Turing)', true],
  ['reservas', 'dama_blanca', 'Dama blanca de reserva (solo si el brazo corona con blancas)', true],
];
const PRUEBAS = [
  ['cementerio:0', 'Primera casilla'],
  ['cementerio:29', 'Última casilla (la 30)'],
  ['reserva:dama_negra', 'Dama negra'],
  ['reserva:dama_blanca', 'Dama blanca'],
];

/**
 * Dónde está el cementerio (piezas capturadas y peones coronados) y las damas de reserva, y cómo probarlos SIN pieza. Se lleva la punta al lugar con el modo en
 * vivo, se toca «Usar la posición actual» y se prueba primero en el emulador. `pose` es la pose actual del brazo conectado.
 */
export default function CementerioBrazo({ pose, emulador, deshabilitado }) {
  const [valores, setValores] = useState(null);
  const [guardarEnDisco, setGuardarEnDisco] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const p = await obtenerParametrosBrazo();
      setValores({
        cementerio_origen: p.cementerio_origen,
        cementerio_paso: p.cementerio_paso,
        cementerio_paso_fila: p.cementerio_paso_fila,
        cementerio_columnas: p.cementerio_columnas,
        reservas: p.reservas ?? {},
      });
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

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

  const lugar = (clave, subclave) => {
    const fuente = subclave ? valores.reservas?.[subclave] : valores[clave];
    return Array.isArray(fuente) ? fuente : ['', ''];
  };
  function fijarLugar(clave, subclave, par) {
    const limpio = par.every((v) => v === '') ? null : par;
    setValores((v) => {
      if (!subclave) return { ...v, [clave]: limpio };
      const reservas = { ...v.reservas };
      if (limpio === null) delete reservas[subclave];
      else reservas[subclave] = limpio;
      return { ...v, reservas };
    });
  }
  function cambiarLugar(clave, subclave, indice, texto) {
    const actual = [...lugar(clave, subclave)];
    actual[indice] = texto === '' ? '' : Number(texto);
    fijarLugar(clave, subclave, actual);
  }
  const usarPosicionActual = (clave, subclave) => pose && fijarLugar(clave, subclave, [Math.round(pose[0] * 10) / 10, Math.round(pose[1] * 10) / 10]);

  const aplicar = (guardar) => actualizarParametrosBrazo(valores, guardar && !emulador);
  const probar = (id) =>
    correr(async () => {
      await aplicar(false); // primero lo que se ve en pantalla (solo en memoria)
      await probarLugarBrazo(id);
    }, `Probando ${id} sin pieza: mirá el brazo (o el emulador). Si no llega o choca, ajustá los valores.`);

  if (!valores) return <p className="font-body-sm text-body-sm text-on-surface-variant m-0">{error ?? 'Cargando…'}</p>;
  return (
    <div className="flex flex-col gap-space-xs">
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Ahí van las piezas capturadas y los peones coronados, y de ahí sale la dama al coronar. Tienen que estar a la altura del tablero y fuera de él. Lleva la punta del brazo
        al lugar con el modo en vivo y toca «Usar la posición actual». Sin cementerio, el brazo no mueve ninguna captura.
      </p>
      {LUGARES.map(([clave, subclave, etiqueta, puedeTomar]) => {
        const par = lugar(clave, subclave);
        return (
          <div key={`${clave}-${subclave}`} className="grid grid-cols-[1fr_1fr] sm:grid-cols-[2fr_1fr_1fr_auto] items-end gap-space-xs">
            <span className="col-span-2 sm:col-span-1 font-body-sm text-body-sm text-on-surface-variant">{etiqueta}</span>
            {[0, 1].map((i) => (
              <input
                key={i}
                className={CAMPO}
                type="number"
                step="0.1"
                value={par[i] ?? ''}
                onChange={(e) => cambiarLugar(clave, subclave, i, e.target.value)}
                placeholder={i === 0 ? 'x mm' : 'y mm'}
                aria-label={`${etiqueta}: ${i === 0 ? 'x' : 'y'}`}
              />
            ))}
            {puedeTomar && (
              <button type="button" className={`${CLASE_BOTON} col-span-2 sm:col-span-1`} disabled={!pose} onClick={() => usarPosicionActual(clave, subclave)}>
                Usar la posición actual
              </button>
            )}
          </div>
        );
      })}
      <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1 sm:max-w-xs">
        Casillas por fila del cementerio
        <input
          className={CAMPO}
          type="number"
          min="1"
          max="30"
          value={valores.cementerio_columnas ?? ''}
          onChange={(e) => setValores((v) => ({ ...v, cementerio_columnas: e.target.value === '' ? '' : Number(e.target.value) }))}
        />
      </label>
      <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-primary" checked={guardarEnDisco && !emulador} disabled={emulador} onChange={(e) => setGuardarEnDisco(e.target.checked)} />
        Guardar también como valores por defecto del brazo real (brazo.json){emulador ? ' — no aplica al emulador' : ''}
      </label>
      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado}
          onClick={() => correr(() => aplicar(guardarEnDisco), guardarEnDisco && !emulador ? 'Aplicado y guardado en brazo.json.' : 'Aplicado al brazo.')}
        >
          Aplicar cementerio y reservas
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="font-body-sm text-body-sm text-on-surface-variant w-full">Probar sin pieza (lleva la punta ahí y baja unos mm; empezá por el emulador):</span>
        {PRUEBAS.map(([id, texto]) => (
          <button key={id} type="button" className={CLASE_BOTON} disabled={ocupado || deshabilitado} onClick={() => probar(id)}>
            {texto}
          </button>
        ))}
      </div>
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
    </div>
  );
}
