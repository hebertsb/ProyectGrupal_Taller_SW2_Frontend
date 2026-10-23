import { useEffect, useMemo, useState } from 'react';
import { quitarImagenMedalla, subirImagenMedalla } from '../../api/backend';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import useMedallas from '../../useMedallas';
import { etiquetaNivel, etiquetaPieza, normalizarNivel, validarImagenMedalla } from '../../medallas';

const BOTON_BASE =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-sm min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_PRINCIPAL = `${BOTON_BASE} bg-primary text-on-primary font-medium`;
const BOTON_SECUNDARIO = `${BOTON_BASE} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
const BOTON_PELIGRO = `${BOTON_BASE} bg-error/10 hover:bg-error/20 text-error`;

function AvisoError({ mensaje }) {
  return (
    <div
      role="alert"
      className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-start gap-space-xs"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        error
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

function AvisoListo({ mensaje }) {
  return (
    <div
      role="status"
      className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-start gap-space-xs"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        check_circle
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

/**
 * Una medalla del catálogo con su figurita actual (la subida o la de fábrica) y los botones para cambiarla. Maneja su
 * propia selección de archivo y vista previa (`URL.createObjectURL`, liberada al cancelar, confirmar o desmontar):
 * antes de subir se ve cómo queda la figurita, porque el cambio le llega a TODOS los jugadores. La subida y el borrado
 * reales y su resultado (éxito o el error del backend) los maneja el padre.
 */
function TarjetaFiguritaMedalla({ medalla, estado, alSubir, alQuitar }) {
  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const subiendo = estado?.subiendo === true;
  const quitando = estado?.quitando === true;
  const ocupado = subiendo || quitando;
  const tieneImagen = Boolean(medalla.imagen_url);
  const nivel = normalizarNivel(medalla.nivel);

  function manejarSeleccion(evento) {
    const elegido = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!elegido) return;
    setConfirmandoQuitar(false);
    const problema = validarImagenMedalla(elegido);
    if (problema) {
      setErrorArchivo(problema);
      return;
    }
    setErrorArchivo(null);
    setArchivo(elegido);
    setPreviewUrl(URL.createObjectURL(elegido));
  }

  function cancelar() {
    setArchivo(null);
    setPreviewUrl(null);
    setErrorArchivo(null);
  }

  async function confirmar() {
    if (!archivo) return;
    const hecho = await alSubir(medalla.codigo, archivo);
    if (hecho) {
      setArchivo(null);
      setPreviewUrl(null);
    }
  }

  async function quitar() {
    const hecho = await alQuitar(medalla.codigo);
    if (hecho) setConfirmandoQuitar(false);
  }

  const figurita = previewUrl ? { ...medalla, imagen_url: previewUrl } : medalla;

  return (
    <li className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container min-w-0">
      <div className="flex items-start gap-space-sm min-w-0">
        <MedallaFigurita medalla={figurita} tamano="md" vistaPrevia />
        <div className="flex flex-col gap-space-2xs min-w-0">
          <h3 className="m-0 font-body-sm text-body-sm font-semibold text-on-surface break-words">{medalla.nombre}</h3>
          <span className="font-mono-micro text-mono-micro uppercase tracking-wide text-on-surface-variant">
            {etiquetaNivel(nivel)} · {etiquetaPieza(medalla.pieza)}
          </span>
          <span
            className={`self-start flex items-center gap-1 px-space-xs py-space-2xs rounded-full font-mono-micro text-mono-micro uppercase tracking-wide font-medium ${
              tieneImagen
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              {tieneImagen ? 'image' : 'palette'}
            </span>
            {tieneImagen ? 'Imagen subida' : 'De fábrica'}
          </span>
        </div>
      </div>

      {previewUrl && (
        <p className="m-0 font-mono-micro text-mono-micro text-primary-fixed-dim">
          Vista previa, todavía sin guardar. Confirmá para {tieneImagen ? 'reemplazar la imagen' : 'usar esta imagen'}: la ven
          todos los jugadores.
        </p>
      )}

      {errorArchivo && <AvisoError mensaje={errorArchivo} />}
      {estado?.error && <AvisoError mensaje={estado.error} />}
      {estado?.exito && !previewUrl && <AvisoListo mensaje="Listo, todos los jugadores ya ven esta figurita." />}
      {estado?.quitado && !previewUrl && !confirmandoQuitar && (
        <AvisoListo mensaje="Volvió la figurita de fábrica." />
      )}

      <div className="flex flex-wrap gap-space-xs">
        {!previewUrl ? (
          <>
            <label
              className={`${BOTON_SECUNDARIO} cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
                ocupado ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                upload
              </span>
              {tieneImagen ? 'Reemplazar imagen' : 'Subir imagen'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={manejarSeleccion}
                disabled={ocupado}
                aria-label={`${tieneImagen ? 'Elegir imagen de reemplazo' : 'Elegir imagen'} para la medalla ${medalla.nombre}`}
              />
            </label>
            {tieneImagen && (
              <button
                type="button"
                onClick={() => setConfirmandoQuitar((actual) => !actual)}
                disabled={ocupado}
                aria-expanded={confirmandoQuitar}
                className={BOTON_PELIGRO}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  undo
                </span>
                Volver a la de fábrica
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={confirmar} disabled={subiendo} className={BOTON_PRINCIPAL}>
              {subiendo && (
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
              )}
              {subiendo ? 'Subiendo…' : 'Confirmar imagen'}
            </button>
            <button type="button" onClick={cancelar} disabled={subiendo} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
          </>
        )}
      </div>

      {tieneImagen && confirmandoQuitar && !previewUrl && (
        <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
          <p className="m-0 font-body-sm text-body-sm text-on-surface">
            Todos los jugadores van a volver a ver la figurita de fábrica de esta medalla. La imagen subida se borra.
          </p>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" onClick={quitar} disabled={quitando} className={BOTON_PELIGRO}>
              {quitando ? 'Quitando…' : 'Sí, volver a la de fábrica'}
            </button>
            <button type="button" onClick={() => setConfirmandoQuitar(false)} disabled={quitando} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * "Figuritas de las medallas": solo para el facilitador PRINCIPAL (el padre no la monta para nadie más). Lista el
 * catálogo completo (`GET /usuario/medallas` devuelve todas a un facilitador) con la figurita que se ve hoy, y deja subir
 * una imagen propia por medalla o volver a la de fábrica. El error del backend se muestra tal cual y la figurita se
 * actualiza apenas termina la subida (la URL nueva trae `?v=`, así que el navegador no usa la vieja).
 */
export default function FiguritasMedallas() {
  const { datos, cargando, error, recargar } = useMedallas({ pedirAviso: false });
  // Cambios hechos desde esta pantalla (código -> url nueva o `null`), por encima de lo último que mandó el backend.
  const [imagenes, setImagenes] = useState({});
  // Resultado de la última acción de cada medalla: `{subiendo, quitando, error, exito, quitado}`.
  const [estados, setEstados] = useState({});

  const catalogo = useMemo(
    () =>
      (Array.isArray(datos?.medallas) ? datos.medallas : []).map((medalla) =>
        medalla.codigo in imagenes ? { ...medalla, imagen_url: imagenes[medalla.codigo] } : medalla
      ),
    [datos, imagenes]
  );

  async function subir(codigo, archivo) {
    setEstados((actual) => ({ ...actual, [codigo]: { subiendo: true } }));
    try {
      const resultado = await subirImagenMedalla(codigo, archivo);
      setImagenes((actual) => ({ ...actual, [codigo]: resultado?.imagen_url ?? null }));
      setEstados((actual) => ({ ...actual, [codigo]: { exito: true } }));
      return true;
    } catch (err) {
      setEstados((actual) => ({ ...actual, [codigo]: { error: err?.message || 'No se pudo subir la imagen.' } }));
      return false;
    }
  }

  /** Borra la imagen subida. Devuelve `true` si se borró. Muestra el error del backend tal cual. */
  async function quitar(codigo) {
    setEstados((actual) => ({ ...actual, [codigo]: { quitando: true } }));
    try {
      await quitarImagenMedalla(codigo);
      setImagenes((actual) => ({ ...actual, [codigo]: null }));
      setEstados((actual) => ({ ...actual, [codigo]: { quitado: true } }));
      return true;
    } catch (err) {
      // 404: ya no tenía imagen subida, así que la pantalla se pone al día igual.
      if (err?.status === 404) setImagenes((actual) => ({ ...actual, [codigo]: null }));
      setEstados((actual) => ({ ...actual, [codigo]: { error: err?.message || 'No se pudo volver a la figurita de fábrica.' } }));
      return false;
    }
  }

  return (
    <section
      aria-labelledby="titulo-figuritas-medallas"
      className="flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            collections_bookmark
          </span>
          <h2 id="titulo-figuritas-medallas" className="m-0 font-headline-sm text-headline-sm text-on-surface">
            Figuritas de las medallas
          </h2>
        </div>
        <span className="flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-mono-micro text-mono-micro uppercase tracking-wide">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            admin_panel_settings
          </span>
          Solo la ve el facilitador principal
        </span>
      </div>

      <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container border border-outline-variant/30">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5" aria-hidden="true">
          info
        </span>
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Subí solo la ilustración del centro: el escudo, su color y su brillo los pone el sistema según el nivel y son
          iguales para todas. Imagen cuadrada de 512×512 px, PNG con fondo transparente, dibujo centrado y sin marco ni
          texto. Máx. 2 MB. Reemplaza la silueta de la pieza para todos los jugadores.
        </p>
      </div>

      {cargando && !datos && (
        <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Buscando las medallas…</span>
        </div>
      )}

      {error && !datos && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={error.message || 'No se pudieron cargar las medallas.'} />
          <button type="button" onClick={recargar} disabled={cargando} className={`${BOTON_SECUNDARIO} self-start`}>
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {datos && catalogo.length === 0 && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay medallas en el catálogo.</p>
      )}

      {catalogo.length > 0 && (
        <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {catalogo.map((medalla) => (
            <TarjetaFiguritaMedalla
              key={medalla.codigo}
              medalla={medalla}
              estado={estados[medalla.codigo]}
              alSubir={subir}
              alQuitar={quitar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
