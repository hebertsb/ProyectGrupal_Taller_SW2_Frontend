import { useEffect, useRef, useState } from 'react';
import { subirFotosPieza } from '../../api/backend';
import { reducirImagen } from '../../imagen';

const MAX_FOTOS = 20;
const MAX_BYTES = 10 * 1024 * 1024;

const CLASE_TARJETA =
  'w-full min-w-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col gap-space-sm';
const CLASE_BOTON =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_BOTON_PRIMARIO =
  'min-h-[44px] px-space-md py-space-xs rounded-xl font-body-sm text-body-sm bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CLASE_AVISO =
  'aviso font-body-sm text-body-sm bg-error-container text-on-error-container rounded-lg p-space-xs break-words';

const PIEZAS = {
  pawn: ['Peón', 'm'],
  knight: ['Caballo', 'm'],
  bishop: ['Alfil', 'm'],
  rook: ['Torre', 'f'],
  queen: ['Dama', 'f'],
  king: ['Rey', 'm'],
};

/** Nombre legible en español de una clase del dataset (white-pawn -> "Peón blanco"). */
export function nombreClase(clase) {
  if (clase === 'vacia') return 'Casilla vacía';
  const [color, pieza] = clase.split('-');
  const datos = PIEZAS[pieza];
  if (!datos || (color !== 'white' && color !== 'black')) return clase;
  const [nombre, genero] = datos;
  const adjetivo = color === 'white' ? 'blanc' : 'negr';
  return `${nombre} ${adjetivo}${genero === 'f' ? 'a' : 'o'}`;
}

/** Mensaje en español para un error al subir fotos. */
function mensajeErrorSubida(error) {
  if (error.status === 413) return 'Alguna foto es demasiado grande (máximo 10 MB por foto).';
  if (error.status === 422) return `No se pudieron usar las fotos: ${error.message}.`;
  return error.message;
}

/**
 * Sube a mano fotos de una sola pieza a su clase del dataset (galería o cámara del celular).
 * `porClase` son los contadores actuales; `onSubido` refresca el resumen del padre.
 */
