import { useEffect, useState } from 'react';
import {
  actualizarPerfil,
  listarCursos,
  obtenerPerfil,
  obtenerVideosDeMiCurso,
  obtenerVideosFacilitador,
  quitarVideoPieza,
  subirVideoPieza,
} from '../../api/backend';
import { rutaImagenPieza } from '../../ajedrez';
import InsigniaTonoCurso from '../../componentes/InsigniaTonoCurso';
import { PRESETS_TONO } from '../../tonoTuring';
import FiguritasMedallas from './FiguritasMedallas';

/** 6 piezas — mismo vocabulario que `TIPOS_PIEZA_VALIDOS` en el backend
 * (`backend/servicios/facilitador/servicio_videos.py`). `letra` en
 * mayúscula para `rutaImagenPieza` (siempre el set blanco, ilustrativo). */
const PIEZAS = [
  { tipo: 'rey', nombre: 'Rey', letra: 'K' },
  { tipo: 'dama', nombre: 'Dama', letra: 'Q' },
  { tipo: 'torre', nombre: 'Torre', letra: 'R' },
  { tipo: 'alfil', nombre: 'Alfil', letra: 'B' },
  { tipo: 'caballo', nombre: 'Caballo', letra: 'N' },
  { tipo: 'peon', nombre: 'Peón', letra: 'P' },
];

function mensajeError(err, mensajePorDefecto) {
  if (err?.status === 404 || err?.status === 405) {
    return 'Esta función todavía no está disponible en el servidor. Probá de nuevo en un rato.';
  }
  return err?.message || mensajePorDefecto;
}

