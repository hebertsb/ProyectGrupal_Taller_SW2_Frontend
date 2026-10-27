import { useCallback, useEffect, useState } from 'react';
import { marcarDenunciaRevisada, obtenerDenuncias, obtenerPartidasEnVivo } from '../../api/backend';
import { textoDeReloj } from '../../enlaceJuego';
import { BOTON_NEUTRO } from '../Suscripcion/comunes';
import { formatearReloj } from '../SalaControl/useRelojAjedrez';

const INTERVALO_MS = 5000;
const MOTIVOS_DENUNCIA = { conducta: 'Mala conducta', trampa: 'Trampa', abandono: 'Abandono', otro: 'Otro motivo' };

/**
 * Las denuncias que hicieron los alumnos contra otros alumnos del docente (con los nombres completos). Cada una se marca como revisada cuando el docente ya habló
 * con quien corresponde; las revisadas quedan abajo. Si una denuncia trae el código de una partida, la partida se puede mirar si todavía sigue abierta.
 */
function BandejaDeDenuncias({ alMirar }) {
  const [denuncias, setDenuncias] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDenuncias(await obtenerDenuncias());
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las denuncias.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function revisar(id) {
    try {
      await marcarDenunciaRevisada(id);
      cargar();
    } catch (err) {
      setError(err.message || 'No se pudo marcar como revisada.');
    }
  }

  const nuevas = (denuncias ?? []).filter((d) => d.estado === 'nueva');
  const revisadas = (denuncias ?? []).filter((d) => d.estado !== 'nueva');
  if (!error && denuncias && denuncias.length === 0) return null;

  const Fila = ({ denuncia }) => (
    <li className={`flex flex-col gap-space-2xs p-space-sm rounded-xl min-w-0 ${denuncia.estado === 'nueva' ? 'bg-tertiary/10 border border-tertiary/30' : 'bg-surface-container'}`}>
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="font-body-sm text-body-sm text-on-surface break-words min-w-0">
          <strong>{denuncia.denunciante ?? 'Un alumno'}</strong> denunció a <strong>{denuncia.denunciado ?? 'otro alumno'}</strong>
        </span>
        <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{MOTIVOS_DENUNCIA[denuncia.motivo] ?? denuncia.motivo}</span>
      </div>
      {denuncia.detalle && <p className="m-0 font-body-sm text-body-sm text-on-surface-variant break-words">«{denuncia.detalle}»</p>}
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">{new Date(denuncia.creada_en).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        {denuncia.codigo_sala && alMirar && (
          <button type="button" onClick={() => alMirar(denuncia.codigo_sala)} className={BOTON_NEUTRO}>Ver la partida</button>
        )}
        {denuncia.estado === 'nueva' && (
          <button type="button" onClick={() => revisar(denuncia.id)} className={BOTON_NEUTRO}>
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">done</span>
            Ya la revisé
          </button>
        )}
      </div>
    </li>
  );

  return (
    <section aria-label="Denuncias" className="flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[22px] text-tertiary" aria-hidden="true">flag</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Denuncias de tus alumnos{nuevas.length > 0 ? ` (${nuevas.length} nueva${nuevas.length === 1 ? '' : 's'})` : ''}</h2>
      </div>
      {error && <div role="alert" className="p-space-sm rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
        {nuevas.map((d) => <Fila key={d.id} denuncia={d} />)}
        {revisadas.slice(0, 10).map((d) => <Fila key={d.id} denuncia={d} />)}
      </ul>
    </section>
  );
}

function Jugador({ jugador, color, ms, juega }) {
  return (
    <div className={`flex items-center justify-between gap-space-xs min-w-0 px-space-xs py-space-2xs rounded-lg ${juega ? 'bg-primary/10' : ''}`}>
      <span className="font-body-sm text-body-sm text-on-surface truncate min-w-0">
        {jugador ? jugador.nombre : 'Esperando rival…'}
        <span className="ml-space-xs font-mono-micro text-mono-micro uppercase text-on-surface-variant">{color}</span>
        {jugador?.nivel != null && <span className="ml-space-xs font-mono-micro text-mono-micro text-on-surface-variant">N{jugador.nivel}</span>}
        {jugador?.elo != null && <span className="ml-space-xs font-mono-micro text-mono-micro text-on-surface-variant">Elo {jugador.elo}</span>}
      </span>
      {ms != null && <span className="font-mono-metric text-mono-metric tabular-nums text-on-surface-variant shrink-0">{formatearReloj(ms)}</span>}
    </div>
  );
}

/**
 * Las partidas que están jugando ahora los alumnos entre sí (retos entre compañeros, amigos y rivales de su nivel): quién juega, con qué reloj y cuántas jugadas llevan.
 * Con «Mirar» el docente ve la partida en vivo, en solo lectura. Se actualiza cada pocos segundos.
 */
export default function PartidasEntreAlumnos({ alMirar }) {
  const [partidas, setPartidas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    let temporizador;
    const cargar = async () => {
      try {
        const datos = await obtenerPartidasEnVivo();
        if (!cancelado) {
          setPartidas(datos);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) setError(err.message || 'No se pudo cargar la lista.');
      }
      if (!cancelado) temporizador = setTimeout(cargar, INTERVALO_MS);
    };
    cargar();
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, []);

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">swords</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Partidas entre alumnos</h1>
        </div>
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Lo que están jugando ahora tus alumnos entre sí. Podés mirar cualquier partida en vivo; no ves el chat porque no hay: solo juegan.
        </p>
      </div>

      <BandejaDeDenuncias alMirar={alMirar} />

      {error && <div role="alert" className="p-space-md rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      {!partidas && !error && <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando…</span>}
      {partidas && partidas.length === 0 && (
        <p className="m-0 p-space-md rounded-xl bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
          Ahora no hay ninguna partida abierta. Cuando tus alumnos se reten, busquen rival o creen una partida, aparecen acá.
        </p>
      )}

      {partidas && partidas.length > 0 && (
        <ul className="m-0 p-0 list-none grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {partidas.map((partida) => (
            <li key={partida.codigo} className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container-low shadow-md min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-space-xs">
                <span className={`font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${partida.estado === 'en_curso' ? 'bg-primary-container/30 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {partida.estado === 'en_curso' ? 'En curso' : 'Esperando rival'}
                </span>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                  {textoDeReloj(partida.control_tiempo_ms)} · {partida.jugadas} {partida.jugadas === 1 ? 'jugada' : 'jugadas'}
                </span>
              </div>
              <Jugador jugador={partida.negras} color="negras" ms={partida.tiempo_negras_ms} juega={partida.estado === 'en_curso' && partida.turno === 'negras'} />
              <Jugador jugador={partida.blancas} color="blancas" ms={partida.tiempo_blancas_ms} juega={partida.estado === 'en_curso' && partida.turno === 'blancas'} />
              <button type="button" onClick={() => alMirar(partida.codigo)} className={`${BOTON_NEUTRO} self-start`}>
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">visibility</span>
                Mirar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
