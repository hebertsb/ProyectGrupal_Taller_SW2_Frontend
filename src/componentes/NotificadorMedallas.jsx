import { useCallback, useEffect, useRef, useState } from 'react';
import './NotificadorMedallas.css';
import MedallaFigurita from './MedallaFigurita';
import { marcarMedallasVistas, obtenerMedallas } from '../api/backend';
import {
  EVENTO_MEDALLAS_NUEVAS,
  EVENTO_REVISAR_MEDALLAS,
  etiquetaNivel,
  etiquetaPieza,
  normalizarNivel,
  recordarMedallasAvisadas,
} from '../medallas';
import { fechaDesdeIso } from '../formatoTiempo';
import useModalAccesible from '../useModalAccesible';

/** Cuánto se queda la tarjeta de aviso en pantalla si nadie la toca. */
const DURACION_AVISO_MS = 6000;
/** Lo que dura la animación de salida de la tarjeta (ver `.medalla-aviso--sale`). */
const DURACION_SALIDA_MS = 250;

/** Chispas que salen de la figurita al revelarse: `cx`/`cy` son la dirección (-1 a 1) y `t` el tamaño en px. */
const PARTICULAS = Array.from({ length: 14 }, (_, i) => {
  const angulo = (i / 14) * Math.PI * 2 + (i % 2) * 0.15;
  const alcance = [1, 0.78, 0.56][i % 3];
  return {
    cx: Number((Math.cos(angulo) * alcance).toFixed(3)),
    cy: Number((Math.sin(angulo) * alcance).toFixed(3)),
    t: 10 + (i % 4) * 4,
  };
});

/** Estrellitas de fondo que titilan (posiciones fijas en % de la pantalla, desfasadas entre sí). */
const TITILOS = [
  { x: '8%', y: '12%', t: 14, d: '0s' },
  { x: '21%', y: '28%', t: 10, d: '0.6s' },
  { x: '12%', y: '52%', t: 16, d: '1.2s' },
  { x: '27%', y: '74%', t: 11, d: '0.3s' },
  { x: '6%', y: '84%', t: 12, d: '1.7s' },
  { x: '44%', y: '8%', t: 11, d: '0.9s' },
  { x: '58%', y: '16%', t: 9, d: '1.5s' },
  { x: '73%', y: '9%', t: 15, d: '0.4s' },
  { x: '90%', y: '19%', t: 11, d: '1.1s' },
  { x: '82%', y: '40%', t: 17, d: '0.7s' },
  { x: '93%', y: '62%', t: 10, d: '1.9s' },
  { x: '76%', y: '78%', t: 13, d: '0.2s' },
  { x: '60%', y: '90%', t: 10, d: '1.4s' },
  { x: '40%', y: '86%', t: 14, d: '1s' },
];

function listarEnTexto(nombres) {
  try {
    return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(nombres);
  } catch {
    return nombres.join(', ');
  }
}

/** La primera medalla de la vida, si ganó varias a la vez, es la que se ganó antes (y, a igualdad, la primera de la lista). */
function elegirProtagonista(medallas) {
  let elegida = medallas[0];
  let menor = fechaDesdeIso(elegida.ganada_en)?.getTime() ?? Infinity;
  for (const medalla of medallas.slice(1)) {
    const momento = fechaDesdeIso(medalla.ganada_en)?.getTime() ?? Infinity;
    if (momento < menor) {
      elegida = medalla;
      menor = momento;
    }
  }
  return elegida;
}

/**
 * Convierte la respuesta de `GET /usuario/medallas` en avisos para mostrar. Solo cuenta las medallas ganadas, nuevas y
 * que no se hayan encolado ya en esta sesión. Si es la primera medalla de la vida (y todavía no hubo una revelación en
 * esta sesión), sale UNA revelación con la protagonista y las demás mencionadas; si no, una tarjeta por medalla.
 */
