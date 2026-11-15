import { useEffect, useId, useMemo, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { historialPartidasPropio, obtenerPartida } from '../../api/backend';
import { rutaImagenPieza } from '../../ajedrez';

/** Cuántas partidas recientes se revisan para los capítulos basados en historial. */
const PARTIDAS_A_REVISAR = 20;
/** Cuántas partidas se piden juntas al buscar jugadas (de la más reciente a la más vieja). */
const LOTE_DE_PARTIDAS = 4;

/**
 * Etapas del Camino de Aprendizaje basadas en la metodología pedagógica
 * de la FIDE (Stappenmethode de Brunia & Van Wijgerden) y Práctica Deliberada de Ericsson.
 *
 * Cada etapa corresponde a una franja de desarrollo ajedrecístico:
 * - Principiante: Paso 1 (Reglas, tablero, movimientos, capturas y jaque).
 * - Intermedio: Pasos 2 y 3 (Aperturas clásicas, defensas asimétricas, táctica y auditoría de blunders).
 * - Avanzado: Paso 4+ (Estructuras de peones, finales teóricos, sparring con Turing ~1808 Elo y torneos).
 */
export const ETAPAS_APRENDIZAJE = {
  principiante: {
    id: 'principiante',
    nombre: 'Paso 1 · Fundamentos',
    nivelRecomendado: 'Principiante',
    icono: 'school',
    lema: 'Reglas esenciales, tablero y movimientos básicos (Stappenmethode)',
    capitulos: [
      {
        id: 'tablero',
        titulo: 'El tablero y coordenadas',
        descripcion: 'Comprender la cuadrícula de 64 casillas, columnas (a-h) y filas (1-8). Se completa al jugar tu primera partida.',
        accion: 'sala',
        icono: 'grid_view',
      },
      {
        id: 'piezas',
        titulo: 'Las 6 piezas del ajedrez',
        descripcion: 'Conocé el valor y la función de cada pieza. Se completa al revisarlas en "Aprendé cada pieza".',
        accion: 'piezas',
        pieza: 'Q',
      },
      {
        id: 'posicion',
        titulo: 'Posición inicial del combate',
        descripcion: 'Ubicación reglamentaria de las 32 piezas en el tablero antes de la batalla. Marcala como vista cuando la domines.',
        marcable: true,
        pieza: 'R',
      },
      {
        id: 'movimientos',
        titulo: 'Movimiento de las piezas',
        descripcion: 'Patrones de desplazamiento de peón, caballo, alfil, torre, dama y rey. Marcala como vista cuando la practiques.',
        marcable: true,
        pieza: 'N',
      },
      {
        id: 'enroque',
        titulo: 'Enroque corto y largo',
        descripcion: 'La maniobra especial para poner a salvo al rey y activar la torre en un solo turno. Marcala o realizala en una partida.',
        marcable: true,
        accion: 'sala',
        pieza: 'K',
      },
      {
        id: 'captura',
        titulo: 'Captura y peón al paso',
        descripcion: 'Mecánica de captura tradicional y la regla histórica del "en passant". Se completa al realizar una captura en partida.',
        accion: 'sala',
        pieza: 'P',
      },
      {
        id: 'jaque',
        titulo: 'Jaque, jaque mate y tablas',
        descripcion: 'Cómo amenazar al rey rival, defenderse del jaque y rematar la partida con mate. Se completa al dar jaque o mate.',
        accion: 'sala',
        pieza: 'K',
      },
    ],
  },
  intermedio: {
    id: 'intermedio',
    nombre: 'Pasos 2-3 · Aperturas y Táctica',
    nivelRecomendado: 'Intermedio',
    icono: 'psychology',
    lema: 'Principios de apertura, defensas activas, combinaciones tácticas y práctica deliberada',
    capitulos: [
      {
        id: 'mandamientos_apertura',
        titulo: 'Los 3 principios de apertura',
        descripcion: 'Controlar el centro (d4/e4/d5/e5), desarrollar caballos y alfiles activamente, y proteger al rey en las primeras 10 jugadas.',
        marcable: true,
        icono: 'flag',
      },
      {
        id: 'aperturas_clasicas',
        titulo: 'Apertura Italiana y Española',
        descripcion: 'Sistemas abiertos con 1.e4 e5: rápido desarrollo del alfil para presionar el punto f7 o clavar el caballo defensor.',
        marcable: true,
        pieza: 'B',
      },
      {
        id: 'defensas_activas',
        titulo: 'Defensa Siciliana (1.e4 c5)',
        descripcion: 'La respuesta asimétrica y combativa más popular contra el peón de rey para disputar la iniciativa desde la jugada 1.',
        marcable: true,
        pieza: 'N',
      },
      {
        id: 'gambito_dama',
        titulo: 'Juego cerrado: Gambito de Dama',
        descripcion: 'Batalla posicional tras 1.d4 d5 2.c4: lucha estratégica por el dominio central, estructuras sólidas y cadenas de peones.',
        marcable: true,
        pieza: 'Q',
      },
      {
        id: 'tactica_doble',
        titulo: 'Táctica: Ataque doble y horquilla',
        descripcion: 'El recurso táctico más letal: una sola pieza amenaza dos objetivos simultáneamente, ganando material decisivo.',
        marcable: true,
        pieza: 'N',
      },
      {
        id: 'tactica_clavada',
        titulo: 'Táctica: Clavada y enfilada',
        descripcion: 'Inmovilizar una pieza enemiga porque detrás se encuentra el rey o una pieza de mayor valor que caería indefensa.',
        marcable: true,
        pieza: 'B',
      },
      {
        id: 'erradicar_blunders',
        titulo: 'Auditoría de colgadas (Blunders)',
        descripcion: 'Práctica deliberada: usar la retroalimentación de Turing para erradicar piezas colgadas e imprecisiones tácticas graves.',
        accion: 'repaso',
        icono: 'verified_user',
      },
    ],
  },
  avanzado: {
    id: 'avanzado',
    nombre: 'Paso 4+ · Estrategia y Maestría',
    nivelRecomendado: 'Avanzado',
    icono: 'military_tech',
    lema: 'Estructuras de peones, finales teóricos, sparring con Turing (~1808 Elo) y ranking',
    capitulos: [
      {
        id: 'estructuras_peones',
        titulo: 'Estructuras e islas de peones',
        descripcion: 'Comprender debilidades a largo plazo: peones doblados, peones aislados, mayorías en el flanco y peones pasados candidatos.',
        marcable: true,
        pieza: 'P',
      },
      {
        id: 'finales_torre',
        titulo: 'Finales teóricos de torre y peón',
        descripcion: 'Dominio de las posiciones clave de finales: la técnica de construcción del puente de Lucena y la defensa activa de Filidor.',
        marcable: true,
        pieza: 'R',
      },
      {
        id: 'sparring_turing',
        titulo: 'Sparring contra Turing (~1808 Elo)',
        descripcion: 'Partidas de alta exigencia contra la red neuronal profunda SE-ResNet-8 con búsqueda táctica de 2-3 plies.',
        accion: 'sala',
        icono: 'neurology',
      },
      {
        id: 'analisis_centipeones',
        titulo: 'Evaluación de centipeones y precisión',
        descripcion: 'Auditar la pérdida promedio de centipeones (ACPL) en cada partida para afinar la toma de decisiones milimétrica.',
        accion: 'repaso',
        icono: 'analytics',
      },
      {
        id: 'maestria_torneos',
        titulo: 'Torneos y consolidación de Elo',
        descripcion: 'Competir en el ranking global, sostener rachas ganadoras y consolidar tu maestría ajedrecística.',
        accion: 'ranking',
        icono: 'trophy',
      },
    ],
  },
};

/** En pantallas anchas el camino zigzaguea entre estas posiciones (en % del ancho). */
const POSICIONES_ZIGZAG = [30, 70];

const RADIO_ANILLO = 34;
const LONGITUD_ANILLO = 2 * Math.PI * RADIO_ANILLO;

const ETIQUETA_ESTADO = {
  completado: '¡Listo!',
  en_curso: 'Vas por aquí',
  bloqueado: 'Se abre al terminar el anterior',
  proximo: 'Próximamente',
};

function claveCapitulosVistos(usuarioId) {
  return `camino_capitulos_vistos_${usuarioId ?? 'anon'}`;
}

function cargarCapitulosVistos(usuarioId) {
  try {
    const crudo = localStorage.getItem(claveCapitulosVistos(usuarioId));
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardarCapitulosVistos(usuarioId, ids) {
  try {
    localStorage.setItem(claveCapitulosVistos(usuarioId), JSON.stringify(ids));
  } catch {
    // Modo privado o cuota llena: el capítulo queda marcado solo en esta sesión.
  }
}

/** El jugador lleva blancas, así que sus jugadas son las de índice par de `jugadas_san`. */
function jugadasDelJugador(jugadasSan) {
  return jugadasSan.filter((_, indice) => indice % 2 === 0);
}

function hizoCaptura(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('x'));
}

function dioJaque(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('+') || san.includes('#'));
}

function hizoEnroque(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('O-O') || san.includes('0-0'));
}

