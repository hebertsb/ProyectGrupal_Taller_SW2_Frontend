import { useState } from 'react';
import { actualizarPerfil } from '../../api/backend';

const EDAD_MIN = 0;
const EDAD_MAX = 120;
const DESCRIPCION_MAX = 1000;

export default function Perfil({ usuario, alActualizarUsuario }) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [avatarUrl, setAvatarUrl] = useState(usuario?.avatar_url ?? '');
  const [edad, setEdad] = useState(usuario?.edad != null ? String(usuario.edad) : '');
  const [descripcion, setDescripcion] = useState(usuario?.descripcion ?? '');
  const [avatarRoto, setAvatarRoto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const esFacilitador = usuario?.rol === 'facilitador';

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
        avatar_url: avatarUrl.trim() || null,
        edad: edad === '' ? null : Number(edad),
        descripcion: descripcion.trim() || null,
      });
      alActualizarUsuario?.(actualizado);
      setGuardadoOk(true);
    } catch (err) {
      if (err.status === 404 || err.status === 405) {
        setError('Esta función todavía no está disponible en el servidor. Probá de nuevo en un rato.');
      } else {
        setError(err.message || 'No se pudo guardar el perfil.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary">account_circle</span>
        <span className="font-headline-sm text-headline-sm text-on-surface">Mi Perfil</span>
      </div>

      <div className="max-w-xl w-full bg-surface-container-low p-space-lg rounded-xl shadow-md flex flex-col gap-space-lg">
        <div className="flex items-center gap-space-md pb-space-md border-b border-outline-variant/20">
          <div className="w-16 h-16 rounded-full bg-surface-bright flex items-center justify-center text-primary overflow-hidden flex-shrink-0">
            {avatarUrl && !avatarRoto ? (
              <img
                src={avatarUrl}
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
            <label htmlFor="perfil-avatar" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
              Foto (URL de imagen)
            </label>
            <input
              id="perfil-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg text-body-sm font-body-sm text-on-surface placeholder-outline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              )}
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