export default function SubirFotosPieza({ porClase, minimoPorClase, onSubido }) {
  const [clase, setClase] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const urlsRef = useRef([]);
  const idRef = useRef(0);
  const montadoRef = useRef(true);
  const entradaRef = useRef(null);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const clases = Object.entries(porClase ?? {});

  function agregarFotos(evento) {
    const archivos = Array.from(evento.target.files ?? []);
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return;
    setMensaje(null);
    const validas = archivos.filter((a) => a.type.startsWith('image/'));
    const grandes = validas.filter((a) => a.size > MAX_BYTES);
    const aceptadas = validas.filter((a) => a.size <= MAX_BYTES);
    const lugar = MAX_FOTOS - fotos.length;
    const nuevas = aceptadas.slice(0, Math.max(lugar, 0)).map((archivo) => {
      const url = URL.createObjectURL(archivo);
      urlsRef.current.push(url);
      idRef.current += 1;
      return { id: idRef.current, archivo, url };
    });
    const avisos = [];
    if (validas.length < archivos.length) avisos.push('Se ignoraron archivos que no son imágenes.');
    if (grandes.length > 0) avisos.push(`${grandes.length} foto(s) superan los 10 MB y no se agregaron.`);
    if (aceptadas.length > nuevas.length) avisos.push(`Máximo ${MAX_FOTOS} fotos por subida.`);
    setError(avisos.length > 0 ? avisos.join(' ') : null);
    setFotos((actuales) => [...actuales, ...nuevas]);
  }

  function quitar(id) {
    setFotos((actuales) => {
      const foto = actuales.find((f) => f.id === id);
      if (foto) {
        URL.revokeObjectURL(foto.url);
        urlsRef.current = urlsRef.current.filter((u) => u !== foto.url);
      }
      return actuales.filter((f) => f.id !== id);
    });
  }

  function limpiar() {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    setFotos([]);
  }

  async function subir() {
    if (!clase || fotos.length === 0) return;
    setSubiendo(true);
    setError(null);
    setMensaje(null);
    try {
      const reducidas = await Promise.all(fotos.map((f) => reducirImagen(f.archivo)));
      const respuesta = await subirFotosPieza(clase, reducidas);
      if (!montadoRef.current) return;
      limpiar();
      setMensaje(
        `Se guardaron ${respuesta.guardadas} fotos de ${nombreClase(clase)}. Ya hay ${respuesta.total_clase} en esa clase.`,
      );
      await onSubido?.();
    } catch (e) {
      if (montadoRef.current) setError(mensajeErrorSubida(e));
    } finally {
      if (montadoRef.current) setSubiendo(false);
    }
  }

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-subir-pieza">
      <h3 id="titulo-subir-pieza" className="font-body-md text-body-md text-on-surface font-medium">
        Subir fotos por pieza
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Cada foto debe mostrar UNA sola pieza, vista desde arriba, centrada en su casilla, con luz parecida a la de
        la cámara fija.
      </p>

      <div role="radiogroup" aria-label="Clase de la pieza" className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
        {clases.map(([clave, cantidad]) => {
          const pocas = cantidad < minimoPorClase;
          const elegida = clave === clase;
          return (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={elegida}
              onClick={() => setClase(clave)}
              disabled={subiendo}
              className={`min-h-[44px] min-w-0 flex flex-col items-start justify-center sm:flex-row sm:items-center sm:justify-between gap-0 sm:gap-1 rounded-lg px-space-xs py-1 font-body-sm text-body-sm text-left disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                elegida
                  ? 'border-2 border-primary bg-primary-container text-on-surface font-medium'
                  : pocas
                    ? 'border-2 border-dashed border-error text-error bg-surface-container'
                    : 'border border-outline-variant text-on-surface bg-surface-container'
              }`}
            >
              <span className="min-w-0 break-words">
                {elegida && <span className="material-symbols-outlined text-[14px] align-middle" aria-hidden="true">check</span>}{' '}
                {nombreClase(clave)}
              </span>
              <span className="shrink-0">
                {pocas && <span className="material-symbols-outlined text-[14px] align-middle" aria-hidden="true">warning</span>}{' '}
                <strong>{cantidad}</strong>
                {pocas && <span className="sr-only"> (pocas fotos)</span>}
              </span>
            </button>
          );
        })}
      </div>
      {clases.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Cargando las clases…</p>
      )}

      <div className="flex flex-col gap-space-xs">
        <label htmlFor="subir-pieza-archivos" className="font-body-sm text-body-sm text-on-surface">
          Fotos de {clase ? <strong>{nombreClase(clase)}</strong> : 'la clase elegida'} (galería o cámara)
        </label>
        <input
          id="subir-pieza-archivos"
          ref={entradaRef}
          type="file"
          accept="image/*"
          multiple
          onChange={agregarFotos}
          disabled={!clase || subiendo}
          className="min-h-[44px] w-full min-w-0 font-body-sm text-body-sm text-on-surface disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        {!clase && <p className="font-body-sm text-body-sm text-on-surface-variant">Elegí primero una clase.</p>}
      </div>

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-space-xs list-none p-0 m-0">
          {fotos.map((foto, i) => (
            <li key={foto.id} className="relative min-w-0">
              <img
                src={foto.url}
                alt={`Foto ${i + 1} de ${nombreClase(clase)}`}
                className="w-full aspect-square object-cover rounded-lg border border-outline-variant"
              />
              <button
                type="button"
                onClick={() => quitar(foto.id)}
                disabled={subiendo}
                aria-label={`Quitar la foto ${i + 1}`}
                className="absolute top-1 right-1 min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[18px] bg-surface text-on-surface rounded-full border border-outline-variant p-0.5">
                  close
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          onClick={subir}
          disabled={!clase || fotos.length === 0 || subiendo}
        >
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            {subiendo ? 'Subiendo…' : `Subir ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`}
          </span>
        </button>
        {fotos.length > 0 && (
          <button type="button" className={CLASE_BOTON} onClick={limpiar} disabled={subiendo}>
            Quitar todas
          </button>
        )}
      </div>

      <div aria-live="polite">
        {mensaje && <p className="font-body-sm text-body-sm text-on-surface-variant">{mensaje}</p>}
      </div>
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