function prepararAvisos(datos, yaEncoladas, revelacionYaEncolada) {
  const lista = Array.isArray(datos?.medallas) ? datos.medallas : [];
  const codigosNuevos = new Set(Array.isArray(datos?.nuevas) ? datos.nuevas : []);
  const pendientes = lista.filter(
    (medalla) =>
      medalla?.ganada === true && (codigosNuevos.has(medalla.codigo) || medalla.nueva === true) && !yaEncoladas.has(medalla.codigo)
  );
  if (pendientes.length === 0) return { avisos: [], pendientes, conRevelacion: false };

  if (datos?.es_primera === true && !revelacionYaEncolada) {
    const protagonista = elegirProtagonista(pendientes);
    return {
      avisos: [
        {
          clave: `revelacion:${protagonista.codigo}`,
          tipo: 'revelacion',
          medalla: protagonista,
          otras: pendientes.filter((medalla) => medalla !== protagonista),
        },
      ],
      pendientes,
      conRevelacion: true,
    };
  }
  return {
    avisos: pendientes.map((medalla) => ({ clave: `aviso:${medalla.codigo}`, tipo: 'aviso', medalla, otras: [] })),
    pendientes,
    conRevelacion: false,
  };
}

const BOTON_PRINCIPAL =
  'min-h-12 px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:bg-primary-fixed transition-colors motion-reduce:transition-none flex items-center justify-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_SECUNDARIO =
  'min-h-12 px-space-lg py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none flex items-center justify-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Pantalla completa para la PRIMERA medalla de la vida del jugador: la figurita aparece como silueta oscura, gira,
 * destella y recién ahí muestra el color, con chispas hechas con CSS. Es un diálogo modal accesible (foco atrapado,
 * Escape cierra). No se cierra tocando el fondo a propósito: un toque suelto justo después de la jugada la taparía.
 */