/** Días seguidos con al menos una partida, contando hoy (o ayer, si hoy todavía no jugó). */
function rachaDeDias(fechas, ahora = new Date()) {
  const clave = (fecha) => `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
  const dias = new Set(
    fechas.map((f) => new Date(f)).filter((d) => !Number.isNaN(d.getTime())).map(clave),
  );
  const cursor = new Date(ahora);
  if (!dias.has(clave(cursor))) cursor.setDate(cursor.getDate() - 1);
  let racha = 0;
  while (dias.has(clave(cursor))) {
    racha += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

/** Anillo que se llena hasta el porcentaje y cuenta el número en paralelo. */
function AnilloProgreso({ porcentaje, reducir }) {
  const [valor, setValor] = useState(reducir ? porcentaje : 0);

  useEffect(() => {
    if (reducir) {
      setValor(porcentaje);
      return undefined;
    }
    const control = animate(0, porcentaje, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setValor(Math.round(v)),
    });
    return () => control.stop();
  }, [porcentaje, reducir]);

  const desplazamiento = LONGITUD_ANILLO * (1 - valor / 100);

  return (
    <div className="relative w-[88px] h-[88px] shrink-0" role="img" aria-label={`${valor}% del camino completado`}>
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="gradiente-anillo-camino" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-tertiary)" />
            <stop offset="1" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={RADIO_ANILLO} fill="none" stroke="var(--color-outline-variant)" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={RADIO_ANILLO}
          fill="none"
          stroke="url(#gradiente-anillo-camino)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={LONGITUD_ANILLO}
          strokeDashoffset={desplazamiento}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono-metric text-mono-metric font-bold text-on-surface">
        {valor}%
      </span>
    </div>
  );
}

/** Nodo del camino: estrella dorada si está listo, pieza con anillo si es el paso actual, candado si falta. */
function Nodo({ estado, pieza, icono, reducir, indice = 0 }) {
  if (estado === 'completado') {
    return (
      <motion.div
        initial={reducir ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className="relative flex items-center justify-center w-16 h-16 rounded-full text-on-tertiary-fixed"
        style={{
          background: 'linear-gradient(135deg, #ffdcc1, #ffb778)',
          boxShadow: '0 0 24px rgba(255, 183, 120, 0.45)',
        }}
      >
        {!reducir && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,183,120,0.55), transparent 70%)' }}
            animate={{ scale: [1, 1.7], opacity: [0.8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: indice * 0.35 }}
          />
        )}
        <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          star
        </span>
      </motion.div>
    );
  }

  if (estado === 'en_curso') {
    return (
      <div className="relative flex items-center justify-center w-16 h-16">
        {!reducir && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-primary-container"
            animate={{ scale: [1, 1.5], opacity: [0.9, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <div
          className="relative flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-lowest border-[3px] border-primary-container text-primary"
          style={{ boxShadow: '0 0 28px color-mix(in srgb, var(--color-primary-container) 50%, transparent)' }}
        >
          {pieza ? (
            <motion.img
              src={rutaImagenPieza(pieza)}
              alt=""
              className="w-10 h-10"
              animate={reducir ? undefined : { y: [0, -4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <span className="material-symbols-outlined text-[30px]">{icono ?? 'school'}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-outline-variant text-outline ${
        estado === 'proximo' ? 'opacity-50' : 'bg-surface-container'
      }`}
    >
      <span className="material-symbols-outlined text-[26px]">lock</span>
    </div>
  );
}

