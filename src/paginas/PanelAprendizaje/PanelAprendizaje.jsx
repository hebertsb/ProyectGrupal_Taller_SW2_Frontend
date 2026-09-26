import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analisisCompletoPartida, historialPartidasPropio } from '../../api/backend';
import { casillasIlustrativas, rutaImagenPieza } from '../../ajedrez';

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];

/** 6 piezas — letra en mayúscula para `rutaImagenPieza` (siempre el set blanco, ilustrativo). */
const PIEZAS = [
  { tipo: 'rey', nombre: 'Rey', articulo: 'el', letra: 'K' },
  { tipo: 'dama', nombre: 'Dama', articulo: 'la', letra: 'Q' },
  { tipo: 'torre', nombre: 'Torre', articulo: 'la', letra: 'R' },
  { tipo: 'alfil', nombre: 'Alfil', articulo: 'el', letra: 'B' },
  { tipo: 'caballo', nombre: 'Caballo', articulo: 'el', letra: 'N' },
  { tipo: 'peon', nombre: 'Peón', articulo: 'el', letra: 'P' },
];

/**
 * Estilo por `calidad` — el campo que ya devuelve el backend por jugada
 * (`explicar_jugada`/`clasificar_calidad_jugada`, ver servicio_retroalimentacion.py).
 * No reusa `ESTILO_CATEGORIA` de aprendizaje.js a propósito: esa tabla tiene
 * solo 5 categorías calculadas del lado del cliente a partir del winPercent
 * (para la vista técnica "Aprendizaje"), mientras que acá se pinta tal cual
 * la clasificación pedagógica de 7 niveles que ya calculó el servidor.
 */
const ESTILO_CALIDAD = {
  brillante: { etiqueta: 'Brillante', texto: 'text-neon-lime', fondo: 'bg-neon-lime/10', icono: 'stars' },
  mejor: { etiqueta: 'Mejor jugada', texto: 'text-primary', fondo: 'bg-primary-container/20', icono: 'stars' },
  excelente: { etiqueta: 'Excelente', texto: 'text-primary', fondo: 'bg-primary-container/10', icono: 'check_circle' },
  buena: { etiqueta: 'Buena', texto: 'text-secondary', fondo: 'bg-secondary-container/10', icono: 'check_circle' },
  imprecision: { etiqueta: 'Imprecisión', texto: 'text-tertiary-fixed-dim', fondo: 'bg-tertiary-container/20', icono: 'help' },
  error: { etiqueta: 'Error', texto: 'text-tertiary-fixed-dim', fondo: 'bg-tertiary-container/20', icono: 'warning' },
  blunder: { etiqueta: 'Blunder', texto: 'text-error', fondo: 'bg-error-container/20', icono: 'report' },
};

/** Definición corta por principio ajedrecístico — lenguaje simple, un término tocable por jugada. */
const TERMINOS = {
  pieza_indefensa: { termino: 'pieza colgada', definicion: 'Una pieza que el rival puede capturar gratis porque nadie la defiende.' },
  control_del_centro: { termino: 'control del centro', definicion: 'Dominar las casillas centrales (d4, d5, e4, e5). Desde ahí tus piezas llegan a más lugares.' },
  desarrollo_piezas: { termino: 'desarrollo de piezas', definicion: 'Sacar los caballos y alfiles de su casilla inicial para que puedan entrar al juego.' },
  seguridad_del_rey: { termino: 'enroque', definicion: 'Una jugada especial que pone al rey a resguardo y activa una torre, en un solo movimiento.' },
  oportunidad_tactica: { termino: 'táctica', definicion: 'Una jugada o serie de jugadas que ganan material o dan jaque mate por sorpresa.' },
  iniciativa_tactica: { termino: 'iniciativa', definicion: 'Cuando tus jugadas obligan al rival a defenderse, en vez de dejarlo seguir su propio plan.' },
  jaque_mate: { termino: 'jaque mate', definicion: 'Un jaque del que el rey no tiene forma de escapar. Termina la partida.' },
  imprecision_posicional: { termino: 'imprecisión', definicion: 'Una jugada que no es grave, pero deja pasar una opción algo mejor.' },
  error_tactico: { termino: 'error táctico', definicion: 'Una jugada que le regala ventaja al rival por no ver una amenaza.' },
  colgada_grave: { termino: 'blunder', definicion: 'Un error grande, de los que pierden una pieza importante o la partida.' },
  posicion_solida: { termino: 'posición sólida', definicion: 'Tus piezas están bien colocadas y no hay debilidades claras para atacar.' },
  maestria_tactica: { termino: 'jugada brillante', definicion: 'Una jugada excepcional, a veces un sacrificio, que rompe la posición del rival.' },
  general: { termino: 'jugada', definicion: 'El movimiento que elegiste en esa posición del tablero.' },
};

