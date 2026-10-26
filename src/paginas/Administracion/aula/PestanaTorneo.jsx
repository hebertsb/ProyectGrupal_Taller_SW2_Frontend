import { useCallback, useEffect, useState } from 'react';
import {
  cerrarTorneo,
  crearTorneo,
  inscribirATodosEnTorneo,
  iniciarRondaDeTorneo,
  obtenerTorneosDelCurso,
} from '../../../api/backend';
import TablaDeTorneo, { NOMBRE_ESTADO_TORNEO } from '../../../componentes/TablaDeTorneo';
import { BOTON_NEUTRO, BOTON_PELIGRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT } from '../../Suscripcion/comunes';

const RELOJES = [
  { valor: 180000, texto: '3 minutos por lado' },
  { valor: 300000, texto: '5 minutos por lado' },
  { valor: 600000, texto: '10 minutos por lado' },
  { valor: 900000, texto: '15 minutos por lado' },
];

function Alerta({ mensaje }) {
  return <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{mensaje}</div>;
}

function FormularioTorneo({ cursoId, alCrear }) {
  const [nombre, setNombre] = useState('Torneo relámpago');
  const [reloj, setReloj] = useState(300000);
  const [rondas, setRondas] = useState('3');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  async function crear(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await crearTorneo({ cursoId, nombre: nombre.trim(), controlTiempoMs: reloj, rondas: Number(rondas) });
      alCrear();
    } catch (err) {
      setError(err.message || 'No se pudo armar el torneo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={crear} className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs p-space-sm rounded-xl bg-surface-container-low">
      <div className="sm:col-span-3 flex flex-col gap-space-2xs">
        <label htmlFor={`torneo-nombre-${cursoId}`} className={CLASE_ETIQUETA}>Nombre del torneo</label>
        <input id={`torneo-nombre-${cursoId}`} value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={3} maxLength={60} required className={CLASE_INPUT} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-space-2xs">
        <label htmlFor={`torneo-reloj-${cursoId}`} className={CLASE_ETIQUETA}>Reloj</label>
        <select id={`torneo-reloj-${cursoId}`} value={reloj} onChange={(e) => setReloj(Number(e.target.value))} className={CLASE_INPUT}>
          {RELOJES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`torneo-rondas-${cursoId}`} className={CLASE_ETIQUETA}>Rondas</label>
        <input id={`torneo-rondas-${cursoId}`} type="number" inputMode="numeric" min={1} max={9} value={rondas} onChange={(e) => setRondas(e.target.value)} required className={CLASE_INPUT} />
      </div>
      {error && <div className="sm:col-span-3"><Alerta mensaje={error} /></div>}
      <button type="submit" disabled={ocupado || nombre.trim().length < 3} className={`${BOTON_PRINCIPAL} sm:col-span-3 sm:justify-self-start`}>
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">emoji_events</span>
        {ocupado ? 'Armando…' : 'Armar torneo'}
      </button>
    </form>
  );
}

/**
 * Torneo relámpago (suizo) del curso: el docente lo arma, inscribe a todos los alumnos que pueden jugar con otros, arma cada ronda (el sistema empareja por puntos y
 * crea las salas; a cada alumno le llega el aviso en su pantalla) y sigue la tabla. Con reloj, así que nadie se queda pensando: el que se ausenta pierde.
 */
export default function PestanaTorneo({ curso, alMirarPartida = null }) {
  const [torneos, setTorneos] = useState(undefined);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [puedeForzar, setPuedeForzar] = useState(false);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setTorneos(await obtenerTorneosDelCurso(curso.id));
      setError((previo) => (previo && previo.startsWith('No se pudo cargar') ? null : previo));
    } catch (err) {
      setError(`No se pudo cargar los torneos: ${err.message || 'error de red'}`);
      setTorneos((actual) => (actual === undefined ? [] : actual));
    }
  }, [curso.id]);

  useEffect(() => {
    cargar();
    const temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, 6000);
    return () => clearInterval(temporizador);
  }, [cargar]);

  const activo = (torneos ?? []).find((t) => t.estado !== 'terminado') ?? null;
  const ultimo = (torneos ?? [])[0] ?? null;
  const torneo = activo ?? ultimo;

  async function ejecutar(accion, mensajeError) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      return await accion();
    } catch (err) {
      setError(err.message || mensajeError);
      return undefined;
    } finally {
      setOcupado(false);
    }
  }

  async function inscribirATodos() {
    const respuesta = await ejecutar(() => inscribirATodosEnTorneo(torneo.id), 'No se pudo inscribir a los alumnos.');
    if (respuesta) {
      const omitidos = respuesta.omitidos ?? [];
      setAviso(
        `Se inscribieron ${respuesta.inscritos} alumno${respuesta.inscritos === 1 ? '' : 's'}.` +
          (omitidos.length > 0 ? ` No se pudo inscribir a: ${omitidos.map((o) => `${o.nombre} (${o.motivo})`).join('; ')}.` : ''),
      );
      cargar();
    }
  }

  async function armarRonda(forzar = false) {
    setPuedeForzar(false);
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await iniciarRondaDeTorneo(torneo.id, forzar);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo armar la ronda.');
      if (err.status === 409 && /terminar/.test(err.message || '')) setPuedeForzar(true);
    } finally {
      setOcupado(false);
    }
  }

  async function cerrar() {
    setConfirmandoCierre(false);
    await ejecutar(() => cerrarTorneo(torneo.id), 'No se pudo cerrar el torneo.');
    cargar();
  }

  if (torneos === undefined) return <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Cargando torneos…</p>;

  return (
    <div className="flex flex-col gap-space-sm">
      {error && <Alerta mensaje={error} />}
      {aviso && <p role="status" className="m-0 p-space-sm rounded-lg bg-primary/10 border border-primary/30 font-body-sm text-body-sm text-on-surface break-words">{aviso}</p>}

      {!activo && (
        <>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Un torneo relámpago hace que todo el curso juegue entre sí por rondas, con reloj. Vos lo armás, inscribís a todos con un botón y vas armando las rondas: el
            sistema empareja por puntos, reparte los colores y les avisa a los alumnos en su pantalla. Un curso tiene un solo torneo abierto a la vez.
          </p>
          <FormularioTorneo cursoId={curso.id} alCrear={cargar} />
        </>
      )}

      {torneo && (
        <section aria-label={torneo.nombre} className="flex flex-col gap-space-sm p-space-sm rounded-xl bg-surface-container-low min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-space-xs">
            <div className="min-w-0">
              <h3 className="m-0 font-body-md text-body-md font-medium text-on-surface break-words">{torneo.nombre}</h3>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                {NOMBRE_ESTADO_TORNEO[torneo.estado]} · ronda {torneo.ronda_actual} de {torneo.rondas} · {Math.round(torneo.control_tiempo_ms / 60000)} min por lado · {torneo.inscritos} inscritos
              </p>
            </div>
          </div>

          {torneo.estado === 'inscripcion' && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
              <button type="button" onClick={inscribirATodos} disabled={ocupado} className={BOTON_NEUTRO}>
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">group_add</span>
                Inscribir a todos los alumnos
              </button>
              <button type="button" onClick={() => armarRonda(false)} disabled={ocupado || torneo.inscritos < 2} className={BOTON_PRINCIPAL}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>
                Armar la primera ronda
              </button>
            </div>
          )}

          {torneo.estado === 'en_juego' && torneo.ronda_actual < torneo.rondas && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
              <button type="button" onClick={() => armarRonda(false)} disabled={ocupado} className={BOTON_PRINCIPAL}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">skip_next</span>
                Armar la ronda {torneo.ronda_actual + 1}
              </button>
              {puedeForzar && (
                <button type="button" onClick={() => armarRonda(true)} disabled={ocupado} className={BOTON_PELIGRO}>
                  Forzar: dejar sin ganador las que siguen abiertas
                </button>
              )}
            </div>
          )}

          {torneo.estado === 'en_juego' && torneo.ronda_actual >= torneo.rondas && (
            <p role="status" className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              Es la última ronda: el torneo termina solo cuando terminan todas las partidas.
            </p>
          )}

          {torneo.estado !== 'terminado' && (
            confirmandoCierre ? (
              <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
                <p className="m-0 font-body-sm text-body-sm text-on-surface">¿Cerrar el torneo ahora? Las partidas sin terminar quedan sin ganador y la tabla queda como está.</p>
                <div className="flex flex-wrap gap-space-xs">
                  <button type="button" onClick={cerrar} disabled={ocupado} className={BOTON_PELIGRO}>Sí, cerrar el torneo</button>
                  <button type="button" onClick={() => setConfirmandoCierre(false)} className={BOTON_NEUTRO}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmandoCierre(true)} disabled={ocupado} className={`${BOTON_NEUTRO} self-start`}>
                Cerrar el torneo ahora
              </button>
            )
          )}

          <TablaDeTorneo torneo={torneo} alMirar={alMirarPartida} />
        </section>
      )}

      {!activo && torneos.length > 1 && (
        <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Torneos anteriores de este curso: {torneos.slice(1).map((t) => t.nombre).join(', ')}.</p>
      )}
    </div>
  );
}
