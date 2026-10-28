import { useCallback, useEffect, useRef, useState } from 'react';
import {
  abandonarSala,
  cancelarSala,
  jugadasLegalesSala,
  moverEnSala,
  obtenerAnalisisSala,
  obtenerSala,
  ofrecerTablas,
  pedirRevancha,
  rechazarTablas,
} from '../../api/backend';
import ModalDenunciar from '../../componentes/ModalDenunciar';
import TableroJugable from '../../componentes/TableroJugable';
import { aplicarJugadaUciAFen, esPromocionDePeon, piezaEnCasilla } from '../../ajedrez';
import { enlaceDeSala, mensajeDeSala, textoDeReloj } from '../../enlaceJuego';
import { textoDeCambio, textoDePersona } from '../../elo';
import { enlaceDeWhatsApp } from '../../enlaceInvitacion';
import SelectorPromocion from '../SalaControl/SelectorPromocion';
import { formatearReloj } from '../SalaControl/useRelojAjedrez';

/** Segundos sin dar señal de vida a partir de los cuales el servidor da por perdida una partida con reloj (`SEGUNDOS_AUSENCIA_CON_RELOJ`). */
const SEGUNDOS_DE_AUSENCIA = 20;
/** Cada cuánto se consulta la sala (la consulta es también la señal de que el jugador sigue en pantalla). */
const INTERVALO_VISIBLE_MS = 1000;
const INTERVALO_OCULTA_MS = 3000;
const TIEMPO_CRITICO_MS = 30_000;

const MOTIVOS = {
  mate: 'por jaque mate',
  tablas: 'por tablas',
  acuerdo: 'por acuerdo: los dos aceptaron las tablas',
  abandono: 'por abandono',
  tiempo: 'por tiempo',
  tiempo_sin_material: 'por tiempo: el rival no tenía material para dar mate',
  ausencia: 'por ausencia: se fue de la partida con reloj',
  sin_respuesta: 'por inactividad: no respondió en 2 días',
  inactividad: 'por inactividad',
};