const TERMINOS_GENERALES = [
  { termino: 'centipawns', definicion: 'La unidad que usa el motor para medir la ventaja. 100 centipawns equivalen, más o menos, a un peón de diferencia.' },
  { termino: 'motor de ajedrez', definicion: 'Un programa (como Stockfish) que calcula millones de jugadas para decir cuál es la mejor en una posición.' },
];

const SECCIONES = [
  { id: 'nivel', titulo: 'Tu nivel', icono: 'military_tech' },
  { id: 'repaso', titulo: 'Repaso de tu partida', icono: 'history_edu' },
  { id: 'piezas', titulo: 'Aprendé cada pieza', icono: 'extension' },
  { id: 'resumen', titulo: 'Resumen del tutor', icono: 'menu_book' },
  { id: 'logros', titulo: 'Tus logros', icono: 'emoji_events' },
  { id: 'proximamente', titulo: 'Próximamente', icono: 'lock' },
];

const BOTONES_PROXIMAMENTE = [
  { titulo: 'Invitar a un amigo', icono: 'person_add' },
  { titulo: 'Buscar rival de mi nivel', icono: 'search' },
  { titulo: 'Ranking', icono: 'leaderboard' },
];

function clavePiezasVistas(usuarioId) {
  return `panel_aprendizaje_piezas_${usuarioId ?? 'anon'}`;
}

