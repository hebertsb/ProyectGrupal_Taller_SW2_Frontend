import { useEffect, useState } from 'react';
import { actualizarPerfil, guardarNivelEstimado, subirFotoPerfil } from '../../api/backend';
import MiCurso from './MiCurso';
import ModalBajaCuenta from './ModalBajaCuenta';
import TarjetaCambiarPassword from './TarjetaCambiarPassword';
import TarjetaDobleFactor from './TarjetaDobleFactor';
import TarjetaMiElo from './TarjetaMiElo';
import TarjetaMiFamilia from './TarjetaMiFamilia';
import TarjetaMiProgreso from './TarjetaMiProgreso';
import TarjetaMisMedallas from './TarjetaMisMedallas';

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

export default function Perfil({ usuario, alActualizarUsuario, alVerAlbum, alEliminarCuenta }) {
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
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

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
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-md animate-in fade-in duration-500">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary">account_circle</span>
        <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi Perfil</h1>
      </div>

      {/* Una columna en celular y tablet; dos en pantallas anchas (datos a la izquierda, nivel, medallas, curso y privacidad a la derecha) */}
      <div className="w-full max-w-xl xl:max-w-5xl grid grid-cols-1 xl:grid-cols-2 gap-space-md items-start">
        {/* Datos de la cuenta: foto, nombre, edad y descripción en una sola tarjeta */}
        <div className="w-full min-w-0 bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-14 h-14 rounded-full bg-surface-bright flex items-center justify-center text-primary overflow-hidden flex-shrink-0">
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
                <span className="material-symbols-outlined text-[28px]">
                  {esFacilitador ? 'admin_panel_settings' : 'person'}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{usuario?.email}</span>
              <span className={`font-mono-micro text-mono-micro uppercase ${esFacilitador ? 'text-tertiary' : 'text-secondary'}`}>
                {esFacilitador ? 'Facilitador' : 'Jugador'}
              </span>
            </div>
            {!previewFotoUrl && (
              <label
                title="Formatos aceptados: JPG, PNG o WEBP"
                className="shrink-0 flex items-center gap-space-2xs px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm cursor-pointer transition-colors motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">photo_camera</span>
                <span className="max-sm:sr-only">Cambiar foto</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={manejarSeleccionFoto}
                  aria-label="Cambiar foto de perfil (JPG, PNG o WEBP)"
                />
              </label>
            )}
          </div>

          {previewFotoUrl && (
            <div className="flex flex-wrap items-center gap-space-xs">
              <button
                type="button"
                onClick={confirmarFoto}
                disabled={subiendoFoto}
                className="flex items-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                className="flex items-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancelar
              </button>
            </div>
          )}
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

          {error && (
            <div className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm flex items-center gap-space-xs" role="alert">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}
          {guardadoOk && (
            <div className="p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs" role="status">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">check_circle</span>
              <span>Perfil actualizado.</span>
            </div>
          )}

          <form onSubmit={manejarSubmit} className="flex flex-col gap-space-sm border-t border-outline-variant/20 pt-space-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-space-sm">
              <div className="flex flex-col gap-space-2xs min-w-0">
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
                  className="w-full px-space-sm py-space-xs min-h-10 bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
              <div className="flex flex-col gap-space-2xs min-w-0">
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
                  className="w-full px-space-sm py-space-xs min-h-10 bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-baseline justify-between gap-space-sm">
                <label htmlFor="perfil-descripcion" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
                  Bio / descripción
                </label>
                <span className="font-mono-micro text-mono-micro text-outline">
                  {descripcion.length}/{DESCRIPCION_MAX}
                </span>
              </div>
              <textarea
                id="perfil-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={DESCRIPCION_MAX}
                rows={3}
                placeholder={
                  esFacilitador
                    ? 'Ej. Instructor con 5 años de experiencia, nivel FIDE 1800'
                    : 'Contá un poco sobre vos y tu experiencia jugando ajedrez'
                }
                className="w-full px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface placeholder-outline resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="flex items-center gap-space-xs px-space-lg py-space-xs min-h-10 bg-primary text-on-primary rounded-xl font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {guardando && (
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
                )}
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-space-md min-w-0">
        {/* Autoselección de nivel — solo jugador. Punto de partida, no un
            diagnóstico ni una elección definitiva (ver `NIVELES_RANGO`). */}
        {!esFacilitador && (
          <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-primary">military_tech</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Tu nivel</h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Este es tu punto de partida (define cómo te habla Turing hasta que te midamos). Tu primera partida —de
              diagnóstico, contra Stockfish— mide tu nivel y luego se reajusta con cada partida.
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

        {/* Medallas del jugador — resumen del álbum de figuritas y acceso a él (ver TarjetaMisMedallas.jsx). */}
        {!esFacilitador && <TarjetaMisMedallas alVerAlbum={alVerAlbum} />}

        {/* Informe de progreso del jugador: el antes y el después, para mostrar a la familia (ver TarjetaMiProgreso.jsx). */}
        {!esFacilitador && <TarjetaMiProgreso />}

        {/* Elo entre jugadores: cómo le va contra otras personas (ver TarjetaMiElo.jsx). */}
        {!esFacilitador && <TarjetaMiElo />}

        {/* Curso del jugador — entra con el código de su facilitador (ver MiCurso.jsx). */}
        {!esFacilitador && <MiCurso />}

        {/* Edad y autorización de la familia para jugar con otras personas (ver TarjetaMiFamilia.jsx). */}
        {!esFacilitador && <TarjetaMiFamilia usuario={usuario} alActualizarUsuario={alActualizarUsuario} />}

        {/* Cambiar la contraseña: las cuentas que entran solo con Google no tienen una. */}
        {usuario?.tiene_password !== false && !usuario?.google_id && <TarjetaCambiarPassword />}

        {/* Verificación en dos pasos: solo facilitadores (docentes, administradores y la plataforma) */}
        {esFacilitador && <TarjetaDobleFactor usuario={usuario} alActualizarUsuario={alActualizarUsuario} />}

        {/* Privacidad y baja de la cuenta — para todos los perfiles. La cuenta de la plataforma no se da de baja desde acá. */}
        <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">shield_person</span>
            <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Privacidad y cuenta</h2>
          </div>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Qué datos guardamos, quién los ve y cómo pedir ayuda está en los{' '}
            <a href="/#politica" target="_blank" rel="noopener" className="text-primary underline">
              términos y la política de privacidad
            </a>
            . Si ya no querés tener cuenta, podés darte de baja: se borra todo lo tuyo.
          </p>
          {usuario?.es_principal ? (
            <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
              La cuenta de la plataforma no se da de baja desde la web: se maneja desde el servidor.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBaja(true)}
              className="self-start flex items-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg bg-error/10 hover:bg-error/20 text-error font-body-sm text-body-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_remove</span>
              Eliminar mi cuenta
            </button>
          )}
        </div>
        {confirmandoBaja && (
          <ModalBajaCuenta usuario={usuario} alCerrar={() => setConfirmandoBaja(false)} alEliminar={() => alEliminarCuenta?.()} />
        )}
        </div>
      </div>
    </div>
  );
}
