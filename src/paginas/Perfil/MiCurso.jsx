import { useCallback, useEffect, useState } from 'react';
import { obtenerMiCurso, salirDelCurso } from '../../api/backend';
import AvatarUsuario from '../../componentes/AvatarUsuario';
import FormularioUnirseCurso from '../../componentes/FormularioUnirseCurso';

/** Mismos 3 valores que `PresetEnsenanza` en `backend/esquemas/auth_esquema.py`. */
const NOMBRE_TONO = {
  infantil: 'Infantil',
  estandar: 'Estándar',
  adultos: 'Adultos',
};

const BASE_BOTON =
  'flex items-center justify-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function Alerta({ mensaje }) {
  return (
    <div
      role="alert"
      className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm flex items-start gap-space-xs"
    >
      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5" aria-hidden="true">
        error
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

/**
 * Tarjeta "Mi curso" del perfil del jugador: entra a un curso con el código que le dio su facilitador, o
 * muestra el curso en el que ya está (con el nombre y la foto de su facilitador) y deja salir.
 */
export default function MiCurso() {
  const [curso, setCurso] = useState(undefined); // undefined = cargando, null = no está en ninguno
  const [errorCarga, setErrorCarga] = useState(null);

  const [aviso, setAviso] = useState(null);

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalir, setErrorSalir] = useState(null);

  const cargar = useCallback(async () => {
    setErrorCarga(null);
    try {
      setCurso(await obtenerMiCurso());
    } catch (err) {
      setErrorCarga(err.message || 'No se pudo cargar tu curso.');
      setCurso((actual) => (actual === undefined ? null : actual));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function alUnido(unido) {
    setCurso(unido);
    setErrorCarga(null);
    setAviso(`Listo, ya estás en «${unido.nombre}».`);
  }

  async function salir() {
    setSaliendo(true);
    setErrorSalir(null);
    try {
      await salirDelCurso();
      setCurso(null);
      setConfirmandoSalida(false);
      setAviso('Saliste del curso.');
    } catch (err) {
      if (err.status === 404) {
        // ya no estaba inscrito (por ejemplo, el facilitador lo sacó): se pone la pantalla al día
        setCurso(null);
        setConfirmandoSalida(false);
        setAviso('Ya no estabas inscrito en ese curso.');
      } else {
        setErrorSalir(err.message || 'No se pudo salir del curso.');
      }
    } finally {
      setSaliendo(false);
    }
  }

  const tono = curso?.preset_ensenanza ? NOMBRE_TONO[curso.preset_ensenanza] : null;

  return (
    <div className="max-w-xl w-full bg-surface-container-low p-space-lg rounded-xl shadow-md flex flex-col gap-space-md">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
          groups
        </span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Mi curso</h2>
      </div>

      {errorCarga && (
        <div className="flex flex-col gap-space-xs">
          <Alerta mensaje={errorCarga} />
          <button
            type="button"
            onClick={cargar}
            className={`${BASE_BOTON} self-start bg-surface-container-high hover:bg-surface-bright text-on-surface`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-start gap-space-xs"
        >
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5" aria-hidden="true">
            check_circle
          </span>
          <span className="min-w-0 break-words">{aviso}</span>
        </div>
      )}

      {curso === undefined ? (
        <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Buscando tu curso…</span>
        </div>
      ) : curso === null ? (
        <>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Si tu facilitador te dio un código, escribilo acá para entrar a su curso. Tu facilitador te acompaña y
            puede ver tu progreso, y Turing te va a hablar con el tono que él elija. Si querés, jugá por tu cuenta: es
            opcional.
          </p>
          <FormularioUnirseCurso alUnido={alUnido} idCampo="mi-curso-codigo" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-space-sm min-w-0">
            <AvatarUsuario
              url={curso.facilitador_avatar_url}
              icono="admin_panel_settings"
              clase="w-14 h-14"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface break-words">{curso.nombre}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant break-words">
                Tu facilitador: <strong className="text-on-surface">{curso.facilitador_nombre}</strong>
              </span>
              {tono && (
                <span className="font-mono-micro text-mono-micro uppercase text-primary">Tono de Turing: {tono}</span>
              )}
            </div>
          </div>

          {errorSalir && <Alerta mensaje={errorSalir} />}

          {confirmandoSalida ? (
            <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
              <p className="m-0 font-body-sm text-body-sm text-on-surface break-words">
                ¿Salir de «{curso.nombre}»? {curso.facilitador_nombre} deja de ver tu progreso y Turing deja de usar su
                tono. Podés volver a entrar con el código.
              </p>
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" onClick={salir} disabled={saliendo} className={`${BASE_BOTON} bg-error/10 hover:bg-error/20 text-error`}>
                  {saliendo ? 'Saliendo…' : 'Sí, salir del curso'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoSalida(false)}
                  disabled={saliendo}
                  className={`${BASE_BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorSalir(null);
                setAviso(null);
                setConfirmandoSalida(true);
              }}
              className={`${BASE_BOTON} self-start bg-surface-container-high hover:bg-surface-bright text-on-surface`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                logout
              </span>
              Salir del curso
            </button>
          )}
        </>
      )}
    </div>
  );
}
