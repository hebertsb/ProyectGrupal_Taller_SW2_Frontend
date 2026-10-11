import { useEffect, useRef, useState } from 'react';
import { eliminarUsuario, historialPartidasUsuario } from '../../api/backend';

/**
 * Confirmación para eliminar a un usuario (solo facilitadores). Dice qué se pierde antes de borrar y, si la
 * persona solo dejó de jugar, ofrece la alternativa de desactivarla en vez de eliminarla.
 */
export default function ModalEliminarUsuario({ usuario, alCerrar, alEliminar }) {
  const [totalPartidas, setTotalPartidas] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState(null);
  const cancelarRef = useRef(null);

  useEffect(() => {
    cancelarRef.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && !eliminando) alCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar, eliminando]);

  useEffect(() => {
    let vigente = true;
    historialPartidasUsuario(usuario.id, 1, 0)
      .then((datos) => vigente && setTotalPartidas(datos.total))
      .catch(() => vigente && setTotalPartidas(null));
    return () => {
      vigente = false;
    };
  }, [usuario.id]);

  async function confirmar() {
    setEliminando(true);
    setError(null);
    try {
      const resultado = await eliminarUsuario(usuario.id);
      alEliminar(usuario, resultado);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar al usuario.');
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
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-eliminar-usuario"
        aria-describedby="descripcion-eliminar-usuario"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface-container-low border border-error/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-error/15 text-error flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">delete_forever</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-error">Eliminar usuario</span>
            <h2 id="titulo-eliminar-usuario" className="font-headline-sm text-headline-sm text-on-surface truncate">
              {usuario.nombre}
            </h2>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">{usuario.email}</span>
          </div>
        </div>

        <div id="descripcion-eliminar-usuario" className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface">
          <p className="m-0">
            Se borra la cuenta de la base de datos <strong>para siempre</strong>, junto con todo lo suyo:
          </p>
          <ul className="m-0 pl-space-md list-disc text-on-surface-variant">
            <li>
              {totalPartidas == null
                ? 'Sus partidas'
                : totalPartidas === 1
                  ? 'Su única partida'
                  : totalPartidas === 0
                    ? 'Ninguna partida (no jugó)'
                    : `Sus ${totalPartidas} partidas`}{' '}
              {totalPartidas === 0 ? '' : 'con las jugadas'}
            </li>
            <li>Su nivel y el historial de calibraciones</li>
            <li>Sus conversaciones con el tutor y su foto de perfil</li>
          </ul>
          <p className="m-0 text-on-surface-variant">No se puede deshacer.</p>
          {usuario.activo !== false && (
            <p className="m-0 px-space-sm py-space-xs rounded-lg bg-surface-container-high text-on-surface-variant">
              Si solo dejó de jugar y querés conservar sus datos, usá <strong>Editar → Estado: Inactivo</strong>: no podrá
              iniciar sesión pero no se pierde nada.
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button
            ref={cancelarRef}
            type="button"
            onClick={alCerrar}
            disabled={eliminando}
            className="px-space-md py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={eliminando}
            className="px-space-md py-space-sm rounded-xl bg-error text-on-error font-body-sm text-body-sm font-medium transition-colors hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-space-xs"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
            {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
