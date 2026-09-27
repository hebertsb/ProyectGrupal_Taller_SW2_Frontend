import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import './SalaControl.css';
import AvatarAgente3D from '../../componentes/AvatarAgente3D';
import SimuladorBrazoTablero3D from '../../componentes/SimuladorBrazoTablero3D';
import { useRazonamiento } from '../../contexto/ContextoRazonamiento';
import {
  abrirSimulacion3D,
  actualizarPermisosPartida,
  analizarPosicion,
  backendEnLinea,
  crearPartida,
  moverPartida,
  moverPartidaDesdeFoto,
  obtenerJugadasLegales,
  obtenerPartida,
  reconocerTablero,
  urlFotoCamara,
} from '../../api/backend';
import {
  claseDePieza,
  detectarMovimientosVisuales,
  esPromocionDePeon,
  fenAMatriz,
  nombreCasilla,
  piezaEnCasilla,
  rutaImagenPieza,
  turnoDeFen,
} from '../../ajedrez';

gsap.registerPlugin(useGSAP);

const DURACION_VUELO_PIEZA = 0.28; // segundos — deslizamiento contenido, no un efecto largo

const NIVEL_MAX = 20;
const NIVEL_INICIAL = 8; // arranca en "Intermedio", no siempre al máximo

// Niveles de Stockfish (0-20, "Skill Level") agrupados por franja de dificultad,
// para que elegir el nivel sea más legible que un número suelto.
const NIVELES_POR_CATEGORIA = [
  { etiqueta: 'Básico', desde: 0, hasta: 6 },
  { etiqueta: 'Intermedio', desde: 7, hasta: 13 },
  { etiqueta: 'Avanzado', desde: 14, hasta: NIVEL_MAX },
];

function categoriaDeNivel(n) {
  if (n <= 6) return 'Principiante';
  if (n <= 13) return 'Intermedio';
  return 'Avanzado';
}

// Cuando el facilitador está mirando la partida de OTRA persona (no la propia,
// no la de un jugador viendo la suya), nadie mueve piezas desde esta pantalla
// — así que si no se sondea el backend, el tablero/análisis queda congelado
// en la foto de cuando se cargó. Mismo espíritu que el polling de
// DemostracionEnVivo/Monitoreo, un poco menos agresivo porque acá conviven con
// el heartbeat de "backend conectado" y el resto de la UI de Sala de Control.
const INTERVALO_SONDEO_PARTIDA_AJENA_MS = 2500;