/** Trazo de una línea entre dos nodos: se dibuja al entrar, el activo fluye y el completado tiene una luz que viaja. */
function TrazoConector({ d, estadoOrigen, estadoDestino, indice, reducir }) {
  const idBase = useId();
  const hecho = estadoOrigen === 'completado' && estadoDestino === 'completado';
  const activo = estadoOrigen === 'completado' && estadoDestino === 'en_curso';

  const color = hecho
    ? 'var(--color-tertiary)'
    : activo
      ? 'var(--color-primary-container)'
      : 'var(--color-outline-variant)';

  const idRecorte = `${idBase}-recorte-camino`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <clipPath id={idRecorte} clipPathUnits="userSpaceOnUse">
          <rect x="-200" y="32" width="500" height="36" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idRecorte})`}>
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={hecho || activo ? 5 : 4}
          strokeLinecap="round"
          strokeDasharray={hecho ? undefined : '6 8'}
          vectorEffect="non-scaling-stroke"
          animate={{ strokeDashoffset: activo && !reducir ? [0, -28] : 0 }}
          transition={{ strokeDashoffset: { duration: 1.2, repeat: Infinity, ease: 'linear' } }}
        />
        {hecho && !reducir && (
          <motion.path
            d={d}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="4 60"
            vectorEffect="non-scaling-stroke"
            animate={{ strokeDashoffset: [0, -64] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: indice * 0.25 }}
          />
        )}
      </g>
    </svg>
  );
}

/**
 * Línea que une un nodo con el siguiente. En teléfono y tableta va recta por la
 * columna de los nodos; en pantallas anchas sigue el zigzag entre las posiciones.
 */
function Conector({ xDesde, xHasta, estadoOrigen, estadoDestino, indice, reducir }) {
  return (
    <>
      <div className="absolute left-0 w-16 pointer-events-none xl:hidden" style={{ top: 32, bottom: -32 }} aria-hidden="true">
        <TrazoConector
          d="M 50 0 L 50 100"
          estadoOrigen={estadoOrigen}
          estadoDestino={estadoDestino}
          indice={indice}
          reducir={reducir}
        />
      </div>
      <div className="absolute inset-x-0 hidden pointer-events-none xl:block" style={{ top: 32, bottom: -32 }} aria-hidden="true">
        <TrazoConector
          d={`M ${xDesde} 0 C ${xDesde} 50, ${xHasta} 50, ${xHasta} 100`}
          estadoOrigen={estadoOrigen}
          estadoDestino={estadoDestino}
          indice={indice}
          reducir={reducir}
        />
      </div>
    </>
  );
}

/** Tarjeta del paso actual: va arriba del camino para guiar al estudiante en su siguiente acción. */
function TarjetaPasoActual({
  capitulo,
  claseTextoContenido,
  alMarcarVisto,
  alIrASeccion,
  alIrASalaControl,
  reducir,
}) {
  const claseBoton =
    'px-space-md py-space-xs rounded-full bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all hover:brightness-110';

  return (
    <motion.section
      aria-label="Paso actual"
      initial={reducir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="p-space-md rounded-2xl border border-primary/40 bg-surface-container-lowest/80 flex flex-col gap-space-xs shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary font-bold">
          Paso actual sugerido · {capitulo.titulo}
        </span>
      </div>
      <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>{capitulo.descripcion}</p>
      <div className="flex flex-wrap gap-space-xs pt-1">
        {capitulo.marcable && (
          <motion.button
            type="button"
            onClick={() => alMarcarVisto(capitulo.id)}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            ¡Ya lo comprendí! (Marcar listo)
          </motion.button>
        )}
        {capitulo.accion === 'piezas' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('piezas')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            Ir a Aprendé cada pieza
          </motion.button>
        )}
        {capitulo.accion === 'sala' && alIrASalaControl && (
          <motion.button
            type="button"
            onClick={alIrASalaControl}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            Ir a Sala de Control y jugar
          </motion.button>
        )}
        {capitulo.accion === 'repaso' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('repaso')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            Ir a Repaso de tu partida
          </motion.button>
        )}
        {capitulo.accion === 'ranking' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('ranking')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            Ver Ranking de Maestría
          </motion.button>
        )}
      </div>
    </motion.section>
  );
}

/**
 * Camino de Aprendizaje multinivel adaptativo.
 * Implementa la fundamentación pedagógica formal (FIDE Stappenmethode y Práctica Deliberada):
 * Permite a jugadores de cualquier nivel explorar su currículo personalizado según su rango,
 * o inspeccionar y practicar etapas previas y avanzadas dinámicamente.
 */
export default function CaminoAprendizaje({
  usuarioId,
  rango,
  piezasVistas,
  alIrASeccion,
  alIrASalaControl,
  claseTextoContenido,
}) {
  const reducir = useReducedMotion();
  const [partidas, setPartidas] = useState([]);
  const [jugadasPorPartida, setJugadasPorPartida] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vistos, setVistos] = useState(() => cargarCapitulosVistos(usuarioId));

  // Determinar etapa inicial sugerida según el rango estimado del jugador
  const etapaSugerida = useMemo(() => {
    if (rango === 'Avanzado') return 'avanzado';
    if (rango === 'Intermedio') return 'intermedio';
    return 'principiante';
  }, [rango]);

  const [etapaActiva, setEtapaActiva] = useState(etapaSugerida);

  // Sincronizar si cambia el rango
  useEffect(() => {
    if (rango === 'Avanzado') setEtapaActiva('avanzado');
    else if (rango === 'Intermedio') setEtapaActiva('intermedio');
    else setEtapaActiva('principiante');
  }, [rango]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    historialPartidasPropio(PARTIDAS_A_REVISAR, 0)
      .then(async (historial) => {
        const jugadas = (historial?.partidas ?? []).filter((p) => p.cantidad_jugadas > 0);
        if (cancelado) return;
        setPartidas(jugadas);
        if (jugadas.length === 0) {
          setCargando(false);
          return;
        }

        // Obtener jugadas detalladas por lotes para verificar capturas, jaques y enroques
        const acumuladas = [];
        for (let desde = 0; desde < jugadas.length; desde += LOTE_DE_PARTIDAS) {
          const lote = jugadas.slice(desde, desde + LOTE_DE_PARTIDAS);
          const detalles = await Promise.allSettled(lote.map((p) => obtenerPartida(p.id)));
          if (cancelado) return;
          detalles.forEach((d) => {
            if (d.status === 'fulfilled') acumuladas.push(d.value?.jugadas ?? []);
          });
          setJugadasPorPartida([...acumuladas]);
          setCargando(false);
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  function marcarVisto(id) {
    setVistos((actual) => {
      if (actual.includes(id)) return actual;
      const nuevo = [...actual, id];
      guardarCapitulosVistos(usuarioId, nuevo);
      return nuevo;
    });
  }

  // Evaluar estado de los capítulos para la etapa activa
  const capitulosConfig = ETAPAS_APRENDIZAJE[etapaActiva]?.capitulos ?? ETAPAS_APRENDIZAJE.principiante.capitulos;

  const capitulos = useMemo(() => {
    // Mapa de verificaciones objetivas
    const verificaciones = {
      // Etapa Principiante
      tablero: partidas.length > 0 || vistos.includes('tablero'),
      piezas: (piezasVistas?.length ?? 0) >= 6 || vistos.includes('piezas'),
      posicion: vistos.includes('posicion'),
      movimientos: vistos.includes('movimientos'),
      enroque: vistos.includes('enroque') || jugadasPorPartida.some(hizoEnroque),
      captura: vistos.includes('captura') || jugadasPorPartida.some(hizoCaptura),
      jaque: vistos.includes('jaque') || jugadasPorPartida.some(dioJaque),

      // Etapa Intermedia
      mandamientos_apertura: vistos.includes('mandamientos_apertura'),
      aperturas_clasicas: vistos.includes('aperturas_clasicas'),
      defensas_activas: vistos.includes('defensas_activas'),
      gambito_dama: vistos.includes('gambito_dama'),
      tactica_doble: vistos.includes('tactica_doble'),
      tactica_clavada: vistos.includes('tactica_clavada'),
      erradicar_blunders: vistos.includes('erradicar_blunders') || partidas.length >= 3,

      // Etapa Avanzada
      estructuras_peones: vistos.includes('estructuras_peones'),
      finales_torre: vistos.includes('finales_torre'),
      sparring_turing: vistos.includes('sparring_turing') || partidas.some((p) => p.tipo_oponente === 'modelo'),
      analisis_centipeones: vistos.includes('analisis_centipeones') || partidas.length >= 5,
      maestria_torneos: vistos.includes('maestria_torneos') || rango === 'Avanzado',
    };

    let hayEnCurso = false;
    return capitulosConfig.map((c) => {
      const estaHecho = Boolean(verificaciones[c.id]);
      if (estaHecho) return { ...c, estado: 'completado' };
      if (!hayEnCurso) {
        hayEnCurso = true;
        return { ...c, estado: 'en_curso' };
      }
      return { ...c, estado: 'bloqueado' };
    });
  }, [capitulosConfig, partidas, jugadasPorPartida, piezasVistas, vistos, rango]);

  const completados = capitulos.filter((c) => c.estado === 'completado').length;
  const porcentaje = Math.round((completados / capitulosConfig.length) * 100);
  const racha = useMemo(() => rachaDeDias(partidas.map((p) => p.fecha)), [partidas]);
  const enCurso = capitulos.find((c) => c.estado === 'en_curso');

  if (cargando) {
    return (
      <div className="flex flex-col gap-space-sm" aria-busy="true" aria-label="Armando tu camino pedagógico">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Sincronizando plan pedagógico según tu nivel…</span>
        </div>
        <div className="h-28 rounded-3xl border border-outline-variant/10 bg-on-surface/[0.04] backdrop-blur-md animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-body-sm text-body-sm text-error py-space-xs">
        No pudimos cargar tu progreso en este momento. {error.message || ''}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Selector de Etapa Pedagógica (Tabs multinivel interactivos) */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
            Metodología FIDE · Currículo adaptativo
          </span>
          <span className="font-mono-micro text-mono-micro px-2 py-0.5 rounded bg-surface-container text-primary font-medium">
            Rango actual: {rango ?? 'Principiante'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30">
          {Object.values(ETAPAS_APRENDIZAJE).map((etapa) => {
            const esActiva = etapaActiva === etapa.id;
            const esSugerida = etapaSugerida === etapa.id;

            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => setEtapaActiva(etapa.id)}
                className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  esActiva
                    ? 'bg-surface-container-high text-primary font-semibold shadow-sm border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{etapa.icono}</span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{etapa.nombre}</span>
                  {esSugerida && (
                    <span className="text-[10px] font-mono-micro text-neon-lime uppercase tracking-wider">
                      ★ Recomendado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cabecera de progreso de la etapa activa */}
      <motion.header
        key={etapaActiva}
        initial={reducir ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl p-space-md border border-outline-variant/30"
        style={{
          background:
            'radial-gradient(circle at 15% 0%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 55%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--color-tertiary) 12%, transparent), transparent 50%), var(--color-surface-container-low)',
        }}
      >
        <div className="flex flex-wrap items-center gap-space-md">
          <AnilloProgreso porcentaje={porcentaje} reducir={reducir} />

          <div className="flex-1 min-w-[12rem] flex flex-col gap-space-2xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="px-space-sm py-[2px] rounded-full bg-primary/15 text-primary font-mono-micro text-mono-micro uppercase tracking-wider font-semibold">
                {ETAPAS_APRENDIZAJE[etapaActiva]?.nombre}
              </span>
              <span className="flex items-center gap-1 px-space-sm py-[2px] rounded-full bg-tertiary/10 text-tertiary font-mono-micro text-mono-micro">
                <motion.span
                  className="material-symbols-outlined text-[16px]"
                  animate={reducir || racha === 0 ? undefined : { scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  local_fire_department
                </motion.span>
                {racha > 0 ? `${racha} ${racha === 1 ? 'día' : 'días'} de práctica` : 'Jugá hoy para iniciar racha'}
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {completados} de {capitulosConfig.length} módulos completados
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
              {ETAPAS_APRENDIZAJE[etapaActiva]?.lema}
            </p>
            {enCurso ? (
              <p className="font-body-sm text-body-sm text-primary font-medium mt-1">
                Siguiente objetivo: {enCurso.titulo}
              </p>
            ) : (
              <p className="font-body-sm text-body-sm text-neon-lime font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                ¡Felicitaciones! Has completado todos los módulos de esta etapa.
              </p>
            )}
          </div>
        </div>
      </motion.header>

      {/* Tarjeta de acción inmediata para el módulo actual */}
      {enCurso && (
        <TarjetaPasoActual
          capitulo={enCurso}
          claseTextoContenido={claseTextoContenido}
          alMarcarVisto={marcarVisto}
          alIrASeccion={alIrASeccion}
          alIrASalaControl={alIrASalaControl}
          reducir={reducir}
        />
      )}

      {/* Lista del camino en zigzag con nodos y conectores */}
      <ol className="flex flex-col" aria-label={`Capítulos de ${ETAPAS_APRENDIZAJE[etapaActiva]?.nombre}`}>
        {capitulos.map((fila, indice) => {
          const siguiente = capitulos[indice + 1];
          const x = POSICIONES_ZIGZAG[indice % POSICIONES_ZIGZAG.length];
          const xSiguiente = POSICIONES_ZIGZAG[(indice + 1) % POSICIONES_ZIGZAG.length];
          const etiquetaIzquierda = siguiente ? xSiguiente > x : x > 50;

          return (
            <motion.li
              key={fila.id}
              className={`relative ${siguiente ? 'pb-10' : ''}`}
              style={{ '--x': `${x}%` }}
              initial={reducir ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + indice * 0.05, duration: 0.35 }}
            >
              {siguiente && (
                <Conector
                  xDesde={x}
                  xHasta={xSiguiente}
                  estadoOrigen={fila.estado}
                  estadoDestino={siguiente.estado}
                  indice={indice}
                  reducir={reducir}
                />
              )}

              <div className="h-16" aria-hidden="true" />

              <div className="absolute top-0 left-0 w-16 h-16 xl:left-[calc(var(--x)_-_2rem)]">
                <Nodo estado={fila.estado} pieza={fila.pieza} icono={fila.icono} reducir={reducir} indice={indice} />
              </div>

              <div
                className={`absolute top-0 left-[4.5rem] right-0 h-16 flex flex-col justify-center xl:w-44 ${
                  etiquetaIzquierda
                    ? 'xl:left-auto xl:right-[calc(100%_-_var(--x)_+_2.75rem)] xl:text-right'
                    : 'xl:left-[calc(var(--x)_+_2.75rem)] xl:right-auto xl:text-left'
                }`}
              >
                <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{fila.titulo}</p>
                <p
                  className={`font-mono-micro text-mono-micro ${
                    fila.estado === 'completado'
                      ? 'text-tertiary-fixed-dim'
                      : fila.estado === 'en_curso'
                        ? 'text-primary font-bold'
                        : 'text-outline'
                  }`}
                >
                  Módulo {indice + 1} · {ETIQUETA_ESTADO[fila.estado]}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
