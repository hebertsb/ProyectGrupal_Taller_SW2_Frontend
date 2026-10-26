import { useState } from 'react';
import { cambiarMiPassword } from '../../api/backend';

const CLASE_INPUT =
  'w-full px-space-sm py-space-xs min-h-10 bg-surface-container border border-outline-variant/30 rounded-lg font-body-sm text-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Cambiar la propia contraseña. Sirve sobre todo a los alumnos a los que el docente les creó la cuenta: entran con una clave temporal y la cambian por una
 * propia. Una cuenta que entra solo con Google no tiene contraseña de ChessIA y no ve esta tarjeta.
 */
export default function TarjetaCambiarPassword() {
  const [abierta, setAbierta] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  function cerrar() {
    setAbierta(false);
    setActual('');
    setNueva('');
    setRepetida('');
    setError(null);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError(null);
    if (nueva.length < 8 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva) || !/\d/.test(nueva)) {
      setError('La contraseña nueva tiene que tener al menos 8 caracteres, con letras y números.');
      return;
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setGuardando(true);
    try {
      await cambiarMiPassword(actual, nueva);
      cerrar();
      setListo(true);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">key</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi contraseña</h2>
      </div>
      {listo && !abierta && (
        <p role="status" className="m-0 p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm">
          Listo, cambiaste tu contraseña. Las otras sesiones se cerraron.
        </p>
      )}
      {!abierta ? (
        <div className="flex flex-col gap-space-xs">
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Si tu docente te creó la cuenta con una clave temporal, cambiala por una que solo vos sepas.
          </p>
          <button
            type="button"
            onClick={() => {
              setListo(false);
              setAbierta(true);
            }}
            className="self-start flex items-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">lock_reset</span>
            Cambiar mi contraseña
          </button>
        </div>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-space-sm max-w-md">
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="pass-actual" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Contraseña actual</label>
            <input id="pass-actual" type={ver ? 'text' : 'password'} autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required className={CLASE_INPUT} />
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="pass-nueva" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Contraseña nueva</label>
            <input id="pass-nueva" type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required className={CLASE_INPUT} />
            <span className="font-mono-micro text-mono-micro text-outline">Mínimo 8 caracteres, con letras y números.</span>
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="pass-repetida" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Repetí la contraseña nueva</label>
            <input id="pass-repetida" type={ver ? 'text' : 'password'} autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} required className={CLASE_INPUT} />
          </div>
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-primary" />
            Mostrar lo que escribo
          </label>
          {error && (
            <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-space-xs">
            <button type="button" onClick={cerrar} disabled={guardando} className="px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
