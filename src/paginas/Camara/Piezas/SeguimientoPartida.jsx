import { useCallback, useEffect, useRef, useState } from 'react';
import {
  avanzarSeguimientoPartida,
  deshacerJugadaSeguimiento,
  detenerSeguimientoPartida,
  fijarPosicionSeguimiento,
  iniciarSeguimientoPartida,
  retomarFotoBaseSeguimiento,
} from '../../../api/backend';
import TableroSoloLectura from '../../../componentes/TableroSoloLectura';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import VistaDecision from './VistaDecision';

const INTERVALO_MS = 250; // cuatro cuadros por segundo: la jugada se reconoce ~0,5 s después de soltar la pieza
const CADA_CUANTOS_CON_VISTA = 4; // las fotos de la comparación pesan: se piden una de cada cuatro veces
const FEN_INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const ETIQUETA = {
  tomando_base: ['Tomando la foto base…', 'text-on-surface-variant'],
  esperando: ['Esperando la próxima jugada', 'text-on-surface'],
  moviendo: ['Hay movimiento…', 'text-primary'],
  jugada: ['Jugada detectada', 'text-primary'],
  incompleta: ['Jugada a medias', 'text-primary'],
  invalida: ['Posición inválida', 'text-error'],
  dudosa: ['Jugada dudosa', 'text-error'],
};

/** Las jugadas en pares «1. e4 e5» para leerlas como en una planilla. */
function planilla(jugadas, blancasEmpiezan = true) {
  const filas = [];
  jugadas.forEach((san, i) => {
    const indice = blancasEmpiezan ? i : i + 1;
    if (indice % 2 === 0) filas.push([Math.floor(indice / 2) + 1, san, '']);
    else if (filas.length) filas[filas.length - 1][2] = san;
    else filas.push([Math.floor(indice / 2) + 1, '…', san]);
  });
  return filas;
}

/**
 * Seguimiento de la partida por DIFERENCIAS entre imágenes: la app conoce la posición y, una vez por segundo, compara el cuadro de la cámara con el anterior
 * y con la foto base. Cuando el tablero queda quieto, busca la jugada LEGAL que explica las casillas que cambiaron; si ninguna lo explica, avisa de una
 * posición inválida. No clasifica piezas, así que no depende de qué tan bien reconoce el modelo cada una.
 */