const BOTON =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-11 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_PRINCIPAL = `${BOTON} bg-primary text-on-primary font-medium hover:brightness-110`;
const BOTON_NEUTRO = `${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
const BOTON_PELIGRO = `${BOTON} bg-error/10 hover:bg-error/20 text-error`;

function esDelColor(pieza, color) {
  return Boolean(pieza) && (color === 'blancas' ? pieza === pieza.toUpperCase() : pieza === pieza.toLowerCase());
}

/** Cómo terminó la partida, contado desde quien mira: `{ titulo, detalle, tono }`. */
function resumenDelResultado(sala) {
  const motivo = MOTIVOS[sala.motivo_fin] ?? '';
  if (sala.resultado == null) return { titulo: 'Partida cancelada', detalle: motivo, tono: 'neutro' };
  if (sala.resultado === '1/2-1/2') return { titulo: 'Tablas', detalle: motivo, tono: 'neutro' };
  const ganaron = sala.resultado === '1-0' ? 'blancas' : 'negras';
  if (sala.rol === 'espectador') return { titulo: `Ganaron las ${ganaron}`, detalle: motivo, tono: 'neutro' };
  return sala.rol === ganaron
    ? { titulo: '¡Ganaste!', detalle: motivo, tono: 'bien' }
    : { titulo: 'Perdiste', detalle: motivo, tono: 'mal' };
}

/** Una de las dos franjas con quién juega, su nivel, si sigue conectado y cuánto tiempo le queda. */
function BarraJugador({ jugador, etiquetaColor, ms, activo, sinTiempo, esYo, conReloj, enCurso, nombreCompleto }) {
  const ausente = enCurso && conReloj && jugador?.ausente_s != null && jugador.ausente_s >= 5 && !esYo;
  const critico = ms != null && ms <= TIEMPO_CRITICO_MS;
  return (
    <div
      className={`w-full flex items-center justify-between gap-space-sm px-space-sm py-space-xs rounded-xl border ${
        activo ? 'bg-primary/10 border-primary/50' : 'bg-surface-container-low border-outline-variant/30'
      }`}
    >
      <div className="flex items-center gap-space-xs min-w-0">
        <span className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0">
          {jugador?.avatar_url ? (
            <img src={jugador.avatar_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">person</span>
          )}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">
            {jugador ? (esYo ? 'Vos' : nombreCompleto ? jugador.nombre : jugador.nombre_publico || jugador.nombre) : 'Esperando rival…'}
            <span className="ml-space-xs font-mono-micro text-mono-micro text-on-surface-variant uppercase">{etiquetaColor}</span>
          </span>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">
            {textoDePersona(jugador)}
          </span>
          {ausente && (
            <span role="status" className="font-mono-micro text-mono-micro text-error">
              Sin conexión hace {jugador.ausente_s} s · pierde en {Math.max(0, SEGUNDOS_DE_AUSENCIA - jugador.ausente_s)} s
            </span>
          )}
        </div>
      </div>
      {ms != null && (
        <span
          aria-label={sinTiempo ? 'sin tiempo' : `${formatearReloj(ms)} restantes`}
          className={`shrink-0 font-mono-metric text-[22px] leading-none tabular-nums px-2.5 py-1 rounded-lg ${
            sinTiempo || (activo && critico) ? 'text-error bg-error/15' : activo ? 'text-primary bg-primary/10' : 'text-on-surface-variant bg-on-surface/[0.04]'
          } ${activo && critico && !sinTiempo ? 'motion-safe:animate-pulse' : ''}`}
        >
          {formatearReloj(ms)}
        </span>
      )}
    </div>
  );
}

/** Las jugadas de a pares: `1. e4 e5  2. Nf3 Nc6`. */
function ListaDeJugadas({ jugadas }) {
  const pares = [];
  for (let i = 0; i < jugadas.length; i += 2) pares.push([jugadas[i], jugadas[i + 1]]);
  if (pares.length === 0) return <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay jugadas.</p>;
  return (
    <ol className="m-0 p-0 list-none grid grid-cols-[auto_1fr_1fr] gap-x-space-sm gap-y-1 font-mono-metric text-mono-metric max-h-48 overflow-y-auto">
      {pares.map(([blancas, negras], indice) => (
        <li key={indice} className="contents">
          <span className="text-on-surface-variant">{indice + 1}.</span>
          <span className="text-on-surface">{blancas}</span>
          <span className="text-on-surface">{negras ?? ''}</span>
        </li>
      ))}
    </ol>
  );
}

function ResumenDeAnalisis({ analisis }) {
  const bando = (datos, color) => (
    <div className="flex flex-col gap-0.5 p-space-xs rounded-lg bg-surface-container min-w-0">
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{color}</span>
      <span className="font-headline-sm text-headline-sm text-on-surface">{datos.precision != null ? `${Math.round(datos.precision)} %` : '—'}</span>
      <span className="font-mono-micro text-mono-micro text-on-surface-variant">
        {datos.mejores} mejores · {datos.imprecisiones} imprec. · {datos.errores} errores · {datos.blunders} graves
      </span>
    </div>
  );
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="grid grid-cols-2 gap-space-xs">
        {bando(analisis.blancas, 'Blancas')}
        {bando(analisis.negras, 'Negras')}
      </div>
      {analisis.momentos_clave?.slice(0, 3).map((momento) => (
        <p key={momento.ply} className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          <strong className="text-on-surface">Jugada {Math.ceil(momento.ply / 2)} ({momento.color}):</strong> {momento.explicacion}
        </p>
      ))}
    </div>
  );
}

/**
 * Una partida entre dos personas (una sala): el tablero, quién juega y cuánto tiempo le queda a cada uno. Consulta la sala cada segundo; esa
 * consulta es también la señal de que el jugador sigue en pantalla. En una sala con reloj no se puede dejar la partida: pasados 20 segundos sin
 * señal, el servidor la da por perdida. Sin reloj se puede salir y volver. Quien mira sin estar sentado (un docente) la ve en solo lectura.
 */
export default function PartidaEntrePersonas({ codigo, alSalir, alCambiarPartida = null, nombresCompletos = false }) {
  const [sala, setSala] = useState(null);
  const [error, setError] = useState(null);
  const [seleccion, setSeleccion] = useState(null); // { casilla, destinos }
  const [promocion, setPromocion] = useState(null); // { origen, destino }
  const [optimista, setOptimista] = useState(null); // { fen, plies }: la jugada propia dibujada mientras el servidor la confirma
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(null); // 'abandonar' | 'salir' | 'cancelar' | null
  const [analisis, setAnalisis] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [revancha, setRevancha] = useState(null); // null | 'enviando' | 'esperando'
  const [copiado, setCopiado] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState(null);
  const [ahora, setAhora] = useState(() => performance.now());
  const recibidoEn = useRef(performance.now());
  const terminadaRef = useRef(false);
  const seleccionToken = useRef(0);

  const aplicar = useCallback((nueva) => {
    setSala(nueva);
    recibidoEn.current = performance.now();
    terminadaRef.current = nueva.terminada;
    setOptimista((actual) => (actual && nueva.jugadas.length > actual.plies ? null : actual));
  }, []);

  // Consulta de la sala: cada segundo mientras la pantalla se ve, cada tres si está oculta; se detiene al terminar la partida.
  useEffect(() => {
    let cancelado = false;
    let temporizador;
    const consultar = async () => {
      try {
        const datos = await obtenerSala(codigo);
        if (!cancelado) {
          aplicar(datos);
          setError(null);
        }
      } catch (err) {
        if (!cancelado) setError(err.status === 404 ? 'Esta partida ya no existe.' : err.message || 'No se pudo consultar la partida.');
        if (err.status === 404) return;
      }
      if (!cancelado && !terminadaRef.current) {
        temporizador = setTimeout(consultar, document.visibilityState === 'visible' ? INTERVALO_VISIBLE_MS : INTERVALO_OCULTA_MS);
      }
    };
    consultar();
    const alVolver = () => {
      if (document.visibilityState === 'visible' && !terminadaRef.current) {
        clearTimeout(temporizador);
        consultar();
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [codigo, aplicar]);

  // Le avisa a la aplicación si el jugador tiene una partida en curso (y si es con reloj): si se va a otra pantalla, ella sigue dando señal de vida
  // por él y le recuerda volver; y mientras juega no le interrumpe con retos nuevos.
  const rolDeSala = sala?.rol;
  const vigente = Boolean(sala && sala.estado === 'en_curso' && !sala.terminada && rolDeSala !== 'espectador');
  const conRelojDeSala = Boolean(sala && sala.control_tiempo_ms > 0);
  const rivalDeSala = rolDeSala === 'blancas' ? sala?.negras?.nombre_publico : sala?.blancas?.nombre_publico;
  useEffect(() => {
    alCambiarPartida?.(vigente ? { codigo, rival: rivalDeSala ?? 'tu rival', conReloj: conRelojDeSala } : null);
  }, [vigente, codigo, rivalDeSala, conRelojDeSala, alCambiarPartida]);

  // El reloj en pantalla corre solo mientras el del servidor corre; cada respuesta lo vuelve a sincronizar.
  useEffect(() => {
    if (!sala?.reloj_corre || sala.terminada) return undefined;
    const intervalo = setInterval(() => setAhora(performance.now()), 200);
    return () => clearInterval(intervalo);
  }, [sala?.reloj_corre, sala?.terminada]);

  if (!sala) {
    return (
      <div className="w-full px-space-lg py-space-xl flex flex-col items-center gap-space-sm text-on-surface-variant" role="status">
        {error ? (
          <>
            <p role="alert" className="m-0 p-space-md rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm">{error}</p>
            <button type="button" onClick={alSalir} className={BOTON_NEUTRO}>Volver a jugar con otros</button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
            <span className="font-mono-micro text-mono-micro">Entrando a la partida…</span>
          </>
        )}
      </div>
    );
  }

  const rol = sala.rol; // 'blancas' | 'negras' | 'espectador'
  const miColor = rol === 'espectador' ? null : rol;
  const orientacion = rol === 'negras' ? 'negras' : 'blancas';
  const enCurso = sala.estado === 'en_curso' && !sala.terminada;
  const conReloj = sala.control_tiempo_ms > 0;
  const fenMostrado = optimista?.fen ?? sala.fen;
  const miTurno = enCurso && miColor != null && sala.turno === miColor;
  const puedeMover = miTurno && !enviando && !optimista && !promocion;
  const jugadorDe = (color) => sala[color];
  const arriba = orientacion === 'blancas' ? 'negras' : 'blancas';
  const abajo = orientacion === 'blancas' ? 'blancas' : 'negras';

  const restante = (color) => {
    const base = color === 'blancas' ? sala.tiempo_blancas_ms : sala.tiempo_negras_ms;
    if (base == null) return null;
    if (sala.reloj_corre && !sala.terminada && sala.turno === color) return Math.max(0, base - (ahora - recibidoEn.current));
    return base;
  };

  const limpiarSeleccion = () => {
    seleccionToken.current += 1;
    setSeleccion(null);
  };

  const enviarJugada = async (uci) => {
    setError(null);
    setEnviando(true);
    setOptimista({ fen: aplicarJugadaUciAFen(sala.fen, uci), plies: sala.jugadas.length });
    limpiarSeleccion();
    try {
      aplicar(await moverEnSala(codigo, uci));
    } catch (err) {
      setOptimista(null);
      setError(err.message || 'No se pudo jugar.');
    } finally {
      setEnviando(false);
    }
  };

  const elegirCasilla = async (casilla) => {
    const token = ++seleccionToken.current;
    setSeleccion({ casilla, destinos: [] });
    try {
      const destinos = await jugadasLegalesSala(codigo, casilla);
      if (seleccionToken.current === token) setSeleccion({ casilla, destinos });
    } catch {
      if (seleccionToken.current === token) setSeleccion(null);
    }
  };

  const alClicCasilla = (casilla) => {
    if (!puedeMover) return;
    if (seleccion?.destinos.includes(casilla)) {
      if (esPromocionDePeon(sala.fen, seleccion.casilla, casilla)) setPromocion({ origen: seleccion.casilla, destino: casilla });
      else enviarJugada(`${seleccion.casilla}${casilla}`);
      return;
    }
    if (casilla === seleccion?.casilla) return limpiarSeleccion();
    if (esDelColor(piezaEnCasilla(sala.fen, casilla), miColor)) elegirCasilla(casilla);
    else limpiarSeleccion();
  };

  const abandonar = async () => {
    setConfirmando(null);
    try {
      aplicar(await abandonarSala(codigo));
    } catch (err) {
      setError(err.message || 'No se pudo abandonar.');
    }
  };

  // Tablas: se ofrecen, el rival las acepta (la partida termina empatada) o las rechaza. La oferta vale mientras no se juegue otra jugada.
  // Antes de cierta cantidad de jugadas el servidor no deja ofrecerlas (evita pactar tablas al instante para mover puntos sin jugar).
  const demasiadoPronto = sala.jugadas.length < (sala.medias_jugadas_para_tablas ?? 0);
  const responderTablas = async (funcion, mensajeError) => {
    setError(null);
    try {
      aplicar(await funcion(codigo));
    } catch (err) {
      setError(err.message || mensajeError);
    }
  };

  const cancelar = async () => {
    setConfirmando(null);
    try {
      await cancelarSala(codigo);
      alSalir();
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la sala.');
    }
  };

  const verAnalisis = async () => {
    setCargandoAnalisis(true);
    try {
      setAnalisis(await obtenerAnalisisSala(codigo));
    } catch (err) {
      setError(err.message || 'No se pudo armar el análisis.');
    } finally {
      setCargandoAnalisis(false);
    }
  };

  const pedirLaRevancha = async () => {
    setRevancha('enviando');
    setError(null);
    try {
      await pedirRevancha(codigo);
      setRevancha('esperando'); // cuando la acepte, la aplicación te lleva sola a la partida nueva
    } catch (err) {
      setRevancha(null);
      setError(err.message || 'No se pudo pedir la revancha.');
    }
  };

  const enlace = enlaceDeSala(sala.codigo);
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const resultado = sala.terminada || ['terminada', 'abandonada'].includes(sala.estado) ? resumenDelResultado(sala) : null;
  const sentado = miColor != null;
  const rival = sentado ? (miColor === 'blancas' ? sala.negras : sala.blancas) : null;
  const esperando = sala.estado === 'esperando';

  return (
    <div className="w-full px-space-sm sm:px-space-lg py-space-md sm:py-space-lg flex flex-col items-center gap-space-sm animate-in fade-in duration-300">
      {error && (
        <div role="alert" className="w-full max-w-[920px] flex items-start justify-between gap-space-sm p-space-sm rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm">
          <span className="min-w-0 break-words">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar el aviso" className="shrink-0">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-space-md items-start justify-items-center lg:justify-items-stretch">
        <div className="w-full max-w-[clamp(300px,calc(100dvh-230px),560px)] flex flex-col items-center gap-space-xs">
          <BarraJugador
            jugador={jugadorDe(arriba)}
            etiquetaColor={arriba}
            ms={conReloj ? restante(arriba) : null}
            activo={enCurso && sala.turno === arriba}
            sinTiempo={sala.motivo_fin === 'tiempo' && sala.turno === arriba}
            esYo={miColor === arriba}
            conReloj={conReloj}
            enCurso={enCurso}
            nombreCompleto={nombresCompletos}
          />
          <TableroJugable
            fen={fenMostrado}
            orientacion={orientacion}
            seleccionada={seleccion?.casilla ?? null}
            destinos={seleccion?.destinos ?? []}
            ultimaJugada={sala.ultima_jugada_uci}
            alClicCasilla={alClicCasilla}
            deshabilitado={!puedeMover}
            miColor={miColor}
            miTurno={puedeMover}
            activoAnticipar={enCurso && miColor != null}
            puedeAnticipar={enCurso && miColor != null && !puedeMover && !promocion}
            obtenerDestinosLegales={(casilla) => jugadasLegalesSala(codigo, casilla)}
            jugar={(origen, destino, promocionLetra) => enviarJugada(`${origen}${destino}${promocionLetra}`)}
            claveDePartida={codigo}
          />
          <BarraJugador
            jugador={jugadorDe(abajo)}
            etiquetaColor={abajo}
            ms={conReloj ? restante(abajo) : null}
            activo={enCurso && sala.turno === abajo}
            sinTiempo={sala.motivo_fin === 'tiempo' && sala.turno === abajo}
            esYo={miColor === abajo}
            conReloj={conReloj}
            enCurso={enCurso}
            nombreCompleto={nombresCompletos}
          />
        </div>

        <aside className="w-full max-w-[560px] lg:max-w-none flex flex-col gap-space-sm">
          <section className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container-low shadow-md" aria-label="Estado de la partida">
            <div className="flex flex-wrap items-center justify-between gap-space-xs">
              <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">
                {esperando ? 'Esperando rival' : resultado ? resultado.titulo : miTurno ? 'Te toca jugar' : sentado ? 'Juega el rival' : 'Mirando la partida'}
              </h1>
              <span className="flex flex-wrap items-center gap-space-2xs">
                {sala.puntuada === false && (
                  <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary/15 text-on-surface">Amistosa</span>
                )}
                <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant">
                  {textoDeReloj(sala.control_tiempo_ms)}
                </span>
              </span>
            </div>
            {resultado?.detalle && <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Terminó {resultado.detalle}.</p>}
            {resultado && sentado && sala.puntuada === false && (
              <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Fue una partida amistosa: no mueve el Elo.</p>
            )}
            {resultado && sentado && sala.elo?.[miColor] && (
              <p role="status" className="m-0 font-body-sm text-body-sm text-on-surface">
                Tu Elo: {sala.elo[miColor].antes} → <strong>{sala.elo[miColor].despues}</strong>{' '}
                <span className={sala.elo[miColor].cambio > 0 ? 'text-primary' : sala.elo[miColor].cambio < 0 ? 'text-error' : 'text-on-surface-variant'}>({textoDeCambio(sala.elo[miColor].cambio)})</span>
              </p>
            )}
            {enCurso && conReloj && sentado && (
              <p className="m-0 flex items-start gap-space-xs font-mono-micro text-mono-micro text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] shrink-0 text-primary" aria-hidden="true">timer</span>
                Con reloj no se puede dejar la partida: si salís de esta pantalla más de {SEGUNDOS_DE_AUSENCIA} segundos, perdés. El reloj empieza cuando cada uno movió una vez.
              </p>
            )}
            {enCurso && !conReloj && sentado && (
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Sin reloj: podés salir y volver a seguir cuando quieras.</p>
            )}
          </section>

          {esperando && sentado && (
            <section className="flex flex-col gap-space-xs p-space-md rounded-xl bg-primary/10 border border-primary/30" aria-label="Invitar a un rival">
              <span className="font-body-sm text-body-sm text-on-surface">Mandá este código o enlace a quien quieras que juegue:</span>
              <span className="font-mono-metric text-[30px] tracking-[0.25em] text-on-surface select-all">{sala.codigo}</span>
              <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
                <a
                  href={enlaceDeWhatsApp(mensajeDeSala({ enlace, reloj: conReloj ? textoDeReloj(sala.control_tiempo_ms) : null }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${BOTON_PRINCIPAL} no-underline`}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
                  Enviar por WhatsApp
                </a>
                <button type="button" onClick={copiarEnlace} className={BOTON_NEUTRO}>
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'link'}</span>
                  {copiado ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
              </div>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">La partida empieza apenas entre. La sala se borra sola si nadie entra en 30 minutos.</p>
            </section>
          )}

          <section className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container-low shadow-md" aria-label="Jugadas">
            <h2 className="m-0 font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Jugadas</h2>
            <ListaDeJugadas jugadas={sala.jugadas} />
          </section>

          {resultado && sentado && sala.blancas && sala.negras && (
            <section className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container-low shadow-md" aria-label="Después de la partida">
              <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
                <button type="button" onClick={pedirLaRevancha} disabled={revancha != null} className={BOTON_PRINCIPAL}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">replay</span>
                  {revancha === 'esperando' ? 'Esperando que acepte…' : revancha === 'enviando' ? 'Pidiendo…' : 'Revancha'}
                </button>
                <button type="button" onClick={verAnalisis} disabled={cargandoAnalisis || analisis != null} className={BOTON_NEUTRO}>
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">troubleshoot</span>
                  {cargandoAnalisis ? 'Analizando…' : 'Ver análisis'}
                </button>
              </div>
              {analisis && <ResumenDeAnalisis analisis={analisis} />}
            </section>
          )}

          {enCurso && sentado && sala.blancas && sala.negras && (
            sala.tablas_ofrecidas_por && sala.tablas_ofrecidas_por !== miColor ? (
              <div role="alert" className="flex flex-col gap-space-xs p-space-md rounded-xl bg-tertiary/10 border border-tertiary/40">
                <p className="m-0 font-body-sm text-body-sm text-on-surface"><strong>Tu rival te ofrece tablas.</strong> Si aceptás, la partida termina empatada.</p>
                <div className="flex flex-wrap gap-space-xs">
                  <button type="button" onClick={() => responderTablas(ofrecerTablas, 'No se pudieron aceptar las tablas.')} className={BOTON_PRINCIPAL}>Aceptar tablas</button>
                  <button type="button" onClick={() => responderTablas(rechazarTablas, 'No se pudieron rechazar las tablas.')} className={BOTON_NEUTRO}>Rechazar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-space-2xs self-start">
                <button
                  type="button"
                  onClick={() => responderTablas(ofrecerTablas, 'No se pudieron ofrecer las tablas.')}
                  disabled={sala.tablas_ofrecidas_por === miColor || demasiadoPronto}
                  className={BOTON_NEUTRO}
                >
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">handshake</span>
                  {sala.tablas_ofrecidas_por === miColor ? 'Tablas ofrecidas, esperando respuesta…' : 'Ofrecer tablas'}
                </button>
                {demasiadoPronto && (
                  <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                    Se pueden ofrecer tablas cuando cada uno lleve {Math.ceil(sala.medias_jugadas_para_tablas / 2)} jugadas.
                  </p>
                )}
              </div>
            )
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-space-xs">
            {enCurso && sentado && (
              <button type="button" onClick={() => setConfirmando('abandonar')} className={BOTON_PELIGRO}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>
                Abandonar
              </button>
            )}
            {esperando && sentado && (
              <button type="button" onClick={() => setConfirmando('cancelar')} className={BOTON_PELIGRO}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                Cancelar sala
              </button>
            )}
            {sentado && !nombresCompletos && rival && (
              <button type="button" onClick={() => setDenunciando(true)} className={BOTON_NEUTRO}>
                <span className="material-symbols-outlined text-[18px] text-error" aria-hidden="true">report</span>
                Bloquear o denunciar
              </button>
            )}
            <button
              type="button"
              onClick={() => (enCurso && conReloj && sentado ? setConfirmando('salir') : alSalir())}
              className={BOTON_NEUTRO}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              {resultado ? 'Volver a jugar con otros' : 'Salir'}
            </button>
          </div>

          {confirmando && (
            <div role="alertdialog" aria-label="Confirmar" className="flex flex-col gap-space-xs p-space-md rounded-xl bg-error-container/40 border border-error/40">
              <p className="m-0 font-body-sm text-body-sm text-on-surface">
                {confirmando === 'abandonar' && 'Si abandonás, gana tu rival. ¿Seguro?'}
                {confirmando === 'salir' && `Esta partida tiene reloj: si te vas más de ${SEGUNDOS_DE_AUSENCIA} segundos, la perdés. ¿Salir igual?`}
                {confirmando === 'cancelar' && 'La sala se borra y el código deja de servir. ¿Cancelarla?'}
              </p>
              <div className="flex flex-wrap gap-space-xs">
                <button
                  type="button"
                  onClick={confirmando === 'abandonar' ? abandonar : confirmando === 'cancelar' ? cancelar : () => { setConfirmando(null); alSalir(); }}
                  className={BOTON_PELIGRO}
                >
                  {confirmando === 'abandonar' ? 'Sí, abandonar' : confirmando === 'cancelar' ? 'Sí, cancelar' : 'Sí, salir'}
                </button>
                <button type="button" onClick={() => setConfirmando(null)} className={BOTON_NEUTRO}>Seguir jugando</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {avisoLocal && (
        <p role="status" className="m-0 p-space-sm rounded-lg bg-primary/10 border border-primary/30 font-body-sm text-body-sm text-on-surface">{avisoLocal}</p>
      )}
      {denunciando && rival && (
        <ModalDenunciar
          persona={{ id: rival.id, nombre: rival.nombre_publico ?? rival.nombre }}
          codigoSala={sala.codigo}
          alCerrar={() => setDenunciando(false)}
          alListo={(mensaje) => {
            setDenunciando(false);
            setAvisoLocal(mensaje);
          }}
        />
      )}

      {promocion && (
        <SelectorPromocion
          esBlanca={miColor === 'blancas'}
          alElegir={(letra) => {
            const jugada = `${promocion.origen}${promocion.destino}${letra}`;
            setPromocion(null);
            enviarJugada(jugada);
          }}
          alCancelar={() => {
            setPromocion(null);
            limpiarSeleccion();
          }}
        />
      )}
    </div>
  );
}
