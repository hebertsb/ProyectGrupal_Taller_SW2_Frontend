import { useEffect, useId, useMemo, useState } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { historialPartidasPropio, obtenerPartida } from '../../api/backend';
import { rutaImagenPieza } from '../../ajedrez';

/** Cuántas partidas recientes se revisan para los capítulos de captura y jaque. */
const PARTIDAS_A_REVISAR = 20;

/**
 * Capítulos del camino para jugadores principiantes. Los de tablero, piezas,
 * captura y jaque se completan con datos reales de las partidas o del panel;
 * los de posición y movimientos los marca el propio jugador (sin datos inventados).
 * `pieza` es la letra FEN de la pieza que representa el capítulo; `icono`, el de
 * Material Symbols cuando no hay pieza que lo represente.
 */
const CAPITULOS = [
  {
    id: 'tablero',
    titulo: 'El tablero',
    descripcion: 'Cómo está armado el tablero. Se completa al jugar tu primera partida.',
    accion: 'sala',
    icono: 'grid_view',
  },
  {
    id: 'piezas',
    titulo: 'Las piezas',
    descripcion: 'Conocé las 6 piezas y cómo se mueve cada una. Se completa al revisarlas todas en "Aprendé cada pieza".',
    accion: 'piezas',
    pieza: 'Q',
  },
  {
    id: 'posicion',
    titulo: 'Posición inicial',
    descripcion: 'Dónde empieza cada pieza en el tablero. Marcala como vista cuando la termines.',
    marcable: true,
    pieza: 'R',
  },
  {
    id: 'movimientos',
    titulo: 'Movimiento de las piezas',
    descripcion: 'Cómo se mueve cada pieza en su turno. Marcala como vista cuando la termines.',
    marcable: true,
    pieza: 'N',
  },
  {
    id: 'captura',
    titulo: 'Captura de piezas',
    descripcion: 'Cuándo una pieza captura a otra. Se completa cuando hacés una captura en una de tus partidas.',
    accion: 'sala',
    pieza: 'B',
  },
  {
    id: 'jaque',
    titulo: 'Jaque y jaque mate',
    descripcion: 'Cómo dar jaque y jaque mate. Se completa cuando das jaque o mate en una de tus partidas.',
    accion: 'sala',
    pieza: 'K',
  },
];

/** Capítulos previstos que todavía no tienen contenido: se muestran sin progreso. */
const PROXIMOS = ['Estrategias básicas', 'Puzzles y práctica'];

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
            <stop offset="0" stopColor="#ffb778" />
            <stop offset="1" stopColor="#00e5ff" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={RADIO_ANILLO} fill="none" stroke="#33343b" strokeWidth="8" />
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

/** Nodo del camino: estrella dorada si está listo (con halo que respira), pieza con anillo si es el paso actual, candado si falta. */
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
          style={{ boxShadow: '0 0 28px rgba(0, 229, 255, 0.5)' }}
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
            <span className="material-symbols-outlined text-[30px]">{icono}</span>
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
  const hecho = estadoOrigen === 'completado' && estadoDestino === 'completado';
  const activo = estadoOrigen === 'completado' && estadoDestino === 'en_curso';
  const color = hecho ? '#ffb778' : activo ? '#00e5ff' : '#56656a';

  // La línea se revela de arriba hacia abajo con un recorte, así se ve que avanza sin tocar el patrón de dash.
  const idRecorte = useId();

  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <clipPath id={idRecorte}>
          <motion.rect
            x="-5"
            y="-5"
            width="110"
            initial={{ height: reducir ? 110 : 0 }}
            animate={{ height: 110 }}
            transition={{ duration: 0.9, delay: 0.2 + indice * 0.12, ease: 'easeInOut' }}
          />
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
          stroke="#fff4e6"
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

/** Tarjeta del paso actual: va arriba del camino para que las líneas no la crucen. */
function TarjetaPasoActual({ capitulo, claseTextoContenido, alMarcarVisto, alIrASeccion, alIrASalaControl, reducir }) {
  const claseBoton =
    'px-space-md py-space-xs rounded-full bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <motion.section
      aria-label="Paso actual"
      initial={reducir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="p-space-md rounded-2xl border border-primary/40 bg-surface-container-lowest/80 flex flex-col gap-space-xs"
    >
      <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">
        Paso actual · {capitulo.titulo}
      </span>
      <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>{capitulo.descripcion}</p>
      <div className="flex flex-wrap gap-space-xs">
        {capitulo.marcable && (
          <motion.button
            type="button"
            onClick={() => alMarcarVisto(capitulo.id)}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            ¡Ya la vi!
          </motion.button>
        )}
        {capitulo.accion === 'piezas' && (
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
            Ir a Sala de Control
          </motion.button>
        )}
      </div>
    </motion.section>
  );
}

