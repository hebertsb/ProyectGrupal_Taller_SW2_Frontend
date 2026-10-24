import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarPermisosPartida,
  crearPartida,
  detenerPartidaFisica,
  estadoControlBrazo,
  estadoPartidaFisica,
  iniciarPartidaFisica,
  jugadaManualPartidaFisica,
  pausarPartidaFisica,
  reanudarPartidaFisica,
  resolverIncidentePartidaFisica,
} from '../../../api/backend';
import TableroSoloLectura from '../../../componentes/TableroSoloLectura';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import VistaDecision from './VistaDecision';

const INTERVALO_MS = 1000;

const ETIQUETA = {
  esperando_humano: ['Tu turno: mové una pieza', 'text-on-surface'],
  turing_decide: ['Turing está pensando…', 'text-primary'],
  brazo_ejecuta: ['El brazo está moviendo una pieza', 'text-primary'],
  verificando: ['Comprobando el tablero…', 'text-primary'],
  esperando_robot_manual: ['Mové la pieza de Turing a mano', 'text-primary'],
  incidente: ['Incidente: la partida está detenida', 'text-error'],
  fin: ['Partida terminada', 'text-on-surface'],
};

function planilla(jugadas) {
  const filas = [];
  jugadas.forEach((san, i) => {
    if (i % 2 === 0) filas.push([Math.floor(i / 2) + 1, san, '']);
    else filas[filas.length - 1][2] = san;
  });
  return filas;
}

/**
 * Partida física: movés una pieza en el tablero real, la cámara lo detecta, Turing responde y el brazo (o vos, sin brazo) mueve su pieza. Si el brazo falla o el
 * tablero no coincide, la partida se detiene en un incidente hasta que lo resuelvas. Solo facilitador.
 */
