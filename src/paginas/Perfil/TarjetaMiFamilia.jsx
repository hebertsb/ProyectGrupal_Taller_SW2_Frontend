import { useCallback, useEffect, useState } from 'react';
import { actualizarPerfil, obtenerMiAutorizacion } from '../../api/backend';
import ModalDatosFamilia from '../../componentes/ModalDatosFamilia';

const ESTADOS = {
  adulto: { icono: 'verified_user', texto: 'Sos mayor de edad: podés jugar con tus compañeros y amigos.' },
  institucional: { icono: 'school', texto: 'Tu docente o tu colegio tiene la autorización de las familias: podés jugar con tus compañeros y amigos.' },
  familia: { icono: 'family_restroom', texto: 'Tu familia te autorizó: podés jugar con tus compañeros y amigos.' },
};

/**
 * Tarjeta «Mi edad y mi familia» del perfil del jugador: dice si puede jugar con otras personas (es mayor de edad, su curso está autorizado o su familia lo
 * autorizó) y, si no, qué le falta cargar. Abre la ventana para completar los datos.
 */
export default function TarjetaMiFamilia({ usuario, alActualizarUsuario }) {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(false);
  const [retirando, setRetirando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEstado(await obtenerMiAutorizacion());
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo consultar tu autorización.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const conocido = estado ? ESTADOS[estado.estado] : null;

  return (
    <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">family_restroom</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi edad y mi familia</h2>
      </div>
      {error && <p role="alert" className="m-0 font-body-sm text-body-sm text-error break-words">{error}</p>}
      {estado && (
        <p
          role="status"
          className={`m-0 p-space-sm rounded-lg font-body-sm text-body-sm break-words flex items-start gap-space-xs ${
            conocido ? 'bg-surface-bright text-primary' : 'bg-tertiary/10 text-on-surface border border-tertiary/30'
          }`}
        >
          <span className={`material-symbols-outlined text-[18px] shrink-0 ${conocido ? '' : 'text-tertiary'}`} aria-hidden="true">
            {conocido ? conocido.icono : 'shield_person'}
          </span>
          <span className="min-w-0">{conocido ? conocido.texto : estado.mensaje}</span>
        </p>
      )}
      {(estado?.tutor_nombre || estado?.tutor_telefono || estado?.tutor_email) && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant break-words">
          Tu contacto de familia: <strong className="text-on-surface">{estado.tutor_nombre}</strong>
          {estado.tutor_telefono ? ` · ${estado.tutor_telefono}` : ''}
          {estado.tutor_email ? ` · ${estado.tutor_email}` : ''}
        </p>
      )}
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="self-start flex items-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">edit</span>
        {estado && !estado.puede_jugar_con_otros ? 'Completar mis datos' : 'Cambiar mis datos'}
      </button>
      {estado?.estado === 'familia' && <button type="button" disabled={retirando} className="self-start min-h-11 text-error underline disabled:opacity-50" onClick={async () => {
        setRetirando(true);
        try {
          alActualizarUsuario?.(await actualizarPerfil({ autorizacion_tutor: false }));
          await cargar();
        } catch (err) { setError(err.message || 'No se pudo retirar la autorización.'); }
        finally { setRetirando(false); }
      }}>{retirando ? 'Retirando…' : 'Retirar la declaración de autorización familiar'}</button>}
      {editando && (
        <ModalDatosFamilia
          usuario={usuario}
          falta={estado?.falta ?? []}
          alCerrar={() => setEditando(false)}
          alGuardar={(actualizado) => {
            setEditando(false);
            alActualizarUsuario?.(actualizado);
            cargar();
          }}
        />
      )}
    </div>
  );
}
