import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analisisCompletoPartida, historialPartidasPropio } from '../../api/backend';
import { casillasIlustrativas, rutaImagenPieza } from '../../ajedrez';
import { fechaHoraLegible as fechaLegible } from '../../formatoTiempo';
import PiezaModelo3D from '../../componentes/PiezaModelo3D';
import FondoCapasScroll from '../../componentes/FondoCapasScroll';
import ChatTuring from './ChatTuring';
import EstadisticasPersonales from './EstadisticasPersonales';
import TuNivel from './TuNivel';
import CaminoAprendizaje from './CaminoAprendizaje';
import { PIEZAS } from '../../contenido/piezas';
import { esDelJugador } from '../../aprendizaje';

/*
 * `PIEZAS` (las 6 piezas con su apodo, regla especial y cómo se mueven) vive en
 * `src/contenido/piezas.js`: lo comparten este panel y el onboarding (HU12).
 */

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

/** Términos de una jugada puntual: el propio del principio + los generales, siempre 3 en total. */
function terminosDeJugada(jugada) {
  const principal = TERMINOS[jugada.principio_ajedrecistico] ?? TERMINOS.general;
  return [principal, ...TERMINOS_GENERALES];
}

/** Nombre legible en español de cada clave interna de `principio_ajedrecistico` (ver servicio_retroalimentacion.py). */
const NOMBRE_PRINCIPIO = {
  jaque_mate: 'Jaque mate',
  seguridad_del_rey: 'Seguridad del rey',
  pieza_indefensa: 'Pieza indefensa',
  oportunidad_tactica: 'Oportunidad táctica',
  control_del_centro: 'Control del centro',
  desarrollo_piezas: 'Desarrollo de piezas',
  iniciativa_tactica: 'Iniciativa táctica',
  maestria_tactica: 'Maestría táctica',
  posicion_solida: 'Posición sólida',
  imprecision_posicional: 'Imprecisión posicional',
  error_tactico: 'Error táctico',
  colgada_grave: 'Blunder (colgada grave)',
  general: 'Jugada general',
};

/**
 * "Peor" y "mejor" jugada de la partida para la sección "Repaso de tu partida"
 * (hasta 2 tarjetas, ver más abajo). Se rankea por severidad real de la
 * `calidad` que ya calculó el backend — no por orden de aparición — y en caso
 * de empate se prefiere la más reciente (más fácil de recordar para quien
 * recién jugó la partida).
 */
const RANGO_PEOR = { blunder: 3, error: 2, imprecision: 1 };
const RANGO_MEJOR = { brillante: 3, mejor: 2, excelente: 1 };

function jugadaMasNotable(jugadas, rangoPorCalidad) {
  let elegida = null;
  let mejorRango = 0;
  for (const jugada of jugadas) {
    const rango = rangoPorCalidad[jugada.calidad] ?? 0;
    if (rango > 0 && rango >= mejorRango) {
      mejorRango = rango;
      elegida = jugada;
    }
  }
  return elegida;
}

const SECCIONES = [
  { id: 'nivel', titulo: 'Tu nivel', icono: 'military_tech' },
  { id: 'camino', titulo: 'Tu camino', icono: 'route' },
  { id: 'repaso', titulo: 'Repaso de tu partida', icono: 'history_edu' },
  { id: 'estadisticas', titulo: 'Tus estadísticas', icono: 'monitoring' },
  { id: 'piezas', titulo: 'Aprendé cada pieza', icono: 'extension' },
  { id: 'resumen', titulo: 'Resumen del tutor', icono: 'menu_book' },
  { id: 'turing', titulo: 'Preguntale a Turing', icono: 'forum' },
  { id: 'logros', titulo: 'Tus logros', icono: 'emoji_events' },
  { id: 'proximamente', titulo: 'Próximamente', icono: 'lock' },
];

/** Secciones que muestran datos del análisis completo de la última partida. */
const SECCIONES_CON_ANALISIS = ['repaso', 'resumen', 'logros'];

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

function claveLecturaFacil(usuarioId) {
  return `panel_aprendizaje_lectura_facil_${usuarioId ?? 'anon'}`;
}

/** Preferencia de accesibilidad (texto más grande) — no un dato que dependa del backend. */
function cargarLecturaFacil(usuarioId) {
  try {
    return localStorage.getItem(claveLecturaFacil(usuarioId)) === '1';
  } catch {
    return false;
  }
}

function guardarLecturaFacil(usuarioId, activo) {
  try {
    localStorage.setItem(claveLecturaFacil(usuarioId), activo ? '1' : '0');
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no es crítico.
  }
}

