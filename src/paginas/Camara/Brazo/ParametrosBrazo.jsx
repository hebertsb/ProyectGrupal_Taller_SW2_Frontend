import { useCallback, useEffect, useState } from 'react';
import {
  actualizarParametrosBrazo,
  aplicarConfiguracionBrazo,
  borrarConfiguracionBrazo,
  guardarConfiguracionBrazo,
  listarConfiguracionesBrazo,
  obtenerParametrosBrazo,
} from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const CAMPOS = [
  ['velocidad_global', 'Velocidad global del brazo (%)', 1, 100],
  ['aceleracion', 'Aceleración (%)', 1, 100],
  ['velocidad', 'Velocidad de movimientos (%)', 1, 100],
  ['fuerza', 'Fuerza de la pinza (%)', 20, 100],
  ['velocidad_pinza', 'Velocidad de la pinza (%)', 1, 100],
  ['apertura_aproximacion', 'Apertura al bajar sobre un peón (0–1000)', 0, 1000],
  ['apertura_extra_soltar', 'Apertura extra al soltar la pieza (0–1000)', 0, 1000],
  ['largo_pinza_mm', 'Largo de la pinza: de la brida a la punta de los dedos (mm)', 100, 400],
  ['altura_segura_mm', 'Altura segura para trasladarse (mm)', 20, 200],
  ['margen_agarre_mm', 'Margen de agarre sobre el tablero (mm)', 0, 60],
  ['velocidad_bajada', 'Velocidad al bajar y subir cerca del tablero (%): lenta, para no golpearlo', 1, 100],
  ['aceleracion_bajada', 'Aceleración al bajar y subir cerca del tablero (%)', 1, 100],
  ['altura_borde_mm', 'Cuánto sobresale el marco del tablero sobre la superficie de juego (mm)', 0, 50],
  ['holgura_traslado_mm', 'Aire al trasladar una pieza por encima de las demás (mm)', 0, 60],
  ['elevacion_al_soltar_mm', 'Al SOLTAR la pieza, quedarse más arriba que al agarrar (mm): para no chocar con el tablero', 0, 30],
  ['desnivel_cementerio_mm', 'Cementerio: cuánto más baja que la superficie del tablero está la mesa (mm). Con valor, la pieza baja hasta la mesa al soltarla; 0 = a la altura del tablero', 0, 60],
  ['holgura_cementerio_mm', 'Cementerio: aire entre la base de la pieza y la mesa al soltarla (mm)', 0, 20],
  ['giro_diagonal_grados', 'Giro de los dedos (°)', -180, 180],
];
const PIEZAS = [['p', 'Peón'], ['n', 'Caballo'], ['b', 'Alfil'], ['r', 'Torre'], ['q', 'Dama'], ['k', 'Rey']];
// El peón no tiene un valor propio en la lista: usa el de arriba (`apertura_aproximacion` y `margen_agarre_mm`), así que su casilla edita ese mismo campo y las dos se ven igual.

const CAMPO =
  'min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Parámetros del brazo y la pinza + configuraciones con nombre (guardar, aplicar, borrar). Solo con conexión. */
