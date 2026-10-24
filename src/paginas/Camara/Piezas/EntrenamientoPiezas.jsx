import { useCallback, useEffect, useRef, useState } from 'react';
import {
  borrarCapturaDataset,
  borrarClaseDataset,
  descargarDatasetPiezas,
  guardarFotoDataset,
  obtenerResumenDataset,
  obtenerUrlControlDataset,
} from '../../../api/backend';
import { nombreClase } from '../../EntrenarCamara/SubirFotosPieza';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import ModoCamaras from '../ModoCamaras';
import useCamarasConfiguradas from '../useCamarasConfiguradas';
import useFlujoVivo from '../useFlujoVivo';
import {
  CLASE_VACIA,
  CLASES_BLANCAS,
  CLASES_NEGRAS,
  COLUMNAS,
  casillaSiguiente,
  fenConPieza,
} from './fenCaptura';

const META_POR_CLASE = 150;
const CUENTA_REGRESIVA_S = 3;
const FEN_INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const FEN_PIEZAS_VALIDO = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}$/;

/** Las 64 casillas en el orden en que se dibujan para un giro (0/90/180/270, horario) del tablero con blancas abajo. */
function celdasTablero(giro) {
  const vueltas = ((giro / 90) % 4 + 4) % 4;
  const celdas = [];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      let [fi, ci] = [i, j]; // posición en el tablero sin girar que cae en (i, j)
      for (let v = 0; v < vueltas; v += 1) [fi, ci] = [7 - ci, fi];
      celdas.push({ casilla: `${COLUMNAS[ci]}${8 - fi}`, oscura: (ci + (8 - fi)) % 2 === 1 });
    }
  }
  return celdas;
}

function mensajeError(error) {
  if (error.status === 503) return 'La cámara no está disponible. Revisá que esté conectada y probá de nuevo.';
  if (error.status === 422) {
    return `No se pudo usar la foto: ${error.message}. ¿Está calibrado el tablero y completo a la vista, sin la mano encima?`;
  }
  return error.message;
}

/**
 * Captura guiada para entrenar el reconocimiento de piezas: elegís qué pieza (tipo y color) pusiste, en qué casilla(s)
 * del tablero físico, y se guarda el recorte de cada casilla ya etiquetado. Usa la calibración del tablero; luego el
 * ZIP se entrena en Colab. Todo el acceso al backend pasa por api/backend.js.
 */
