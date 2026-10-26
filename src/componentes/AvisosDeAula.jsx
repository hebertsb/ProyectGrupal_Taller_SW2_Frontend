import { useState } from 'react';

/**
 * Franja del torneo relámpago del curso: «tu partida está lista» (con un botón para ir a jugarla) o «hay un torneo abierto, inscribite». Se ve en cualquier
 * pantalla menos en la partida misma y en el aula.
 */
export function AvisoTorneo({ torneo, alIrAPartida, alIrAlAula }) {
  if (!torneo) return null;
  const hayPartida = torneo.estado === 'en_juego' && torneo.mi_partida;
  const puedeInscribirse = torneo.estado === 'inscripcion' && !torneo.inscrito;
  if (!hayPartida && !puedeInscribirse) return null;
  return (
    <div role="status" className="w-full px-space-lg py-space-sm bg-tertiary/10 border-b border-tertiary/30 flex flex-wrap items-center justify-between gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-center gap-space-xs min-w-0">
        <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0" aria-hidden="true">emoji_events</span>
        <span className="min-w-0 break-words">
          {hayPartida ? (
            <>
              <strong>Torneo «{torneo.nombre}»: tu partida de la ronda {torneo.mi_partida.ronda} está lista.</strong> El reloj ya corre.
            </>
          ) : (
            <>
              <strong>Hay un torneo en tu curso: «{torneo.nombre}».</strong> Las inscripciones están abiertas.
            </>
          )}
        </span>
      </p>
      <button
        type="button"
        onClick={hayPartida ? () => alIrAPartida(torneo.mi_partida.codigo) : alIrAlAula}
        className="px-space-md py-space-xs min-h-10 rounded-lg bg-tertiary text-on-tertiary font-body-sm text-body-sm font-medium hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
      >
        {hayPartida ? 'Ir a mi partida' : 'Ver el torneo'}
      </button>
    </div>
  );
}

const CLAVE_AVISO_VISTO = 'aviso_docente_visto';

function avisoYaVisto(id) {
  try {
    return window.sessionStorage.getItem(CLAVE_AVISO_VISTO) === String(id);
  } catch {
    return false;
  }
}

/**
 * Franja con el último aviso del docente a su curso (de los últimos 7 días). El alumno la cierra y no vuelve a aparecer en esa sesión; el aviso queda siempre
 * en «Mi aula».
 */
export function AvisoDelDocente({ aviso, alIrAlAula }) {
  const [cerradoId, setCerradoId] = useState(null);
  if (!aviso || cerradoId === aviso.id || avisoYaVisto(aviso.id)) return null;
  const cerrar = () => {
    try {
      window.sessionStorage.setItem(CLAVE_AVISO_VISTO, String(aviso.id));
    } catch {
      // sin almacenamiento: se cierra solo por esta pantalla
    }
    setCerradoId(aviso.id);
  };
  const enlaceSeguro = aviso.enlace && /^https?:\/\//i.test(aviso.enlace) ? aviso.enlace : null;
  return (
    <div role="status" className="w-full px-space-lg py-space-sm bg-primary/10 border-b border-primary/30 flex flex-wrap items-center justify-between gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-start gap-space-xs min-w-0">
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">campaign</span>
        <span className="min-w-0 break-words">
          <strong>{aviso.autor ? `${aviso.autor}: ` : 'Tu docente: '}</strong>
          {aviso.texto}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-space-xs">
        {enlaceSeguro && (
          <a
            href={enlaceSeguro}
            target="_blank"
            rel="noopener noreferrer"
            className="px-space-md py-space-xs min-h-10 flex items-center rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium no-underline hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Abrir el enlace
          </a>
        )}
        <button
          type="button"
          onClick={alIrAlAula}
          className="px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Mi aula
        </button>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar el aviso del docente"
          className="min-w-10 min-h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  );
}