/**
 * Camino de capítulos para el jugador principiante. Recibe las piezas ya vistas
 * del panel y lee sus partidas reales para marcar captura y jaque.
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

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    historialPartidasPropio(PARTIDAS_A_REVISAR, 0)
      .then(async (historial) => {
        const jugadas = (historial?.partidas ?? []).filter((p) => p.cantidad_jugadas > 0);
        const detalles = await Promise.allSettled(jugadas.map((p) => obtenerPartida(p.id)));
        if (cancelado) return;
        setPartidas(jugadas);
        setJugadasPorPartida(
          detalles.filter((d) => d.status === 'fulfilled').map((d) => d.value?.jugadas ?? []),
        );
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

  const capitulos = useMemo(() => {
    const hechos = {
      tablero: partidas.length > 0,
      piezas: (piezasVistas?.length ?? 0) >= 6,
      posicion: vistos.includes('posicion'),
      movimientos: vistos.includes('movimientos'),
      captura: jugadasPorPartida.some(hizoCaptura),
      jaque: jugadasPorPartida.some(dioJaque),
    };
    // Cada capítulo se desbloquea al terminar el anterior: el primero pendiente queda en curso.
    let hayEnCurso = false;
    return CAPITULOS.map((c) => {
      if (hechos[c.id]) return { ...c, estado: 'completado' };
      if (!hayEnCurso) {
        hayEnCurso = true;
        return { ...c, estado: 'en_curso' };
      }
      return { ...c, estado: 'bloqueado' };
    });
  }, [partidas, jugadasPorPartida, piezasVistas, vistos]);

  const completados = capitulos.filter((c) => c.estado === 'completado').length;
  const porcentaje = Math.round((completados / CAPITULOS.length) * 100);
  const racha = useMemo(() => rachaDeDias(partidas.map((p) => p.fecha)), [partidas]);
  const enCurso = capitulos.find((c) => c.estado === 'en_curso');

  // Filas del camino: los capítulos reales seguidos de los previstos.
  const filas = [
    ...capitulos,
    ...PROXIMOS.map((titulo) => ({ id: titulo, titulo, estado: 'proximo' })),
  ];

  if (cargando) {
    return (
      <div className="animate-pulse flex flex-col gap-space-md" aria-busy="true" aria-label="Armando tu camino">
        <div className="h-32 rounded-3xl bg-surface-container" />
        <div className="h-24 rounded-2xl bg-surface-container" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-body-sm text-body-sm text-error py-space-xs">
        No pudimos cargar tu camino en este momento. {error.message || ''}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <motion.header
        initial={reducir ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl p-space-md border border-outline-variant/30"
        style={{
          background:
            'radial-gradient(circle at 15% 0%, rgba(0,229,255,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(255,183,120,0.16), transparent 50%), #191b22',
        }}
      >
        <div className="flex flex-wrap items-center gap-space-md">
          <AnilloProgreso porcentaje={porcentaje} reducir={reducir} />

          <div className="flex-1 min-w-[12rem] flex flex-col gap-space-2xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="px-space-sm py-[2px] rounded-full bg-primary/15 text-primary font-mono-micro text-mono-micro uppercase tracking-wider font-semibold">
                Nivel {rango ?? 'sin medir'}
              </span>
              <span className="flex items-center gap-1 px-space-sm py-[2px] rounded-full bg-tertiary-container/15 text-tertiary-container font-mono-micro text-mono-micro">
                <motion.span
                  className="material-symbols-outlined text-[16px]"
                  animate={reducir || racha === 0 ? undefined : { scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  local_fire_department
                </motion.span>
                {racha > 0 ? `${racha} ${racha === 1 ? 'día' : 'días'} seguidos` : 'Jugá hoy para arrancar una racha'}
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {completados} de {CAPITULOS.length} capítulos listos
            </p>
            {enCurso ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Siguiente paso: <span className="text-primary font-medium">{enCurso.titulo}</span>
              </p>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Terminaste los capítulos disponibles. Pronto llegan más.</p>
            )}
          </div>
        </div>
      </motion.header>

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

      <ol className="flex flex-col" aria-label="Capítulos del camino">
        {filas.map((fila, indice) => {
          const siguiente = filas[indice + 1];
          const x = POSICIONES_ZIGZAG[indice % POSICIONES_ZIGZAG.length];
          const xSiguiente = POSICIONES_ZIGZAG[(indice + 1) % POSICIONES_ZIGZAG.length];
          // La etiqueta va del lado contrario hacia donde sigue el camino, así la línea nunca la cruza.
          const etiquetaIzquierda = siguiente ? xSiguiente > x : x > 50;
          return (
            <motion.li
              key={fila.id}
              className={`relative ${siguiente ? 'pb-10' : ''}`}
              style={{ '--x': `${x}%` }}
              initial={reducir ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + indice * 0.08, duration: 0.4 }}
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
                className={`absolute top-0 left-[4.5rem] right-0 h-16 flex flex-col justify-center xl:w-32 ${
                  etiquetaIzquierda
                    ? 'xl:left-auto xl:right-[calc(100%_-_var(--x)_+_2.75rem)] xl:text-right'
                    : 'xl:left-[calc(var(--x)_+_2.75rem)] xl:right-auto xl:text-left'
                }`}
              >
                <p className="font-body-sm text-body-sm font-semibold text-on-surface">{fila.titulo}</p>
                <p
                  className={`font-mono-micro text-mono-micro ${
                    fila.estado === 'completado' ? 'text-tertiary-fixed-dim' : fila.estado === 'en_curso' ? 'text-primary' : 'text-outline'
                  }`}
                >
                  Capítulo {indice + 1} · {ETIQUETA_ESTADO[fila.estado]}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
