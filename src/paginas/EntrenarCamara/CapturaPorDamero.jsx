import { useCallback, useEffect, useRef, useState } from 'react';
import { borrarCapturaDataset, guardarFotoDataset, obtenerUrlControlDataset } from '../../api/backend';
import { fenSoloPieza, letraFenDeClase, nombreCasilla, rutaImagenPieza } from '../../ajedrez';

const CUENTA_REGRESIVA_S = 3;
const COLUMNAS = 'abcdefgh';

const CLASE_BOTON =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_BOTON_PRIMARIO =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_AVISO =
  'aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words';

/** Mensaje en español para un error al sacar o guardar una foto del dataset. */
function mensajeErrorFoto(error) {
  if (error.status === 503) return 'La cámara no está disponible. Revisá que esté conectada y probá de nuevo.';
  if (error.status === 422) {
    return `No se pudo usar la foto: ${error.message}. Revisá que el tablero esté completo y a la vista, sin la mano encima.`;
  }
  return error.message;
}

/**
 * Damero 8x8 para marcar en qué casillas del tablero real se colocó una pieza de la clase elegida,
 * y guardarlas con la cámara fija sin escribir FEN. `nombre` es el nombre legible de la clase.
 */
export default function CapturaPorDamero({ clase, nombre, onGuardado }) {
  const [marcadas, setMarcadas] = useState([]);
  const [cuenta, setCuenta] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [captura, setCaptura] = useState(null);
  const [urlControl, setUrlControl] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const montadoRef = useRef(true);
  const temporizadorRef = useRef(null);
  const urlRef = useRef(null);

  const letra = letraFenDeClase(clase);

  const reemplazarUrl = useCallback((urlNueva) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = urlNueva;
    setUrlControl(urlNueva);
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  // Al cambiar de clase se empieza de cero.
  useEffect(() => {
    setMarcadas([]);
    setCaptura(null);
    setMensaje(null);
    setError(null);
    reemplazarUrl(null);
  }, [clase, reemplazarUrl]);

  const ocupado = cuenta !== null || guardando || borrando;

  function alternar(casilla) {
    setMarcadas((actuales) =>
      actuales.includes(casilla) ? actuales.filter((c) => c !== casilla) : [...actuales, casilla],
    );
  }

  async function guardar() {
    setGuardando(true);
    try {
      const respuesta = await guardarFotoDataset(fenSoloPieza(letra, marcadas), true);
      if (!montadoRef.current) return;
      setCaptura(respuesta);
      setMensaje(`Se guardaron ${respuesta.guardadas} muestras de ${nombre}`);
      try {
        reemplazarUrl(await obtenerUrlControlDataset());
      } catch (e) {
        if (montadoRef.current) setError(`La foto se guardó, pero no se pudo mostrar la imagen de control: ${e.message}`);
      }
      await onGuardado?.();
    } catch (e) {
      if (montadoRef.current) setError(mensajeErrorFoto(e));
    } finally {
      if (montadoRef.current) setGuardando(false);
    }
  }

  function sacarFoto() {
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
        guardar();
      }
    }
    temporizadorRef.current = setTimeout(tic, 1000);
  }

  async function borrar() {
    if (!captura) return;
    setBorrando(true);
    setError(null);
    try {
      const respuesta = await borrarCapturaDataset(captura.captura_id);
      if (!montadoRef.current) return;
      setMensaje(`Captura borrada (${respuesta.borradas} muestras).`);
      setCaptura(null);
      reemplazarUrl(null);
      await onGuardado?.();
    } catch (e) {
      if (montadoRef.current) setError(`No se pudo borrar la captura: ${e.message}`);
    } finally {
      if (montadoRef.current) setBorrando(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs border-t border-outline-variant pt-space-sm">
      <h4 className="font-body-md text-body-md text-on-surface font-medium">Sacar foto del tablero real</h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Poné {nombre} en el tablero físico y marcá acá las casillas donde la pusiste.
      </p>

      <div
        role="group"
        aria-label={`Casillas donde pusiste ${nombre}`}
        className="grid grid-cols-8 w-full max-w-[420px] mx-auto border border-outline-variant rounded-lg overflow-hidden"
      >
        {Array.from({ length: 64 }, (_, i) => {
          const fila = Math.floor(i / 8);
          const columna = i % 8;
          const casilla = nombreCasilla(fila, columna);
          const marcada = marcadas.includes(casilla);
          const clara = (fila + columna) % 2 === 0;
          return (
            <button
              key={casilla}
              type="button"
              aria-pressed={marcada}
              aria-label={`Casilla ${casilla}${marcada ? ', marcada' : ''}`}
              onClick={() => alternar(casilla)}
              disabled={ocupado}
              className={`relative aspect-square min-w-0 p-0 flex items-center justify-center disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                clara ? 'bg-surface-container-high' : 'bg-surface-container-highest'
              } ${marcada ? 'ring-2 ring-inset ring-primary' : ''}`}
            >
              {fila === 7 && (
                <span className="absolute bottom-0 right-0.5 text-[8px] leading-none text-on-surface-variant" aria-hidden="true">
                  {COLUMNAS[columna]}
                </span>
              )}
              {columna === 0 && (
                <span className="absolute top-0 left-0.5 text-[8px] leading-none text-on-surface-variant" aria-hidden="true">
                  {8 - fila}
                </span>
              )}
              {marcada && (
                <img src={rutaImagenPieza(letra)} alt="" draggable={false} className="w-[80%] h-[80%] object-contain" />
              )}
            </button>
          );
        })}
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {marcadas.length === 0
          ? 'Ninguna casilla marcada.'
          : `${marcadas.length} ${marcadas.length === 1 ? 'casilla marcada' : 'casillas marcadas'}: ${[...marcadas].sort().join(', ')}`}
      </p>

      <div className="flex flex-col sm:flex-row gap-space-xs">
        <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={sacarFoto} disabled={marcadas.length === 0 || ocupado}>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            {guardando ? 'Guardando…' : 'Sacar foto y guardar'}
          </span>
        </button>
        <button type="button" className={CLASE_BOTON} onClick={() => setMarcadas([])} disabled={marcadas.length === 0 || ocupado}>
          Limpiar casillas
        </button>
      </div>

      <div aria-live="polite" className="min-h-[1.5rem]">
        {cuenta !== null && (
          <p className="font-body-md text-body-md text-on-surface">
            Sacá la mano del tablero. Foto en <strong className="text-primary">{cuenta}</strong>…
          </p>
        )}
        {mensaje && cuenta === null && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">{mensaje}</p>
        )}
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
            alt="Imagen de control: el tablero enderezado con la grilla 8x8 encima"
            className="w-full max-w-full h-auto rounded-lg border border-outline-variant"
          />
          <figcaption className="font-body-sm text-body-sm text-on-surface-variant">
            Revisá que la grilla calce con las casillas y que se vean las piezas.
          </figcaption>
        </figure>
      )}
      {captura && (
        <button type="button" className={CLASE_BOTON} onClick={borrar} disabled={ocupado}>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">delete</span>
            {borrando ? 'Borrando…' : 'Borrar esta captura'}
          </span>
        </button>
      )}
    </div>
  );
}
