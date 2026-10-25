import { useRef, useState } from 'react';
import { eliminarMiCuenta } from '../../api/backend';
import useModalAccesible from '../../useModalAccesible';

/**
 * Confirmación para que la persona se dé de baja. Dice qué se pierde, vuelve a pedir la contraseña (o el correo, si la
 * cuenta entra solo con Google) y recién ahí borra. Al terminar llama a `alEliminar` (cierra la sesión).
 */
export default function ModalBajaCuenta({ usuario, alCerrar, alEliminar }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [valor, setValor] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState(null);
  const conPassword = usuario?.tiene_password !== false;
  const esFacilitador = usuario?.rol === 'facilitador';

  useModalAccesible(dialogoRef, { alCerrar: eliminando ? null : alCerrar, focoInicialRef: campoRef });

  async function confirmar(evento) {
    evento.preventDefault();
    setEliminando(true);
    setError(null);
    try {
      await eliminarMiCuenta(conPassword ? { password: valor } : { confirmarEmail: valor });
      alEliminar();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la cuenta.');
      setEliminando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !eliminando) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={confirmar}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-baja-cuenta"
        aria-describedby="descripcion-baja-cuenta"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-error/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-error/15 text-error flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">person_remove</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-error">Darme de baja</span>
            <h2 id="titulo-baja-cuenta" className="m-0 font-headline-sm text-headline-sm text-on-surface">Eliminar mi cuenta</h2>
          </div>
        </div>

        <div id="descripcion-baja-cuenta" className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface">
          <p className="m-0">
            Se borra tu cuenta <strong>para siempre</strong>, junto con todo lo tuyo:
          </p>
          <ul className="m-0 pl-space-md list-disc text-on-surface-variant">
            <li>Tus datos de perfil y tu foto</li>
            <li>Tus partidas con todas sus jugadas</li>
            <li>Tu nivel y su historial</li>
            <li>Tus conversaciones con Turing y tus medallas</li>
            {esFacilitador && (
              <li>
                Tus cursos: tus alumnos siguen en el sistema, pero quedan sin curso. Si administrabas una institución, queda sin
                administrador
              </li>
            )}
          </ul>
          <p className="m-0 text-on-surface-variant">No se puede deshacer.</p>
        </div>

        <div className="flex flex-col gap-space-2xs">
          <label htmlFor="baja-confirmacion" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
            {conPassword ? 'Para confirmar, escribí tu contraseña' : 'Para confirmar, escribí tu correo completo'}
          </label>
          <div className="relative">
            <input
              id="baja-confirmacion"
              ref={campoRef}
              type={conPassword && !mostrar ? 'password' : 'text'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoComplete={conPassword ? 'current-password' : 'off'}
              placeholder={conPassword ? '' : usuario?.email}
              required
              disabled={eliminando}
              className="w-full px-space-sm py-space-xs min-h-10 pr-12 bg-surface-container border border-outline-variant/30 rounded-lg font-body-sm text-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {conPassword && (
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{mostrar ? 'visibility_off' : 'visibility'}</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button
            type="button"
            onClick={alCerrar}
            disabled={eliminando}
            className="px-space-md py-space-sm min-h-11 rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={eliminando || valor.trim() === ''}
            className="px-space-md py-space-sm min-h-11 rounded-xl bg-error text-on-error font-body-sm text-body-sm font-medium transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-space-xs"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar mi cuenta'}
          </button>
        </div>
      </form>
    </div>
  );
}