export default function ParametrosBrazo({ emulador }) {
  const [valores, setValores] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [nombre, setNombre] = useState('');
  const [guardarEnDisco, setGuardarEnDisco] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([obtenerParametrosBrazo(), listarConfiguracionesBrazo()]);
      setValores(p);
      setConfigs(c);
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
      const resultado = await accion();
      if (textoOk) setMensaje(textoOk);
      return resultado;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function cambiar(clave, texto) {
    setValores((v) => ({ ...v, [clave]: texto === '' ? '' : Number(texto) }));
  }
  function cambiarApertura(letra, texto) {
    if (letra === 'p') {
      cambiar('apertura_aproximacion', texto);
      return;
    }
    setValores((v) => {
      const aperturas = { ...v.aperturas_por_pieza };
      if (texto === '') delete aperturas[letra];
      else aperturas[letra] = Number(texto);
      return { ...v, aperturas_por_pieza: aperturas };
    });
  }
  function cambiarMargen(letra, texto) {
    if (letra === 'p') {
      cambiar('margen_agarre_mm', texto);
      return;
    }
    setValores((v) => {
      const margenes = { ...v.margenes_por_pieza };
      if (texto === '') delete margenes[letra];
      else margenes[letra] = Number(texto);
      return { ...v, margenes_por_pieza: margenes };
    });
  }
  function cambiarGiro(letra, texto) {
    if (letra === 'p') {
      cambiar('giro_diagonal_grados', texto);
      return;
    }
    setValores((v) => {
      const giros = { ...v.giros_por_pieza };
      if (texto === '') delete giros[letra];
      else giros[letra] = Number(texto);
      return { ...v, giros_por_pieza: giros };
    });
  }

  async function aplicar() {
    // El cementerio y las reservas se editan en «Llevar una pieza»: acá no se tocan (si no, se pisarían con los valores viejos de esta pantalla).
    // eslint-disable-next-line no-unused-vars
    const { z_tope, cementerio_origen, cementerio_paso, cementerio_paso_fila, cementerio_columnas, cementerio_por_piezas, cementerio_peones_por_fila, cementerio_jugador_origen, cementerio_jugador_paso, cementerio_jugador_paso_fila, reservas, ...resto } = valores;
    const nuevos = await correr(
      () => actualizarParametrosBrazo({ ...resto, z_tope }, guardarEnDisco && !emulador),
      guardarEnDisco && !emulador ? 'Aplicado y guardado en brazo.json.' : 'Aplicado al brazo.'
    );
    if (nuevos) setValores(nuevos);
  }

  if (!valores) {
    return (
      <section className={CLASE_TARJETA}>
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">{error ?? 'Cargando parámetros…'}</p>
      </section>
    );
  }

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-parametros-brazo">
      <h3 id="titulo-parametros-brazo" className="font-body-md text-body-md text-on-surface font-medium">
        2 · Parámetros y configuraciones
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
        {CAMPOS.map(([clave, etiqueta, min, max]) => (
          <label key={clave} className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            {etiqueta}
            <input className={CAMPO} type="number" min={min} max={max} value={valores[clave] ?? ''} onChange={(e) => cambiar(clave, e.target.value)} />
          </label>
        ))}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0">Apertura de la pinza al bajar sobre cada pieza (0–1000). La del peón es la misma de «Apertura al bajar sobre un peón», arriba.</p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-space-xs">
        {PIEZAS.map(([letra, etiqueta]) => (
          <label key={letra} className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            {etiqueta}
            <input
              className={CAMPO}
              type="number"
              min="0"
              max="1000"
              value={(letra === 'p' ? valores.apertura_aproximacion : valores.aperturas_por_pieza?.[letra]) ?? ''}
              onChange={(e) => cambiarApertura(letra, e.target.value)}
              placeholder="sin medir"
            />
          </label>
        ))}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0">Alto de cada pieza, medido con regla (mm): con esto el brazo sube lo necesario para pasar por encima de la más alta con aire de sobra.</p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-space-xs">
        {PIEZAS.map(([letra, etiqueta]) => (
          <label key={letra} className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            {etiqueta}
            <input
              className={CAMPO}
              type="number"
              min="0"
              max="200"
              value={valores.alturas_piezas_mm?.[letra] ?? ''}
              onChange={(e) => setValores((v) => {
                const alturas = { ...v.alturas_piezas_mm };
                if (e.target.value === '') delete alturas[letra];
                else alturas[letra] = Number(e.target.value);
                return { ...v, alturas_piezas_mm: alturas };
              })}
              placeholder="sin medir"
            />
          </label>
        ))}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0">
        Margen de agarre sobre el tablero al bajar sobre cada pieza (mm, 0–60). El del peón es el mismo de «Margen de agarre sobre el tablero», arriba.. Si la pinza choca contra el
        tablero con una pieza puntual, subile el margen acá — no hace falta tocar el de arriba, que sigue valiendo para las demás.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-space-xs">
        {PIEZAS.map(([letra, etiqueta]) => (
          <label key={letra} className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            {etiqueta}
            <input
              className={CAMPO}
              type="number"
              min="0"
              max="60"
              step="0.1"
              value={(letra === 'p' ? valores.margen_agarre_mm : valores.margenes_por_pieza?.[letra]) ?? ''}
              onChange={(e) => cambiarMargen(letra, e.target.value)}
              placeholder={String(valores.margen_agarre_mm ?? '')}
            />
          </label>
        ))}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0">
        Giro de los dedos al agarrar o soltar cada pieza (°, -180 a 180). El del peón es el mismo de «Giro de los dedos (°)», arriba. Si una pieza es irregular (por ejemplo la torre a 35° o el caballo), dale su propio ángulo acá para que la pinza baje con esa orientación.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-space-xs">
        {PIEZAS.map(([letra, etiqueta]) => (
          <label key={letra} className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            {etiqueta}
            <input
              className={CAMPO}
              type="number"
              min="-180"
              max="180"
              step="1"
              value={(letra === 'p' ? valores.giro_diagonal_grados : valores.giros_por_pieza?.[letra]) ?? ''}
              onChange={(e) => cambiarGiro(letra, e.target.value)}
              placeholder={String(valores.giro_diagonal_grados ?? '')}
            />
          </label>
        ))}
      </div>
      <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-primary" checked={guardarEnDisco && !emulador} disabled={emulador} onChange={(e) => setGuardarEnDisco(e.target.checked)} />
        Guardar también como valores por defecto del brazo real (brazo.json){emulador ? ' — no aplica al emulador' : ''}
      </label>
      <div>
        <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={ocupado} onClick={aplicar}>
          Aplicar parámetros
        </button>
      </div>

      <h4 className="font-body-md text-body-md text-on-surface font-medium m-0 mt-space-xs">Configuraciones guardadas</h4>
      <div className="flex flex-col sm:flex-row gap-space-xs">
        <input className={CAMPO} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Suave para peones)" maxLength={60} aria-label="Nombre de la configuración" />
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado || !nombre.trim()}
          onClick={async () => {
            await aplicar();
            const lista = await correr(() => guardarConfiguracionBrazo(nombre.trim()), `Configuración «${nombre.trim()}» guardada.`);
            if (lista) {
              setConfigs(lista);
              setNombre('');
            }
          }}
        >
          Guardar ahora
        </button>
      </div>
      {configs.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Todavía no guardaste ninguna.</p>}
      <ul className="list-none p-0 m-0 flex flex-col gap-1">
        {configs.map((c) => (
          <li key={c.nombre} className="flex flex-wrap items-center justify-between gap-space-xs border-b border-outline-variant pb-1">
            <span className="font-body-sm text-body-sm text-on-surface">
              <strong>{c.nombre}</strong> <span className="text-on-surface-variant">· vel {c.parametros.velocidad_global}% · fuerza {c.parametros.fuerza}% · {c.guardada}</span>
            </span>
            <span className="flex gap-space-xs">
              <button
                type="button"
                className={CLASE_BOTON}
                disabled={ocupado}
                onClick={async () => {
                  const nuevos = await correr(() => aplicarConfiguracionBrazo(c.nombre), `Configuración «${c.nombre}» aplicada.`);
                  if (nuevos) setValores(nuevos);
                }}
              >
                Aplicar
              </button>
              <button
                type="button"
                className={CLASE_BOTON}
                disabled={ocupado}
                onClick={async () => {
                  const lista = await correr(() => borrarConfiguracionBrazo(c.nombre), `Configuración «${c.nombre}» borrada.`);
                  if (lista) setConfigs(lista);
                }}
              >
                Borrar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {mensaje && <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">{mensaje}</p>}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
