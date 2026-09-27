import { useEffect, useState } from 'react';
import { actualizarPerfil, guardarNivelEstimado, subirFotoPerfil } from '../../api/backend';

const EDAD_MIN = 0;
const EDAD_MAX = 120;
const DESCRIPCION_MAX = 1000;

/**
 * Mismos 3 valores y mismo par nivel/rango que ya usa el diagnóstico "Mide tu
 * nivel" de la app móvil (ver app_movil/lib/screens/game_screen.dart) — para
 * que web y móvil hablen el mismo idioma aunque acá no haya un cuestionario,
 * solo una elección directa.
 */
const NIVELES_RANGO = [
  { rango: 'Principiante', nivel: 5 },
  { rango: 'Intermedio', nivel: 11 },
  { rango: 'Avanzado', nivel: 18 },
];

function mensajeError(err, mensajePorDefecto) {
  if (err?.status === 404 || err?.status === 405) {
    return 'Esta función todavía no está disponible en el servidor. Probá de nuevo en un rato.';
  }
  return err?.message || mensajePorDefecto;
}

export default function Perfil({ usuario, alActualizarUsuario }) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [edad, setEdad] = useState(usuario?.edad != null ? String(usuario.edad) : '');
  const [descripcion, setDescripcion] = useState(usuario?.descripcion ?? '');
  const [avatarRoto, setAvatarRoto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  // Foto de perfil real — selector de archivo + vista previa (mismo patrón que
  // `TarjetaVideoPieza` en ConfiguracionEnsenanza.jsx): `URL.createObjectURL`
  // para la preview, liberada al cancelar/confirmar/desmontar.
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [previewFotoUrl, setPreviewFotoUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);
  const [fotoGuardadaOk, setFotoGuardadaOk] = useState(false);

  // Autoselección de nivel (jugador) — punto de partida, no un diagnóstico ni
  // una elección definitiva: el backend recalibra `rango_estimado` solo, más
  // adelante, analizando partidas reales.
  const [nivelSeleccionado, setNivelSeleccionado] = useState(usuario?.rango_estimado ?? null);
  const [guardandoNivel, setGuardandoNivel] = useState(false);
  const [errorNivel, setErrorNivel] = useState(null);
  const [nivelGuardadoOk, setNivelGuardadoOk] = useState(false);

  const esFacilitador = usuario?.rol === 'facilitador';

  useEffect(() => {
    return () => {
      if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl);
    };
  }, [previewFotoUrl]);

  const manejarSubmit = async (evento) => {
    evento.preventDefault();
    setError(null);
    setGuardadoOk(false);

    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (edad !== '' && (Number(edad) < EDAD_MIN || Number(edad) > EDAD_MAX)) {
      setError(`La edad debe estar entre ${EDAD_MIN} y ${EDAD_MAX}.`);
      return;
    }
    if (descripcion.length > DESCRIPCION_MAX) {
      setError(`La descripción no puede superar los ${DESCRIPCION_MAX} caracteres.`);
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil({
        nombre: nombreLimpio,
        edad: edad === '' ? null : Number(edad),
        descripcion: descripcion.trim() || null,
      });
      alActualizarUsuario?.(actualizado);
      setGuardadoOk(true);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el perfil.'));
    } finally {
      setGuardando(false);
    }
  };

  function manejarSeleccionFoto(evento) {
    const elegido = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!elegido) return;
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl);
    setErrorFoto(null);
    setFotoGuardadaOk(false);
    setArchivoFoto(elegido);
    setPreviewFotoUrl(URL.createObjectURL(elegido));
  }

  function cancelarFoto() {
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl);
    setArchivoFoto(null);
    setPreviewFotoUrl(null);
    setErrorFoto(null);
  }

  async function confirmarFoto() {
    if (!archivoFoto) return;
    setSubiendoFoto(true);
    setErrorFoto(null);
    try {
      const actualizado = await subirFotoPerfil(archivoFoto);
      alActualizarUsuario?.(actualizado);
      if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl);
      setArchivoFoto(null);
      setPreviewFotoUrl(null);
      setFotoGuardadaOk(true);
      setAvatarRoto(false);
    } catch (err) {
      setErrorFoto(mensajeError(err, 'No se pudo subir la foto.'));
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function elegirNivel(item) {
    setNivelSeleccionado(item.rango);
    setErrorNivel(null);
    setNivelGuardadoOk(false);
    setGuardandoNivel(true);
    try {
      const actualizado = await guardarNivelEstimado(item.nivel, item.rango);
      alActualizarUsuario?.(actualizado);
      setNivelGuardadoOk(true);
    } catch (err) {
      setErrorNivel(mensajeError(err, 'No se pudo guardar tu nivel.'));
    } finally {
      setGuardandoNivel(false);
    }
  }

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary">account_circle</span>
        <span className="font-headline-sm text-headline-sm text-on-surface">Mi Perfil</span>
      </div>

      <div className="max-w-xl w-full bg-surface-container-low p-space-lg rounded-xl shadow-md flex flex-col gap-space-lg">
        <div className="flex items-center gap-space-md pb-space-md border-b border-outline-variant/20">
          <div className="w-16 h-16 rounded-full bg-surface-bright flex items-center justify-center text-primary overflow-hidden flex-shrink-0">
            {previewFotoUrl ? (
              <img src={previewFotoUrl} alt="" className="w-full h-full object-cover" />
            ) : usuario?.avatar_url && !avatarRoto ? (
              <img
                src={usuario.avatar_url}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setAvatarRoto(true)}
                onLoad={() => setAvatarRoto(false)}
              />
            ) : (
              <span className="material-symbols-outlined text-[32px]">
                {esFacilitador ? 'admin_panel_settings' : 'person'}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{usuario?.email}</span>
            <span className={`font-mono-micro text-mono-micro uppercase ${esFacilitador ? 'text-tertiary' : 'text-secondary'}`}>
              {esFacilitador ? 'Facilitador' : 'Jugador'}
            </span>
          </div>
        </div>

        {/* Foto de perfil real — selector de archivo, no una URL pegada a mano */}
        <div className="flex flex-col gap-space-2xs">
          <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Foto de perfil</span>
          {errorFoto && (
            <div className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs" role="alert">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">error</span>
              <span>{errorFoto}</span>
            </div>
          )}
          {fotoGuardadaOk && !previewFotoUrl && (
            <div className="p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs" role="status">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">check_circle</span>
              <span>Foto actualizada.</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-space-xs">
            {!previewFotoUrl ? (
              <label className="flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm cursor-pointer transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Elegir foto
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={manejarSeleccionFoto}
                  aria-label="Elegir foto de perfil"
                />
              </label>
            ) : (
              <>
                <button
                  type="button"
                  onClick={confirmarFoto}
                  disabled={subiendoFoto}
                  className="flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {subiendoFoto && (
                    <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
                  )}
                  {subiendoFoto ? 'Subiendo…' : 'Confirmar foto'}
                </button>
                <button
                  type="button"
                  onClick={cancelarFoto}
                  disabled={subiendoFoto}
                  className="flex items-center gap-space-2xs px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
          <span className="font-mono-micro text-[10px] text-outline">Formatos aceptados: JPG, PNG o WEBP.</span>
        </div>

        {error && (
          <div className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs" role="alert">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}
        {guardadoOk && (
          <div className="p-space-md rounded-xl bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs" role="status">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">check_circle</span>
            <span>Perfil actualizado.</span>
          </div>
        )}

        <form onSubmit={manejarSubmit} className="flex flex-col gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="perfil-nombre" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
              Nombre
            </label>
            <input
              id="perfil-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              className="w-full px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="perfil-edad" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
              Edad
            </label>
            <input
              id="perfil-edad"
              type="number"
              inputMode="numeric"
              min={EDAD_MIN}
              max={EDAD_MAX}
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              className="w-full sm:w-32 px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="perfil-descripcion" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
              Bio / descripción
            </label>
            <textarea
              id="perfil-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={DESCRIPCION_MAX}
              rows={4}
              placeholder={
                esFacilitador
                  ? 'Ej. Instructor con 5 años de experiencia, nivel FIDE 1800'
                  : 'Contá un poco sobre vos y tu experiencia jugando ajedrez'
              }
              className="w-full px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface placeholder-outline resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-mono-micro text-mono-micro text-outline self-end">
              {descripcion.length}/{DESCRIPCION_MAX}
            </span>
          </div>

          <div className="flex justify-end pt-space-xs">
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary text-on-primary rounded-xl font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {guardando && (
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
              )}
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* Autoselección de nivel — solo jugador. Punto de partida, no un
          diagnóstico ni una elección definitiva (ver `NIVELES_RANGO`). */}
      {!esFacilitador && (
        <div className="max-w-xl w-full bg-surface-container-low p-space-lg rounded-xl shadow-md flex flex-col gap-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px] text-primary">military_tech</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Tu nivel</h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Elegí un nivel de partida mientras jugás tus primeras partidas — después el sistema lo va a ir ajustando
            solo según cómo juegues. Esto define cómo te habla Turing en el Panel de Aprendizaje, no es un
            diagnóstico.
          </p>

          {errorNivel && (
            <div className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs" role="alert">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">error</span>
              <span>{errorNivel}</span>
            </div>
          )}
          {nivelGuardadoOk && (
            <div className="p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs" role="status">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">check_circle</span>
              <span>Listo, guardamos tu nivel.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-space-xs">
            {NIVELES_RANGO.map((item) => {
              const esActual = nivelSeleccionado === item.rango;
              return (
                <button
                  key={item.rango}
                  type="button"
                  onClick={() => elegirNivel(item)}
                  disabled={guardandoNivel}
                  aria-pressed={esActual}
                  className={`flex flex-col items-center gap-space-2xs p-space-sm rounded-xl border transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    esActual
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{esActual ? 'check_circle' : 'radio_button_unchecked'}</span>
                  <span className="font-body-sm text-body-sm font-medium">{item.rango}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
