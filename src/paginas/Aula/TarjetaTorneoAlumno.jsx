import { useCallback, useEffect, useState } from 'react';
import { bajarmeDelTorneo, inscribirmeEnTorneo, obtenerTorneosDelCurso } from '../../api/backend';
import TablaDeTorneo, { NOMBRE_ESTADO_TORNEO } from '../../componentes/TablaDeTorneo';

/** «5 min por lado», «Sin reloj». */
export function textoDeReloj(ms) {
  return ms > 0 ? `${Math.round(ms / 60000)} min por lado` : 'Sin reloj';
}

const BOTON =
  'flex items-center justify-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * El torneo relámpago del curso visto por el alumno: se inscribe mientras están abiertas las inscripciones, ve la tabla y, cuando hay ronda, tiene su partida lista
 * con un botón. Se actualiza solo cada pocos segundos.
 */
export default function TarjetaTorneoAlumno({ cursoId, yoId, alIrAPartida }) {
  const [torneo, setTorneo] = useState(undefined); // undefined = cargando, null = no hay
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const lista = await obtenerTorneosDelCurso(cursoId);
      setTorneo(lista.find((t) => t.estado !== 'terminado') ?? lista[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el torneo.');
      setTorneo((actual) => (actual === undefined ? null : actual));
    }
  }, [cursoId]);

  useEffect(() => {
    cargar();
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, 6000);
    return () => clearInterval(temporizador);
  }, [cargar]);

  async function cambiarInscripcion() {
    setOcupado(true);
    setError(null);
    try {
      setTorneo(torneo.inscrito ? await bajarmeDelTorneo(torneo.id) : await inscribirmeEnTorneo(torneo.id));
    } catch (err) {
      setError(err.message || 'No se pudo cambiar tu inscripción.');
    } finally {
      setOcupado(false);
    }
  }

  if (torneo === undefined) return null;
  if (torneo === null) {
    return (
      <section className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-xs">
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">emoji_events</span>
          Torneo del curso
        </h2>
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay un torneo. Cuando tu docente arme uno, vas a poder inscribirte desde acá.
        </p>
        {error && <p role="alert" className="m-0 font-body-sm text-body-sm text-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-start justify-between gap-space-xs">
        <div className="min-w-0">
          <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">emoji_events</span>
            <span className="break-words min-w-0">{torneo.nombre}</span>
          </h2>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            {NOMBRE_ESTADO_TORNEO[torneo.estado] ?? torneo.estado} · {torneo.rondas} rondas · {textoDeReloj(torneo.control_tiempo_ms)} · {torneo.inscritos} inscritos
          </p>
        </div>
        {torneo.estado === 'inscripcion' && (
          <button
            type="button"
            onClick={cambiarInscripcion}
            disabled={ocupado}
            className={`${BOTON} ${torneo.inscrito ? 'bg-surface-container-high hover:bg-surface-bright text-on-surface' : 'bg-primary text-on-primary'}`}
          >
            {torneo.inscrito ? 'Bajarme del torneo' : 'Inscribirme'}
          </button>
        )}
      </div>

      {error && <p role="alert" className="m-0 px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</p>}

      {torneo.estado === 'inscripcion' && torneo.inscrito && (
        <p role="status" className="m-0 p-space-sm rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm">
          Estás inscrito. Cuando tu docente arme la primera ronda, acá te aparece tu partida.
        </p>
      )}

      {torneo.estado === 'en_juego' && torneo.mi_partida && (
        <div role="status" className="p-space-sm rounded-lg bg-primary/10 border border-primary/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-xs">
          <p className="m-0 font-body-sm text-body-sm text-on-surface break-words">
            <strong>Tu partida de la ronda {torneo.mi_partida.ronda} está lista</strong>
            {torneo.mi_partida.rival ? ` contra ${torneo.mi_partida.rival.nombre}` : ''}. El reloj corre desde que se arma la ronda.
          </p>
          <button type="button" onClick={() => alIrAPartida(torneo.mi_partida.codigo)} className={`${BOTON} bg-primary text-on-primary shrink-0`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>
            Ir a mi partida
          </button>
        </div>
      )}

      {torneo.estado === 'en_juego' && torneo.inscrito && !torneo.mi_partida && (
        <p role="status" className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Ya jugaste tu partida de esta ronda (o te tocó descansar). Esperá a que tu docente arme la siguiente.
        </p>
      )}

      {torneo.estado === 'en_juego' && !torneo.inscrito && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">El torneo ya empezó y no estás inscrito: mirá cómo va la tabla.</p>
      )}

      <TablaDeTorneo torneo={torneo} yoId={yoId} />
    </section>
  );
}