export default function PartidaFisica() {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [usarBrazo, setUsarBrazo] = useState(false);
  const [precauciones, setPrecauciones] = useState(false);
  const [nivel, setNivel] = useState(18);
  const [jugadaManual, setJugadaManual] = useState('');
  const [verDecision, setVerDecision] = useState(true);
  const verDecisionRef = useRef(true);
  const montadoRef = useRef(true);
  const temporizadorRef = useRef(null);

  const consultar = useCallback(async () => {
    try {
      const datos = await estadoPartidaFisica(verDecisionRef.current);
      if (montadoRef.current) setEstado(datos);
    } catch (e) {
      if (montadoRef.current) setError(e.message);
    }
    if (montadoRef.current) temporizadorRef.current = setTimeout(consultar, INTERVALO_MS);
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    consultar();
    return () => {
      montadoRef.current = false;
      clearTimeout(temporizadorRef.current);
    };
  }, [consultar]);

  async function ejecutar(accion, alExito) {
    setOcupado(true);
    setError(null);
    try {
      const datos = await accion();
      if (alExito) alExito(datos);
      if (datos && montadoRef.current && 'estado' in datos) setEstado(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const empezar = () =>
    ejecutar(async () => {
      if (usarBrazo) {
        // Sin brazo conectado el sistema no mueve nada: mejor avisar antes de empezar que descubrirlo en la primera jugada.
        const brazo = await estadoControlBrazo();
        if (!brazo.conectado) throw new Error('No hay ningún brazo conectado: en «Control del brazo» conectá el brazo real (o el emulador), habilitalo e inicializá la pinza.');
        if (brazo.modo !== 5) throw new Error(`El brazo no está habilitado y libre (${brazo.modo_texto ?? 'estado desconocido'}): habilitalo en «Control del brazo».`);
      }
      const partida = await crearPartida(nivel, null, 'modelo');
      if (usarBrazo) await actualizarPermisosPartida(partida.id, { usa_brazo: true });
      return iniciarPartidaFisica(partida.id);
    });
  const detener = () => ejecutar(async () => { await detenerPartidaFisica(); setEstado({ activa: false }); return null; });
  const alternarPausa = () => ejecutar(() => (estado?.pausada ? reanudarPartidaFisica() : pausarPartidaFisica()));
  const resolver = (accion) => ejecutar(() => resolverIncidentePartidaFisica(accion));
  const enviarManual = () =>
    ejecutar(() => jugadaManualPartidaFisica(jugadaManual.trim()), () => setJugadaManual(''));

  const activa = estado?.activa;
  const [textoEstado, colorEstado] = ETIQUETA[estado?.estado] ?? ['', 'text-on-surface'];
  const filas = planilla(estado?.jugadas ?? []);

  return (
    <section className={`${CLASE_TARJETA} lg:col-span-2`} aria-labelledby="titulo-partida-fisica">
      <h3 id="titulo-partida-fisica" className="font-body-md text-body-md text-on-surface font-medium">
        Partida física: tú, la cámara, Turing y el brazo
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Movés una pieza en el tablero real, la cámara lo detecta, Turing responde y el brazo mueve su pieza (captura, enroque y coronación incluidos).
        Si algo falla, la partida se detiene en un incidente hasta que lo resuelvas.
      </p>

      {!activa && (
        <div className="flex flex-col gap-space-xs">
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface min-h-[44px]">
            Nivel de Turing (0 a 18)
            <input
              type="number"
              min={0}
              max={18}
              value={nivel}
              onChange={(e) => setNivel(Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
              className="w-20 min-h-[44px] rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs"
            />
          </label>
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface min-h-[44px]">
            <input type="checkbox" checked={usarBrazo} onChange={(e) => { setUsarBrazo(e.target.checked); setPrecauciones(false); }} />
            Usar el brazo real (si no, movés vos la pieza de Turing)
          </label>
          {usarBrazo && (
            <div className={CLASE_AVISO}>
              <label className="flex items-start gap-space-xs min-h-[44px]">
                <input type="checkbox" checked={precauciones} onChange={(e) => setPrecauciones(e.target.checked)} className="mt-1" />
                <span>
                  Hebert está en el laboratorio, la velocidad global está al 20 %, hay una mano en la parada de emergencia, las aperturas de cada pieza, el cementerio y
                  la dama de reserva están calibrados y probé la jugada primero en el emulador.
                </span>
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={empezar} disabled={ocupado || (usarBrazo && !precauciones)}>
              {ocupado ? 'Empezando…' : 'Empezar partida física'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}

      {activa && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md items-start">
          <div className="flex flex-col gap-space-xs min-w-0">
            <p className={`font-body-md text-body-md font-medium m-0 ${colorEstado}`} role="status" aria-live="polite">
              {estado.pausada ? 'Pausada · ' : ''}
              {textoEstado}
              {estado.usa_brazo ? '' : ' · sin brazo'}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0 break-words">{estado.mensaje}</p>

            {estado.estado === 'incidente' && (
              <div className={CLASE_AVISO} role="alert">
                <p className="m-0 font-medium">{estado.incidente}</p>
                <p className="m-0 mt-1">
                  Arreglá el tablero físico y elegí: <strong>Ya coincide</strong> si las piezas ya están como dice la posición de la derecha; <strong>Reintentar</strong>{' '}
                  si lo dejaste como estaba antes de la jugada del brazo y querés que la repita.
                </p>
                <div className="flex flex-wrap gap-space-xs mt-space-xs">
                  <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => resolver('continuar')} disabled={ocupado}>
                    Ya coincide: continuar
                  </button>
                  {estado.puede_reintentar && (
                    <button type="button" className={CLASE_BOTON} onClick={() => resolver('reintentar')} disabled={ocupado}>
                      Reintentar la jugada del brazo
                    </button>
                  )}
                </div>
              </div>
            )}

            {estado.seguimiento?.estado === 'invalida' && estado.estado === 'esperando_humano' && (
              <p className={CLASE_AVISO} role="alert">
                {estado.seguimiento.mensaje}
              </p>
            )}

            <div className="font-mono-micro text-mono-micro text-on-surface" aria-label="Jugadas">
              {filas.length === 0 ? (
                <span className="text-on-surface-variant">Todavía no hay jugadas.</span>
              ) : (
                filas.map(([n, blancas, negras]) => (
                  <div key={n}>
                    {n}. {blancas} {negras}
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-space-xs">
              <button type="button" className={CLASE_BOTON} onClick={alternarPausa} disabled={ocupado || estado.estado === 'fin'}>
                {estado.pausada ? 'Reanudar' : 'Pausar'}
              </button>
              <button type="button" className={CLASE_BOTON} onClick={detener} disabled={ocupado}>
                Detener
              </button>
            </div>

            {estado.estado === 'esperando_humano' && (
              <div className="flex flex-wrap items-end gap-space-xs">
                <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  La cámara no detecta tu jugada: escribila (Nf3 o g1f3)
                  <input
                    className="min-h-[44px] w-40 rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs font-mono-micro text-mono-micro"
                    value={jugadaManual}
                    onChange={(e) => setJugadaManual(e.target.value)}
                    spellCheck={false}
                    aria-label="Jugada que hiciste"
                  />
                </label>
                <button type="button" className={CLASE_BOTON} onClick={enviarManual} disabled={ocupado || !jugadaManual.trim()}>
                  Terminé mi jugada
                </button>
              </div>
            )}

            <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface min-h-[44px]">
              <input
                type="checkbox"
                checked={verDecision}
                onChange={(e) => {
                  verDecisionRef.current = e.target.checked;
                  setVerDecision(e.target.checked);
                }}
              />
              Ver cómo decide (foto base, foto de ahora y la comparación)
            </label>
            <details className="font-body-sm text-body-sm text-on-surface-variant">
              <summary className="cursor-pointer min-h-[44px] flex items-center">Registro de lo que pasó</summary>
              <ul className="m-0 pl-space-md">
                {[...(estado.eventos ?? [])].reverse().map((e, i) => (
                  <li key={`${e.hora}-${i}`} className="break-words">
                    {e.hora} · {e.texto}
                  </li>
                ))}
              </ul>
            </details>
          </div>
          <div className="w-full flex flex-col items-center gap-1">
            <TableroSoloLectura fen={estado.fen} />
            <span className="font-mono-micro text-mono-micro text-on-surface-variant break-all text-center">{estado.fen}</span>
          </div>
        </div>
      )}
      {activa && verDecision && <VistaDecision vista={estado.vista} />}
    </section>
  );
}
