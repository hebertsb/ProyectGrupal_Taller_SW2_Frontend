import { useState } from 'react';
import FormularioUnirseCurso from '../../componentes/FormularioUnirseCurso';

function claveSinCurso(usuarioId) {
  return `panel_aprendizaje_sin_curso_${usuarioId ?? 'anon'}`;
}

/** `true` si el jugador ya dijo "No, juego por mi cuenta" (se recuerda por usuario; si el storage falla, `false`). */
function cargarDescartada(usuarioId) {
  try {
    return localStorage.getItem(claveSinCurso(usuarioId)) === '1';
  } catch {
    return false;
  }
}

function guardarDescartada(usuarioId) {
  try {
    localStorage.setItem(claveSinCurso(usuarioId), '1');
  } catch {
    // localStorage puede fallar (modo privado, cuota): la tarjeta igual se oculta mientras dure la pantalla.
  }
}

/**
 * Invitación discreta y opcional a entrar a un curso, para el Panel de Aprendizaje del jugador. Jugar por cuenta
 * propia es una experiencia completa: por eso solo aparece si el jugador NO está en un curso y todavía no la
 * descartó, y nunca se muestra al registrarse ni al iniciar sesión.
 *
 * `miCurso`: `undefined` = todavía no se sabe (o falló el pedido: no se invita sin saberlo), `null` = no está en
 * ninguno, o el curso en el que ya está (entonces no se muestra nada). `alUnirse(curso)` avisa a la pantalla
 * cuando entró. `alIrAPerfil` es opcional: si viene, "Mi Perfil" es un enlace.
 */
export default function TarjetaUnirseCurso({ usuarioId = null, miCurso, alUnirse, alIrAPerfil = null }) {
  const [descartada, setDescartada] = useState(() => cargarDescartada(usuarioId));
  const [unido, setUnido] = useState(null); // el curso al que entró desde esta tarjeta
  const [confirmacionCerrada, setConfirmacionCerrada] = useState(false);

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
          className="self-start min-h-10 px-space-md py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
        <button
          type="button"
          onClick={jugarPorMiCuenta}
          className="min-h-10 px-space-md py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          No, juego por mi cuenta
        </button>
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">
          Podés unirte cuando quieras desde {enlacePerfil}.
        </span>
      </div>
    </section>
  );
}
