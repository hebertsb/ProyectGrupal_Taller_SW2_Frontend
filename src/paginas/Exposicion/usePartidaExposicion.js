import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarPermisosPartida,
  cancelarLecturaPartidaFisica,
  corregirPosicionPartidaFisica,
  crearPartida,
  detenerPartidaFisica,
  estadoControlBrazo,
  estadoPartidaFisica,
  inferenciaModelo,
  iniciarPartidaFisica,
  jugadaManualPartidaFisica,
  pausarPartidaFisica,
  reanudarPartidaFisica,
  resolverIncidentePartidaFisica,
  retomarFotoBasePartidaFisica,
} from '../../api/backend';
import { POSICION_INICIAL_FEN, aplicarJugadaUciAFen, sanAUci } from '../../ajedrez';

const INTERVALO_MS = 300; // el estado solo pesa unos bytes
const INTERVALO_SIN_PARTIDA_MS = 1500;
const INTERVALO_SIN_CONEXION_MS = 2000;
const INTERVALO_OCULTA_MS = 3000;
const CADA_CUANTOS_CON_VISTA = 3; // las fotos de la comparación pesan (~80 KB): una de cada tres consultas

/**
 * La partida física (`/partida-fisica`) para la pantalla de exposición: consulta el estado, y da las acciones (empezar, pausar, detener, resolver un incidente,
 * jugada manual). Pide las fotos de «cómo reconoce» solo si `conVista`. Con la pestaña oculta no pide las fotos y consulta más despacio.
 */