function cargarPiezasVistas(usuarioId) {
  try {
    const crudo = localStorage.getItem(clavePiezasVistas(usuarioId));
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardarPiezasVistas(usuarioId, piezas) {
  try {
    localStorage.setItem(clavePiezasVistas(usuarioId), JSON.stringify(piezas));
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no es crítico, el estado en memoria sigue sirviendo.
  }
}

/**
 * Narración por voz con la Web Speech API nativa (`window.speechSynthesis`) —
 * sin dependencias nuevas. `narrando` refleja el estado real del motor de
 * voz (eventos `onstart`/`onend`/`onerror`), no un booleano optimista.
 */
function useNarracion() {
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [narrando, setNarrando] = useState(false);

  const narrar = useCallback(
    (texto) => {
      if (!disponible || !texto) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-ES';
      utterance.onstart = () => setNarrando(true);
      utterance.onend = () => setNarrando(false);
      utterance.onerror = () => setNarrando(false);
      window.speechSynthesis.speak(utterance);
    },
    [disponible]
  );

  const detener = useCallback(() => {
    if (!disponible) return;
    window.speechSynthesis.cancel();
    setNarrando(false);
  }, [disponible]);

  useEffect(() => {
    return () => {
      if (disponible) window.speechSynthesis.cancel();
    };
  }, [disponible]);

  return { narrar, detener, narrando, disponible };
}

function textoNarrableDeJugada(jugada) {
  if (!jugada) return '';
  return `Jugada ${jugada.numero_ply}, ${jugada.jugada_san}. ${jugada.explicacion}`;
}

/**
 * Bloque colapsable — mismo patrón visual y de accesibilidad que "Candidatas
 * de Turing" en Razonamiento Neuronal (botón con `aria-expanded`/`aria-controls`,
 * flecha que rota). Un solo componente reusado por las 6 secciones del panel.
 */
function SeccionAcordeon({ id, titulo, icono, abierta, onToggle, innerRef, children }) {
  return (
    <section
      ref={innerRef}
      className="bg-surface-container/70 border border-outline-variant/30 rounded-xl shadow-md overflow-hidden scroll-mt-20"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        aria-controls={`panel-${id}`}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-high/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0">{icono}</span>
          <span className="font-headline-sm text-headline-sm text-on-surface truncate">{titulo}</span>
        </span>
        <span
          className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {abierta && (
        <div id={`panel-${id}`} className="px-4 pb-4 pt-1 border-t border-outline-variant/20 flex flex-col gap-3">
          {children}
        </div>
      )}
    </section>
  );
}

function CargandoInline({ texto }) {
  return (
    <div className="flex items-center gap-2 py-2 text-on-surface-variant">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

function AvisoError({ mensaje }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
      <span>{mensaje}</span>
    </div>
  );
}

/** Mini-tablero 8x8 ilustrativo: la pieza sola en el centro + sus casillas de movimiento (ver ajedrez.js). */
function MiniTableroPieza({ pieza }) {
  const filaCentro = 3;
  const columnaCentro = 3;
  const destinos = useMemo(() => casillasIlustrativas(pieza.tipo, filaCentro, columnaCentro), [pieza.tipo]);

  return (
    <div
      className="grid grid-cols-8 grid-rows-8 w-full aspect-square rounded-lg overflow-hidden border border-outline-variant/30"
      role="img"
      aria-label={`Tablero vacío mostrando hacia dónde se mueve ${pieza.articulo} ${pieza.nombre.toLowerCase()} desde el centro (ilustrativo, no es una posición real)`}
    >
      {Array.from({ length: 64 }).map((_, indice) => {
        const fila = Math.floor(indice / 8);
        const columna = indice % 8;
        const esClara = (fila + columna) % 2 === 0;
        const esCentro = fila === filaCentro && columna === columnaCentro;
        const esDestino = !esCentro && destinos.some(([f, c]) => f === fila && c === columna);
        return (
          <div
            key={indice}
            className={`relative flex items-center justify-center ${esClara ? 'bg-surface-container-high' : 'bg-surface-container'}`}
          >
            {esCentro && <img src={rutaImagenPieza(pieza.letra)} alt="" className="w-6 h-6" draggable="false" />}
            {esDestino && <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function fechaLegible(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Panel de Aprendizaje — tutor "Turing" para el rol `jugador`. A diferencia
 * de la vista técnica "Aprendizaje" (jugada por jugada, para quien ya sabe
 * leer una evaluación en centipawns), esta pantalla está pensada para
 * alguien que recién está aprendiendo: oraciones cortas, narración por voz,
 * y todo detrás de un acordeón para no abrumar con todo junto.
 */
export default function PanelAprendizaje({ usuario }) {
  const [seccionAbierta, setSeccionAbierta] = useState('nivel');
  const refsSeccion = useRef({});

  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const [analisis, setAnalisis] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState(null);

  const [piezaElegida, setPiezaElegida] = useState(null);
  const [piezasVistas, setPiezasVistas] = useState(() => cargarPiezasVistas(usuario?.id));
  const [terminoAbierto, setTerminoAbierto] = useState(null);

  const { narrar, detener, narrando, disponible: vozDisponible } = useNarracion();

  const rango = usuario?.rango_estimado || 'Intermedio';
  const nombreCorto = usuario?.nombre?.trim().split(/\s+/)[0] || 'jugador';

  useEffect(() => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    historialPartidasPropio(5, 0)
      .then(setHistorial)
      .catch((err) => setErrorHistorial(err))
      .finally(() => setCargandoHistorial(false));
  }, []);

  // Partidas con al menos una jugada — una partida recién creada y nunca jugada
  // no sirve como "tu última partida" para repasar (mismo criterio que RazonamientoNeuronal.jsx).
  const partidasJugadas = useMemo(
    () => (historial?.partidas ?? []).filter((p) => p.cantidad_jugadas > 0),
    [historial]
  );
  const ultimaPartidaId = partidasJugadas[0]?.id ?? null;

  useEffect(() => {
    if (!ultimaPartidaId) return;
    setCargandoAnalisis(true);
    setErrorAnalisis(null);
    analisisCompletoPartida(ultimaPartidaId, rango)
      .then(setAnalisis)
      .catch((err) => setErrorAnalisis(err))
      .finally(() => setCargandoAnalisis(false));
  }, [ultimaPartidaId, rango]);

  // La jugada "relevante" para repasar: la última con margen de mejora si hubo
  // alguna, o si la partida fue impecable, directamente la última jugada.
  const jugadaRelevante = useMemo(() => {
    const jugadas = analisis?.jugadas ?? [];
    if (jugadas.length === 0) return null;
    const conMargen = [...jugadas].reverse().find((j) => ['imprecision', 'error', 'blunder'].includes(j.calidad));
    return conMargen ?? jugadas[jugadas.length - 1];
  }, [analisis]);

  const estiloJugadaRelevante = jugadaRelevante ? ESTILO_CALIDAD[jugadaRelevante.calidad] ?? ESTILO_CALIDAD.buena : null;
  const terminoPrincipal = jugadaRelevante ? TERMINOS[jugadaRelevante.principio_ajedrecistico] ?? TERMINOS.general : null;
  const terminosDeLaJugada = terminoPrincipal ? [terminoPrincipal, ...TERMINOS_GENERALES] : [];
  const textoRepaso = textoNarrableDeJugada(jugadaRelevante);

  function manejarClickSeccionSidebar(id) {
    setSeccionAbierta(id);
    requestAnimationFrame(() => {
      refsSeccion.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function alternarSeccion(id) {
    setSeccionAbierta((actual) => (actual === id ? null : id));
  }

  function narrarRepaso() {
    if (narrando) {
      detener();
      return;
    }
    if (!textoRepaso) return;
    setSeccionAbierta('repaso');
    requestAnimationFrame(() => {
      refsSeccion.current.repaso?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    narrar(textoRepaso);
  }

  function elegirPieza(tipo) {
    setPiezaElegida(tipo);
    setPiezasVistas((actual) => {
      if (actual.includes(tipo)) return actual;
      const nuevo = [...actual, tipo];
      guardarPiezasVistas(usuario?.id, nuevo);
      return nuevo;
    });
  }

  const piezaActual = PIEZAS.find((p) => p.tipo === piezaElegida) ?? null;

  // ===== Insignias (HU "Tus logros") — solo datos reales, sin progreso inventado =====
  const primeraPartidaDesbloqueada = (historial?.total ?? 0) > 0;
  const insignias = [
    {
      id: 'primera-partida',
      titulo: 'Primera partida jugada',
      desbloqueada: primeraPartidaDesbloqueada,
      icono: 'flag',
    },
    {
      id: 'seis-piezas',
      titulo: `Conocé las 6 piezas: ${piezasVistas.length}/6`,
      desbloqueada: piezasVistas.length >= 6,
      icono: 'extension',
    },
    {
      id: 'repaso-turing',
      titulo: 'Repasaste una partida con Turing',
      desbloqueada: Boolean(analisis),
      icono: 'menu_book',
    },
  ];

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      {/* Encabezado — identidad de Turing, siempre visible, fuera del acordeón */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm bg-surface-container-low/80 backdrop-blur-md rounded-xl p-space-md shadow-md">
        <div className="flex items-center gap-space-sm flex-1 min-w-0">
          <div className="relative w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[26px]">psychology</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-lime border-2 border-surface-container-low" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase text-primary tracking-widest">Turing · tu tutor</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">
              Hola {nombreCorto}, repasemos tu ajedrez
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={narrarRepaso}
          disabled={!vozDisponible || (!textoRepaso && !narrando)}
          title={!vozDisponible ? 'Tu navegador no permite leer en voz alta' : 'Escuchar el repaso de tu última jugada'}
          className="flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">{narrando ? 'stop_circle' : 'volume_up'}</span>
          {narrando ? 'Detener' : 'Escuchar saludo de Turing'}
        </button>
      </div>

      {!vozDisponible && (
        <p className="font-mono-micro text-mono-micro text-outline px-space-xs">
          La narración por voz no está disponible en este navegador — el resto del panel funciona igual.
        </p>
      )}

      {/* Layout de dos columnas: sub-índice fijo + contenido en acordeón */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <nav
          className="lg:col-span-3 lg:sticky lg:top-20 flex lg:flex-col gap-space-2xs overflow-x-auto lg:overflow-visible bg-surface-container-low/60 rounded-xl p-space-xs"
          aria-label="Secciones del panel de aprendizaje"
        >
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => manejarClickSeccionSidebar(s.id)}
              aria-current={seccionAbierta === s.id ? 'true' : undefined}
              className={`shrink-0 flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg font-body-sm text-body-sm text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                seccionAbierta === s.id
                  ? 'bg-surface-container-high text-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{s.icono}</span>
              {s.titulo}
            </button>
          ))}
        </nav>

        <div className="lg:col-span-9 flex flex-col gap-space-md">
          {/* 1. Tu nivel */}
          <SeccionAcordeon
            id="nivel"
            titulo="Tu nivel"
            icono="military_tech"
            abierta={seccionAbierta === 'nivel'}
            onToggle={() => alternarSeccion('nivel')}
            innerRef={(el) => { refsSeccion.current.nivel = el; }}
          >
            <div className="grid grid-cols-3 gap-space-xs">
              {NIVELES.map((n) => {
                const esActual = n === rango;
                return (
                  <div
                    key={n}
                    className={`flex flex-col items-center gap-space-2xs p-space-sm rounded-xl border ${
                      esActual ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{esActual ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span className="font-body-sm text-body-sm font-medium">{n}</span>
                  </div>
                );
              })}
            </div>
            <p className="font-mono-micro text-mono-micro text-on-surface-variant">
              Tu nivel lo calcula el diagnóstico inicial. No se cambia a mano acá.
            </p>
            <div className="flex items-center gap-space-2xs pt-space-2xs" aria-hidden="true">
              {NIVELES.map((n, indice) => (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border-2 font-mono-micro text-[11px] font-bold ${
                      n === rango
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30'
                    }`}
                  >
                    {indice + 1}
                  </div>
                  {indice < NIVELES.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-space-2xs ${NIVELES.indexOf(rango) > indice ? 'bg-primary' : 'bg-outline-variant/30'}`} />
                  )}
                </div>
              ))}
            </div>
          </SeccionAcordeon>

          {/* 2. Repaso de tu partida */}
          <SeccionAcordeon
            id="repaso"
            titulo="Repaso de tu partida"
            icono="history_edu"
            abierta={seccionAbierta === 'repaso'}
            onToggle={() => alternarSeccion('repaso')}
            innerRef={(el) => { refsSeccion.current.repaso = el; }}
          >
            {cargandoHistorial && <CargandoInline texto="Buscando tu última partida…" />}

            {!cargandoHistorial && errorHistorial && (
              <AvisoError
                mensaje={
                  errorHistorial.status === 404 || errorHistorial.status === 405
                    ? 'No pudimos traer tu última partida en este servidor. Mientras tanto, podés revisar tus partidas en "Registro de Partidas".'
                    : errorHistorial.message || 'No se pudo cargar tu historial de partidas.'
                }
              />
            )}

            {!cargandoHistorial && !errorHistorial && partidasJugadas.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant py-space-xs">
                Todavía no jugaste ninguna partida. Andá a Sala de Control y jugá tu primera partida — después Turing la repasa acá con vos.
              </p>
            )}

            {ultimaPartidaId && cargandoAnalisis && <CargandoInline texto="Turing está repasando tu partida…" />}

            {ultimaPartidaId && !cargandoAnalisis && errorAnalisis && (
              <AvisoError mensaje={errorAnalisis.message || 'No se pudo analizar tu última partida.'} />
            )}

            {ultimaPartidaId && !cargandoAnalisis && !errorAnalisis && jugadaRelevante && (
              <>
                <div className="flex items-center gap-space-xs flex-wrap">
                  <span className={`flex items-center gap-1 px-space-xs py-space-2xs rounded-lg font-mono-micro text-mono-micro uppercase tracking-wide ${estiloJugadaRelevante.texto} ${estiloJugadaRelevante.fondo}`}>
                    <span className="material-symbols-outlined text-[14px]">{estiloJugadaRelevante.icono}</span>
                    {estiloJugadaRelevante.etiqueta}
                  </span>
                  <span className="font-mono-label text-mono-label text-on-surface-variant">
                    Jugada {jugadaRelevante.numero_ply} · {jugadaRelevante.jugada_san}
                  </span>
                </div>

                <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-space-2xs">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Turing te explica</span>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{jugadaRelevante.explicacion}</p>
                </div>

                <div className="flex flex-col gap-space-2xs">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">Términos de esta jugada (tocá para ver qué significan)</span>
                  <div className="flex flex-wrap gap-space-2xs">
                    {terminosDeLaJugada.map((t) => (
                      <button
                        key={t.termino}
                        type="button"
                        onClick={() => setTerminoAbierto((actual) => (actual === t.termino ? null : t.termino))}
                        aria-expanded={terminoAbierto === t.termino}
                        className="px-space-xs py-space-2xs rounded-full bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/30 font-mono-label text-[11px] text-primary transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {t.termino}
                      </button>
                    ))}
                  </div>
                  {terminoAbierto && (
                    <div className="p-space-sm rounded-lg bg-primary/10 border border-primary/30 text-on-surface font-body-sm text-body-sm flex items-start gap-space-xs">
                      <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">info</span>
                      <span>
                        <strong className="text-primary">{terminoAbierto}:</strong>{' '}
                        {(terminosDeLaJugada.find((t) => t.termino === terminoAbierto) ?? {}).definicion}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-space-xs pt-space-2xs">
                  <button
                    type="button"
                    onClick={narrarRepaso}
                    disabled={!vozDisponible}
                    className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-mono-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">volume_up</span>
                    Escuchar
                  </button>
                  <button
                    type="button"
                    onClick={narrarRepaso}
                    disabled={!vozDisponible}
                    className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-mono-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    Explicámelo de nuevo
                  </button>
                </div>
              </>
            )}
          </SeccionAcordeon>

          {/* 3. Aprendé cada pieza */}
          <SeccionAcordeon
            id="piezas"
            titulo="Aprendé cada pieza"
            icono="extension"
            abierta={seccionAbierta === 'piezas'}
            onToggle={() => alternarSeccion('piezas')}
            innerRef={(el) => { refsSeccion.current.piezas = el; }}
          >
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-space-xs">
              {PIEZAS.map((p) => (
                <button
                  key={p.tipo}
                  type="button"
                  onClick={() => elegirPieza(p.tipo)}
                  aria-pressed={piezaElegida === p.tipo}
                  className={`flex flex-col items-center gap-space-2xs p-space-xs rounded-xl border transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    piezaElegida === p.tipo
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container'
                  }`}
                >
                  <span className="relative">
                    <img src={rutaImagenPieza(p.letra)} alt="" className="w-8 h-8" draggable="false" />
                    {piezasVistas.includes(p.tipo) && (
                      <span className="material-symbols-outlined text-[13px] text-neon-lime absolute -top-1 -right-1 bg-surface-container-lowest rounded-full" aria-hidden="true">
                        check_circle
                      </span>
                    )}
                  </span>
                  <span className="font-mono-micro text-[10px] uppercase text-on-surface-variant">{p.nombre}</span>
                </button>
              ))}
            </div>

            {piezaActual && (
              <div className="grid sm:grid-cols-2 gap-space-sm pt-space-xs">
                <div className="flex flex-col gap-space-2xs">
                  <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">
                    Cómo se mueve {piezaActual.articulo} {piezaActual.nombre.toLowerCase()}
                  </span>
                  <MiniTableroPieza pieza={piezaActual} />
                </div>
                <div className="flex flex-col items-center justify-center gap-space-xs p-space-md rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant/40 text-center min-h-[160px]">
                  <span className="material-symbols-outlined text-[32px] text-outline">videocam_off</span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    [Video: cómo se mueve y captura {piezaActual.articulo} {piezaActual.nombre.toLowerCase()}]
                  </p>
                  <span className="font-mono-micro text-[10px] uppercase tracking-wider text-outline px-space-xs py-space-2xs rounded-full border border-outline-variant/30">
                    Próximamente
                  </span>
                </div>
              </div>
            )}
          </SeccionAcordeon>

          {/* 4. Resumen del tutor */}
          <SeccionAcordeon
            id="resumen"
            titulo="Resumen del tutor"
            icono="menu_book"
            abierta={seccionAbierta === 'resumen'}
            onToggle={() => alternarSeccion('resumen')}
            innerRef={(el) => { refsSeccion.current.resumen = el; }}
          >
            {cargandoHistorial && <CargandoInline texto="Buscando tu última partida…" />}
            {!cargandoHistorial && !ultimaPartidaId && !errorHistorial && (
              <p className="font-body-sm text-body-sm text-on-surface-variant py-space-xs">
                Jugá una partida para que Turing te arme un resumen con consejos.
              </p>
            )}
            {ultimaPartidaId && cargandoAnalisis && <CargandoInline texto="Armando tu resumen…" />}
            {ultimaPartidaId && !cargandoAnalisis && errorAnalisis && (
              <AvisoError mensaje={errorAnalisis.message || 'No se pudo armar el resumen de tu partida.'} />
            )}
            {analisis?.resumen && (
              <>
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">insights</span>
                  <span className="font-mono-metric text-mono-metric font-bold text-secondary">
                    {analisis.resumen.precision_global.toFixed(0)}% de precisión en tu última partida
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">lightbulb</span>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{analisis.resumen.consejo_tutor}</p>
                </div>
              </>
            )}
          </SeccionAcordeon>

          {/* 5. Tus logros */}
          <SeccionAcordeon
            id="logros"
            titulo="Tus logros"
            icono="emoji_events"
            abierta={seccionAbierta === 'logros'}
            onToggle={() => alternarSeccion('logros')}
            innerRef={(el) => { refsSeccion.current.logros = el; }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
              {insignias.map((insignia) => (
                <div
                  key={insignia.id}
                  className={`flex flex-col items-center gap-space-2xs p-space-sm rounded-xl border text-center ${
                    insignia.desbloqueada
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[26px]">{insignia.desbloqueada ? insignia.icono : 'lock'}</span>
                  <span className="font-body-sm text-body-sm font-medium">{insignia.titulo}</span>
                  <span className="font-mono-micro text-[10px] uppercase tracking-wider">
                    {insignia.desbloqueada ? 'Desbloqueada' : 'Todavía no'}
                  </span>
                </div>
              ))}
            </div>
          </SeccionAcordeon>

          {/* 6. Próximamente */}
          <SeccionAcordeon
            id="proximamente"
            titulo="Próximamente"
            icono="lock"
            abierta={seccionAbierta === 'proximamente'}
            onToggle={() => alternarSeccion('proximamente')}
            innerRef={(el) => { refsSeccion.current.proximamente = el; }}
          >
            <div className="opacity-60 flex flex-col gap-space-sm">
              <p className="font-body-sm text-body-sm text-on-surface-variant">Estas funciones todavía no están disponibles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                {BOTONES_PROXIMAMENTE.map((b) => (
                  <button
                    key={b.titulo}
                    type="button"
                    disabled
                    title="Próximamente"
                    className="flex items-center justify-center gap-space-xs px-space-sm py-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant cursor-not-allowed font-body-sm text-body-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">{b.icono}</span>
                    {b.titulo}
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                  </button>
                ))}
              </div>
            </div>
          </SeccionAcordeon>

          {partidasJugadas[0] && (
            <p className="font-mono-micro text-mono-micro text-outline px-space-xs">
              Última partida analizada: {fechaLegible(partidasJugadas[0].fecha)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
