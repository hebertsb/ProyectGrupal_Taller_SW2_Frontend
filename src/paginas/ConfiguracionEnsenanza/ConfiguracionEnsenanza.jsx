import { useEffect, useState } from 'react';
import { actualizarPerfil, obtenerVideosFacilitador, subirVideoPieza } from '../../api/backend';
import { rutaImagenPieza } from '../../ajedrez';

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

/** Mismos 3 valores que `PresetEnsenanza` en `backend/esquemas/auth_esquema.py`. */
const PRESETS_TONO = [
  {
    id: 'infantil',
    titulo: 'Modo Infantil',
    icono: 'child_care',
    descripcion: 'Frases cortas, con ánimo y sin números — para los más chicos.',
    ejemplo: '¡Cuidado! Tu torre en d5 quedó sola y el rival te la puede comer gratis.',
  },
  {
    id: 'estandar',
    titulo: 'Modo Estándar',
    icono: 'balance',
    descripcion: 'El equilibrio de siempre: claro, ni muy infantil ni muy técnico.',
    ejemplo: 'Dejaste tu torre en d5 bajo ataque rival sin defensores suficientes.',
  },
  {
    id: 'adultos',
    titulo: 'Modo Adultos',
    icono: 'school',
    descripcion: 'Vocabulario técnico y directo — para quien ya conoce los términos.',
    ejemplo: 'Pieza colgada: torre en d5 sin defensa suficiente ante el ataque rival.',
  },
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
 * la subida real y el resultado (éxito/error) los maneja el padre, que es
 * quien sabe qué video quedó guardado para cada pieza.
 */
function TarjetaVideoPieza({ pieza, urlActual, estado, onSubir }) {
  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

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

  const subiendo = estado?.subiendo ?? false;

  return (
    <div className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container-low shadow-md">
      <div className="flex items-center gap-space-xs">
        <img src={rutaImagenPieza(pieza.letra)} alt="" className="w-7 h-7 shrink-0" draggable="false" />
        <span className="font-headline-sm text-headline-sm text-on-surface">{pieza.nombre}</span>
      </div>

      {previewUrl ? (
        <video controls src={previewUrl} className="w-full aspect-video rounded-lg bg-surface-container-lowest" />
      ) : urlActual ? (
        <video controls src={urlActual} className="w-full aspect-video rounded-lg bg-surface-container-lowest" />
      ) : (
        <div className="w-full aspect-video rounded-lg bg-surface-container-lowest border border-dashed border-outline-variant/40 flex flex-col items-center justify-center gap-space-2xs text-center px-space-sm">
          <span className="material-symbols-outlined text-[28px] text-outline">videocam</span>
          <p className="font-mono-micro text-mono-micro text-on-surface-variant">
            Sin video propio — tus estudiantes ven el video por defecto del sistema.
          </p>
        </div>
      )}

      {previewUrl && (
        <p className="font-mono-micro text-mono-micro text-primary-fixed-dim">
          Vista previa, todavía sin guardar. Confirmá para reemplazar el video.
        </p>
      )}

      {estado?.error && <AvisoError mensaje={estado.error} />}
      {estado?.exito && !previewUrl && (
        <div
          role="status"
          className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
          <span>Listo, tus estudiantes ya ven este video.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-space-xs pt-space-2xs">
        {!previewUrl ? (
          <label
            className={`flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm cursor-pointer transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
              subiendo ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Reemplazar video
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={manejarSeleccion}
              disabled={subiendo}
              aria-label={`Elegir video de reemplazo para ${pieza.nombre.toLowerCase()}`}
            />
          </label>
        ) : (
          <>
            <button
              type="button"
              onClick={confirmar}
              disabled={subiendo}
              className="flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              className="flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancelar
            </button>
          </>
        )}
      </div>

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
 * `preset_ensenanza`). El vínculo formal facilitador-estudiante (cursos)
 * todavía no existe, así que el preset es una preferencia personal por
 * ahora — se lo avisamos al facilitador de forma visible, no oculta.
 */
export default function ConfiguracionEnsenanza({ usuario, alActualizarUsuario }) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  const [videos, setVideos] = useState({});
  const [cargandoVideos, setCargandoVideos] = useState(true);
  const [errorVideos, setErrorVideos] = useState(null);
  const [estadoSubida, setEstadoSubida] = useState({});

  const presetGuardado = usuario?.preset_ensenanza ?? 'estandar';
  const [presetSeleccionado, setPresetSeleccionado] = useState(presetGuardado);
  const [guardandoPreset, setGuardandoPreset] = useState(false);
  const [errorPreset, setErrorPreset] = useState(null);
  const [presetGuardadoOk, setPresetGuardadoOk] = useState(false);

  useEffect(() => {
    setCargandoVideos(true);
    setErrorVideos(null);
    obtenerVideosFacilitador()
      .then((datos) => setVideos(datos || {}))
      .catch((err) => setErrorVideos(err))
      .finally(() => setCargandoVideos(false));
  }, []);

  async function manejarSubirVideo(tipoPieza, archivo) {
    setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { subiendo: true, error: null, exito: false } }));
    try {
      const resultado = await subirVideoPieza(tipoPieza, archivo);
      setVideos((actual) => ({ ...actual, [resultado.tipo_pieza]: resultado.url }));
      setEstadoSubida((actual) => ({ ...actual, [tipoPieza]: { subiendo: false, error: null, exito: true } }));
    } catch (err) {
      setEstadoSubida((actual) => ({
        ...actual,
        [tipoPieza]: { subiendo: false, error: mensajeError(err, 'No se pudo subir el video.'), exito: false },
      }));
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
              <strong className="text-primary">1.</strong> Subí un video corto explicando cómo se mueve cada pieza —
              tus estudiantes lo ven en vez del video genérico del sistema.
            </p>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <strong className="text-primary">2.</strong> Elegí cómo querés que Turing (el tutor) le hable a tus
              estudiantes: con más ánimo y simple, con el tono de siempre, o más técnico.
            </p>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
              <strong className="text-primary">3.</strong> Por ahora esto es una preferencia tuya, personal — todavía
              no se puede aplicar por curso (lo explicamos más abajo, junto al tono).
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
          Subí tu propio video para cada pieza. Si no subís uno, tus estudiantes ven el video por defecto del
          sistema.
        </p>

        {cargandoVideos && <CargandoInline texto="Buscando tus videos…" />}
        {!cargandoVideos && errorVideos && (
          <AvisoError mensaje={mensajeError(errorVideos, 'No se pudieron cargar tus videos.')} />
        )}

        {!cargandoVideos && !errorVideos && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {PIEZAS.map((pieza) => (
              <TarjetaVideoPieza
                key={pieza.tipo}
                pieza={pieza}
                urlActual={videos[pieza.tipo] ?? null}
                estado={estadoSubida[pieza.tipo]}
                onSubir={manejarSubirVideo}
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

        {/* Nota visible — no se oculta ni se minimiza */}
        <div className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container border border-outline-variant/30">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">info</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Este tono es una preferencia <strong className="text-on-surface">personal tuya</strong>, por ahora.
            Todavía no existe una forma de agrupar a tus estudiantes por curso — así que{' '}
            <strong className="text-on-surface">no se aplica automáticamente a nadie más</strong> todavía.
          </p>
        </div>

        {errorPreset && <AvisoError mensaje={errorPreset} />}
        {presetGuardadoOk && (
          <div
            role="status"
            className="p-space-md rounded-xl bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
            <span>Listo, guardamos cómo le habla Turing a tus estudiantes.</span>
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

      {/* Selector de grupo/curso — placeholder visual, sin funcionalidad real todavía */}
      <section className="flex flex-col gap-space-sm bg-surface-container-low p-space-lg rounded-xl shadow-md">
        <div className="flex items-center justify-between gap-space-sm flex-wrap">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Grupo o curso</h2>
          </div>
          <span className="font-mono-micro text-[10px] uppercase tracking-wider text-outline px-space-xs py-space-2xs rounded-full border border-outline-variant/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">lock</span>
            Próximamente
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Más adelante vas a poder elegir a qué grupo de estudiantes aplicar esta configuración. Todavía no existe
          esa función.
        </p>
        <div
          aria-disabled="true"
          title="Próximamente"
          className="w-full sm:w-72 flex items-center justify-between px-space-sm py-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-outline cursor-not-allowed opacity-70"
        >
          <span className="font-body-sm text-body-sm">Todos mis estudiantes</span>
          <span className="material-symbols-outlined text-[18px]">expand_more</span>
        </div>
      </section>
    </div>
  );
}
