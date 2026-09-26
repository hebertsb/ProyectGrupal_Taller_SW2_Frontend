import { useEffect, useState } from 'react';
import { obtenerPartida } from '../../api/backend';
import { turnoDeFen } from '../../ajedrez';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';

// Sondeo rápido — es una vista en vivo de la partida de otra persona (el
// facilitador), no la propia, así que necesita refrescar seguido para que se
// sienta "en vivo" de verdad (mismo espíritu que el resto del sondeo del
// proyecto, solo que más frecuente por eso).
const INTERVALO_SONDEO_MS = 1500;

function agruparJugadasPorRonda(jugadas) {
  const rondas = [];
  for (let i = 0; i < jugadas.length; i += 2) {
    rondas.push({ numero: i / 2 + 1, blancas: jugadas[i], negras: jugadas[i + 1] });
  }
  return rondas.reverse();
}

/**
 * Vista de SOLO LECTURA de una partida que el facilitador marcó como
 * demostración en vivo (`es_demostracion`) — un jugador la abre desde el
 * banner de Registro de Partidas. Nada de controles de facilitador acá: sin
 * E-STOP, sin simulación 3D, sin cámara, sin elegir nivel/oponente. Solo
 * mirar el tablero, de quién es el turno, y la lista de jugadas.
 */
export default function DemostracionEnVivo({ partidaId, alVolver }) {
  const [partida, setPartida] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!partidaId) {
      setCargando(false);
      return;
    }
    let cancelado = false;

    function sondear() {
      obtenerPartida(partidaId)
        .then((datos) => {
          if (cancelado) return;
          setPartida(datos);
          setError(null);
        })
        .catch((err) => {
          if (cancelado) return;
          setError(err.message || 'No se pudo cargar la transmisión.');
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }

    sondear();
    const intervalo = setInterval(sondear, INTERVALO_SONDEO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [partidaId]);

  if (!partidaId) {
    return (
      <div className="w-full px-space-lg py-space-lg flex flex-col items-center justify-center min-h-[40vh] text-center">
        <span className="material-symbols-outlined text-[48px] text-outline mb-2">live_tv</span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">No hay ninguna demostración para ver</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Tu facilitador todavía no activó ninguna transmisión en vivo.
        </p>
        <button
          onClick={alVolver}
          className="mt-4 px-space-lg py-space-md bg-primary text-on-primary rounded-xl font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="button"
        >
          Volver
        </button>
      </div>
    );
  }

  const turnoActual = partida?.fen ? turnoDeFen(partida.fen) : 'w';

  return (
    <div className="w-full px-space-lg py-space-md flex flex-col gap-space-lg max-w-[1100px] mx-auto animate-in fade-in duration-500">
      {/* SUB-BARRA DE ESTADO */}
      <div className="flex items-center justify-between px-space-md py-space-xs rounded-xl bg-surface-container-low/70 shadow-md flex-wrap gap-2">
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container shadow-[0_0_8px_#00e5ff]"></span>
            </span>
            <span className="font-mono-micro text-mono-micro tracking-widest text-primary uppercase font-medium">
              TRANSMISIÓN EN VIVO
            </span>
          </div>
          {partida?.usuario_nombre && (
            <>
              <div className="h-3 w-[1px] bg-surface-variant"></div>
              <span className="font-mono-label text-mono-label text-on-surface-variant">
                {partida.usuario_nombre}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-space-lg">
          {partida?.terminada ? (
            <span className="font-mono-metric text-mono-metric text-primary font-medium">TERMINADA — {partida.resultado}</span>
          ) : partida ? (
            <div className="flex items-center gap-space-xs font-mono-metric text-mono-metric">
              <span className="text-on-surface-variant font-mono-micro text-mono-micro uppercase">TURNO:</span>
              <span className="text-primary font-medium">{turnoActual === 'w' ? 'BLANCAS' : 'NEGRAS'}</span>
            </div>
          ) : null}
          <button
            onClick={alVolver}
            className="font-mono-micro text-mono-micro text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            SALIR
          </button>
        </div>
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      {partida && partida.es_demostracion === false && (
        <div className="px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface-variant font-body-sm text-body-sm flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[16px]">visibility_off</span>
          Tu facilitador dejó de transmitir esta partida. Podés seguir viendo la última posición.
        </div>
      )}

      {cargando && !partida ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Conectando con la transmisión…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">
          {/* TABLERO — SOLO LECTURA, sin manejadores de clic */}
          <div className="lg:col-span-2 flex flex-col items-center">
            <TableroSoloLectura fen={partida?.fen} tamano="grande" />
            <p className="font-mono-micro text-[10px] text-outline uppercase tracking-wide mt-space-sm text-center">
              Solo lectura — tu facilitador es quien juega esta partida
            </p>
          </div>

          {/* MOVIMIENTOS */}
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">format_list_numbered</span> MOVIMIENTOS
            </span>
            <div className="flex flex-col gap-1 font-mono-label text-mono-label max-h-[420px] overflow-y-auto">
              {(!partida?.jugadas || partida.jugadas.length === 0) && (
                <span className="font-mono-micro text-mono-micro text-outline px-2 py-1">Todavía no se jugó ninguna jugada.</span>
              )}
              {partida?.jugadas &&
                agruparJugadasPorRonda(partida.jugadas).map((ronda) => (
                  <div key={ronda.numero} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant">
                    <span className="text-outline w-6">{ronda.numero}.</span>
                    <span className="w-20">{ronda.blancas}</span>
                    <span className="w-20">{ronda.negras ?? '—'}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
