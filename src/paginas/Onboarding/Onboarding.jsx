import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { casillasIlustrativas, rutaImagenPieza } from '../../ajedrez';
import { PIEZAS } from '../../contenido/piezas';

/**
 * Onboarding educativo (HU12): tarjetas que enseñan las reglas básicas antes de
 * jugar. Se muestra una sola vez por usuario en este navegador; "Saltar" y el
 * final también lo marcan como visto, para no volver a mostrarlo.
 */

const TAMANO_TABLERO = 8;
const CASILLA_CENTRAL = [3, 3];

function claveCompletado(usuarioId) {
  return `onboarding_completado_${usuarioId ?? 'anon'}`;
}

/** `true` si este usuario ya vio (o saltó) el onboarding en este navegador. */
export function onboardingCompletado(usuarioId) {
  try {
    return localStorage.getItem(claveCompletado(usuarioId)) === '1';
  } catch {
    return false;
  }
}

function marcarOnboardingCompletado(usuarioId) {
  try {
    localStorage.setItem(claveCompletado(usuarioId), '1');
  } catch {
    // Modo privado o cuota llena: el tutorial puede volver a aparecer, no es crítico.
  }
}

const TARJETAS = [
  {
    id: 'inicio',
    tipo: 'concepto',
    titulo: 'Bienvenido al tablero',
    texto:
      'El tablero tiene 8 filas y 8 columnas: 64 casillas. Juegan primero las blancas. El objetivo es dar jaque mate: atacar al rey rival sin que pueda escapar.',
  },
  ...PIEZAS.map((pieza) => ({ id: pieza.tipo, tipo: 'pieza', pieza })),
  {
    id: 'jaque',
    tipo: 'concepto',
    titulo: 'Jaque y jaque mate',
    texto:
      'Jaque es cuando una pieza ataca al rey: hay que salir del ataque en la jugada siguiente. Jaque mate es cuando el rey está atacado y no tiene ninguna jugada para escapar. Ahí termina la partida.',
  },
  { id: 'puzzle', tipo: 'puzzle', titulo: 'Tu primera prueba' },
];

/** Casillas del tablero de la tarjeta: (fila, columna) de 0 a 7, fila 0 = octava fila. */
function casillasDelTablero() {
  const casillas = [];
  for (let f = 0; f < TAMANO_TABLERO; f++) {
    for (let c = 0; c < TAMANO_TABLERO; c++) casillas.push([f, c]);
  }
  return casillas;
}