export default function SeguimientoPartida() {
  const [activo, setActivo] = useState(false);
  const [fenTexto, setFenTexto] = useState(FEN_INICIAL);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [avisoJugada, setAvisoJugada] = useState(null);
  const [verDecision, setVerDecision] = useState(true);
  const verDecisionRef = useRef(true);
  const temporizadorRef = useRef(null);
  const montadoRef = useRef(true);
  const blancasEmpiezanRef = useRef(true);
  const contadorRef = useRef(0);

  const detenerBucle = useCallback(() => {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    temporizadorRef.current = null;
  }, []);

  const pasar = useCallback(async () => {
    try {
      contadorRef.current += 1;
      const respuesta = await avanzarSeguimientoPartida(verDecisionRef.current && contadorRef.current % CADA_CUANTOS_CON_VISTA === 0);
      if (!montadoRef.current) return;
      setDatos((anterior) => ({ ...respuesta, vista: respuesta.vista ?? anterior?.vista }));
      setError(null);
      if (respuesta.estado === 'jugada') setAvisoJugada(`${respuesta.mensaje}`);
    } catch (e) {
      if (!montadoRef.current) return;
      if (e.status === 409) {
        setActivo(false);
        setError('El seguimiento se detuvo (el backend se reinició o alguien lo paró). Volvé a empezarlo.');
        return;
      }
      setError(e.message);
    }
    if (montadoRef.current) temporizadorRef.current = setTimeout(pasar, INTERVALO_MS);
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      detenerBucle();
    };
  }, [detenerBucle]);

  async function empezar() {
    setOcupado(true);
    setError(null);
    setAvisoJugada(null);
    try {
      const fen = fenTexto.trim() || FEN_INICIAL;
      const inicio = await iniciarSeguimientoPartida(fen, 'principal', INTERVALO_MS / 1000);
      blancasEmpiezanRef.current = (fen.split(' ')[1] ?? 'w') === 'w';
      setDatos({ ...inicio, mensaje: 'Esperando que el tablero esté quieto para tomar la foto base…' });
      setActivo(true);
      detenerBucle();
      temporizadorRef.current = setTimeout(pasar, INTERVALO_MS);
    } catch (e) {
      setError(e.status === 409 ? `${e.message}` : e.status === 422 ? `Posición inválida: ${e.message}` : e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function detener() {
    detenerBucle();
    setActivo(false);
    try {
      await detenerSeguimientoPartida();
    } catch {
      /* ya estaba detenido */
    }
  }

  function cambiarVerDecision(valor) {
    verDecisionRef.current = valor;
    setVerDecision(valor);
  }

  async function accion(llamada, alExito) {
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await llamada();
      setDatos((anterior) => ({ ...anterior, ...respuesta, mensaje: alExito(respuesta) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const deshacer = () => accion(deshacerJugadaSeguimiento, (r) => `Se quitó la jugada ${r.deshecha}. Esperando que el tablero esté quieto para tomar otra foto base…`);
  const retomarBase = () => accion(retomarFotoBaseSeguimiento, () => 'Esperando que el tablero esté quieto para tomar otra foto base…');

  async function fijarPosicion() {
    setOcupado(true);
    setError(null);
    try {
      setDatos(await fijarPosicionSeguimiento(fenTexto.trim() || FEN_INICIAL));
    } catch (e) {
      setError(e.status === 422 ? `Posición inválida: ${e.message}` : e.message);
    } finally {
      setOcupado(false);
    }
  }

  const estado = datos?.estado ?? 'esperando';
  const [textoEstado, colorEstado] = ETIQUETA[estado] ?? ETIQUETA.esperando;
  const filas = planilla(datos?.jugadas ?? [], blancasEmpiezanRef.current);

  return (
    <section className={`${CLASE_TARJETA} lg:col-span-2`} aria-labelledby="titulo-seguimiento">
      <h3 id="titulo-seguimiento" className="font-body-md text-body-md text-on-surface font-medium">
        Seguimiento de la partida (por diferencias entre fotos)
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Sabe la posición y, cada segundo, compara la cámara con la foto anterior. Cuando el tablero queda quieto, busca la jugada legal que explica lo que cambió; si
        ninguna lo explica, avisa de una posición inválida. No clasifica piezas, así que no depende de que el modelo las reconozca. Hace falta la cámara calibrada,
        las piezas en la posición de partida y buena luz.
      </p>
      <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
        Posición de partida (FEN)
        <input
          className="min-h-[44px] rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs font-mono-micro text-mono-micro"
          value={fenTexto}
          onChange={(e) => setFenTexto(e.target.value)}
          spellCheck={false}
          aria-label="Posición de partida en FEN"
        />
      </label>
      <div className="flex flex-wrap gap-space-xs">
        {!activo ? (
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={empezar} disabled={ocupado}>
            {ocupado ? 'Empezando…' : 'Empezar a seguir la partida'}
          </button>
        ) : (
          <>
            <button type="button" className={CLASE_BOTON} onClick={detener}>
              Detener
            </button>
            <button type="button" className={CLASE_BOTON} onClick={fijarPosicion} disabled={ocupado} title="Usa la posición de arriba como la actual (p. ej. después de que el robot jugó) y toma otra foto base">
              Fijar con el FEN de arriba
            </button>
            <button type="button" className={CLASE_BOTON} onClick={retomarBase} disabled={ocupado} title="Las piezas están bien pero la imagen no coincide con la foto: vuelve a tomarla con la posición actual">
              Volver a tomar la foto base
            </button>
            <button type="button" className={CLASE_BOTON} onClick={deshacer} disabled={ocupado || !datos?.puede_deshacer} title="Quita la última jugada si se detectó mal">
              Deshacer última jugada
            </button>
          </>
        )}
        <button type="button" className={CLASE_BOTON} onClick={() => setFenTexto(FEN_INICIAL)} disabled={activo && ocupado}>
          Posición inicial
        </button>
      </div>
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      {activo && datos && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md items-start">
          <div className="flex flex-col gap-space-xs min-w-0">
            <p className={`font-body-md text-body-md font-medium m-0 ${colorEstado}`} role="status" aria-live="polite">
              {textoEstado} · le toca a las {datos.turno}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0 break-words">{datos.mensaje}</p>
            {(estado === 'invalida' || estado === 'dudosa' || estado === 'incompleta') && datos.cambiadas?.length > 0 && (
              <p className={CLASE_AVISO} role="alert">
                {estado === 'invalida' ? '⚠ ' : ''}
                Casillas que cambiaron: <strong>{datos.cambiadas.join(', ')}</strong>
              </p>
            )}
            {avisoJugada && estado !== 'invalida' && (
              <p className="font-body-sm text-body-sm text-primary m-0" role="status">
                Última: {avisoJugada}
              </p>
            )}
            <div className="font-mono-micro text-mono-micro text-on-surface" aria-label="Jugadas detectadas">
              {filas.length === 0 ? (
                <span className="text-on-surface-variant">Todavía no se detectó ninguna jugada.</span>
              ) : (
                filas.map(([numero, blancas, negras]) => (
                  <div key={numero}>
                    {numero}. {blancas} {negras}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="w-full flex flex-col items-center gap-1">
            <TableroSoloLectura fen={datos.fen} />
            <span className="font-mono-micro text-mono-micro text-on-surface-variant break-all text-center">{datos.fen}</span>
          </div>
        </div>
      )}
      {activo && (
        <div className="flex flex-col gap-space-sm">
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface min-h-[44px]">
            <input type="checkbox" checked={verDecision} onChange={(e) => cambiarVerDecision(e.target.checked)} />
            Ver cómo decide (foto 1, foto 2 y la comparación)
          </label>
          {verDecision && <VistaDecision vista={datos?.vista} />}
        </div>
      )}
    </section>
  );
}
