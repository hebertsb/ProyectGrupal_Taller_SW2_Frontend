import { useState } from 'react';
import FormularioUnirseCurso from '../../componentes/FormularioUnirseCurso';
import { cargarDescartada, guardarDescartada } from './invitacionCurso';

// Sin colores ni relleno propios para poder combinarlos sin que dos clases del mismo tipo se pisen.
const BASE_BOTON =
  'min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const COLOR_NEUTRO = 'bg-surface-container-high hover:bg-surface-bright text-on-surface';
const COLOR_PRINCIPAL = 'bg-primary hover:bg-primary-fixed text-on-primary font-medium';
const BOTON_NEUTRO = `${BASE_BOTON} ${COLOR_NEUTRO} px-space-md py-space-xs`;

/**
 * Invitación discreta y opcional a entrar a un curso, para el jugador. Jugar por cuenta propia es una experiencia
 * completa: por eso solo aparece si el jugador NO está en un curso y todavía no la descartó, y nunca se muestra al
 * registrarse ni al iniciar sesión.
 *
 * `miCurso`: `undefined` = todavía no se sabe (o falló el pedido: no se invita sin saberlo), `null` = no está en
 * ninguno, o el curso en el que ya está (entonces no se muestra nada). `alUnirse(curso)` avisa a la pantalla
 * cuando entró. `alIrAPerfil` es opcional: si viene, "Mi Perfil" es un enlace.
 *
 * `compacta` es la versión en una franja delgada (Sala de Control): "Unirme" despliega el campo del código y
 * "No, juego por mi cuenta" la descarta. Las dos versiones recuerdan el descarte con la misma clave, así que
 * descartarla en una pantalla la oculta también en la otra.
 */
export default function TarjetaUnirseCurso({
  usuarioId = null,
  miCurso,
  alUnirse,
  alIrAPerfil = null,
  compacta = false,
}) {
  const [descartada, setDescartada] = useState(() => cargarDescartada(usuarioId));
  const [unido, setUnido] = useState(null); // el curso al que entró desde esta tarjeta
  const [confirmacionCerrada, setConfirmacionCerrada] = useState(false);
  const [desplegada, setDesplegada] = useState(false); // solo en la versión compacta: campo del código a la vista

  const enlacePerfil = alIrAPerfil ? (
    <button
      type="button"
      onClick={alIrAPerfil}
      className="underline underline-offset-2 text-primary hover:text-primary-fixed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
    >
      Mi Perfil
    </button>
  ) : (
    'Mi Perfil'
  );

  if (unido) {
    if (confirmacionCerrada) return null;
    return (
      <section
        role="status"
        className="flex flex-col gap-space-xs bg-surface-container-low/80 backdrop-blur-md rounded-xl p-space-md shadow-md"
      >
        <div className="flex items-start gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            check_circle
          </span>
          <p className="m-0 font-body-sm text-body-sm text-on-surface min-w-0 break-words">
            Estás en <strong>{unido.nombre}</strong> con <strong>{unido.facilitador_nombre}</strong>. Tu facilitador puede
            ver tu progreso y Turing te habla con el tono que él eligió. Si querés salir, lo hacés desde {enlacePerfil}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmacionCerrada(true)}
          className={`${BOTON_NEUTRO} self-start`}
        >
          Listo
        </button>
      </section>
    );
  }

  if (miCurso === undefined || miCurso || descartada) return null;

  function jugarPorMiCuenta() {
    guardarDescartada(usuarioId);
    setDescartada(true);
  }

  function manejarUnido(curso) {
    setUnido(curso);
    alUnirse?.(curso);
  }

  if (compacta) {
    return (
      <section
        aria-labelledby="tarjeta-unirse-curso-compacta-titulo"
        className="flex flex-col gap-space-xs bg-surface-container-low/70 backdrop-blur-md rounded-xl px-space-md py-space-sm shadow-md min-w-0"
      >
        <div className="flex flex-wrap items-center gap-x-space-sm gap-y-space-xs">
          <div className="flex items-start gap-space-xs grow basis-48 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
              groups
            </span>
            <div className="flex flex-col min-w-0">
              <h2
                id="tarjeta-unirse-curso-compacta-titulo"
                className="m-0 font-body-sm text-body-sm font-medium text-on-surface"
              >
                ¿Tenés un código de curso?
              </h2>
              <p className="m-0 hidden sm:block font-mono-micro text-mono-micro text-on-surface-variant">
                Es opcional. Podés unirte cuando quieras desde {enlacePerfil}.
              </p>
            </div>
          </div>
          {/* En celular los botones van en su propia fila y el segundo puede partir su texto en dos líneas */}
          <div className="flex items-stretch gap-space-xs w-full sm:w-auto min-w-0">
            <button
              type="button"
              onClick={() => setDesplegada((v) => !v)}
              aria-expanded={desplegada}
              aria-controls="tarjeta-unirse-curso-compacta-campo"
              className={`${BASE_BOTON} ${desplegada ? COLOR_NEUTRO : COLOR_PRINCIPAL} px-space-md py-space-xs shrink-0`}
            >
              {desplegada ? 'Cancelar' : 'Unirme'}
            </button>
            <button
              type="button"
              onClick={jugarPorMiCuenta}
              className={`${BASE_BOTON} ${COLOR_NEUTRO} px-space-sm py-space-2xs flex-1 min-w-0 text-center`}
            >
              No, juego por mi cuenta
            </button>
          </div>
        </div>
        {desplegada && (
          <div id="tarjeta-unirse-curso-compacta-campo" className="flex flex-col gap-space-xs">
            <FormularioUnirseCurso alUnido={manejarUnido} idCampo="sala-curso-codigo" autoEnfocar />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="tarjeta-unirse-curso-titulo"
      className="flex flex-col gap-space-xs bg-surface-container-low/70 backdrop-blur-md rounded-xl p-space-md shadow-md max-w-xl"
    >
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
          groups
        </span>
        <h2 id="tarjeta-unirse-curso-titulo" className="font-body-sm text-body-sm font-medium text-on-surface">
          ¿Tenés un código de curso?
        </h2>
      </div>
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
        Es opcional. Si tu facilitador te dio uno, escribilo: te acompaña, puede ver tu progreso y Turing te habla con el
        tono que él eligió. Si no, seguí jugando y aprendiendo por tu cuenta.
      </p>
      <FormularioUnirseCurso alUnido={manejarUnido} idCampo="panel-curso-codigo" />
      <div className="flex flex-wrap items-center gap-x-space-sm gap-y-space-2xs">
        <button type="button" onClick={jugarPorMiCuenta} className={BOTON_NEUTRO}>
          No, juego por mi cuenta
        </button>
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">
          Podés unirte cuando quieras desde {enlacePerfil}.
        </span>
      </div>
    </section>
  );
}