function claveSidebarColapsado(usuarioId) {
  return `panel_aprendizaje_sidebar_colapsado_${usuarioId ?? 'anon'}`;
}

/** Preferencia de layout (sub-índice angosto, solo íconos) — no depende del backend. */
function cargarSidebarColapsado(usuarioId) {
  try {
    return localStorage.getItem(claveSidebarColapsado(usuarioId)) === '1';
  } catch {
    return false;
  }
}

function guardarSidebarColapsado(usuarioId, activo) {
  try {
    localStorage.setItem(claveSidebarColapsado(usuarioId), activo ? '1' : '0');
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no es crítico.
  }
}

/**
 * Limpia el texto de formato Markdown y símbolos para que la síntesis de voz
 * (Web Speech API) no pronuncie palabras como "asterisco", "almohadilla",
 * "comilla invertida", etc.
 */
export function limpiarTextoParaVoz(texto) {
  if (!texto) return '';

  return texto
    // 1. Quitar bloques de código completos
    .replace(/```[\s\S]*?```/g, '')
    // 2. Quitar encabezados (# Título -> Título)
    .replace(/^#{1,6}\s+/gm, '')
    // 3. Quitar negrita y cursiva (**palabra** o *palabra* -> palabra)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 4. Quitar enlaces markdown [texto](url) -> texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 5. Quitar viñetas de listas (- item o * item -> item)
    .replace(/^\s*[-*+]\s+/gm, '')
    // 6. Quitar enumeraciones de listas (1. item -> item)
    .replace(/^\s*\d+\.\s+/gm, '')
    // 7. Quitar citas (> cita -> cita)
    .replace(/^\s*>\s+/gm, '')
    // 8. Quitar código en línea (`código` -> código)
    .replace(/`([^`]+)`/g, '$1')
    // 9. Quitar cualquier asterisco, guión bajo o virgulilla remanente
    .replace(/[*_~`#|]/g, '')
    // 10. Normalizar pausas de puntuación y saltos de línea
    .replace(/([.!?;:])\s*\n+/g, '$1 ')
    .replace(/\n+/g, '. ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
      const textoLimpio = limpiarTextoParaVoz(texto);
      if (!textoLimpio) return;
      const utterance = new SpeechSynthesisUtterance(textoLimpio);
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
 * Una jugada destacada dentro de "Repaso de tu partida" — hasta 2 en la misma
 * sección (la peor y la mejor de la partida, ver `jugadaMasNotable`), cada una
 * con su propio glosario de términos tocables y su propio control de voz.
 * Maneja su propio `terminoAbierto` (no se comparte entre tarjetas) porque
 * puede haber dos tarjetas visibles a la vez.
 */
function TarjetaJugada({ jugada, claseTextoContenido, narrar, detener, narrando, vozDisponible }) {
  const [terminoAbierto, setTerminoAbierto] = useState(null);
  const estilo = ESTILO_CALIDAD[jugada.calidad] ?? ESTILO_CALIDAD.buena;
  const terminos = terminosDeJugada(jugada);

  function narrarEsta() {
    if (narrando) {
      detener();
      return;
    }
    narrar(textoNarrableDeJugada(jugada));
  }

  return (
    <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
      <div className="flex items-center gap-space-xs flex-wrap">
        <span
          className={`flex items-center gap-1 px-space-xs py-space-2xs rounded-lg font-mono-micro text-mono-micro uppercase tracking-wide ${estilo.texto} ${estilo.fondo}`}
        >
          <span className="material-symbols-outlined text-[14px]">{estilo.icono}</span>
          {estilo.etiqueta}
        </span>
        <span className="font-mono-label text-mono-label text-on-surface-variant">
          Jugada {jugada.numero_ply} · {jugada.jugada_san}
        </span>
      </div>

      {/* Principio ajedrecístico como título, la explicación completa como desarrollo debajo — separados visualmente. */}
      <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-space-2xs">
        <span className="font-mono-micro text-mono-micro text-primary uppercase tracking-wider font-semibold">
          {NOMBRE_PRINCIPIO[jugada.principio_ajedrecistico] ?? NOMBRE_PRINCIPIO.general}
        </span>
        <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>{jugada.explicacion}</p>
      </div>

      <div className="flex flex-col gap-space-2xs">
        <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">
          Términos de esta jugada (tocá para ver qué significan)
        </span>
        <div className="flex flex-wrap gap-space-2xs">
          {terminos.map((t) => (
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
              {(terminos.find((t) => t.termino === terminoAbierto) ?? {}).definicion}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-space-xs pt-space-2xs">
        <button
          type="button"
          onClick={narrarEsta}
          disabled={!vozDisponible}
          className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-mono-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[16px]">{narrando ? 'stop_circle' : 'volume_up'}</span>
          {narrando ? 'Detener' : 'Escuchar'}
        </button>
        <button
          type="button"
          onClick={narrarEsta}
          disabled={!vozDisponible}
          className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-mono-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[16px]">replay</span>
          Explicámelo de nuevo
        </button>
      </div>
    </div>
  );
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
      className="grid grid-cols-8 grid-rows-8 w-full aspect-square rounded-lg overflow-hidden ring-1 ring-primary/25 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]"
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
            className={`relative flex items-center justify-center ${esClara ? 'bg-surface-container-highest' : 'bg-surface-container-lowest'} ${
              esCentro ? 'bg-primary/15' : ''
            }`}
          >
            {esCentro && <img src={rutaImagenPieza(pieza.letra)} alt="" className="w-6 h-6 drop-shadow" draggable="false" />}
            {esDestino && (
              <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.9)]" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Banner tipo "cartilla" — una pieza a la vez, con apodo + regla especial
 * (mismo contenido de `PIEZAS`, ver arriba), rotando sola cada 5s. Inspirado
 * en la tabla de piezas de la app móvil (`pieces_screen.dart`) y en la
 * estética "consola" del resto de la app (Razonamiento Neuronal / Sala de
 * Control): contador + barra de progreso segmentada arriba, la pieza en 3D
 * real (mismo set OBJ que usa el simulador PyBullet, ver `PiezaModelo3D.jsx`)
 * flotando sobre un recuadro con grilla punteada, y una grilla de selección
 * rápida abajo para saltar directo a cualquier pieza. Pausa al pasar el
 * mouse o tocar, y respeta `prefers-reduced-motion` desactivando el
 * auto-avance (las flechas manuales siguen funcionando igual).
 */
function BannerPiezas({ piezas, claseTextoContenido, onCambiarPieza }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const cajaRef = useRef(null);
  const prefiereMovimientoReducido = useMemo(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    []
  );

  useEffect(() => {
    if (pausado || prefiereMovimientoReducido) return;
    const temporizador = setTimeout(() => {
      setIndice((actual) => (actual + 1) % piezas.length);
    }, 5000);
    return () => clearTimeout(temporizador);
  }, [indice, pausado, prefiereMovimientoReducido, piezas.length]);

  const pieza = piezas[indice];
  const totalPiezas = piezas.length;

  // Avisa al padre qué pieza quedó activa (arranque, auto-avance o flechas) —
  // así la ficha de detalle de abajo (mini-tablero + "dato clave") y el
  // registro de piezas vistas siguen al banner solos, sin necesitar una
  // grilla aparte para elegir a mano.
  useEffect(() => {
    onCambiarPieza?.(pieza.tipo);
  }, [pieza.tipo, onCambiarPieza]);

  // Giro tipo "moneda" al cambiar de pieza — se dispara de nuevo en cada
  // cambio de `indice` sacando y reponiendo la clase (con un reflow forzado
  // en el medio), sin desmontar `PiezaModelo3D` — si lo desmontáramos acá
  // (ej. con un `key`), se perdería el canvas de WebGL ya armado y tocaría
  // recargar el modelo de nuevo en cada pieza.
  useEffect(() => {
    const el = cajaRef.current;
    if (!el || prefiereMovimientoReducido) return;
    el.classList.remove('moneda-flip');
    void el.offsetWidth;
    el.classList.add('moneda-flip');
  }, [indice, prefiereMovimientoReducido]);

  function anterior() {
    setIndice((actual) => (actual - 1 + piezas.length) % piezas.length);
  }

  function siguiente() {
    setIndice((actual) => (actual + 1) % piezas.length);
  }

  return (
    <div
      role="region"
      aria-label="Presentación rotativa de las 6 piezas de ajedrez"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      onTouchCancel={() => setPausado(false)}
      className="relative flex flex-col gap-space-md rounded-xl bg-surface-container border border-outline-variant/20 overflow-hidden"
    >
      {/* Manchas de luz a la deriva — le dan vida al fondo sin competir con
          el contenido (bien difuminadas, van detrás de todo). */}
      <div
        aria-hidden="true"
        className="absolute -top-16 -left-12 w-64 h-64 rounded-full bg-primary-container/25 blur-3xl pointer-events-none fondo-banner-blob-1"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-secondary-container/30 blur-3xl pointer-events-none fondo-banner-blob-2"
      />

      {/* Barra superior — navegación, contador y progreso del recorrido (posición
          en el carrusel, no "dominio": no medimos eso todavía). */}
      <div className="relative z-10 flex items-center justify-between gap-space-sm px-space-md sm:px-space-lg pt-space-md flex-wrap">
        <div className="flex items-center gap-space-xs">
          <div className="flex items-center gap-1 bg-surface-container-high/60 p-1 rounded-lg">
            <button
              type="button"
              onClick={anterior}
              title="Pieza anterior"
              className="w-7 h-7 rounded flex items-center justify-center text-on-surface hover:bg-surface-bright transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={siguiente}
              title="Pieza siguiente"
              className="w-7 h-7 rounded flex items-center justify-center text-on-surface hover:bg-surface-bright transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <span className="font-mono-metric text-mono-metric text-primary font-medium whitespace-nowrap">
            PIEZA {String(indice + 1).padStart(2, '0')} DE {String(totalPiezas).padStart(2, '0')}
          </span>
          <span className="text-outline-variant font-mono-label text-mono-label hidden sm:inline">/</span>
          <span className="hidden sm:inline font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wide">
            {pieza.apodo}
          </span>
        </div>

        <div className="flex items-center gap-space-xs">
          <div
            className="grid gap-1 h-1.5 w-32 sm:w-36"
            style={{ gridTemplateColumns: `repeat(${totalPiezas}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {piezas.map((p, i) => (
              <div
                key={p.tipo}
                className={`h-full rounded-full transition-all ${
                  i <= indice ? 'bg-primary shadow-[0_0_6px_rgba(0,229,255,0.7)]' : 'bg-surface-container-highest'
                }`}
              />
            ))}
          </div>
          <span className="font-mono-micro text-mono-micro text-primary-fixed-dim whitespace-nowrap">
            {indice + 1}/{totalPiezas}
          </span>
        </div>
      </div>

      {/* Tarjeta central — pieza en 3D real sobre un recuadro con grilla
          punteada y brillo ambiente (nada de círculo/marco que la recorte). */}
      <div className="relative z-10 flex flex-col items-center text-center gap-space-sm px-space-lg py-space-md">
        {/* `perspective` va en este contenedor (no en la caja que gira) — es
            así como CSS 3D funciona: el `perspective` de un elemento afecta
            cómo se ven los `transform` de sus HIJOS, no el propio. */}
        <div className="shrink-0" style={{ perspective: '800px' }}>
          <div
            ref={cajaRef}
            className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-gradient-to-t from-primary/10 to-transparent flex items-center justify-center overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-15"
              style={{ backgroundImage: 'radial-gradient(rgba(0,229,255,0.5) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-[-15%] rounded-full bg-gradient-to-br from-primary/25 via-secondary/15 to-transparent blur-2xl"
            />
            <PiezaModelo3D tipo={pieza.tipo} pausado={pausado} className="relative w-full h-full" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-space-2xs max-w-md">
          <span className="font-headline-md text-headline-md text-on-surface">
            {pieza.nombre} — {pieza.apodo}
          </span>
          <p className={`${claseTextoContenido} text-on-surface-variant leading-relaxed`}>{pieza.reglaEspecial}</p>
        </div>
      </div>

      {/* Selección rápida — salta directo a cualquier pieza, con las mismas
          imágenes ilustrativas que ya usa el resto de la pantalla. */}
      <div className="relative z-10 flex flex-col gap-space-xs px-space-md sm:px-space-lg pb-space-md">
        <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">
          Selección rápida de pieza
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-space-2xs">
          {piezas.map((p, i) => {
            const activa = i === indice;
            return (
              <button
                key={p.tipo}
                type="button"
                onClick={() => setIndice(i)}
                aria-current={activa || undefined}
                title={p.nombre}
                className={`flex flex-col items-center gap-space-2xs py-space-xs rounded-lg transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  activa ? 'bg-surface-container-high shadow-[0_0_16px_rgba(0,229,255,0.2)]' : 'bg-surface-container hover:bg-surface-container-high'
                }`}
              >
                <img src={rutaImagenPieza(p.letra)} alt="" draggable="false" className="w-7 h-7 object-contain" />
                <span className={`font-body-sm text-[12px] leading-tight font-medium ${activa ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {p.nombre}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// `fechaLegible` = `fechaHoraLegible` (formatoTiempo.js), importada arriba — interpreta como UTC un
// ISO del backend sin sufijo de zona (si no, la hora se ve adelantada según el huso del navegador;
// este es justo el caso reportado: "Última partida analizada" mostraba una hora ~4h adelantada).

/**
 * Panel de Aprendizaje — tutor "Turing" para el rol `jugador`. A diferencia
 * de la vista técnica "Aprendizaje" (jugada por jugada, para quien ya sabe
 * leer una evaluación en centipawns), esta pantalla está pensada para
 * alguien que recién está aprendiendo: oraciones cortas, narración por voz,
 * y todo detrás de un acordeón para no abrumar con todo junto.
 */
export default function PanelAprendizaje({
  usuario,
  seccionInicial = null,
  onSeccionConsumida = null,
  alIrASalaControl = null,
  alVerTutorial = null,
}) {
  const [seccionAbierta, setSeccionAbierta] = useState(() => seccionInicial || 'nivel');
  const refsSeccion = useRef({});
  const [sidebarColapsado, setSidebarColapsado] = useState(() => cargarSidebarColapsado(usuario?.id));

  useEffect(() => {
    if (seccionInicial) {
      setSeccionAbierta(seccionInicial);
      const timer = setTimeout(() => {
        refsSeccion.current[seccionInicial]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      onSeccionConsumida?.();
      return () => clearTimeout(timer);
    }
  }, [seccionInicial, onSeccionConsumida]);

  function alternarSidebar() {
    setSidebarColapsado((actual) => {
      const nuevo = !actual;
      guardarSidebarColapsado(usuario?.id, nuevo);
      return nuevo;
    });
  }

  // Pantalla completa para el recuadro de video de "Aprendé cada pieza" —
  // Fullscreen API nativa del navegador, sin librería nueva. Colapsar el
  // sub-índice ya le da más ancho a este recuadro (efecto "modo cine"); esto
  // suma la opción de taparlo todo, útil incluso en el placeholder de hoy y
  // listo para cuando el video real del facilitador esté conectado acá.
  const videoBoxRef = useRef(null);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);

  useEffect(() => {
    function alCambiar() {
      setEnPantallaCompleta(Boolean(document.fullscreenElement) && document.fullscreenElement === videoBoxRef.current);
    }
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  function alternarPantallaCompletaVideo() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoBoxRef.current?.requestFullscreen?.();
    }
  }

  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const [analisis, setAnalisis] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState(null);

  const [piezaElegida, setPiezaElegida] = useState(null);
  const [piezasVistas, setPiezasVistas] = useState(() => cargarPiezasVistas(usuario?.id));
  // "Lectura Fácil" — preferencia de accesibilidad (agranda el texto de las
  // explicaciones), persistida por usuario igual que `piezasVistas`. No es un
  // dato del backend, así que vive enteramente en localStorage.
  const [lecturaFacil, setLecturaFacilState] = useState(() => cargarLecturaFacil(usuario?.id));

  const { narrar, detener, narrando, disponible: vozDisponible } = useNarracion();

  const rango = usuario?.rango_estimado || 'Intermedio';
  // El camino de capítulos es para quien está aprendiendo las bases: principiantes
  // y quienes todavía no se midieron. Intermedio y avanzado ven su análisis de partida.
  const muestraCamino = !usuario?.rango_estimado || usuario.rango_estimado === 'Principiante';
  const seccionesVisibles = muestraCamino ? SECCIONES : SECCIONES.filter((s) => s.id !== 'camino');
  const nombreCorto = usuario?.nombre?.trim().split(/\s+/)[0] || 'jugador';
  // Escalón de tamaño de fuente para el contenido de texto de las secciones
  // (repaso, resumen, descripciones de piezas) — no toca badges ni etiquetas
  // mono chicas, que son UI, no contenido a leer.
  const claseTextoContenido = lecturaFacil ? 'font-body-lg text-headline-sm' : 'font-body-sm text-body-sm';

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

  // El análisis con Stockfish es lo más pesado del panel y solo lo usan "Repaso", "Resumen" y
  // "Logros" (la insignia del repaso): se pide recién cuando se abre una de esas secciones, no al
  // entrar, para no frenar al resto (por ejemplo "Tu camino"). Una vez pedido para una partida y un
  // rango, no se repite aunque se cierre y se vuelva a abrir.
  const necesitaAnalisis = SECCIONES_CON_ANALISIS.includes(seccionAbierta);
  const analisisPedidoRef = useRef(null);
  useEffect(() => {
    if (!ultimaPartidaId || !necesitaAnalisis) return;
    const clave = `${ultimaPartidaId}|${rango}`;
    if (analisisPedidoRef.current === clave) return;
    analisisPedidoRef.current = clave;
    setCargandoAnalisis(true);
    setErrorAnalisis(null);
    analisisCompletoPartida(ultimaPartidaId, rango)
      .then(setAnalisis)
      .catch((err) => setErrorAnalisis(err))
      .finally(() => setCargandoAnalisis(false));
  }, [ultimaPartidaId, rango, necesitaAnalisis]);
  // Entre abrir la sección y que arranque el pedido no hay un cuadro "vacío": ya figura como cargando.
  const analizando = cargandoAnalisis || (necesitaAnalisis && Boolean(ultimaPartidaId) && !analisis && !errorAnalisis);

  // Hasta 2 jugadas destacadas para repasar: la peor (si hubo alguna con margen
  // de mejora real) y la mejor (si hubo alguna sobresaliente). Si la partida fue
  // pareja y ninguna de las dos existe, se cae al criterio viejo (última jugada)
  // para no dejar la sección vacía — pero nunca se fabrica una segunda tarjeta.
  const tarjetasRepaso = useMemo(() => {
    // Solo las jugadas del estudiante: el repaso es sobre lo que él hizo y lo que debía hacer.
    // Las de Turing o Stockfish no se le explican como propias.
    const jugadas = (analisis?.jugadas ?? []).filter(esDelJugador);
    if (jugadas.length === 0) return [];
    const peor = jugadaMasNotable(jugadas, RANGO_PEOR);
    const mejor = jugadaMasNotable(jugadas, RANGO_MEJOR);
    if (peor && mejor) return [peor, mejor];
    if (peor || mejor) return [peor ?? mejor];
    return [jugadas[jugadas.length - 1]];
  }, [analisis]);

  // Texto que lee el botón de voz del encabezado — las explicaciones de las
  // tarjetas de repaso, una tras otra (cada tarjeta también puede narrarse sola).
  const textoRepaso = tarjetasRepaso.map((j) => textoNarrableDeJugada(j)).join(' ');

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

  function alternarLecturaFacil() {
    setLecturaFacilState((actual) => {
      const nuevo = !actual;
      guardarLecturaFacil(usuario?.id, nuevo);
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
  // La insignia de las 6 piezas sigue el mismo criterio que el camino: solo para principiantes.
  const insigniasVisibles = muestraCamino ? insignias : insignias.filter((i) => i.id !== 'seis-piezas');

  return (
    <div className="relative w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <FondoCapasScroll />

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
        <div className="flex items-center gap-space-xs shrink-0">
          <button
            type="button"
            onClick={alternarLecturaFacil}
            aria-pressed={lecturaFacil}
            title="Agrandar el texto de las explicaciones para que sea más fácil de leer"
            className={`flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-xl font-body-sm text-body-sm font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              lecturaFacil
                ? 'bg-primary/15 border-primary text-primary'
                : 'bg-surface-container-high hover:bg-surface-bright border-outline-variant/40 text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">format_size</span>
            Lectura Fácil
          </button>
          <button
            type="button"
            onClick={narrarRepaso}
            disabled={!vozDisponible || (!textoRepaso && !narrando)}
            title={!vozDisponible ? 'Tu navegador no permite leer en voz alta' : 'Escuchar el repaso de tu última jugada'}
            className="flex items-center justify-center gap-space-xs px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]">{narrando ? 'stop_circle' : 'volume_up'}</span>
            {narrando ? 'Detener' : 'Escuchar saludo de Turing'}
          </button>
        </div>
      </div>

      {!vozDisponible && (
        <p className="font-mono-micro text-mono-micro text-outline px-space-xs">
          La narración por voz no está disponible en este navegador — el resto del panel funciona igual.
        </p>
      )}

      {/* Layout de dos columnas: sub-índice fijo + contenido en acordeón.
          El sub-índice se puede colapsar a solo íconos (botón "Colapsar/
          Expandir menú") para agrandar el panel de contenido — útil sobre
          todo en "Aprendé cada pieza", donde el tablero y el video ganan
          ancho real cuando el sub-índice no ocupa 3 columnas de texto. */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start`}>
        <nav
          className={`${sidebarColapsado ? 'lg:col-span-1' : 'lg:col-span-3'} lg:sticky lg:top-20 flex lg:flex-col gap-space-2xs overflow-x-auto lg:overflow-visible bg-surface-container-low/60 rounded-xl p-space-xs transition-[grid-column] motion-reduce:transition-none`}
          aria-label="Secciones del panel de aprendizaje"
        >
          {/* Mismo estilo que el botón que abre/cierra el menú principal
              (ver App.tsx: ícono `menu_open`/`menu`, plano, sin caja). */}
          <button
            type="button"
            onClick={alternarSidebar}
            aria-expanded={!sidebarColapsado}
            title={sidebarColapsado ? 'Expandir menú' : 'Colapsar menú'}
            className="shrink-0 flex items-center gap-space-xs px-space-sm py-space-xs text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary mb-space-2xs lg:mb-0 lg:self-end"
          >
            <span className="material-symbols-outlined text-[20px]">{sidebarColapsado ? 'menu' : 'menu_open'}</span>
            {!sidebarColapsado && <span className="lg:hidden font-body-sm text-body-sm">Colapsar</span>}
          </button>

          {seccionesVisibles.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => manejarClickSeccionSidebar(s.id)}
              aria-current={seccionAbierta === s.id ? 'true' : undefined}
              title={sidebarColapsado ? s.titulo : undefined}
              className={`shrink-0 flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg font-body-sm text-body-sm text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                sidebarColapsado ? 'lg:justify-center' : ''
              } ${
                seccionAbierta === s.id
                  ? 'bg-surface-container-high text-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{s.icono}</span>
              <span className={sidebarColapsado ? 'lg:hidden' : ''}>{s.titulo}</span>
            </button>
          ))}
        </nav>

        <div className={`${sidebarColapsado ? 'lg:col-span-11' : 'lg:col-span-9'} flex flex-col gap-space-md transition-[grid-column] motion-reduce:transition-none`}>
          {/* 1. Tu nivel */}
          <SeccionAcordeon
            id="nivel"
            titulo="Tu nivel"
            icono="military_tech"
            abierta={seccionAbierta === 'nivel'}
            onToggle={() => alternarSeccion('nivel')}
            innerRef={(el) => { refsSeccion.current.nivel = el; }}
          >
            <TuNivel usuario={usuario} alIrASalaControl={alIrASalaControl} claseTextoContenido={claseTextoContenido} />
          </SeccionAcordeon>

          {/* 1b. Tu camino (solo principiantes y sin medir) */}
          {muestraCamino && (
            <SeccionAcordeon
              id="camino"
              titulo="Tu camino"
              icono="route"
              abierta={seccionAbierta === 'camino'}
              onToggle={() => alternarSeccion('camino')}
              innerRef={(el) => { refsSeccion.current.camino = el; }}
            >
              <CaminoAprendizaje
                usuarioId={usuario?.id}
                rango={usuario?.rango_estimado ?? null}
                piezasVistas={piezasVistas}
                alIrASeccion={manejarClickSeccionSidebar}
                alIrASalaControl={alIrASalaControl}
                claseTextoContenido={claseTextoContenido}
              />
            </SeccionAcordeon>
          )}

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

            {ultimaPartidaId && analizando && <CargandoInline texto="Turing está repasando tu partida…" />}

            {ultimaPartidaId && !analizando && errorAnalisis && (
              <AvisoError mensaje={errorAnalisis.message || 'No se pudo analizar tu última partida.'} />
            )}

            {ultimaPartidaId && !analizando && !errorAnalisis && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-surface-container-high/60 border border-outline-variant/30 font-mono-micro text-mono-micro">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      {partidasJugadas[0]?.tipo_oponente === 'modelo' ? 'psychology' : 'smart_toy'}
                    </span>
                    {partidasJugadas[0]?.tipo_oponente === 'modelo' ? 'Turing IA' : 'Stockfish'}
                  </span>
                  <span className="text-outline">·</span>
                  <span className="text-on-surface">Nivel {partidasJugadas[0]?.nivel ?? '—'}</span>
                  <span className="text-outline">·</span>
                  <span className="text-on-surface">{partidasJugadas[0]?.cantidad_jugadas ?? 0} jugadas</span>
                </div>
                <span className="text-on-surface-variant">
                  {fechaLegible(partidasJugadas[0]?.fecha)}
                </span>
              </div>
            )}

            {ultimaPartidaId && !analizando && !errorAnalisis && tarjetasRepaso.length > 0 && (
              <div className="flex flex-col gap-space-sm">
                {tarjetasRepaso.map((jugada) => (
                  <TarjetaJugada
                    key={jugada.numero_ply}
                    jugada={jugada}
                    claseTextoContenido={claseTextoContenido}
                    narrar={narrar}
                    detener={detener}
                    narrando={narrando}
                    vozDisponible={vozDisponible}
                  />
                ))}
              </div>
            )}
          </SeccionAcordeon>

          {/* 3. Aprendé cada pieza */}
          {/* Tus estadísticas (HU14) */}
          <SeccionAcordeon
            id="estadisticas"
            titulo="Tus estadísticas"
            icono="monitoring"
            abierta={seccionAbierta === 'estadisticas'}
            onToggle={() => alternarSeccion('estadisticas')}
            innerRef={(el) => { refsSeccion.current.estadisticas = el; }}
          >
            <EstadisticasPersonales />
          </SeccionAcordeon>

          <SeccionAcordeon
            id="piezas"
            titulo="Aprendé cada pieza"
            icono="extension"
            abierta={seccionAbierta === 'piezas'}
            onToggle={() => alternarSeccion('piezas')}
            innerRef={(el) => { refsSeccion.current.piezas = el; }}
          >
            {/* Sin grilla manual aparte — el banner se mueve solo (auto-avance
                o flechas) y avisa qué pieza quedó activa vía `onCambiarPieza`,
                así la ficha de detalle de abajo y el registro de "vistas"
                (logro "Conocé las 6 piezas") lo siguen automáticamente. */}
            <BannerPiezas piezas={PIEZAS} claseTextoContenido={claseTextoContenido} onCambiarPieza={elegirPieza} />

            {alVerTutorial && (
              <button
                type="button"
                onClick={alVerTutorial}
                className="self-start flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-high text-on-surface font-body-sm text-body-sm hover:bg-surface-bright transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[18px]">school</span>
                Ver el tutorial de nuevo
              </button>
            )}

            {piezaActual && (
              <div className="flex flex-col gap-space-sm pt-space-xs">
                <p className={`${claseTextoContenido} text-primary font-semibold italic`}>"{piezaActual.apodo}"</p>

                <div className="grid sm:grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-mono-micro text-mono-micro text-outline uppercase tracking-wider">
                      Cómo se mueve {piezaActual.articulo} {piezaActual.nombre.toLowerCase()}
                    </span>
                    <MiniTableroPieza pieza={piezaActual} />
                  </div>
                  <div
                    ref={videoBoxRef}
                    className="relative flex flex-col items-center justify-center gap-space-xs p-space-md rounded-xl bg-surface-container overflow-hidden border border-dashed border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-center min-h-[160px] [&:fullscreen]:rounded-none [&:fullscreen]:min-h-screen [&:fullscreen]:justify-center [&:fullscreen]:bg-surface"
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10"
                    />
                    <button
                      type="button"
                      onClick={alternarPantallaCompletaVideo}
                      title={enPantallaCompleta ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                      className="absolute top-space-xs right-space-xs z-10 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container-lowest/70 hover:bg-surface-container-lowest text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {enPantallaCompleta ? 'fullscreen_exit' : 'fullscreen'}
                      </span>
                    </button>
                    <span className="relative material-symbols-outlined text-[32px] text-primary-fixed-dim">videocam_off</span>
                    <p className="relative font-body-sm text-body-sm text-on-surface-variant">
                      [Video: cómo se mueve y captura {piezaActual.articulo} {piezaActual.nombre.toLowerCase()}]
                    </p>
                    <span className="relative font-mono-micro text-[10px] uppercase tracking-wider text-outline px-space-xs py-space-2xs rounded-full border border-outline-variant/30">
                      Próximamente
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-space-xs p-space-sm rounded-lg bg-secondary-container/10 border border-secondary/20">
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">bolt</span>
                  <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>
                    <strong className="text-secondary">Dato clave:</strong> {piezaActual.reglaEspecial}
                  </p>
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
            {ultimaPartidaId && analizando && <CargandoInline texto="Armando tu resumen…" />}
            {ultimaPartidaId && !analizando && errorAnalisis && (
              <AvisoError mensaje={errorAnalisis.message || 'No se pudo armar el resumen de tu partida.'} />
            )}
            {analisis?.resumen && (
              <>
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[22px]">insights</span>
                  <span className="font-mono-metric text-mono-metric font-bold text-secondary">
                    {(analisis.resumen.precision_jugador ?? analisis.resumen.precision_global).toFixed(0)}% de precisión en tus jugadas de la última partida
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-space-2xs">
                  <span className="font-mono-micro text-mono-micro text-primary uppercase tracking-wider font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                    Consejo de Turing
                  </span>
                  <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>{analisis.resumen.consejo_tutor}</p>
                </div>
              </>
            )}
          </SeccionAcordeon>

          {/* 5. Preguntale a Turing */}
          <SeccionAcordeon
            id="turing"
            titulo="Preguntale a Turing"
            icono="forum"
            abierta={seccionAbierta === 'turing'}
            onToggle={() => alternarSeccion('turing')}
            innerRef={(el) => { refsSeccion.current.turing = el; }}
          >
            <ChatTuring
              usuario={usuario}
              narrar={narrar}
              detener={detener}
              narrando={narrando}
              vozDisponible={vozDisponible}
            />
          </SeccionAcordeon>

          {/* 6. Tus logros */}
          <SeccionAcordeon
            id="logros"
            titulo="Tus logros"
            icono="emoji_events"
            abierta={seccionAbierta === 'logros'}
            onToggle={() => alternarSeccion('logros')}
            innerRef={(el) => { refsSeccion.current.logros = el; }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
              {insigniasVisibles.map((insignia) => (
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

          {/* 7. Próximamente */}
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