export function usePartidaExposicion({ conVista = true } = {}) {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const conVistaRef = useRef(conVista);
  const montadoRef = useRef(true);
  const temporizadorRef = useRef(null);
  const contadorRef = useRef(0);
  conVistaRef.current = conVista;

  const consultar = useCallback(async () => {
    let espera = INTERVALO_MS;
    const visible = document.visibilityState === 'visible';
    try {
      contadorRef.current += 1;
      const datos = await estadoPartidaFisica(visible && conVistaRef.current && contadorRef.current % CADA_CUANTOS_CON_VISTA === 0);
      if (montadoRef.current) {
        setEstado((anterior) => ({ ...datos, vista: datos.vista ?? (datos.activa ? anterior?.vista : undefined) }));
        setSinConexion(false);
      }
      if (!datos.activa) espera = INTERVALO_SIN_PARTIDA_MS;
    } catch {
      if (montadoRef.current) setSinConexion(true);
      espera = INTERVALO_SIN_CONEXION_MS;
    }
    if (!visible) espera = Math.max(espera, INTERVALO_OCULTA_MS);
    if (montadoRef.current) temporizadorRef.current = setTimeout(consultar, espera);
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    consultar();
    return () => {
      montadoRef.current = false;
      clearTimeout(temporizadorRef.current);
    };
  }, [consultar]);

  const ejecutar = useCallback(async (accion) => {
    setOcupado(true);
    setError(null);
    try {
      const datos = await accion();
      if (datos && montadoRef.current && 'estado' in datos) setEstado((anterior) => ({ ...datos, vista: anterior?.vista }));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);

  const empezar = useCallback(
    ({ nivel, usarBrazo, tiempoPersonaS = 0, tiempoTuringS = 0, brazoCuenta = false }) =>
      ejecutar(async () => {
        if (usarBrazo) {
          // Sin brazo conectado el sistema no mueve nada: mejor avisar antes de empezar que descubrirlo en la primera jugada.
          const brazo = await estadoControlBrazo();
          if (!brazo.conectado) throw new Error('No hay ningún brazo conectado: en «Control del brazo» conectá el brazo real (o el emulador), habilitalo e inicializá la pinza.');
          if (brazo.modo !== 5) throw new Error(`El brazo no está habilitado y libre (${brazo.modo_texto ?? 'estado desconocido'}): habilitalo en «Control del brazo».`);
        }
        const partida = await crearPartida(nivel, null, 'modelo');
        if (usarBrazo) await actualizarPermisosPartida(partida.id, { usa_brazo: true });
        return iniciarPartidaFisica(partida.id, 'principal', { tiempo_persona_s: tiempoPersonaS, tiempo_turing_s: tiempoTuringS, brazo_cuenta: brazoCuenta });
      }),
    [ejecutar]
  );
  const detener = useCallback(
    () =>
      ejecutar(async () => {
        await detenerPartidaFisica();
        setEstado({ activa: false });
        return null;
      }),
    [ejecutar]
  );
  const alternarPausa = useCallback(() => ejecutar(() => (estado?.pausada ? reanudarPartidaFisica() : pausarPartidaFisica())), [ejecutar, estado?.pausada]);
  const resolver = useCallback((accion) => ejecutar(() => resolverIncidentePartidaFisica(accion)), [ejecutar]);
  const cancelarLectura = useCallback(() => ejecutar(() => cancelarLecturaPartidaFisica()), [ejecutar]);
  /** Corrige la posición a `fen`. Devuelve `{ ok, error }` (el error es para mostrarlo en el propio editor, no arriba). */
  const corregirPosicion = useCallback(
    async (fen) => {
      setOcupado(true);
      try {
        const datos = await corregirPosicionPartidaFisica(fen);
        if (montadoRef.current) setEstado((anterior) => ({ ...datos, vista: anterior?.vista }));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        setOcupado(false);
      }
    },
    []
  );
  const retomarBase = useCallback(() => ejecutar(() => retomarFotoBasePartidaFisica()), [ejecutar]);
  const jugadaManual = useCallback((movimiento) => ejecutar(() => jugadaManualPartidaFisica(movimiento)), [ejecutar]);

  return { estado, error, sinConexion, ocupado, empezar, detener, alternarPausa, resolver, retomarBase, jugadaManual, cancelarLectura, corregirPosicion };
}

/** Las posiciones de la partida (`fens[i]` = tras `i` jugadas) y la jugada UCI de cada una (`ucis[i]` = la que lleva de `fens[i]` a `fens[i + 1]`). Se detiene en la primera jugada que no entienda. */
export function reconstruirPartida(jugadas) {
  const fens = [POSICION_INICIAL_FEN];
  const ucis = [];
  for (const san of jugadas) {
    const { uci } = sanAUci(fens[fens.length - 1], san);
    if (!uci) break;
    ucis.push(uci);
    fens.push(aplicarJugadaUciAFen(fens[fens.length - 1], uci));
  }
  return { fens, ucis };
}

/**
 * Lo que «piensa» la red de Turing en la posición donde él decide: la actual si le toca (negras) o, si ya respondió, la anterior a su última jugada. Pide la
 * inferencia una sola vez por posición. `jugadaTuring` es la jugada que Turing acaba de hacer (UCI), para marcarla en el tablero.
 */
export function useCerebroTuring(estado) {
  const [inferencia, setInferencia] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const pedidaRef = useRef('');
  const secuenciaRef = useRef(0);
  const activa = Boolean(estado?.activa);
  const fen = estado?.fen;
  const turno = estado?.turno;
  const claveJugadas = (estado?.jugadas ?? []).join(' ');

  const { fens, ucis } = reconstruirPartida(claveJugadas ? claveJugadas.split(' ') : []);
  const cantidad = ucis.length;
  const turingAcabaDeJugar = cantidad > 0 && cantidad % 2 === 0 && turno === 'blancas';
  const jugadaTuring = turingAcabaDeJugar ? ucis[cantidad - 1] : null;
  const objetivo = !activa ? null : turno === 'negras' ? fen : turingAcabaDeJugar ? fens[cantidad - 1] : null;

  useEffect(() => {
    if (!activa) {
      pedidaRef.current = '';
      secuenciaRef.current += 1;
      setInferencia(null);
      setAnalizando(false);
      return;
    }
    // La posición se identifica por piezas y turno: la reconstruida desde las jugadas no lleva bien los derechos de enroque ni los contadores.
    const clave = objetivo ? objetivo.split(' ').slice(0, 2).join(' ') : '';
    if (!clave || pedidaRef.current === clave) return;
    pedidaRef.current = clave;
    const mia = ++secuenciaRef.current;
    setAnalizando(true);
    inferenciaModelo(objetivo)
      .then((resultado) => mia === secuenciaRef.current && setInferencia({ fen: objetivo, ...resultado }))
      .catch(() => {
        // No rompe la pantalla: se queda con lo último que se pudo calcular. Se permite reintentar esta posición.
        if (mia === secuenciaRef.current) pedidaRef.current = '';
      })
      .finally(() => mia === secuenciaRef.current && setAnalizando(false));
  }, [activa, objetivo]);

  return { inferencia, analizando, jugadaTuring };
}