export default function SalaControl({
  partidaIdInicial,
  onPartidaActivaChange,
  esFacilitador = false,
  usuarioIdPropio = null,
  usuario = null,
  alIrAAprendizaje = null,
}) {
  const { dispararInferencia } = useRazonamiento() ?? {};
  const [partidaId, setPartidaId] = useState(null);
  const [fen, setFen] = useState(null);
  const [tipoOponente, setTipoOponente] = useState('modelo'); // 'modelo' (Red Neuronal v5) o 'motor' (Stockfish)
  const nivelInicial = usuario?.nivel_estimado ?? (esFacilitador ? 20 : 5);
  const [nivel, setNivel] = useState(nivelInicial);
  const [terminada, setTerminada] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [vistaTablero, setVistaTablero] = useState('2d'); // '2d' (táctil estándar) o '3d' (gemelo digital Dobot CR5AS)
  const [casillaOrigen, setCasillaOrigen] = useState(null);
  const [destinosValidos, setDestinosValidos] = useState([]);
  const [jugadas, setJugadas] = useState([]);
  const [analisis, setAnalisis] = useState(null);
  const [evaluacionesHistorial, setEvaluacionesHistorial] = useState([]);
  const [backendConectado, setBackendConectado] = useState(null);
  const [fotoKey, setFotoKey] = useState(0);
  const [fenReconocido, setFenReconocido] = useState(null);
  const [cargando, setCargando] = useState(null);
  const [error, setError] = useState(null);
  const [avisoSimulacion3D, setAvisoSimulacion3D] = useState(null);
  // Permisos de esta partida puntual (no del usuario) — el facilitador decide,
  // partida por partida, si el jugador puede ver la simulación 3D y/o usar la
  // cámara del tablero físico. Default false hasta que se cargue/cree la partida.
  const [permiteSimulacion3D, setPermiteSimulacion3D] = useState(false);
  const [permiteCamara, setPermiteCamara] = useState(false);
  const [esDemostracion, setEsDemostracion] = useState(false);
  const [cambiandoPermiso, setCambiandoPermiso] = useState(null); // 'permite_simulacion_3d' | 'permite_camara' | 'es_demostracion' | null
  // De quién es la partida cargada — solo tiene sentido mostrarlo al facilitador
  // (que puede estar viendo la partida de cualquiera); `null` si la partida no
  // tiene usuario asociado (ej. una de prueba creada por el propio facilitador).
  const [usuarioIdPartida, setUsuarioIdPartida] = useState(null);
  const [usuarioNombrePartida, setUsuarioNombrePartida] = useState(null);
  // El facilitador puede VER la partida de un estudiante (tablero, evaluación,
  // historial de jugadas) pero no intervenir en ella — ni seleccionar pieza ni
  // mover. `usuarioIdPartida != null` descarta las partidas sin usuario
  // asociado (ej. una de prueba del propio facilitador), que no deben tratarse
  // como "ajenas" aunque tampoco coincidan con `usuarioIdPropio`.
  const viendoPartidaAjena =
    esFacilitador && usuarioIdPartida != null && usuarioIdPartida !== usuarioIdPropio;
  // Guarda contra el doble-montaje de StrictMode en desarrollo: React invoca este
  // efecto dos veces seguidas al montar (monta → limpia → monta), y como los estados
  // no se actualizan sincrónicamente entre esas dos pasadas, `!partidaId` daba true
  // las dos veces y se creaban DOS partidas reales (dos POST /partida) por cada
  // primer montaje sin partida activa. Un ref sí es sincrónico entre pasadas.
  const partidaInicialSolicitada = useRef(false);
  // Espejo sincrónico del estado `fen`, para que el intervalo de sondeo de más
  // abajo siempre compare contra el valor más reciente sin tener que recrear
  // el `setInterval` en cada jugada (ver ese efecto para el porqué).
  const fenActualRef = useRef(null);

  const matriz = fen ? fenAMatriz(fen) : null;
  const turnoActual = fen ? turnoDeFen(fen) : 'w';
  const porcentajeVentaja = calcularPorcentajeBarra(analisis);

  // --- Capa de animación (GSAP) — solo presentación, no toca el estado de
  // arriba. `raizRef` acota los selectores de texto (".panel-entrada") a esta
  // pantalla; `casillasRefs` guarda el nodo DOM de cada casilla del tablero
  // (siempre montado, solo cambia qué pieza dibuja adentro) para poder medir
  // sus coordenadas y animar el "vuelo" de la pieza que se movió.
  const raizRef = useRef(null);
  const indicadorTurnoRef = useRef(null);
  const casillasRefs = useRef(new Map());
  const fenAnteriorParaAnimarRef = useRef(null);
  const fantasmasActivosRef = useRef([]);
  const prefiereMovimientoReducidoRef = useRef(false);

  function registrarCasillaRef(casilla, nodo) {
    if (nodo) casillasRefs.current.set(casilla, nodo);
    else casillasRefs.current.delete(casilla);
  }

  /**
   * Deslizamiento visual de las piezas que se movieron entre un FEN y el
   * siguiente (jugada propia, del motor/modelo, o detectada por cámara —
   * a esta altura ya da lo mismo el origen). No reemplaza el render real:
   * dibuja una pieza "fantasma" (position: fixed) que viaja de la casilla de
   * origen a la de destino, oculta un instante la pieza real en destino para
   * no ver doble, y al terminar la restaura y se autodestruye.
   */
  function animarMovimientosVisuales(movimientos) {
    for (const { casillaOrigen: origen, casillaDestino: destino, pieza } of movimientos) {
      const nodoOrigen = casillasRefs.current.get(origen);
      const nodoDestino = casillasRefs.current.get(destino);
      if (!nodoOrigen || !nodoDestino) continue;

      const rectOrigen = nodoOrigen.getBoundingClientRect();
      const rectDestino = nodoDestino.getBoundingClientRect();
      const piezaDestinoNodo = nodoDestino.querySelector('.chess-piece');
      if (piezaDestinoNodo) gsap.set(piezaDestinoNodo, { autoAlpha: 0 });

      const tamano = Math.min(rectOrigen.width, rectOrigen.height) * 0.82;
      const fantasma = document.createElement('img');
      fantasma.src = rutaImagenPieza(pieza);
      fantasma.alt = '';
      fantasma.setAttribute('aria-hidden', 'true');
      Object.assign(fantasma.style, {
        position: 'fixed',
        left: `${rectOrigen.left + rectOrigen.width / 2 - tamano / 2}px`,
        top: `${rectOrigen.top + rectOrigen.height / 2 - tamano / 2}px`,
        width: `${tamano}px`,
        height: `${tamano}px`,
        pointerEvents: 'none',
        zIndex: 60,
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.45))',
      });
      document.body.appendChild(fantasma);
      fantasmasActivosRef.current.push(fantasma);

      const dx = rectDestino.left + rectDestino.width / 2 - (rectOrigen.left + rectOrigen.width / 2);
      const dy = rectDestino.top + rectDestino.height / 2 - (rectOrigen.top + rectOrigen.height / 2);

      gsap.to(fantasma, {
        x: dx,
        y: dy,
        duration: DURACION_VUELO_PIEZA,
        ease: 'power2.inOut',
        onComplete: () => {
          fantasma.remove();
          fantasmasActivosRef.current = fantasmasActivosRef.current.filter((nodo) => nodo !== fantasma);
          if (piezaDestinoNodo) gsap.set(piezaDestinoNodo, { clearProps: 'visibility,opacity' });
        },
      });
    }
  }

  // Registra si hay que respetar "reducir movimiento" (patrón oficial de GSAP:
  // gsap.matchMedia()) y, si no, hace aparecer los paneles con un fade-up
  // escalonado apenas se monta la pantalla — una sola vez, no en cada jugada.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ reducido: '(prefers-reduced-motion: reduce)' }, (contexto) => {
        const { reducido } = contexto.conditions;
        prefiereMovimientoReducidoRef.current = reducido;
        if (!reducido) {
          gsap.from('.panel-entrada', {
            autoAlpha: 0,
            y: 14,
            duration: 0.45,
            stagger: 0.06,
            ease: 'power2.out',
          });
        }
        return () => {
          prefiereMovimientoReducidoRef.current = false;
        };
      });
      return () => mm.revert();
    },
    { scope: raizRef, dependencies: [] }
  );

  // Deslizamiento de piezas: se dispara solo cuando cambia `fen` (jugada real
  // aplicada), comparando contra el FEN anterior. `detectarMovimientosVisuales`
  // (ajedrez.js) es la única lógica de "qué se movió" — acá solo se anima.
  useGSAP(
    () => {
      const anterior = fenAnteriorParaAnimarRef.current;
      fenAnteriorParaAnimarRef.current = fen;
      if (!anterior || !fen || prefiereMovimientoReducidoRef.current) return;
      const movimientos = detectarMovimientosVisuales(anterior, fen);
      if (movimientos.length > 0) animarMovimientosVisuales(movimientos);

      return () => {
        // Si la pantalla se desmonta (cambio de pestaña) a mitad de un vuelo,
        // no dejamos fantasmas huérfanos pegados al <body>.
        fantasmasActivosRef.current.forEach((nodo) => nodo.remove());
        fantasmasActivosRef.current = [];
      };
    },
    { scope: raizRef, dependencies: [fen] }
  );

  // Transición sutil del indicador de turno (y del cartel de "TERMINADA") cada
  // vez que cambia a quién le toca jugar o termina la partida — un pulso
  // breve de opacidad/escala, nunca un rebote llamativo.
  useGSAP(
    () => {
      if (!indicadorTurnoRef.current || prefiereMovimientoReducidoRef.current) return;
      gsap.fromTo(
        indicadorTurnoRef.current,
        { autoAlpha: 0.4, scale: 0.97 },
        { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
      );
    },
    { scope: raizRef, dependencies: [turnoActual, terminada] }
  );

  const { contextSafe } = useGSAP({ scope: raizRef });

  // Feedback táctil sutil al presionar un botón de acción — un pulso chico de
  // escala, contextSafe porque se crea en un handler de evento (no durante el
  // efecto de useGSAP), ver skill gsap-react.
  const manejarPulsacion = contextSafe((evento) => {
    if (prefiereMovimientoReducidoRef.current) return;
    gsap.fromTo(
      evento.currentTarget,
      { scale: 1 },
      { scale: 0.94, duration: 0.08, ease: 'power1.out', yoyo: true, repeat: 1 }
    );
  });

  useEffect(() => {
    // `partidaIdInicial` viene de App.tsx y sobrevive a que este componente se
    // desmonte (cambio de pantalla) — por eso, al remontar, si ya coincide con la
    // partida que ya tenemos cargada localmente no hay que volver a pedirla (evita un
    // refetch redundante justo después de crear/cargar una partida desde acá mismo).
    if (partidaIdInicial) {
      if (partidaIdInicial !== partidaId) {
        cargarPartidaExistente(partidaIdInicial);
      }
    } else if (!partidaId && !partidaInicialSolicitada.current) {
      partidaInicialSolicitada.current = true;
      manejarNuevaPartida();
    }
    const intervalo = setInterval(async () => {
      setBackendConectado(await backendEnLinea());
    }, 5000);
    backendEnLinea().then(setBackendConectado);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaIdInicial]);

  useEffect(() => {
    fenActualRef.current = fen;
  }, [fen]);

  // Sondeo en vivo de una partida AJENA — el facilitador puede abrir Sala de
  // Control con la partida de un estudiante (desde "Ver en Sala de Control" en
  // Registro de Partidas, o cargando un `partidaId` que no es el suyo) y, sin
  // esto, el tablero/análisis queda congelado en la foto de cuando se cargó:
  // nadie mueve piezas desde esta pantalla en ese caso, así que nada más
  // dispara un refetch. No se activa para la partida propia del facilitador ni
  // para un jugador viendo la suya — ahí las jugadas ya se hacen localmente en
  // esta misma pantalla, y pisar ese estado a mitad de una jugada sería
  // contraproducente.
  useEffect(() => {
    if (!partidaId || !viendoPartidaAjena || terminada) return;

    const intervalo = setInterval(async () => {
      try {
        const datos = await obtenerPartida(partidaId);
        if (datos.fen !== fenActualRef.current) {
          setFen(datos.fen);
          setTerminada(datos.terminada);
          setResultado(datos.resultado);
          setJugadas(datos.jugadas);
          setCasillaOrigen(null);
          setDestinosValidos([]);
          if (!datos.terminada) {
            await actualizarAnalisis(datos.fen);
          }
        }
      } catch {
        // Sondeo silencioso — si un tick falla (blip de red) no hace falta
        // interrumpir con un error, se reintenta solo en el próximo.
      }
    }, INTERVALO_SONDEO_PARTIDA_AJENA_MS);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId, viendoPartidaAjena, terminada, nivel]);

  // Sincronizar nivel con el perfil del usuario si todavía no hay partida o es nueva
  useEffect(() => {
    if (usuario?.nivel_estimado && !partidaId) {
      setNivel(usuario.nivel_estimado);
    }
  }, [usuario, partidaId]);

  // Si el usuario es un jugador normal y la partida no tiene simulación 3D habilitada por el facilitador,
  // forzar retorno a vista 2D táctica.
  useEffect(() => {
    if (!esFacilitador && !permiteSimulacion3D && vistaTablero === '3d') {
      setVistaTablero('2d');
    }
  }, [esFacilitador, permiteSimulacion3D, vistaTablero]);

  async function actualizarAnalisis(fenActual) {
    try {
      const datos = await analizarPosicion(fenActual, nivel);
      setAnalisis(datos);
      if (typeof datos.evaluacion_cp === 'number') {
        setEvaluacionesHistorial((previas) => [...previas.slice(-9), datos.evaluacion_cp]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function cargarPartidaExistente(id) {
    setError(null);
    setCargando('nueva');
    try {
      const partida = await obtenerPartida(id);
      setPartidaId(partida.id);
      onPartidaActivaChange?.(partida.id);
      setFen(partida.fen);
      setNivel(partida.nivel);
      if (partida.tipo_oponente) {
        setTipoOponente(partida.tipo_oponente);
      }
      setTerminada(partida.terminada);
      setResultado(partida.resultado);
      setJugadas(partida.jugadas);
      setCasillaOrigen(null);
      setDestinosValidos([]);
      setEvaluacionesHistorial([]);
      setPermiteSimulacion3D(partida.permite_simulacion_3d ?? false);
      setPermiteCamara(partida.permite_camara ?? false);
      setEsDemostracion(partida.es_demostracion ?? false);
      setUsuarioIdPartida(partida.usuario_id ?? null);
      setUsuarioNombrePartida(partida.usuario_nombre ?? null);
      if (!partida.terminada) {
        await actualizarAnalisis(partida.fen);
      }
    } catch (err) {
      onPartidaActivaChange?.(null);
      setPartidaId(null);
      const esPartidaAjena =
        err?.message?.includes('otro usuario') ||
        err?.status === 403 ||
        err?.status === 404;

      if (esPartidaAjena) {
        console.warn('Partida no accesible para este usuario. Creando una partida propia e independiente...');
        setError(null);
        await manejarNuevaPartida();
      } else {
        setError(err.message);
      }
    } finally {
      setCargando(null);
    }
  }

  async function manejarNuevaPartida(oponenteDeseado) {
    setError(null);
    setCargando('nueva');
    try {
      const op = oponenteDeseado !== undefined ? oponenteDeseado : tipoOponente;
      const partida = await crearPartida(nivel, null, op);
      setPartidaId(partida.id);
      onPartidaActivaChange?.(partida.id);
      setFen(partida.fen);
      setTipoOponente(partida.tipo_oponente || op);
      setTerminada(false);
      setResultado(null);
      setJugadas(partida.jugadas);
      setCasillaOrigen(null);
      setDestinosValidos([]);
      setEvaluacionesHistorial([]);
      setPermiteSimulacion3D(partida.permite_simulacion_3d ?? false);
      setPermiteCamara(partida.permite_camara ?? false);
      setEsDemostracion(partida.es_demostracion ?? false);
      setUsuarioIdPartida(partida.usuario_id ?? null);
      setUsuarioNombrePartida(partida.usuario_nombre ?? null);
      dispararInferencia?.(partida.fen); // posición nueva disponible — no bloquea la UI de la partida
      await actualizarAnalisis(partida.fen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  function esPiezaDelTurno(casilla) {
    const pieza = piezaEnCasilla(fen, casilla);
    if (!pieza) return false;
    const esBlanca = pieza === pieza.toUpperCase();
    return esBlanca ? turnoDeFen(fen) === 'w' : turnoDeFen(fen) === 'b';
  }

  async function seleccionarOrigen(casilla) {
    setCasillaOrigen(casilla);
    setDestinosValidos([]);
    try {
      const datos = await obtenerJugadasLegales(partidaId, casilla);
      setDestinosValidos(datos.casillas);
    } catch (err) {
      setError(err.message);
    }
  }

  async function manejarClicCasilla(casilla) {
    if (!partidaId || terminada || viendoPartidaAjena) return;

    if (!casillaOrigen) {
      if (esPiezaDelTurno(casilla)) {
        await seleccionarOrigen(casilla);
      }
      return;
    }

    const origen = casillaOrigen;
    if (origen === casilla) {
      setCasillaOrigen(null);
      setDestinosValidos([]);
      return;
    }

    // Clic en otra pieza propia: cambia la selección en vez de intentar mover.
    if (esPiezaDelTurno(casilla)) {
      await seleccionarOrigen(casilla);
      return;
    }

    setCasillaOrigen(null);
    setDestinosValidos([]);

    const jugadaUci = origen + casilla + (esPromocionDePeon(fen, origen, casilla) ? 'q' : '');
    setError(null);
    setCargando('mover');
    try {
      const datos = await moverPartida(partidaId, jugadaUci);
      setFen(datos.fen);
      setTerminada(datos.terminada);
      setResultado(datos.resultado);
      setJugadas(datos.jugadas);
      dispararInferencia?.(datos.fen); // jugada real aplicada — dispara la inferencia del modelo propio sin bloquear
      if (!datos.terminada) {
        await actualizarAnalisis(datos.fen);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function manejarReevaluar() {
    if (!fen) return;
    setCargando('reevaluar');
    try {
      await actualizarAnalisis(fen);
    } finally {
      setCargando(null);
    }
  }

  async function manejarReconocerTablero(archivoFoto = null) {
    setCargando('reconocer');
    setError(null);
    setFenReconocido(null);
    try {
      const datos = await reconocerTablero(fen ? turnoDeFen(fen) : 'w', archivoFoto);
      setFenReconocido(datos.fen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  function manejarSeleccionarFoto(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo después
    if (archivo) {
      manejarReconocerTablero(archivo);
    }
  }

  async function manejarUsarPosicionEscaneada() {
    if (!fenReconocido) return;
    setError(null);
    setCargando('nueva');
    try {
      const partida = await crearPartida(nivel, fenReconocido, tipoOponente);
      setPartidaId(partida.id);
      onPartidaActivaChange?.(partida.id);
      setFen(partida.fen);
      setTerminada(false);
      setResultado(null);
      setJugadas(partida.jugadas);
      setCasillaOrigen(null);
      setDestinosValidos([]);
      setEvaluacionesHistorial([]);
      setFenReconocido(null);
      setPermiteSimulacion3D(partida.permite_simulacion_3d ?? false);
      setPermiteCamara(partida.permite_camara ?? false);
      setEsDemostracion(partida.es_demostracion ?? false);
      setUsuarioIdPartida(partida.usuario_id ?? null);
      setUsuarioNombrePartida(partida.usuario_nombre ?? null);
      dispararInferencia?.(partida.fen); // posición escaneada nueva — no bloquea la UI de la partida
      await actualizarAnalisis(partida.fen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  async function manejarMoverDesdeFoto() {
    if (!partidaId || terminada) return;
    setError(null);
    setCargando('mover-foto');
    try {
      const datos = await moverPartidaDesdeFoto(partidaId);
      setFen(datos.fen);
      setTerminada(datos.terminada);
      setResultado(datos.resultado);
      setJugadas(datos.jugadas);
      setCasillaOrigen(null);
      setDestinosValidos([]);
      dispararInferencia?.(datos.fen); // jugada real detectada por cámara — misma inferencia que un movimiento manual
      if (!datos.terminada) {
        await actualizarAnalisis(datos.fen);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(null);
    }
  }

  function manejarAbrirSimulacion3D() {
    if (!partidaId) return;
    if (!esFacilitador && !permiteSimulacion3D) return;
    setVistaTablero((v) => (v === '3d' ? '2d' : '3d'));
    setAvisoSimulacion3D('Gemelo Digital 3D (Dobot CR5AS) activo en pantalla');
    setTimeout(() => setAvisoSimulacion3D(null), 5000);
  }

  /**
   * Prende/apaga, para esta partida puntual, si el jugador puede ver la
   * simulación 3D, usar la cámara, o si la partida se transmite en vivo
   * (`campo` es 'permite_simulacion_3d', 'permite_camara' o 'es_demostracion').
   * Solo lo llama el facilitador — ver gate en el JSX.
   */
  async function manejarTogglePermiso(campo, valorActual) {
    if (!partidaId) return;
    setError(null);
    setCambiandoPermiso(campo);
    try {
      const datos = await actualizarPermisosPartida(partidaId, { [campo]: !valorActual });
      setPermiteSimulacion3D(datos.permite_simulacion_3d ?? permiteSimulacion3D);
      setPermiteCamara(datos.permite_camara ?? permiteCamara);
      setEsDemostracion(datos.es_demostracion ?? esDemostracion);
    } catch (err) {
      // El backend solo deja transmitir partidas propias del facilitador.
      if (campo === 'es_demostracion' && err.status === 400) {
        setError('Solo podés transmitir tus propias partidas.');
      } else {
        setError(err.message);
      }
    } finally {
      setCambiandoPermiso(null);
    }
  }

  function actualizarFoto() {
    setFotoKey((valor) => valor + 1);
  }

  return (
    <div ref={raizRef} className="w-full px-space-lg py-space-md flex flex-col gap-space-lg max-w-[1720px] mx-auto animate-in fade-in duration-500">
      {/* SUB-BARRA DE ESTADO SUPERIOR */}
      <div className="flex items-center justify-between px-space-md py-space-xs rounded-xl bg-surface-container-low/70 shadow-md flex-wrap gap-2">
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-2xs">
            <span className={`w-2 h-2 rounded-full ${partidaId && !terminada ? 'bg-primary-container animate-pulse shadow-[0_0_8px_#00e5ff]' : 'bg-outline'}`}></span>
            <span className="font-mono-micro text-mono-micro tracking-widest text-primary uppercase font-medium">
              {partidaId ? `PARTIDA ${partidaId.slice(0, 8)}` : 'SIN PARTIDA'}
            </span>
          </div>
          <div className="h-3 w-[1px] bg-surface-variant"></div>
          <span className="font-mono-label text-mono-label text-on-surface-variant flex items-center gap-1.5 flex-wrap">
            <span className="text-primary font-medium">
              {tipoOponente === 'motor' ? 'STOCKFISH 16' : 'TURING IA (v5)'}
            </span>
            <span>·</span>
            <span>NIVEL {nivel} ({categoriaDeNivel(nivel).toUpperCase()})</span>
            {usuario && (
              <>
                <span className="text-outline">|</span>
                <span className="text-secondary font-mono-micro px-2 py-0.5 rounded bg-secondary/10 font-medium">
                  PERFIL: {usuario.rango_estimado ? usuario.rango_estimado.toUpperCase() : `NIVEL ${usuario.nivel_estimado ?? 5}`}
                </span>
              </>
            )}
          </span>
          {esFacilitador && usuarioNombrePartida && usuarioIdPartida !== usuarioIdPropio && (
            <>
              <div className="h-3 w-[1px] bg-surface-variant"></div>
              <span className="font-mono-label text-mono-label text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">visibility</span>
                VIENDO PARTIDA DE: <span className="text-primary font-medium">{usuarioNombrePartida}</span>
              </span>
            </>
          )}
        </div>
        <div ref={indicadorTurnoRef} className="flex items-center gap-space-lg">
          {terminada ? (
            <span className="font-mono-metric text-mono-metric text-primary font-medium">TERMINADA — {resultado}</span>
          ) : (
            <div className="flex items-center gap-space-xs font-mono-metric text-mono-metric">
              <span className="text-on-surface-variant font-mono-micro text-mono-micro uppercase">TURNO:</span>
              <span className="text-primary font-medium">{turnoActual === 'w' ? 'BLANCAS (VOS)' : 'NEGRAS (MOTOR)'}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* COLUMNA IZQUIERDA: AVATAR 3D DEL RIVAL Y VISIÓN FÍSICA */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          {/* AVATAR 3D DEL AGENTE INTELIGENTE (THREE.JS / HU7) */}
          <AvatarAgente3D
            pensando={cargando === 'mover' || cargando === 'mover-foto'}
            tipoOponente={tipoOponente}
            evaluacionCp={analisis?.evaluacion_cp ?? 0}
            mateEn={analisis?.mate_en ?? null}
            ultimoMovimiento={jugadas.length > 0 ? jugadas[jugadas.length - 1] : null}
            cantidadJugadas={jugadas.length}
            terminada={terminada}
            resultado={resultado}
          />

          {/* SELECTOR DE OPONENTE (MODELO IA v5 vs STOCKFISH 16) */}
          <div className="panel-entrada bg-surface-container-low rounded-xl p-3.5 shadow-xl flex flex-col gap-2.5 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-[11px] uppercase tracking-wider text-on-surface-variant flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[14px] text-primary">swords</span>
                RIVAL DIGITAL
              </span>
              <span className="text-[10px] text-primary font-mono font-bold">
                {tipoOponente === 'modelo' ? 'TURING · IA v5 AUTÓNOMA' : 'STOCKFISH 16'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
              <button
                type="button"
                onClick={() => {
                  setTipoOponente('modelo');
                  manejarNuevaPartida('modelo');
                }}
                onPointerDown={manejarPulsacion}
                disabled={cargando === 'nueva'}
                className={`py-2 px-1.5 rounded-lg font-mono-label text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                  tipoOponente === 'modelo'
                    ? 'bg-primary text-on-primary shadow-[0_0_14px_rgba(0,229,255,0.45)]'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">psychology</span>
                  <span>TURING</span>
                </div>
                <span className="text-[9px] opacity-80 font-normal">IA v5 · SE-ResNet-8 FIDE</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTipoOponente('motor');
                  manejarNuevaPartida('motor');
                }}
                onPointerDown={manejarPulsacion}
                disabled={cargando === 'nueva'}
                className={`py-2 px-1.5 rounded-lg font-mono-label text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                  tipoOponente === 'motor'
                    ? 'bg-primary text-on-primary shadow-[0_0_14px_rgba(0,229,255,0.45)]'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                  <span>STOCKFISH</span>
                </div>
                <span className="text-[9px] opacity-80 font-normal">Minimax Alfa-Beta</span>
              </button>
            </div>
          </div>

          {/* TRANSMISIÓN EN VIVO — el facilitador juega esta partida para mostrarle
              a la clase cómo jugar; con esto prende que cualquier jugador la vea en
              modo solo lectura (pantalla "Demostración en vivo"), sin compartir nada
              a mano. Solo facilitador; solo funciona en una partida propia (el
              backend devuelve 400 si no lo es). */}
          {esFacilitador && (
            <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-primary">sensors</span> TRANSMISIÓN EN VIVO
                </span>
              </div>
              <InterruptorPermiso
                id="permiso-demostracion"
                etiqueta="Transmitir esta partida en vivo a los jugadores"
                activo={esDemostracion}
                cargando={cambiandoPermiso === 'es_demostracion'}
                onCambiar={() => manejarTogglePermiso('es_demostracion', esDemostracion)}
              />
              {esDemostracion && (
                <div className="bg-primary/10 text-primary font-mono-micro text-mono-micro px-2 py-1.5 rounded-lg text-center flex items-center justify-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                  </span>
                  Los jugadores ya pueden ver esta partida en vivo
                </div>
              )}
            </div>
          )}

          {/* CÁMARA FIJA / TABLERO FÍSICO — operación de hardware. El facilitador
              siempre la ve; para el jugador depende del permiso de esta partida
              (`permite_camara`), que el facilitador prende/apaga con el switch
              de abajo — un jugador practicando desde el navegador por defecto no
              tiene tablero físico ni cámara al lado. */}
          {(esFacilitador || permiteCamara) && (
            <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-primary">videocam</span> CÁMARA FIJA
                </span>
                <button
                  onClick={actualizarFoto}
                  onPointerDown={manejarPulsacion}
                  className="font-mono-micro text-mono-micro text-primary-fixed-dim px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  ACTUALIZAR
                </button>
              </div>
              {esFacilitador && (
                <InterruptorPermiso
                  id="permiso-camara"
                  etiqueta="Permitir cámara al jugador"
                  activo={permiteCamara}
                  cargando={cambiandoPermiso === 'permite_camara'}
                  onCambiar={() => manejarTogglePermiso('permite_camara', permiteCamara)}
                />
              )}
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center">
                {fotoKey === 0 ? (
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant px-space-sm text-center">
                    Sin captura todavía — tocá ACTUALIZAR
                  </span>
                ) : (
                  <img
                    className="absolute inset-0 w-full h-full object-cover"
                    alt="Foto de la cámara fija sobre el tablero"
                    src={urlFotoCamara()}
                    onError={() => setError('No se pudo obtener la foto de la cámara — ¿está conectada?')}
                  />
                )}
              </div>
              <button
                onClick={() => manejarReconocerTablero()}
                disabled={cargando === 'reconocer'}
                className="w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
                {cargando === 'reconocer' ? 'RECONOCIENDO…' : 'RECONOCER TABLERO (HU1)'}
              </button>
              <label
                className={`w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center justify-center gap-1.5 cursor-pointer ${cargando === 'reconocer' ? 'opacity-50 pointer-events-none' : ''}`}
                title="Subí una foto ya sacada (ej. de la galería del celular) en vez de usar la cámara en vivo"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                SUBIR FOTO DEL TABLERO
                <input type="file" accept="image/*" className="hidden" onChange={manejarSeleccionarFoto} />
              </label>
              {partidaId && !terminada && (
                <button
                  onClick={manejarMoverDesdeFoto}
                  disabled={cargando === 'mover-foto'}
                  title="Mové una pieza en el tablero físico y tocá esto — detecta la jugada comparando la foto con la posición actual"
                  className="w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">back_hand</span>
                  {cargando === 'mover-foto' ? 'DETECTANDO…' : 'DETECTÉ UN MOVIMIENTO FÍSICO'}
                </button>
              )}
              {fenReconocido && (
                <div className="bg-surface-container-lowest p-2 rounded-lg flex flex-col gap-1.5">
                  <span className="font-mono-micro text-mono-micro text-primary-fixed-dim break-all">
                    FEN reconocido: {fenReconocido}
                  </span>
                  <button
                    onClick={manejarUsarPosicionEscaneada}
                    disabled={cargando === 'nueva'}
                    className="w-full py-1.5 rounded-lg bg-primary text-on-primary font-mono-label text-mono-label flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    USAR ESTA POSICIÓN
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ESTADO DEL BRAZO — honesto: no hay hardware real conectado todavía.
              Panel de operador del brazo robótico, solo facilitador — no depende
              de ningún permiso por partida, no es algo que se le pueda "regalar"
              a un jugador. */}
          {esFacilitador && (
            <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-primary">precision_manufacturing</span> BRAZO ROBÓTICO
                </span>
              </div>
              <div className="bg-surface-container-lowest p-3 rounded-lg flex items-center justify-between">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">Estado</span>
                <span className="font-mono-micro text-mono-micro px-2 py-0.5 rounded bg-primary/10 text-primary uppercase font-medium">
                  SIN HARDWARE — SOLO SIMULADO
                </span>
              </div>
              <div className="bg-surface-container-lowest p-1.5 rounded-lg flex items-center">
                <button
                  disabled
                  title="El kit físico todavía no llegó — ver CLAUDE.md"
                  className="flex-1 py-1 text-center font-mono-micro text-mono-micro rounded text-outline cursor-not-allowed"
                >
                  FÍSICO (ROBOT)
                </button>
                <button className="flex-1 py-1 text-center font-mono-micro text-mono-micro rounded bg-primary text-on-primary font-medium shadow-sm">
                  SIMULADOR
                </button>
              </div>
            </div>
          )}

          {/* Ventana 3D en vivo (PyBullet) — aparte del panel de arriba: no es un
              ejecutor de movimientos, es solo una vista del tablero, así que el
              facilitador la puede habilitar para el jugador partida por partida
              (`permite_simulacion_3d`). El facilitador siempre puede abrirla. */}
          {(esFacilitador || permiteSimulacion3D) && (
            <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
              {esFacilitador && (
                <InterruptorPermiso
                  id="permiso-simulacion3d"
                  etiqueta="Permitir simulación 3D al jugador"
                  activo={permiteSimulacion3D}
                  cargando={cambiandoPermiso === 'permite_simulacion_3d'}
                  onCambiar={() => manejarTogglePermiso('permite_simulacion_3d', permiteSimulacion3D)}
                />
              )}
              <button
                onClick={manejarAbrirSimulacion3D}
                disabled={!partidaId}
                title={!partidaId ? 'Iniciá una partida primero' : 'Alterna el Gemelo Digital 3D (Dobot CR5AS) en pantalla'}
                className={`w-full py-2.5 rounded-lg transition-all font-mono-label text-mono-label flex items-center justify-center gap-2 disabled:opacity-50 ${
                  vistaTablero === '3d'
                    ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_15px_rgba(0,229,255,0.45)]'
                    : 'bg-surface-container-high hover:bg-surface-bright text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">precision_manufacturing</span>
                {vistaTablero === '3d' ? 'VISTA 3D EN PANTALLA (ACTIVA)' : 'VER GEMELO DIGITAL 3D'}
              </button>
              {avisoSimulacion3D && (
                <div className="bg-primary/10 text-primary font-mono-micro text-mono-micro px-2 py-1.5 rounded-lg text-center animate-fadeIn">
                  {avisoSimulacion3D}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMNA CENTRAL: TABLERO REAL Y GEMELO DIGITAL 3D */}
        <div className="xl:col-span-6 flex flex-col items-center justify-center">
          {/* SELECTOR DE VISTA: TABLERO 2D vs GEMELO DIGITAL 3D DOBOT CR5AS */}
          {(esFacilitador || permiteSimulacion3D) ? (
            <div className="w-full max-w-[660px] flex items-center justify-between mb-3 px-1">
              <div className="inline-flex p-1 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs shadow-lg">
                <button
                  type="button"
                  onClick={() => setVistaTablero('2d')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    vistaTablero === '2d'
                      ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">grid_view</span>
                  <span>Tablero 2D Táctil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVistaTablero('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    vistaTablero === '3d'
                      ? 'bg-[#00e5ff] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">precision_manufacturing</span>
                  <span>Gemelo Digital 3D (Dobot CR5AS)</span>
                </button>
              </div>

              {vistaTablero === '3d' && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 border border-[#00e5ff]/30 text-[11px] font-mono text-[#00e5ff]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping" />
                  <span>CINEMÁTICA 6-DOF EN VIVO</span>
                </span>
              )}
            </div>
          ) : (
            <div className="w-full max-w-[660px] flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">grid_view</span>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-on-surface">Tablero Táctil 2D</span>
              </div>
              <span className="text-[11px] font-mono text-outline">
                Modo Jugador · Vista Táctica
              </span>
            </div>
          )}

          {vistaTablero === '3d' && (esFacilitador || permiteSimulacion3D) ? (
            <div className="w-full max-w-[660px] aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <SimuladorBrazoTablero3D
                fen={fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                ultimoMovimiento={jugadas[jugadas.length - 1]}
                pensando={cargando === 'jugada'}
              />
            </div>
          ) : (
            <div className="panel-entrada relative w-full max-w-[660px] flex items-center justify-center">
              {analisis && (
                <div className="absolute -left-7 top-6 bottom-6 w-3 rounded-full bg-surface-container-high overflow-hidden shadow-inner flex flex-col justify-end p-0.5">
                  <div
                    className="w-full bg-gradient-to-t from-primary-container to-primary rounded-full transition-all duration-700 shadow-[0_0_8px_#00e5ff]"
                    style={{ height: `${porcentajeVentaja}%` }}
                  ></div>
                  <span className="absolute -left-11 top-1/2 -translate-y-1/2 font-mono-micro text-mono-micro font-medium text-primary bg-surface-container-lowest/90 px-1 py-0.5 rounded shadow">
                    {formatearEvaluacion(analisis)}
                  </span>
                </div>
              )}

              <div
                className="w-full aspect-square p-5 sm:p-7 rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.7)] relative flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #422617 0%, #2c180e 25%, #4a2b1b 50%, #20110a 75%, #3d2215 100%)',
                  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8), 0 20px 40px -10px #000',
                }}
              >
                <div
                  className="w-full h-full rounded-lg p-2.5 sm:p-3 relative flex items-center justify-center shadow-inner"
                  style={{ background: 'linear-gradient(180deg, #1b0e08 0%, #2d180f 100%)' }}
                >
                  <div className="w-full h-full grid grid-cols-8 grid-rows-8 rounded shadow-2xl overflow-hidden relative">
                    {matriz &&
                      matriz.map((fila, indiceFila) =>
                        fila.map((pieza, indiceColumna) => {
                          const casilla = nombreCasilla(indiceFila, indiceColumna);
                          const clara = (indiceFila + indiceColumna) % 2 === 0;
                          const seleccionada = casilla === casillaOrigen;
                          const esDestinoValido = destinosValidos.includes(casilla);
                          return (
                            <button
                              key={casilla}
                              ref={(nodo) => registrarCasillaRef(casilla, nodo)}
                              type="button"
                              onClick={() => manejarClicCasilla(casilla)}
                              disabled={viendoPartidaAjena}
                              aria-label={`Casilla ${casilla}${pieza ? ', pieza ' + pieza : ', vacía'}${esDestinoValido ? ', jugada válida' : ''}${viendoPartidaAjena ? ', solo lectura' : ''}`}
                              className={`relative flex items-center justify-center ${clara ? 'bg-[#b89772]' : 'bg-[#543423]'} ${seleccionada ? 'ring-2 ring-inset ring-primary' : ''} ${viendoPartidaAjena ? 'cursor-default' : ''}`}
                            >
                              {pieza && (
                                <div className={claseDePieza(pieza)}>
                                  <img
                                    className="chess-piece-imagen"
                                    src={rutaImagenPieza(pieza)}
                                    alt={pieza}
                                    draggable={false}
                                  />
                                </div>
                              )}
                              {esDestinoValido && (
                                <span
                                  className={`pointer-events-none absolute rounded-full ${
                                    pieza
                                      ? 'inset-[8%] border-[3px] border-primary/80 shadow-[0_0_6px_rgba(0,229,255,0.5)]'
                                      : 'w-[28%] h-[28%] bg-primary/70 shadow-[0_0_6px_rgba(0,229,255,0.6)]'
                                  }`}
                                ></span>
                              )}
                            </button>
                          );
                        })
                      )}
                  </div>

                  <div className="absolute left-1 top-2 bottom-2 flex flex-col justify-around font-mono-micro text-[9px] text-[#e0cfba]/40 pointer-events-none font-bold select-none">
                    <span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                  </div>
                  <div className="absolute bottom-0.5 left-4 right-4 flex justify-around font-mono-micro text-[9px] text-[#e0cfba]/40 pointer-events-none font-bold select-none">
                    <span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viendoPartidaAjena && (
            <div className="flex items-center gap-1 mt-space-xs font-mono-micro text-[10px] text-outline uppercase tracking-wide">
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              Solo lectura — es la partida de un estudiante, no podés jugarla desde acá
            </div>
          )}

          <div className="w-full max-w-[660px] mt-space-md flex flex-col gap-space-sm">
            {/* TARJETA DE FINALIZACIÓN Y RETROSPECTIVA PEDAGÓGICA */}
            {terminada && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-secondary-container/30 to-surface-container-high border border-secondary/40 shadow-xl flex items-center justify-between flex-wrap gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[22px]">school</span>
                  </div>
                  <div>
                    <div className="font-headline-sm text-body-md font-bold text-on-surface">
                      Partida Finalizada ({resultado || 'Juego Concluido'})
                    </div>
                    <div className="font-mono-micro text-[11px] text-on-surface-variant">
                      Registrada en tu historial con {tipoOponente === 'modelo' ? 'Turing IA' : 'Stockfish'} (Nivel {nivel}).
                    </div>
                  </div>
                </div>
                {alIrAAprendizaje && (
                  <button
                    type="button"
                    onClick={() => alIrAAprendizaje(partidaId)}
                    className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary font-mono-label text-xs font-bold shadow hover:bg-secondary/90 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    <span>TUTOR Y FEEDBACK</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-space-md p-space-sm rounded-xl bg-surface-container-low shadow-xl flex-wrap">
              <div className="flex items-center gap-space-sm pl-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                <div className="flex flex-col">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase">JUGADA SUGERIDA</span>
                  <span className="font-mono-metric text-mono-metric text-on-surface font-semibold tracking-tight">
                    {analisis?.jugada ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-space-xs flex-wrap">
                <div className="flex items-center gap-1.5 bg-surface-container-high/70 px-2 py-1 rounded-lg border border-outline-variant/30">
                  <label className="font-mono-micro text-[10px] text-outline uppercase font-semibold" htmlFor="nivelSelect">
                    Nivel {tipoOponente === 'modelo' ? 'IA' : 'Motor'}
                  </label>
                  <select
                    id="nivelSelect"
                    value={nivel}
                    onChange={(evento) => setNivel(Number(evento.target.value))}
                    className="bg-surface-container-high rounded px-2 py-0.5 font-mono-label text-mono-label text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {NIVELES_POR_CATEGORIA.map((categoria) => (
                      <optgroup key={categoria.etiqueta} label={categoria.etiqueta}>
                        {Array.from(
                          { length: categoria.hasta - categoria.desde + 1 },
                          (_, indice) => categoria.desde + indice
                        ).map((valor) => (
                          <option key={valor} value={valor}>
                            Nivel {valor} ({categoria.etiqueta})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {tipoOponente === 'modelo' && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Turing Adaptativo
                  </span>
                )}
                <button
                  onClick={manejarReevaluar}
                  onPointerDown={manejarPulsacion}
                  disabled={cargando === 'reevaluar' || !fen}
                  className="px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors font-mono-label text-mono-label flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span> REEVALUAR
                </button>
                <button
                  onClick={() => manejarNuevaPartida()}
                  onPointerDown={manejarPulsacion}
                  disabled={cargando === 'nueva'}
                  className="px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-lg font-medium shadow-[0_0_16px_rgba(0,229,255,0.35)] hover:shadow-[0_0_24px_rgba(0,229,255,0.6)] hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                  NUEVA PARTIDA
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ANÁLISIS REAL DE STOCKFISH E HISTORIAL */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">neurology</span>
                <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-medium">STOCKFISH</span>
              </div>
              <span className={`font-mono-micro text-mono-micro px-1.5 py-0.5 rounded ${backendConectado ? 'text-primary bg-primary/10' : 'text-error bg-error-container'}`}>
                {backendConectado === null ? 'VERIFICANDO…' : backendConectado ? 'BACKEND CONECTADO' : 'BACKEND SIN CONEXIÓN'}
              </span>
            </div>
            <p className="font-mono-micro text-[9px] text-outline leading-relaxed -mt-1">
              Oráculo de comparación: analiza la posición de forma independiente aunque juegues contra Turing — nunca decide la jugada del rival.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">VENTAJA</span>
                <span className="font-mono-metric text-mono-metric text-primary font-medium mt-0.5">{formatearEvaluacion(analisis)}</span>
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">PROF.</span>
                <span className="font-mono-metric text-mono-metric text-on-surface font-medium mt-0.5">{analisis?.profundidad ?? '—'}</span>
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">NODOS</span>
                <span className="font-mono-metric text-mono-metric text-on-surface font-medium mt-0.5">{formatearNodos(analisis?.nodos)}</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3 rounded-lg flex flex-col gap-1.5">
              <span className="font-mono-micro text-mono-micro text-outline uppercase">CURVA DE VENTAJA (esta sesión)</span>
              <SparklineEvaluacion valores={evaluacionesHistorial} />
            </div>

            {analisis?.variacion_principal?.length > 0 && (
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">LÍNEA PRINCIPAL (PV)</span>
                <span className="font-mono-micro text-mono-micro text-primary-fixed-dim leading-relaxed break-words">
                  {analisis.variacion_principal.join(' ')}
                </span>
              </div>
            )}

            {analisis?.variantes_candidatas?.length > 0 && (
              <div className="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro text-outline uppercase">JUGADAS CANDIDATAS</span>
                <div className="flex flex-col gap-0.5">
                  {analisis.variantes_candidatas.map((variante, indice) => (
                    <div key={`${variante.jugada}-${indice}`} className="flex items-center justify-between">
                      <span className="font-mono-label text-mono-label text-on-surface-variant">
                        {indice + 1}. {variante.jugada}
                      </span>
                      <span className="font-mono-micro text-mono-micro text-primary-fixed-dim">
                        {formatearEvaluacion(variante)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel-entrada bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col gap-space-sm flex-1">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">format_list_numbered</span> MOVIMIENTOS DE ESTA PARTIDA
            </span>
            <div className="flex flex-col gap-1 font-mono-label text-mono-label max-h-64 overflow-y-auto">
              {jugadas.length === 0 && (
                <span className="font-mono-micro text-mono-micro text-outline px-2 py-1">Todavía no se jugó ninguna jugada.</span>
              )}
              {agruparJugadasPorRonda(jugadas).map((ronda) => (
                <div key={ronda.numero} className="flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant">
                  <span className="text-outline w-6">{ronda.numero}.</span>
                  <span className="w-20">{ronda.blancas}</span>
                  <span className="w-20">{ronda.negras ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function agruparJugadasPorRonda(jugadas) {
  const rondas = [];
  for (let i = 0; i < jugadas.length; i += 2) {
    rondas.push({ numero: i / 2 + 1, blancas: jugadas[i], negras: jugadas[i + 1] });
  }
  return rondas.reverse();
}

/**
 * Switch chico para que el facilitador prenda/apague, partida por partida, un
 * permiso del jugador (cámara, simulación 3D). El estado se ve tanto por color
 * como por posición de la perilla — no depende solo del color.
 */
function InterruptorPermiso({ id, etiqueta, activo, cargando, onCambiar }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-surface-container-lowest px-2.5 py-2 rounded-lg">
      <label htmlFor={id} className="font-mono-micro text-[10px] text-on-surface-variant uppercase tracking-wide cursor-pointer">
        {etiqueta}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={cargando}
        onClick={onCambiar}
        title={activo ? 'Tocá para apagar' : 'Tocá para prender'}
        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          activo ? 'bg-primary' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-surface-container-lowest shadow transition-transform ${
            activo ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function calcularPorcentajeBarra(analisis) {
  if (!analisis) return 50;
  if (analisis.mate_en != null) return analisis.mate_en > 0 ? 95 : 5;
  const cp = analisis.evaluacion_cp ?? 0;
  const acotado = Math.max(-800, Math.min(800, cp));
  return 50 + (acotado / 800) * 45;
}

function formatearEvaluacion(analisis) {
  if (!analisis) return '—';
  if (analisis.mate_en != null) return `M${Math.abs(analisis.mate_en)}`;
  if (analisis.evaluacion_cp == null) return '—';
  const valor = (analisis.evaluacion_cp / 100).toFixed(2);
  return analisis.evaluacion_cp > 0 ? `+${valor}` : valor;
}

function formatearNodos(nodos) {
  if (nodos == null) return '—';
  if (nodos >= 1_000_000) return `${(nodos / 1_000_000).toFixed(1)}M`;
  if (nodos >= 1_000) return `${(nodos / 1_000).toFixed(1)}K`;
  return String(nodos);
}

function SparklineEvaluacion({ valores }) {
  if (!valores || valores.length < 2) {
    return <span className="font-mono-micro text-mono-micro text-outline">Jugá para ver la curva</span>;
  }
  const minimo = Math.min(...valores, -100);
  const maximo = Math.max(...valores, 100);
  const rango = maximo - minimo || 1;
  const puntos = valores
    .map((valor, indice) => {
      const x = (indice / (valores.length - 1)) * 160;
      const y = 36 - ((valor - minimo) / rango) * 36;
      return `${x} ${y}`;
    })
    .join(' L ');
  return (
    <div className="w-full h-11 flex items-end pt-1">
      <svg className="w-full h-full text-primary overflow-visible" fill="none" viewBox="0 0 160 36">
        <path d={`M ${puntos}`} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
      </svg>
    </div>
  );
}