function RevelacionPrimeraMedalla({ aviso, alCerrar, alVerAlbum }) {
  const { medalla, otras } = aviso;
  const dialogoRef = useRef(null);
  const botonAlbumRef = useRef(null);
  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: botonAlbumRef });

  const nivel = normalizarNivel(medalla.nivel);
  const ganada = { ...medalla, ganada: true };

  return (
    <div data-nivel-medalla={nivel} className="fixed inset-0 z-[85]">
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-surface-container-lowest/90 backdrop-blur-sm pointer-events-none">
        <div className="rev-resplandor" />
        <div className="rev-rayos" />
        {TITILOS.map((titilo) => (
          <span key={`${titilo.x}-${titilo.y}`} className="rev-titilo" style={{ '--x': titilo.x, '--y': titilo.y, '--t': `${titilo.t}px`, '--d': titilo.d }} />
        ))}
      </div>

      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="min-h-full flex items-center justify-center p-space-md">
          <div
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-primera-medalla"
            aria-describedby="descripcion-primera-medalla"
            tabIndex={-1}
            className="relative w-full max-w-md flex flex-col items-center gap-space-md py-space-md text-center outline-none"
          >
            <div className="rev-titulo-anim flex flex-col items-center gap-space-2xs">
              <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">Medalla nueva</span>
              <h2 id="titulo-primera-medalla" className="m-0 font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-on-surface">
                ¡Ganaste tu primera medalla!
              </h2>
            </div>

            <div className="rev-escena w-full py-space-xs">
              <span className="rev-destello" aria-hidden="true" />
              {PARTICULAS.map((particula, indice) => (
                <span
                  key={indice}
                  className="rev-particula"
                  aria-hidden="true"
                  style={{ '--cx': particula.cx, '--cy': particula.cy, '--t': `${particula.t}px` }}
                />
              ))}
              <span className="rev-figurita">
                <MedallaFigurita medalla={ganada} tamano="lg" decorativa />
              </span>
            </div>

            <div className="flex flex-col items-center gap-space-xs">
              <p className="rev-texto m-0 font-headline-lg text-headline-lg text-primary break-words" style={{ '--orden': 0 }}>
                {medalla.nombre}
              </p>
              <p className="rev-texto m-0 font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant" style={{ '--orden': 1 }}>
                {etiquetaNivel(nivel)} · {etiquetaPieza(medalla.pieza)}
              </p>
              <p
                id="descripcion-primera-medalla"
                className="rev-texto m-0 font-body-lg text-body-lg text-on-surface break-words"
                style={{ '--orden': 2 }}
              >
                {medalla.descripcion}
              </p>
              {otras.length > 0 && (
                <p className="rev-texto m-0 font-body-sm text-body-sm text-on-surface-variant break-words" style={{ '--orden': 3 }}>
                  Y ganaste {otras.length} {otras.length === 1 ? 'medalla más' : 'medallas más'}: {listarEnTexto(otras.map((otra) => otra.nombre))}.
                </p>
              )}
            </div>

            <div className="rev-texto w-full flex flex-col sm:flex-row sm:justify-center gap-space-xs pt-space-xs" style={{ '--orden': 4 }}>
              <button ref={botonAlbumRef} type="button" onClick={alVerAlbum} className={BOTON_PRINCIPAL}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  collections_bookmark
                </span>
                Ver mi álbum
              </button>
              <button type="button" onClick={alCerrar} className={BOTON_SECUNDARIO}>
                Seguir jugando
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta que entra deslizándose desde arriba cuando se gana una medalla (no la primera): se cierra sola a los
 * ~6 s, con la X, o al tocarla (lleva al álbum). Es un aviso flotante: el contenedor no intercepta clics, solo la
 * tarjeta. Mientras el mouse o el foco están sobre ella, no se cierra sola.
 */
function AvisoMedallaNueva({ medalla, alCerrar, alAbrir }) {
  const [pausado, setPausado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const salidaIniciadaRef = useRef(false);
  const temporizadorSalidaRef = useRef(null);

  const cerrar = useCallback(() => {
    if (salidaIniciadaRef.current) return;
    salidaIniciadaRef.current = true;
    setSaliendo(true);
    const reducirMovimiento =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Con "reducir movimiento" no hay animación de salida: se saca de inmediato.
    temporizadorSalidaRef.current = setTimeout(alCerrar, reducirMovimiento ? 0 : DURACION_SALIDA_MS);
  }, [alCerrar]);

  useEffect(() => () => clearTimeout(temporizadorSalidaRef.current), []);

  useEffect(() => {
    if (pausado || saliendo) return undefined;
    const temporizador = setTimeout(cerrar, DURACION_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [pausado, saliendo, cerrar]);

  const nivel = normalizarNivel(medalla.nivel);
  const ganada = { ...medalla, ganada: true };

  return (
    <div
      className="pointer-events-none fixed z-[84] left-space-md right-space-md sm:left-auto sm:right-space-lg sm:w-[26rem] flex"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div
        data-nivel-medalla={nivel}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
        className={`medalla-aviso ${saliendo ? 'medalla-aviso--sale' : ''} pointer-events-auto relative w-full min-w-0 rounded-2xl border-2 bg-surface-container-low text-on-surface`}
      >
        <button
          type="button"
          onClick={alAbrir}
          className="flex w-full min-h-[4.5rem] items-center gap-space-sm p-space-sm pr-14 text-left rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <MedallaFigurita medalla={ganada} tamano="sm" decorativa />
          <span className="flex flex-col gap-1 min-w-0">
            <span className="font-body-sm text-body-sm font-semibold text-on-surface break-words">
              ¡Ganaste la medalla {medalla.nombre}!
            </span>
            <span className="font-body-sm text-[13px] leading-snug text-on-surface-variant line-clamp-2 break-words">
              {medalla.descripcion}
            </span>
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">Tocá para ver tu álbum</span>
          </span>
        </button>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso de medalla"
          className="absolute top-1 right-1 w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            close
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Aviso global de medallas nuevas. Se monta UNA vez (App.tsx), solo para jugadores con sesión iniciada.
 *
 * Revisa (`GET /usuario/medallas`) al montarse (al iniciar sesión o abrir la app) y cada vez que alguien dispara
 * `pedirRevisionMedallas()` (al terminar una partida, al abrir el Panel de Aprendizaje, etc.). Por cada medalla nueva:
 *  - si es la PRIMERA de su vida: revelación a pantalla completa (`RevelacionPrimeraMedalla`);
 *  - si no: una tarjeta arriba (`AvisoMedallaNueva`), una tras otra si son varias.
 * Apenas se muestra cada aviso se llama a `marcarMedallasVistas` para que no se repita. Si algo falla (red, sesión), no se
 * muestra nada ni se rompe la pantalla: el próximo pedido lo intenta de nuevo. No bloquea el juego: solo la revelación
 * es modal, y solo ocurre una vez en la vida del jugador.
 */
export default function NotificadorMedallas({ alVerAlbum }) {
  const [cola, setCola] = useState([]);
  const yaEncoladasRef = useRef(new Set());
  const revelacionEncoladaRef = useRef(false);
  const enVueloRef = useRef(false);
  const repetirRef = useRef(false);
  const vivoRef = useRef(true);
  const revisarRef = useRef(null);
  const alVerAlbumRef = useRef(alVerAlbum);

  useEffect(() => {
    alVerAlbumRef.current = alVerAlbum;
  }, [alVerAlbum]);

  const revisar = useCallback(async () => {
    // Varios pedidos seguidos (fin de partida + panel abierto...) se juntan: uno en vuelo y, si llegaron más, uno más después.
    if (enVueloRef.current) {
      repetirRef.current = true;
      return;
    }
    enVueloRef.current = true;
    try {
      const datos = await obtenerMedallas();
      if (!vivoRef.current) return;
      const { avisos, pendientes, conRevelacion } = prepararAvisos(datos, yaEncoladasRef.current, revelacionEncoladaRef.current);
      if (avisos.length === 0) return;
      pendientes.forEach((medalla) => yaEncoladasRef.current.add(medalla.codigo));
      if (conRevelacion) revelacionEncoladaRef.current = true;
      setCola((anterior) => [...anterior, ...avisos]);
      // El álbum y el perfil, si están abiertos, se refrescan para mostrar la medalla.
      window.dispatchEvent(new Event(EVENTO_MEDALLAS_NUEVAS));
    } catch {
      // Silencioso a propósito: un aviso de medalla nunca debe mostrar un error ni romper la pantalla.
    } finally {
      enVueloRef.current = false;
      if (repetirRef.current && vivoRef.current) {
        repetirRef.current = false;
        revisarRef.current?.();
      }
    }
  }, []);

  useEffect(() => {
    revisarRef.current = revisar;
  }, [revisar]);

  useEffect(() => {
    vivoRef.current = true;
    const alPedirRevision = () => revisar();
    window.addEventListener(EVENTO_REVISAR_MEDALLAS, alPedirRevision);
    revisar(); // al iniciar sesión / abrir la app
    return () => {
      vivoRef.current = false;
      window.removeEventListener(EVENTO_REVISAR_MEDALLAS, alPedirRevision);
    };
  }, [revisar]);

  const actual = cola[0] ?? null;
  const claveActual = actual?.clave ?? null;

  // Apenas un aviso se muestra se marca como visto (aunque lo cierren enseguida), para que no se repita. Si la llamada
  // falla no pasa nada: a lo sumo se vuelve a avisar en otra sesión.
  useEffect(() => {
    if (!actual) return;
    const codigos = [actual.medalla.codigo, ...actual.otras.map((otra) => otra.codigo)];
    recordarMedallasAvisadas(codigos);
    marcarMedallasVistas(codigos).catch(() => {});
    // `actual` cambia de identidad en cada render del padre: la clave alcanza para saber que es otro aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveActual]);

  const cerrarActual = useCallback(() => setCola((anterior) => anterior.slice(1)), []);
  const irAlAlbum = useCallback(() => {
    setCola((anterior) => anterior.slice(1));
    alVerAlbumRef.current?.();
  }, []);

  return (
    <>
      {/* Región en vivo siempre presente: anuncia la tarjeta (la revelación se anuncia sola al ser un diálogo). */}
      <p className="sr-only" role="status" aria-live="polite">
        {actual?.tipo === 'aviso' ? `¡Ganaste la medalla ${actual.medalla.nombre}! ${actual.medalla.descripcion ?? ''}` : ''}
      </p>
      {actual?.tipo === 'revelacion' && (
        <RevelacionPrimeraMedalla key={actual.clave} aviso={actual} alCerrar={cerrarActual} alVerAlbum={irAlAlbum} />
      )}
      {actual?.tipo === 'aviso' && (
        <AvisoMedallaNueva key={actual.clave} medalla={actual.medalla} alCerrar={cerrarActual} alAbrir={irAlAlbum} />
      )}
    </>
  );
}