const mismaCasilla = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Tablero chico con una pieza en el centro. Las casillas que puede alcanzar se marcan; hay que tocar una. */
function MiniTableroPieza({ pieza, reducir }) {
  const [resultado, setResultado] = useState(null); // 'bien' | 'mal' | null
  const marcadas = casillasIlustrativas(pieza.tipo, CASILLA_CENTRAL[0], CASILLA_CENTRAL[1]);
  const esMarcada = (casilla) => marcadas.some((m) => mismaCasilla(m, casilla));

  function tocar(casilla) {
    if (mismaCasilla(casilla, CASILLA_CENTRAL)) return;
    setResultado(esMarcada(casilla) ? 'bien' : 'mal');
  }

  const mensaje =
    resultado === 'bien'
      ? `¡Bien! Así se mueve ${pieza.articulo} ${pieza.nombre.toLowerCase()}.`
      : resultado === 'mal'
        ? 'Esa casilla no está en su camino. Probá con una marcada en celeste.'
        : 'Tocá una casilla marcada en celeste para ver el camino de la pieza.';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-8 w-full max-w-[17rem] aspect-square rounded-lg overflow-hidden border border-outline-variant/40">
        {casillasDelTablero().map(([f, c]) => {
          const oscura = (f + c) % 2 === 1;
          const marcada = esMarcada([f, c]);
          const esCentro = mismaCasilla([f, c], CASILLA_CENTRAL);
          return (
            <button
              key={`${f}-${c}`}
              type="button"
              onClick={() => tocar([f, c])}
              aria-label={`Casilla fila ${8 - f}, columna ${'abcdefgh'[c]}${marcada ? ', marcada' : ''}`}
              className={`relative flex items-center justify-center ${oscura ? 'bg-[#8b5e3c]' : 'bg-[#e8d5b0]'} ${
                marcada ? 'ring-2 ring-inset ring-primary-container' : ''
              }`}
            >
              {marcada && (
                <span
                  aria-hidden="true"
                  className="absolute w-2 h-2 rounded-full bg-primary-container/90"
                />
              )}
              {esCentro && (
                <img
                  src={rutaImagenPieza(pieza.letra)}
                  alt=""
                  className={`w-[80%] h-[80%] ${reducir ? '' : 'drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]'}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className={`font-body-sm text-body-sm text-center min-h-[2.5rem] ${
          resultado === 'bien' ? 'text-primary' : resultado === 'mal' ? 'text-tertiary-container' : 'text-on-surface-variant'
        }`}
      >
        {mensaje}
      </p>
    </div>
  );
}

/** Puzzle de una jugada: la torre blanca tiene que dar jaque al rey negro. */
function PuzzleJaque({ onResuelto }) {
  const [torre] = useState([7, 0]); // a1
  const reyNegro = [0, 4]; // e8
  const [seleccionada, setSeleccionada] = useState(false);
  const [mensaje, setMensaje] = useState('Tocá la torre blanca y después la casilla a la que la movés para dar jaque.');
  const [resuelto, setResuelto] = useState(false);

  // Movimientos legales de la torre en este tablero: por su fila (1) y su columna (a).
  const destinos = [
    ...Array.from({ length: 7 }, (_, i) => [7, i + 1]),
    ...Array.from({ length: 7 }, (_, i) => [i, 0]),
  ];
  // Da jaque si queda en la fila del rey (octava) o en su columna (e): el camino está libre.
  const daJaque = ([f, c]) => f === reyNegro[0] || c === reyNegro[1];
  const esDestino = (casilla) => destinos.some((d) => mismaCasilla(d, casilla));

  function tocar(casilla) {
    if (resuelto) return;
    if (!seleccionada) {
      if (mismaCasilla(casilla, torre)) {
        setSeleccionada(true);
        setMensaje('Ahora tocá una casilla marcada en celeste.');
      } else {
        setMensaje('Primero tocá la torre blanca (la de la esquina a1).');
      }
      return;
    }
    if (mismaCasilla(casilla, torre)) {
      setSeleccionada(false);
      setMensaje('Tocá la torre blanca y después la casilla a la que la movés para dar jaque.');
      return;
    }
    if (!esDestino(casilla)) {
      setMensaje('La torre no llega ahí en una jugada. Probá con una casilla marcada en celeste.');
      return;
    }
    if (daJaque(casilla)) {
      setResuelto(true);
      setSeleccionada(false);
      setMensaje('¡Jaque! Muy bien: la torre llegó a la misma línea que el rey y lo ataca.');
      onResuelto();
    } else {
      setMensaje('Esa jugada no da jaque: la torre se mueve, pero el rey negro no queda atacado. Probá otra.');
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid grid-cols-8 w-full max-w-[17rem] aspect-square rounded-lg overflow-hidden border border-outline-variant/40">
        {casillasDelTablero().map(([f, c]) => {
          const oscura = (f + c) % 2 === 1;
          const marcada = seleccionada && esDestino([f, c]);
          const esTorre = mismaCasilla([f, c], torre);
          const esRey = mismaCasilla([f, c], reyNegro);
          return (
            <button
              key={`${f}-${c}`}
              type="button"
              onClick={() => tocar([f, c])}
              aria-label={`Casilla fila ${8 - f}, columna ${'abcdefgh'[c]}`}
              className={`relative flex items-center justify-center ${oscura ? 'bg-[#8b5e3c]' : 'bg-[#e8d5b0]'} ${
                marcada ? 'ring-2 ring-inset ring-primary-container' : ''
              }`}
            >
              {marcada && (
                <span aria-hidden="true" className="absolute w-2 h-2 rounded-full bg-primary-container/90" />
              )}
              {esTorre && <img src={rutaImagenPieza('R')} alt="" className="w-[80%] h-[80%]" />}
              {esRey && <img src={rutaImagenPieza('k')} alt="" className="w-[80%] h-[80%]" />}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={`font-body-sm text-body-sm text-center min-h-[2.5rem] ${resuelto ? 'text-primary' : 'text-on-surface-variant'}`}>
        {mensaje}
      </p>
    </div>
  );
}

/**
 * Overlay del onboarding. Se muestra solo si el usuario todavía no lo completó
 * en este navegador. `usuario` es el dueño de la sesión actual.
 */
export default function Onboarding({ usuario = null, alVerPiezas = null }) {
  const reducir = useReducedMotion();
  const [visible, setVisible] = useState(() => !onboardingCompletado(usuario?.id));
  const [indice, setIndice] = useState(0);
  const [puzzleResuelto, setPuzzleResuelto] = useState(false);

  if (!visible) return null;

  const tarjeta = TARJETAS[indice];
  const esUltima = indice === TARJETAS.length - 1;
  const porcentaje = Math.round(((indice + 1) / TARJETAS.length) * 100);

  function cerrar() {
    marcarOnboardingCompletado(usuario?.id);
    setVisible(false);
  }

  // Las reglas y el modelo 3D de cada pieza están en el panel: el enlace cierra el tutorial y lleva ahí.
  function verEnPanel() {
    cerrar();
    alVerPiezas?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-titulo"
      className="fixed inset-0 z-[90] bg-surface-container-lowest/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-3xl bg-surface-container border border-outline-variant/30 shadow-2xl p-5 sm:p-7 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">
            Tarjeta {indice + 1} de {TARJETAS.length}
          </span>
          <button
            type="button"
            onClick={cerrar}
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded"
          >
            Saltar
          </button>
        </div>

        <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-label="Avance del tutorial">
          <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${porcentaje}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={tarjeta.id}
            initial={reducir ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducir ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <h2 id="onboarding-titulo" className="font-headline-sm text-headline-sm text-on-surface">
              {tarjeta.tipo === 'pieza' ? tarjeta.pieza.nombre : tarjeta.titulo}
            </h2>

            {tarjeta.tipo === 'concepto' && (
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{tarjeta.texto}</p>
            )}

            {tarjeta.tipo === 'pieza' && (
              <>
                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                  <span className="font-semibold">Cómo se mueve: </span>
                  {tarjeta.pieza.comoSeMueve}
                </p>
                <MiniTableroPieza pieza={tarjeta.pieza} reducir={reducir} />
                <button
                  type="button"
                  onClick={verEnPanel}
                  className="self-center font-body-sm text-body-sm text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded"
                >
                  Ver la pieza en 3D y sus reglas en Aprendé cada pieza
                </button>
              </>
            )}

            {tarjeta.tipo === 'puzzle' && (
              <>
                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                  Es tu turno con las blancas. Dá jaque al rey negro con la torre, en una sola jugada.
                </p>
                <PuzzleJaque onResuelto={() => setPuzzleResuelto(true)} />
              </>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            disabled={indice === 0}
            className="px-4 py-2 rounded-full bg-surface-container-high text-on-surface font-body-sm text-body-sm disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Anterior
          </button>
          {esUltima ? (
            <button
              type="button"
              onClick={cerrar}
              disabled={!puzzleResuelto}
              className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Empezar a jugar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndice((i) => Math.min(TARJETAS.length - 1, i + 1))}
              className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