export default function EntrenamientoPiezas() {
  const [clase, setClase] = useState('white-pawn');
  const [casillas, setCasillas] = useState(['e4']);
  const [avanzar, setAvanzar] = useState(false);
  const [cuenta, setCuenta] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [capturas, setCapturas] = useState([]); // pila para deshacer: {ids (uno por cámara), clase, casillas}
  const { calibradas, tieneSecundaria } = useCamarasConfiguradas();
  // Con la cámara secundaria calibrada, cada captura guarda las fotos de las dos cámaras a la vez.
  const camarasDeCaptura = calibradas.includes('secundaria') ? ['principal', 'secundaria'] : ['principal'];
  const [urlControl, setUrlControl] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [fenCompleto, setFenCompleto] = useState(FEN_INICIAL);
  const [automatico, setAutomatico] = useState(true);
  const [varias, setVarias] = useState(false);
  const deteccionesRef = useRef([]);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [giro, setGiro] = useState(() => {
    try {
      return Number(localStorage.getItem('piezas_giro_tablero')) || 0;
    } catch {
      return 0;
    }
  });
  const montadoRef = useRef(true);
  const temporizadorRef = useRef(null);
  const urlControlRef = useRef(null);

  const cargarResumen = useCallback(async () => {
    try {
      const datos = await obtenerResumenDataset();
      if (montadoRef.current) setResumen(datos);
    } catch (e) {
      if (montadoRef.current) setError(`No se pudo leer el resumen: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    cargarResumen();
    return () => {
      montadoRef.current = false;
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      if (urlControlRef.current) URL.revokeObjectURL(urlControlRef.current);
    };
  }, [cargarResumen]);

  function reemplazarControl(url) {
    if (urlControlRef.current) URL.revokeObjectURL(urlControlRef.current);
    urlControlRef.current = url;
    setUrlControl(url);
  }

  const esVacia = clase === CLASE_VACIA;
  const ocupado = cuenta !== null || guardando || descargando;

  // Vista previa EN VIVO de lo que se guardaría (video del backend).
  const usaAuto = automatico && !esVacia;
  const { url: urlVista, datos: deteccion, error: errorVista } = useFlujoVivo({
    modo: 'vista',
    camara: camarasDeCaptura.length > 1 ? 'todas' : 'principal',
    casillas: esVacia || usaAuto ? [] : casillas,
    auto: usaAuto ? (clase.startsWith('white') ? 'blanca' : 'negra') : '',
    activo: true,
  });
  // Detección automática: el backend informa [[casilla, estado, confianza]] por cuadro; se guardan los últimos para exigir que sea estable.
  const detectada = deteccion?.[0] ?? null;
  const porCamaraDetectada = detectada?.[3] ?? null; // {camara: casilla que ve esa cámara}
  useEffect(() => {
    if (!usaAuto || !deteccion) {
      deteccionesRef.current = [];
      return;
    }
    deteccionesRef.current = [...deteccionesRef.current, deteccion[0]].slice(-6);
  }, [deteccion, usaAuto]);

  /** La casilla detectada, solo si es estable entre los últimos cuadros (mayoría, ignorando algún cuadro dudoso); si no, qué pasa. */
  function casillaDetectadaEstable() {
    const ultimas = deteccionesRef.current;
    if (ultimas.length < 4) return { error: 'Todavía no hay una detección estable: esperá un segundo y probá de nuevo.' };
    const oks = ultimas.filter((d) => d[1] === 'ok');
    if (oks.length >= 3) {
      const cuentas = {};
      oks.forEach((d) => {
        cuentas[d[0]] = (cuentas[d[0]] ?? 0) + 1;
      });
      const [casilla, veces] = Object.entries(cuentas).sort((x, y) => y[1] - x[1])[0];
      if (veces >= 0.7 * oks.length) return { casilla };
      return { error: 'La detección cambia de casilla entre cuadros: sacá la mano y esperá un segundo.' };
    }
    if (ultimas.filter((d) => d[1] === 'ambigua').length >= 3) {
      return { error: 'Veo más de una pieza o una sola muy inclinada: dejá una sola pieza en el tablero.' };
    }
    if (ultimas.filter((d) => d[1] === 'ninguna').length >= 3) return { error: 'No veo ninguna pieza de ese color en el tablero.' };
    return { error: 'La detección no es estable: sacá la mano y esperá un segundo.' };
  }

  /** Un toque elige esa casilla (reemplaza a la anterior); con «varias casillas» activado, cada toque marca o desmarca. */
  function alternarCasilla(casilla) {
    setCasillas((actuales) => {
      if (!varias) return [casilla];
      return actuales.includes(casilla) ? actuales.filter((c) => c !== casilla) : [...actuales, casilla];
    });
  }

  async function guardar(posicionCompleta = false) {
    let piezasUsadas = esVacia ? [] : casillas;
    if (usaAuto && !posicionCompleta) {
      const { casilla, error: motivo } = casillaDetectadaEstable();
      if (!casilla) {
        setError(motivo);
        return;
      }
      piezasUsadas = [casilla];
    }
    setGuardando(true);
    setError(null);
    try {
      // Posición completa: las 64 casillas salen etiquetadas con el FEN (incluidas las vacías y las vecinas de cada pieza).
      const respuesta = posicionCompleta
        ? await guardarFotoDataset(fenCompleto.trim(), false)
        : await guardarFotoDataset(fenConPieza(clase, piezasUsadas), !esVacia);
      if (!montadoRef.current) return;
      setCapturas((p) => [...p, { ids: respuesta.capturas?.length ? respuesta.capturas : [respuesta.captura_id], clase: posicionCompleta ? 'posición completa' : clase, casillas: piezasUsadas, guardadas: respuesta.guardadas }]);
      const camaras = (respuesta.camaras?.length ?? 1) > 1 ? ` con las cámaras ${respuesta.camaras.join(' y ')}` : '';
      const avisos = respuesta.avisos?.length ? ` Aviso: ${respuesta.avisos.join(' ')}` : '';
      setMensaje(
        (posicionCompleta
          ? `Guardadas ${respuesta.guardadas} casillas de la posición completa${camaras}.`
          : `Guardadas ${respuesta.guardadas} foto(s) de «${nombreClase(clase)}»${camaras}.`) + avisos
      );
      if (!posicionCompleta && avanzar && piezasUsadas.length === 1) setCasillas([casillaSiguiente(piezasUsadas[0])]);
      try {
        reemplazarControl(await obtenerUrlControlDataset());
      } catch (e) {
        if (montadoRef.current) setError(`Se guardó, pero no se pudo mostrar la imagen de control: ${e.message}`);
      }
      await cargarResumen();
    } catch (e) {
      if (montadoRef.current) setError(mensajeError(e));
    } finally {
      if (montadoRef.current) setGuardando(false);
    }
  }

  function capturar(posicionCompleta = false) {
    if (posicionCompleta && !FEN_PIEZAS_VALIDO.test(fenCompleto.trim())) {
      setError('El FEN no es válido: pegá solo las 8 filas de piezas, ej. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR.');
      return;
    }
    if (!posicionCompleta && !esVacia && !usaAuto && casillas.length === 0) {
      setError('Elegí en qué casilla pusiste la pieza.');
      return;
    }
    setError(null);
    setMensaje(null);
    let restante = CUENTA_REGRESIVA_S;
    setCuenta(restante);
    function tic() {
      restante -= 1;
      if (!montadoRef.current) return;
      if (restante > 0) {
        setCuenta(restante);
        temporizadorRef.current = setTimeout(tic, 1000);
      } else {
        setCuenta(null);
        guardar(posicionCompleta);
      }
    }
    temporizadorRef.current = setTimeout(tic, 1000);
  }

  async function deshacer() {
    const ultima = capturas[capturas.length - 1];
    if (!ultima) return;
    setGuardando(true);
    setError(null);
    try {
      for (const id of ultima.ids) await borrarCapturaDataset(id);
      if (!montadoRef.current) return;
      setCapturas((p) => p.slice(0, -1));
      setMensaje(`Se borró la última captura de «${nombreClase(ultima.clase)}».`);
      await cargarResumen();
    } catch (e) {
      if (montadoRef.current) setError(`No se pudo borrar la captura: ${e.message}`);
    } finally {
      if (montadoRef.current) setGuardando(false);
    }
  }

  function girarTablero(grados) {
    setGiro(grados);
    try {
      localStorage.setItem('piezas_giro_tablero', String(grados));
    } catch {
      /* sin almacenamiento: no se recuerda el giro */
    }
  }

  async function borrarClase() {
    setGuardando(true);
    setError(null);
    setConfirmandoBorrado(false);
    try {
      const { borradas } = await borrarClaseDataset(clase);
      if (!montadoRef.current) return;
      setCapturas((p) => p.filter((c) => c.clase !== clase));
      setMensaje(`Se borraron ${borradas} foto(s) de «${nombreClase(clase)}». Podés empezar de cero con esa pieza.`);
      await cargarResumen();
    } catch (e) {
      if (montadoRef.current) setError(`No se pudieron borrar las fotos: ${e.message}`);
    } finally {
      if (montadoRef.current) setGuardando(false);
    }
  }

  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      const { blob, nombre } = await descargarDatasetPiezas();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (montadoRef.current) setError(e.status === 404 ? 'Todavía no hay fotos para descargar.' : e.message);
    } finally {
      if (montadoRef.current) setDescargando(false);
    }
  }

  function botonClase(c) {
    const cantidad = resumen?.por_clase?.[c] ?? 0;
    const completa = cantidad >= META_POR_CLASE;
    const activa = clase === c;
    return (
      <button
        key={c}
        type="button"
        onClick={() => {
          setClase(c);
          setConfirmandoBorrado(false);
        }}
        aria-pressed={activa}
        className={`min-h-[44px] px-space-xs rounded-xl border font-body-sm text-body-sm flex flex-col items-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          activa ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-high'
        }`}
      >
        <span className="truncate w-full">{nombreClase(c)}</span>
        <span className="font-mono-micro text-mono-micro">
          {cantidad}/{META_POR_CLASE} {completa ? '✓' : ''}
        </span>
      </button>
    );
  }

  const total = resumen?.total ?? 0;

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Poné una pieza en el tablero físico, elegí abajo qué pieza es (tipo y color) y en qué casilla está, y sacá la foto.
        Cada captura guarda el recorte de esa casilla ya etiquetado. Movela de casilla entre foto y foto (casillas claras y
        oscuras, distinta luz) para que el modelo generalice. Requiere el tablero calibrado.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <section className={CLASE_TARJETA} aria-labelledby="titulo-clase">
          <h3 id="titulo-clase" className="font-body-md text-body-md text-on-surface font-medium">
            1 · ¿Qué pieza es?
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Blancas</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">{CLASES_BLANCAS.map(botonClase)}</div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Negras</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">{CLASES_NEGRAS.map(botonClase)}</div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Sin pieza</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">{botonClase(CLASE_VACIA)}</div>
        </section>

        <section className={CLASE_TARJETA} aria-labelledby="titulo-casilla">
          <h3 id="titulo-casilla" className="font-body-md text-body-md text-on-surface font-medium">
            2 · ¿En qué casilla está?
          </h3>
          {!esVacia && (
            <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
              <input type="checkbox" className="w-5 h-5 accent-primary" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
              Detectar la casilla automáticamente
            </label>
          )}
          {usaAuto ? (
            <p className="font-body-sm text-body-sm text-on-surface m-0" role="status" aria-live="polite">
              {detectada?.[1] === 'ok'
                ? <>Detecto la pieza en <strong>{detectada[0]}</strong>{camarasDeCaptura.length > 1 ? ' (decisión entre las dos cámaras)' : ''}. Si es correcto, tocá «Capturar».</>
                : detectada?.[1] === 'ambigua'
                  ? 'Veo más de una pieza (o una muy inclinada): dejá una sola pieza en el tablero.'
                  : detectada?.[1] === 'ninguna'
                    ? 'No veo ninguna pieza distinta del tablero vacío guardado. Si la cámara o la luz cambiaron desde que sacaste «Casilla vacía», volvé a sacarla (con el tablero sin piezas) y probá de nuevo.'
                    : errorVista
                      ? `El reconocimiento avisa: ${errorVista}.`
                      : `Poné una pieza ${clase.startsWith('white') ? 'blanca' : 'negra'} en cualquier casilla del tablero.`}
              {' '}Solo una pieza a la vez en el tablero.
              {porCamaraDetectada && new Set(Object.values(porCamaraDetectada).filter(Boolean)).size > 1 && (
                <span className="text-error">
                  {' '}Las cámaras no coinciden: {Object.entries(porCamaraDetectada).map(([c, q]) => `${c} ve ${q || 'nada'}`).join(', ')}.
                </span>
              )}
            </p>
          ) : esVacia ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
              Con «Casilla vacía» el tablero debe estar sin piezas: se guardan las 64 casillas como vacías.
            </p>
          ) : (
            <>
              <div
                className="grid grid-cols-8 w-full max-w-sm mx-auto border border-outline-variant"
                role="group"
                aria-label="Elegí la casilla del tablero donde pusiste la pieza"
              >
                {celdasTablero(giro).map(({ casilla, oscura }) => {
                  const elegida = casillas.includes(casilla);
                  return (
                    <button
                      key={casilla}
                      type="button"
                      onClick={() => alternarCasilla(casilla)}
                      aria-pressed={elegida}
                      aria-label={casilla}
                      className={`aspect-square text-[10px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        elegida
                          ? 'bg-primary text-on-primary font-bold'
                          : oscura
                            ? 'bg-surface-container-highest text-on-surface-variant'
                            : 'bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      {elegida ? '●' : casilla}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-space-xs">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Orientación del tablero:</span>
                {[0, 90, 180, 270].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={giro === g ? CLASE_BOTON_PRIMARIO : CLASE_BOTON}
                    aria-pressed={giro === g}
                    onClick={() => girarTablero(g)}
                  >
                    {g}°
                  </button>
                ))}
              </div>
              <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={avanzar}
                  onChange={(e) => setAvanzar(e.target.checked)}
                />
                Pasar a la casilla siguiente después de cada foto
              </label>
              <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
                Tocá la casilla donde pusiste la pieza «{nombreClase(clase)}». Marcada: {casillas.length ? casillas.join(', ') : 'ninguna'}.
              </p>
              <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-primary"
                  checked={varias}
                  onChange={(e) => {
                    setVarias(e.target.checked);
                    if (!e.target.checked) setCasillas((c) => c.slice(0, 1));
                  }}
                />
                Marcar varias casillas a la vez (la misma pieza en varias casillas)
              </label>
            </>
          )}
        </section>
      </div>

      <section className={CLASE_TARJETA} aria-labelledby="titulo-capturar">
        <h3 id="titulo-capturar" className="font-body-md text-body-md text-on-surface font-medium">
          3 · Vista previa y foto
        </h3>
        <ModoCamaras />
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">
          {camarasDeCaptura.length > 1
            ? 'Cada captura guarda las fotos de las DOS cámaras a la vez (las dos se ven abajo, lado a lado).'
            : tieneSecundaria
              ? 'Hay una cámara secundaria pero todavía no está calibrada: por ahora se captura solo con la principal.'
              : 'Se captura con la cámara principal. Con una cámara secundaria calibrada se captura con las dos a la vez.'}
        </p>
        <figure className="flex flex-col gap-space-xs m-0">
          <div className="w-full max-w-md bg-surface-container rounded-lg overflow-hidden flex items-center justify-center min-h-[8rem]">
            {urlVista ? (
              <img
                src={urlVista}
                alt="Vista previa en vivo: el tablero con las casillas elegidas en verde y, abajo, el recorte exacto que se va a guardar"
                className="w-full h-auto"
              />
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant p-space-md text-center">
                {errorVista ?? 'Esperando la vista previa…'}
              </span>
            )}
          </div>
          <figcaption className="font-body-sm text-body-sm text-on-surface-variant">
            En vivo. El cuadro verde marca la casilla elegida. Abajo, para cada una: el recorte justo que se guarda y el «ampliado», con margen para que entre la pieza completa (con el que se entrena el modelo de piezas).
            {errorVista && urlVista ? ` (${errorVista})` : ''}
          </figcaption>
        </figure>
        <div className="flex flex-wrap gap-space-xs">
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => capturar(false)} disabled={ocupado}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              {guardando ? 'Guardando…' : `Capturar «${nombreClase(clase)}»`}
            </span>
          </button>
          <button type="button" className={CLASE_BOTON} onClick={deshacer} disabled={ocupado || capturas.length === 0}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">undo</span>Deshacer última
            </span>
          </button>
          {!confirmandoBorrado ? (
            <button
              type="button"
              className={CLASE_BOTON}
              onClick={() => setConfirmandoBorrado(true)}
              disabled={ocupado || (resumen?.por_clase?.[clase] ?? 0) === 0}
            >
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                Borrar todas las fotos de «{nombreClase(clase)}»
              </span>
            </button>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-space-xs">
              <span className="font-body-sm text-body-sm text-error">
                ¿Borrar las {resumen?.por_clase?.[clase] ?? 0} fotos de «{nombreClase(clase)}»? No se puede deshacer.
              </span>
              <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={borrarClase} disabled={ocupado}>
                Sí, borrar
              </button>
              <button type="button" className={CLASE_BOTON} onClick={() => setConfirmandoBorrado(false)}>
                Cancelar
              </button>
            </span>
          )}
        </div>
        <div aria-live="polite" className="min-h-[1.5rem]">
          {cuenta !== null && (
            <p className="font-body-md text-body-md text-on-surface m-0">
              Sacá la mano del tablero. Foto en <strong className="text-primary">{cuenta}</strong>…
            </p>
          )}
          {mensaje && cuenta === null && <p className="font-body-sm text-body-sm text-on-surface-variant m-0">{mensaje}</p>}
        </div>
        {error && (
          <p className={CLASE_AVISO} role="alert">
            {error}
          </p>
        )}
        {urlControl && (
          <figure className="flex flex-col gap-space-xs m-0">
            <img
              src={urlControl}
              alt="Imagen de control: el tablero enderezado con la grilla 8x8"
              className="w-full max-w-md h-auto rounded-lg border border-outline-variant"
            />
            <figcaption className="font-body-sm text-body-sm text-on-surface-variant">
              Revisá que la grilla calce con las casillas y que la pieza esté donde dijiste; si no, tocá «Deshacer última».
            </figcaption>
          </figure>
        )}
      </section>

      <section className={CLASE_TARJETA} aria-labelledby="titulo-completa">
        <h3 id="titulo-completa" className="font-body-md text-body-md text-on-surface font-medium">
          Posición completa (todas las piezas a la vez)
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
          Es lo que más mejora el reconocimiento: con el tablero lleno, cada casilla se guarda tal como la ve la cámara, con las piezas
          vecinas que se le inclinan encima. Armá en el tablero físico <strong>exactamente</strong> la posición de abajo (la inicial por
          defecto), revisá la vista previa y capturá. Después mové piezas o cambiá la luz y repetí varias veces.
        </p>
        <input
          className="min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-mono-micro text-mono-micro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          value={fenCompleto}
          onChange={(e) => setFenCompleto(e.target.value)}
          spellCheck="false"
          aria-label="FEN de piezas de la posición armada en el tablero"
        />
        <div className="flex flex-wrap gap-space-xs">
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => capturar(true)} disabled={ocupado}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              Capturar posición completa
            </span>
          </button>
          <button type="button" className={CLASE_BOTON} onClick={() => setFenCompleto(FEN_INICIAL)} disabled={ocupado}>
            Posición inicial
          </button>
          <button type="button" className={CLASE_BOTON} onClick={deshacer} disabled={ocupado || capturas.length === 0}>
            Deshacer última
          </button>
        </div>
      </section>

      <section className={CLASE_TARJETA} aria-labelledby="titulo-dataset">
        <h3 id="titulo-dataset" className="font-body-md text-body-md text-on-surface font-medium">
          4 · Llevar el dataset a Colab
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface m-0">
          <strong>{total}</strong> fotos guardadas. Meta sugerida: {META_POR_CLASE} por clase (con menos de ~50 el modelo suele confundir piezas parecidas, y más de 150 de una sola clase aporta poco si son casi iguales: conviene variar casilla, luz y ángulo).
        </p>
        <div>
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={descargar} disabled={ocupado || total === 0}>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">download</span>
              {descargando ? 'Preparando…' : 'Descargar ZIP para Colab'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