function CargandoInline({ texto }) {
  return (
    <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

function AvisoError({ mensaje }) {
  return (
    <div
      role="alert"
      className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-space-xs"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
      <span>{mensaje}</span>
    </div>
  );
}

/**
 * Una tarjeta = una pieza. Maneja su propia selección de archivo y vista
 * previa (con `URL.createObjectURL`, liberada al cancelar/confirmar/desmontar);
 * la subida y el borrado reales y el resultado (éxito/error) los maneja el
 * padre, que es quien sabe qué video quedó guardado para cada pieza.
 *
 * Estado de la pieza: "Video propio" (el facilitador subió uno), "Se usa el
 * video general" (no tiene propio pero hay uno general del facilitador
 * principal, que se muestra para ver qué reemplazaría) o "Sin video". Para el
 * principal su video propio ES el general: sin propio, no hay video.
 */
function TarjetaVideoPieza({ pieza, urlPropio, urlGeneral, esPrincipal, estado, onSubir, onQuitar }) {
  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function manejarSeleccion(evento) {
    const elegido = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!elegido) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setConfirmandoQuitar(false);
    setArchivo(elegido);
    setPreviewUrl(URL.createObjectURL(elegido));
  }

  function cancelar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivo(null);
    setPreviewUrl(null);
  }

  async function confirmar() {
    if (!archivo) return;
    await onSubir(pieza.tipo, archivo);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivo(null);
    setPreviewUrl(null);
  }

  async function quitar() {
    const hecho = await onQuitar(pieza.tipo);
    if (hecho) setConfirmandoQuitar(false);
  }

  const subiendo = estado?.subiendo ?? false;
  const quitando = estado?.quitando ?? false;
  const ocupado = subiendo || quitando;
  // Lo que se ve si el facilitador no tiene video propio: el general (el principal no tiene otro que el suyo).
  const urlGeneralVisible = !urlPropio && !esPrincipal ? urlGeneral : null;
  const etiquetaEstado = urlPropio
    ? esPrincipal
      ? 'Video propio · es el general'
      : 'Video propio'
    : urlGeneralVisible
      ? 'Se usa el video general'
      : 'Sin video';
  const iconoEstado = urlPropio ? 'check_circle' : urlGeneralVisible ? 'public' : 'videocam_off';
  const claseEstado = urlPropio
    ? 'bg-primary-container text-primary'
    : urlGeneralVisible
      ? 'bg-surface-container-high text-on-surface'
      : 'bg-surface-container-lowest text-outline border border-outline-variant/40';
  const mensajeQuitar = esPrincipal
    ? 'Esta pieza va a quedar sin video general: los jugadores no van a ver ningún video de ella.'
    : urlGeneral
      ? 'Tus jugadores van a ver el video general de esta pieza.'
      : 'Esta pieza va a quedar sin video.';

  return (
    <div className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container-low shadow-md min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <div className="flex items-center gap-space-xs">
          <img src={rutaImagenPieza(pieza.letra)} alt="" className="w-7 h-7 shrink-0" draggable="false" />
          <span className="font-headline-sm text-headline-sm text-on-surface">{pieza.nombre}</span>
        </div>
        <span
          className={`flex items-center gap-1 font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${claseEstado}`}
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            {iconoEstado}
          </span>
          {etiquetaEstado}
        </span>
      </div>

      {previewUrl ? (
        <video
          controls
          preload="metadata"
          src={previewUrl}
          className="w-full aspect-video rounded-lg bg-surface-container-lowest"
        />
      ) : urlPropio ? (
        <video
          controls
          preload="metadata"
          src={urlPropio}
          className="w-full aspect-video rounded-lg bg-surface-container-lowest"
        />
      ) : urlGeneralVisible ? (
        <>
          <video
            controls
            preload="metadata"
            src={urlGeneralVisible}
            aria-label={`Video general de ${pieza.nombre.toLowerCase()}`}
            className="w-full aspect-video rounded-lg bg-surface-container-lowest"
          />
          <p className="font-mono-micro text-mono-micro text-on-surface-variant">
            Este es el video general: tus jugadores lo ven hasta que subas el tuyo, y el tuyo lo reemplaza solo en esta
            pieza.
          </p>
        </>
      ) : (
        <div className="w-full aspect-video rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-space-2xs text-center px-space-sm">
          <span className="material-symbols-outlined text-[28px] text-outline" aria-hidden="true">
            videocam
          </span>
          <p className="font-mono-micro text-mono-micro text-on-surface-variant">
            Todavía no hay un video de esta pieza.{' '}
            {esPrincipal ? 'Subí uno y lo ven todos los jugadores.' : 'Subí uno y lo ven los jugadores de tus cursos.'}
          </p>
        </div>
      )}

      {previewUrl && (
        <p className="font-mono-micro text-mono-micro text-primary-fixed-dim">
          Vista previa, todavía sin guardar. Confirmá para {urlPropio ? 'reemplazar tu video' : 'guardarlo'}.
        </p>
      )}

      {estado?.error && <AvisoError mensaje={estado.error} />}
      {estado?.exito && !previewUrl && (
        <div
          role="status"
          className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
            check_circle
          </span>
          <span>
            {esPrincipal
              ? 'Listo, todos los jugadores ya ven este video.'
              : 'Listo, los jugadores de tus cursos ya ven tu video en esta pieza.'}
          </span>
        </div>
      )}
      {estado?.quitado && !previewUrl && !confirmandoQuitar && (
        <div
          role="status"
          className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
            check_circle
          </span>
          <span>Quitaste tu video de esta pieza.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-space-xs pt-space-2xs">
        {!previewUrl ? (
          <>
            <label
              className={`flex items-center gap-space-2xs px-space-md py-space-sm min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm cursor-pointer transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
                ocupado ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                upload
              </span>
              {urlPropio ? 'Reemplazar video' : esPrincipal ? 'Subir video' : 'Subir mi video'}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={manejarSeleccion}
                disabled={ocupado}
                aria-label={`${urlPropio ? 'Elegir video de reemplazo' : 'Elegir video'} para ${pieza.nombre.toLowerCase()}`}
              />
            </label>
            {urlPropio && (
              <button
                type="button"
                onClick={() => setConfirmandoQuitar((v) => !v)}
                disabled={ocupado}
                aria-expanded={confirmandoQuitar}
                className="flex items-center gap-space-2xs px-space-md py-space-sm min-h-10 rounded-lg bg-error/10 hover:bg-error/20 text-error font-body-sm text-body-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  delete
                </span>
                Quitar mi video
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={confirmar}
              disabled={subiendo}
              className="flex items-center gap-space-2xs px-space-md py-space-sm min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {subiendo && (
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
              )}
              {subiendo ? 'Subiendo…' : 'Confirmar video'}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={subiendo}
              className="flex items-center gap-space-2xs px-space-md py-space-sm min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      {urlPropio && confirmandoQuitar && !previewUrl && (
        <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
          <p className="m-0 font-body-sm text-body-sm text-on-surface">{mensajeQuitar}</p>
          <div className="flex flex-wrap gap-space-xs">
            <button
              type="button"
              onClick={quitar}
              disabled={quitando}
              className="flex items-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-error/10 hover:bg-error/20 text-error font-body-sm text-body-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {quitando ? 'Quitando…' : 'Sí, quitar mi video'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoQuitar(false)}
              disabled={quitando}
              className="flex items-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <span className="font-mono-micro text-[10px] text-outline">Formatos aceptados: MP4, WEBM o MOV.</span>
    </div>
  );
}

function TarjetaPreset({ preset, seleccionado, onSeleccionar }) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(preset.id)}
      aria-pressed={seleccionado}
      className={`flex flex-col gap-space-xs p-space-md rounded-xl border text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        seleccionado
          ? 'bg-primary/10 border-primary'
          : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container'
      }`}
    >
      <div className="flex items-center justify-between gap-space-xs">
        <span className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[22px] text-primary shrink-0">{preset.icono}</span>
          <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{preset.titulo}</span>
        </span>
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">
          {seleccionado ? 'check_circle' : 'radio_button_unchecked'}
        </span>
      </div>
      <p className="font-mono-micro text-mono-micro text-on-surface-variant">{preset.descripcion}</p>
      <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 mt-space-2xs">
        <span className="font-mono-micro text-[10px] uppercase tracking-wider text-outline">Así suena</span>
        <p className="font-body-sm text-body-sm text-on-surface italic mt-space-2xs">&ldquo;{preset.ejemplo}&rdquo;</p>
      </div>
    </button>
  );
}

/**
 * Configuración de Enseñanza — pantalla exclusiva del facilitador,
 * contraparte del Panel de Aprendizaje del jugador. Acá el facilitador sube
 * sus propios videos educativos por pieza y elige el tono con el que Turing
 * le explica las jugadas a sus estudiantes (RF, ver auth_esquema.py
 * `preset_ensenanza`).
 *
 * Videos: los del facilitador PRINCIPAL son los generales y los ve todo jugador;
 * el de otro facilitador reemplaza al general solo en esa pieza, para los
 * jugadores de sus cursos (por eso cada pieza dice si tiene "Video propio", si
 * "Se usa el video general" o si está "Sin video"). El tono que se elige acá es el de
 * sus cursos que no tengan uno propio: cada curso puede tener el suyo desde Gestión de
 * Usuarios → Mis cursos (ver PanelCursos.jsx). La pantalla lista sus cursos reales con el
 * tono vigente de cada uno (`preset_efectivo`).
 */
export default function ConfiguracionEnsenanza({ usuario, alActualizarUsuario }) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  // La sesión guardada puede ser anterior a `es_principal`: se relee el perfil del servidor al entrar.
  const [esPrincipal, setEsPrincipal] = useState(usuario?.es_principal === true);
  const [videos, setVideos] = useState({}); // videos PROPIOS del facilitador, por pieza
  const [general, setGeneral] = useState({}); // videos generales (los del facilitador principal), por pieza
  const [cargandoVideos, setCargandoVideos] = useState(true);
  const [errorVideos, setErrorVideos] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [estadoSubida, setEstadoSubida] = useState({});

  const [cursos, setCursos] = useState([]);
  const [cargandoCursos, setCargandoCursos] = useState(true);
  const [errorCursos, setErrorCursos] = useState(null);

  const presetGuardado = usuario?.preset_ensenanza ?? 'estandar';
  const [presetSeleccionado, setPresetSeleccionado] = useState(presetGuardado);
  const [guardandoPreset, setGuardandoPreset] = useState(false);
  const [errorPreset, setErrorPreset] = useState(null);
  const [presetGuardadoOk, setPresetGuardadoOk] = useState(false);

  /**
   * Pide los videos propios y los generales. `mostrarCarga` solo en la primera carga: al refrescar después de
   * subir o quitar un video no se desmontan las tarjetas (se perdería lo que el usuario tenga abierto).
   */
  async function cargarVideos(mostrarCarga) {
    if (mostrarCarga) setCargandoVideos(true);
    setErrorVideos(null);
    const [propios, generales] = await Promise.allSettled([obtenerVideosFacilitador(), obtenerVideosDeMiCurso()]);
    if (propios.status === 'fulfilled') setVideos(propios.value || {});
    else setErrorVideos(propios.reason);
    if (generales.status === 'fulfilled') {
      setGeneral(generales.value || {});
      setErrorGeneral(null);
    } else {
      setErrorGeneral(generales.reason);
    }
    setCargandoVideos(false);
  }

  useEffect(() => {
    cargarVideos(true);
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerPerfil()
      .then((perfil) => {
        if (!cancelado && perfil && typeof perfil === 'object') setEsPrincipal(perfil.es_principal === true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Pide los cursos del facilitador, cada uno con el tono que se usa en él (`preset_efectivo`). `mostrarCarga` solo
   * en la primera carga: al refrescar después de guardar el tono propio no se tapa la lista con el indicador.
   */
  async function cargarCursos(mostrarCarga) {
    if (mostrarCarga) setCargandoCursos(true);
    setErrorCursos(null);
    try {
      setCursos((await listarCursos()) || []);
    } catch (err) {
      setErrorCursos(err);
    } finally {
      setCargandoCursos(false);
    }
  }

  // Cursos del facilitador: a quiénes les llegan los videos de esta pantalla y con qué tono les habla Turing.
  useEffect(() => {
    cargarCursos(true);
  }, []);

  async function manejarSubirVideo(tipoPieza, archivo) {
    setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { subiendo: true, error: null, exito: false } }));
    try {
      const resultado = await subirVideoPieza(tipoPieza, archivo);
      setVideos((actual) => ({ ...actual, [resultado.tipo_pieza]: resultado.url }));
      setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { subiendo: false, error: null, exito: true } }));
      cargarVideos(false); // el general también puede haber cambiado (si es el principal): se refrescan ambos
    } catch (err) {
      setEstadoSubida((actual) => ({
        ...actual,
        [tipoPieza]: { subiendo: false, error: mensajeError(err, 'No se pudo subir el video.'), exito: false },
      }));
    }
  }

  /** Borra el video propio de la pieza. Devuelve `true` si se borró. Muestra el error del backend tal cual. */
  async function manejarQuitarVideo(tipoPieza) {
    setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { quitando: true, error: null } }));
    try {
      await quitarVideoPieza(tipoPieza);
      await cargarVideos(false);
      setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { quitado: true } }));
      return true;
    } catch (err) {
      setEstadoSubida((actual) => ({
        ...actual,
        [tipoPieza]: { error: err.message || 'No se pudo quitar el video.' },
      }));
      if (err.status === 404) cargarVideos(false); // ya no tenía video propio: se pone la pantalla al día
      return false;
    }
  }

  function manejarSeleccionarPreset(id) {
    setPresetSeleccionado(id);
    setPresetGuardadoOk(false);
    setErrorPreset(null);
  }

  async function manejarGuardarPreset() {
    setErrorPreset(null);
    setPresetGuardadoOk(false);
    setGuardandoPreset(true);
    try {
      const actualizado = await actualizarPerfil({ preset_ensenanza: presetSeleccionado });
      alActualizarUsuario?.(actualizado);
      setPresetGuardadoOk(true);
      cargarCursos(false); // los cursos que heredan este tono pasan a mostrar el nuevo
    } catch (err) {
      setErrorPreset(mensajeError(err, 'No se pudo guardar la preferencia de tono.'));
    } finally {
      setGuardandoPreset(false);
    }
  }

  const presetCambiado = presetSeleccionado !== presetGuardado;

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      {/* Encabezado */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between gap-space-sm flex-wrap">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[24px] text-primary">video_settings</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Configuración de Enseñanza</h1>
          </div>
          <button
            type="button"
            onClick={() => setAyudaAbierta((actual) => !actual)}
            aria-expanded={ayudaAbierta}
            aria-controls="ayuda-configuracion-ensenanza"
            className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            Cómo usar esto
          </button>
        </div>

        {ayudaAbierta && (
          <div
            id="ayuda-configuracion-ensenanza"
            className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-space-xs"
          >
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <strong className="text-primary">1.</strong> Subí un video corto explicando cómo se mueve cada pieza.{' '}
              {esPrincipal
                ? 'Como facilitador principal, los tuyos son los generales: los ven todos los jugadores.'
                : 'Si ya hay uno general, el tuyo lo reemplaza para tus jugadores, solo en esa pieza.'}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <strong className="text-primary">2.</strong> Elegí cómo querés que Turing (el tutor) le hable a tus
              estudiantes: con más ánimo y simple, con el tono de siempre, o más técnico. Ese es el tono de tus cursos
              que no tengan uno propio; cada curso puede tener el suyo desde Gestión de Usuarios → Mis cursos.
            </p>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <strong className="text-primary">3.</strong> Los cursos los creás en Gestión de Usuarios y se los
              compartís a tus estudiantes con su código.{' '}
              {esPrincipal
                ? 'El tono de cada curso les llega a los jugadores inscritos en él.'
                : 'El tono de cada curso (y tus videos propios) les llegan a los jugadores inscritos en él.'}
            </p>
          </div>
        )}
      </div>

      {/* Gestor de videos por pieza */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary">video_library</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Videos por pieza</h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {esPrincipal
            ? 'Tus videos son los generales: los ven todos los jugadores, salvo en las piezas donde el facilitador de su curso subió el suyo.'
            : 'Los videos generales los pone el facilitador principal. Si subís uno para una pieza, tus jugadores ven el tuyo en lugar del general, solo en esa pieza.'}
        </p>

        {cargandoVideos && <CargandoInline texto="Buscando tus videos…" />}
        {!cargandoVideos && errorVideos && (
          <AvisoError mensaje={mensajeError(errorVideos, 'No se pudieron cargar tus videos.')} />
        )}
        {!cargandoVideos && !errorVideos && errorGeneral && (
          <AvisoError mensaje={mensajeError(errorGeneral, 'No se pudieron cargar los videos generales.')} />
        )}

        {!cargandoVideos && !errorVideos && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {PIEZAS.map((pieza) => (
              <TarjetaVideoPieza
                key={pieza.tipo}
                pieza={pieza}
                urlPropio={videos[pieza.tipo] ?? null}
                urlGeneral={general[pieza.tipo] ?? null}
                esPrincipal={esPrincipal}
                estado={estadoSubida[pieza.tipo]}
                onSubir={manejarSubirVideo}
                onQuitar={manejarQuitarVideo}
              />
            ))}
          </div>
        )}
      </section>

      {/* Preset de tono de enseñanza */}
      <section className="flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary">record_voice_over</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Cómo le habla Turing a tus estudiantes</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
          {PRESETS_TONO.map((preset) => (
            <TarjetaPreset
              key={preset.id}
              preset={preset}
              seleccionado={presetSeleccionado === preset.id}
              onSeleccionar={manejarSeleccionarPreset}
            />
          ))}
        </div>

        <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container border border-outline-variant/30">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5" aria-hidden="true">
            info
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Este es el tono de <strong className="text-on-surface">tus cursos que no tengan uno propio</strong>. Cada
            curso puede tener el suyo desde Gestión de Usuarios → Mis cursos. Abajo ves qué tono usa cada uno.
          </p>
        </div>

        {errorPreset && <AvisoError mensaje={errorPreset} />}
        {presetGuardadoOk && (
          <div
            role="status"
            className="p-space-md rounded-xl bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
            <span>Listo, guardamos tu tono. Lo usan tus cursos que no tengan uno propio.</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={manejarGuardarPreset}
            disabled={guardandoPreset || !presetCambiado}
            className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary rounded-xl font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {guardandoPreset && (
              <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
            )}
            {guardandoPreset ? 'Guardando…' : 'Guardar preferencia'}
          </button>
        </div>
      </section>

      {/* A quiénes les llega esta configuración: los jugadores inscritos en sus cursos */}
      <section className="flex flex-col gap-space-sm bg-surface-container-low p-space-lg rounded-xl shadow-md">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            groups
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Tus cursos</h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Cada curso muestra con qué tono les habla Turing a sus jugadores: el propio del curso o, si no tiene, el tuyo
          {esPrincipal ? '.' : '. En las piezas donde subiste un video propio, los jugadores ven el tuyo en lugar del general.'}
        </p>

        {cargandoCursos && <CargandoInline texto="Buscando tus cursos…" />}
        {!cargandoCursos && errorCursos && (
          <AvisoError mensaje={mensajeError(errorCursos, 'No se pudieron cargar tus cursos.')} />
        )}
        {!cargandoCursos && !errorCursos && cursos.length === 0 && (
          <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5" aria-hidden="true">
              info
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Todavía no tenés ningún curso, así que esta configuración no le llega a nadie. Creá uno en{' '}
              <strong className="text-on-surface">Gestión de Usuarios</strong> y compartí su código con tus
              estudiantes.
            </p>
          </div>
        )}
        {!cargandoCursos && !errorCursos && cursos.length > 0 && (
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
            {cursos.map((curso) => (
              <li
                key={curso.id}
                className="flex flex-col gap-space-2xs px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container min-w-0"
              >
                <div className="flex items-center justify-between gap-space-sm">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface min-w-0 break-words">
                    {curso.nombre}
                  </span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant shrink-0">
                    {curso.estudiantes} {curso.estudiantes === 1 ? 'estudiante' : 'estudiantes'}
                  </span>
                </div>
                <InsigniaTonoCurso curso={curso} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Imágenes de las figuritas de las medallas: solo el facilitador principal (ver FiguritasMedallas.jsx). */}
      {esPrincipal && <FiguritasMedallas />}
    </div>
  );
}
