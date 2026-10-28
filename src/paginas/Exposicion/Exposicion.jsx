import { useEffect, useRef, useState } from 'react';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';
import { flechaDeUci } from '../../ajedrez';
import CerebroNeuronal from '../RazonamientoNeuronal/CerebroNeuronal';
import useFlujoVivo from '../Camara/useFlujoVivo';
import usePreparacion from './usePreparacion';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../Camara/estilos';
import { useCerebroTuring, usePartidaExposicion } from './usePartidaExposicion';
import { formatoReloj, useAvisoDeTurno, useRelojEnPantalla } from './avisos';
import EditorPosicion from './EditorPosicion';

const NIVELES = [
  { nombre: 'Principiante', nivel: 3, detalle: 'Se equivoca seguido' },
  { nombre: 'Intermedio', nivel: 8, detalle: 'Juega con idea' },
  { nombre: 'Avanzado', nivel: 13, detalle: 'Castiga los errores' },
  { nombre: 'Maestro', nivel: 18, detalle: 'Lo máximo del modelo' },
];
const TIEMPOS_PERSONA = [
  { s: 0, texto: 'Sin límite' },
  { s: 300, texto: '5 min' },
  { s: 600, texto: '10 min' },
  { s: 900, texto: '15 min' },
  { s: 1800, texto: '30 min' },
];
const TIEMPOS_TURING = [
  { s: 0, texto: 'Sin límite' },
  { s: 180, texto: '3 min' },
  { s: 300, texto: '5 min' },
  { s: 600, texto: '10 min' },
];

const nombreDeNivel = (nivel) => (NIVELES.find((n) => nivel <= n.nivel) ?? NIVELES[NIVELES.length - 1]).nombre;

/** Qué le dice la pantalla a la gente según el estado de la partida física: un título grande, un color y si hay algo moviéndose. */
const ESTADOS = {
  esperando_humano: { titulo: 'Tu turno', ayuda: 'Mové una pieza blanca en el tablero real.', tono: 'text-neon-lime', punto: 'bg-neon-lime', marco: 'border-neon-lime bg-neon-lime/10' },
  leyendo: { titulo: 'Leí tu jugada', ayuda: 'Si no era esa, tocá «¡No, era otra!».', tono: 'text-neon-cyan', punto: 'bg-neon-cyan', late: true, marco: 'border-neon-cyan bg-neon-cyan/10' },
  turing_decide: { titulo: 'Turing está pensando…', ayuda: 'Mirá a la derecha cómo razona la red.', tono: 'text-neon-cyan', punto: 'bg-neon-cyan', late: true },
  brazo_ejecuta: { titulo: 'El brazo mueve su pieza', ayuda: 'No toques el tablero.', tono: 'text-neon-orange', punto: 'bg-neon-orange', late: true },
  esperando_robot_manual: { titulo: 'Mové la pieza de Turing', ayuda: 'Sin brazo: la movés vos en el tablero real.', tono: 'text-neon-orange', punto: 'bg-neon-orange' },
  incidente: { titulo: 'Hay que revisar el tablero', ayuda: '', tono: 'text-error', punto: 'bg-error', marco: 'border-error bg-error/10' },
  fin: { titulo: 'Partida terminada', ayuda: '', tono: 'text-on-surface', punto: 'bg-on-surface-variant' },
};
const PUEDE_ARREGLAR = ['esperando_humano', 'esperando_robot_manual', 'incidente', 'leyendo'];

function textoResultado(estado) {
  if (estado.fin_tiempo === 'persona') return 'Se acabó tu tiempo: ganó Turing.';
  if (estado.fin_tiempo === 'turing') return 'Se acabó el tiempo de Turing: ¡ganaste!';
  if (estado.resultado === '1-0') return '¡Ganaste!';
  if (estado.resultado === '0-1') return 'Ganó Turing.';
  if (estado.resultado === '1/2-1/2') return 'Tablas.';
  return estado.resultado ?? '';
}

function formatearCp(cp) {
  if (cp == null) return '—';
  const valor = (cp / 100).toFixed(2);
  return cp > 0 ? `+${valor}` : valor;
}

function Tarjeta({ titulo, subtitulo, derecha, children, className = '' }) {
  return (
    <section className={`min-w-0 bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md flex flex-col gap-space-sm ${className}`}>
      <header className="flex items-start justify-between gap-space-xs">
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface m-0">{titulo}</h2>
          {subtitulo && <p className="font-body-sm text-body-sm text-on-surface-variant m-0">{subtitulo}</p>}
        </div>
        {derecha}
      </header>
      {children}
    </section>
  );
}

function planilla(jugadas) {
  const filas = [];
  jugadas.forEach((san, i) => {
    if (i % 2 === 0) filas.push([Math.floor(i / 2) + 1, san, '']);
    else filas[filas.length - 1][2] = san;
  });
  return filas;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Antes de empezar: el nivel, el reloj y listo.
// ---------------------------------------------------------------------------------------------------------------------------------------------
function Opciones({ valor, opciones, alElegir, etiqueta }) {
  return (
    <div className="flex flex-wrap gap-space-xs" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.s} type="button" className={valor === o.s ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={valor === o.s} onClick={() => alElegir(o.s)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

const COLOR_PUNTO = { ok: 'bg-neon-lime', error: 'bg-error', aviso: 'bg-neon-orange', info: 'bg-on-surface-variant' };
const TEXTO_ESTADO = { ok: 'Listo', error: 'Falta', aviso: 'Revisar', info: 'Dato' };

/** La lista de verificación: una luz por punto (verde listo, roja falta, ámbar revisar, gris dato). Lo del brazo solo se exige si la partida lo usa. */
function ListaDeVerificacion({ items, error, usarBrazo }) {
  const visibles = items ?? [];
  return (
    <Tarjeta titulo="Antes de empezar" subtitulo="Se actualiza sola cada pocos segundos. Solo lee: no mueve ni cambia nada del brazo.">
      {error && <p className={CLASE_AVISO} role="alert">El backend no responde ({error}). ¿Está levantado?</p>}
      {!items && !error && <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">Comprobando…</p>}
      <ul className="list-none m-0 p-0 flex flex-col gap-1" aria-label="Lista de verificación">
        {visibles.map((i) => {
          const noAplica = i.brazo && !usarBrazo;
          const estado = noAplica ? 'info' : i.estado;
          return (
            <li key={i.id} className={`flex items-start gap-space-xs ${noAplica ? 'opacity-60' : ''}`}>
              <span className={`mt-[6px] w-3 h-3 rounded-full shrink-0 ${COLOR_PUNTO[estado]}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-body-md text-body-md text-on-surface m-0">
                  {i.etiqueta} <span className="font-mono-micro text-mono-micro text-on-surface-variant">· {noAplica ? 'no se usa en esta partida' : TEXTO_ESTADO[estado]}</span>
                </p>
                {!noAplica && <p className="font-body-sm text-body-sm text-on-surface-variant m-0 break-words">{i.detalle}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

function Preparacion({ ocupado, error, sinConexion, alEmpezar }) {
  const [nivel, setNivel] = useState(8);
  const [usarBrazo, setUsarBrazo] = useState(false);
  const [precauciones, setPrecauciones] = useState(false);
  const [tiempoPersonaS, setTiempoPersonaS] = useState(600);
  const [tiempoTuringS, setTiempoTuringS] = useState(180);
  const [brazoCuenta, setBrazoCuenta] = useState(false);
  const { items, error: errorVerificacion } = usePreparacion();
  const faltan = (items ?? []).filter((i) => i.estado === 'error' && (!i.brazo || usarBrazo));
  const listo = items !== null && !errorVerificacion && faltan.length === 0;

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-space-md">
      <div className="text-center flex flex-col gap-1">
        <h1 className="font-headline-xl text-headline-xl text-on-surface m-0">Jugá contra Turing</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant m-0">
          Movés las piezas en el tablero real. La cámara te ve, Turing piensa y el robot responde. Vos jugás con las blancas y empezás.
        </p>
      </div>

      <Tarjeta titulo="¿Qué tan fuerte querés que juegue?" subtitulo={`Nivel ${nivel} de 18 · ${nombreDeNivel(nivel)}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-xs" role="group" aria-label="Nivel de Turing">
          {NIVELES.map((n) => {
            const elegido = nombreDeNivel(nivel) === n.nombre;
            return (
              <button
                key={n.nombre}
                type="button"
                onClick={() => setNivel(n.nivel)}
                aria-pressed={elegido}
                className={`min-h-[72px] rounded-xl border px-space-xs py-space-xs text-left flex flex-col justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  elegido ? 'border-primary bg-primary/10 text-on-surface' : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="font-body-md text-body-md font-medium text-on-surface">{n.nombre}</span>
                <span className="font-body-sm text-body-sm">{n.detalle}</span>
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
          Ajuste fino
          <input type="range" min={0} max={18} value={nivel} onChange={(e) => setNivel(Number(e.target.value))} className="flex-1 accent-[var(--color-primary)]" aria-label="Nivel de Turing de 0 a 18" />
        </label>
      </Tarjeta>

      <Tarjeta titulo="Reloj" subtitulo="Cada lado tiene su tiempo para toda la partida; corre solo el de quien tiene el turno.">
        <div className="flex flex-col gap-space-xs">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Tiempo de la persona</span>
          <Opciones valor={tiempoPersonaS} opciones={TIEMPOS_PERSONA} alElegir={setTiempoPersonaS} etiqueta="Tiempo de la persona" />
        </div>
        <div className="flex flex-col gap-space-xs">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Tiempo de Turing</span>
          <Opciones valor={tiempoTuringS} opciones={TIEMPOS_TURING} alElegir={setTiempoTuringS} etiqueta="Tiempo de Turing" />
        </div>
        {tiempoTuringS > 0 && (
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface min-h-[44px]">
            <input type="checkbox" checked={brazoCuenta} onChange={(e) => setBrazoCuenta(e.target.checked)} className="w-5 h-5" />
            También cuenta lo que tarda el brazo en mover (si no, solo cuenta lo que tarda en pensar)
          </label>
        )}
      </Tarjeta>

      <Tarjeta titulo="¿Quién mueve las piezas de Turing?">
        <label className="flex items-center gap-space-xs font-body-md text-body-md text-on-surface min-h-[44px]">
          <input type="checkbox" checked={usarBrazo} onChange={(e) => { setUsarBrazo(e.target.checked); setPrecauciones(false); }} className="w-5 h-5" />
          El brazo robótico (si no, las movés vos)
        </label>
        {usarBrazo && (
          <div className={CLASE_AVISO}>
            <label className="flex items-start gap-space-xs min-h-[44px]">
              <input type="checkbox" checked={precauciones} onChange={(e) => setPrecauciones(e.target.checked)} className="mt-1" />
              <span>
                Hebert está en el laboratorio, la velocidad global está al 20 %, hay una mano en la parada de emergencia, las aperturas de cada pieza, el cementerio y la dama de
                reserva están calibrados y probé la jugada primero en el emulador.
              </span>
            </label>
          </div>
        )}
      </Tarjeta>

      <ListaDeVerificacion items={items} error={errorVerificacion} usarBrazo={usarBrazo} />
      {error && <p className={CLASE_AVISO} role="alert">{error}</p>}
      {sinConexion && <p className={CLASE_AVISO} role="status">Sin respuesta del backend: reintentando…</p>}

      <button
        type="button"
        className={`${CLASE_BOTON_PRIMARIO} !min-h-[64px] !text-body-lg font-medium`}
        onClick={() => alEmpezar({ nivel, usarBrazo, tiempoPersonaS, tiempoTuringS, brazoCuenta })}
        disabled={ocupado || !listo || (usarBrazo && !precauciones)}
        title={listo ? undefined : 'Falta resolver algo de la lista «Antes de empezar»'}
      >
        {ocupado ? 'Empezando…' : 'Empezar la partida'}
      </button>
      {!listo && items && faltan.length > 0 && (
        <p className="font-body-sm text-body-sm text-error text-center m-0" role="status">
          Falta: {faltan.map((i) => i.etiqueta.replace(/^.*?: /, '')).join(', ')}.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// El marcador de arriba: los relojes, de quién es el turno y qué hacer.
// ---------------------------------------------------------------------------------------------------------------------------------------------
function Esfera({ etiqueta, ms, corre }) {
  const poco = ms != null && ms <= 30_000;
  return (
    <div
      className={`min-w-[148px] rounded-xl border px-space-sm py-space-xs flex flex-col items-center ${corre ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container'}`}
      role="timer"
      aria-label={`${etiqueta}: ${formatoReloj(ms)}`}
    >
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{etiqueta}</span>
      <span className={`font-mono-metric text-[34px] leading-[40px] font-semibold tabular-nums ${poco ? 'text-error' : 'text-on-surface'} ${corre && poco ? 'animate-pulse' : ''}`}>{formatoReloj(ms)}</span>
    </div>
  );
}

function BarraDeVentana({ segundos, clave }) {
  const [llena, setLlena] = useState(false);
  useEffect(() => {
    setLlena(false);
    const cuadro = requestAnimationFrame(() => requestAnimationFrame(() => setLlena(true)));
    return () => cancelAnimationFrame(cuadro);
  }, [clave]);
  return (
    <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden" aria-hidden="true">
      <div className="h-full bg-neon-cyan" style={{ width: llena ? '100%' : '0%', transition: llena ? `width ${segundos}s linear` : 'none' }} />
    </div>
  );
}

function Marcador({ estado, info, reloj, alCancelarLectura, ocupado }) {
  const empezando = estado.estado === 'esperando_humano' && (estado.jugadas ?? []).length === 0 && !estado.pausada;
  const titulo = estado.estado === 'leyendo' && estado.lectura ? `Leí ${estado.lectura.jugada}` : empezando ? 'Empezás vos' : info.titulo;
  const ayuda = empezando ? 'Las blancas mueven primero: mové una pieza en el tablero real.' : estado.estado === 'fin' ? textoResultado(estado) : info.ayuda || estado.mensaje;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-space-md rounded-2xl border px-space-md py-space-sm ${info.marco ?? 'border-outline-variant bg-surface-container-lowest'}`}>
      {reloj && <Esfera etiqueta="Tú · blancas" ms={reloj.persona} corre={reloj.corre === 'persona'} />}
      <div className="flex-1 min-w-[260px] flex flex-col items-center text-center gap-1">
        <p className={`font-headline-xl text-headline-xl font-semibold m-0 ${info.tono}`} role="status" aria-live="polite">
          {estado.pausada ? 'Pausada · ' : ''}
          {titulo}
        </p>
        <p className="font-body-lg text-body-lg text-on-surface-variant m-0 break-words">{ayuda}</p>
        {estado.estado === 'leyendo' && estado.lectura && (
          <div className="w-full max-w-[420px] flex flex-col items-center gap-space-xs mt-1">
            <BarraDeVentana segundos={estado.lectura.ventana_s} clave={estado.lectura.jugada} />
            <button type="button" className={`${CLASE_BOTON} !min-h-[56px] !px-space-lg !text-body-lg font-medium border-neon-orange`} onClick={alCancelarLectura} disabled={ocupado}>
              ¡No, era otra!
            </button>
          </div>
        )}
      </div>
      {reloj && <Esfera etiqueta={estado.usa_brazo ? 'Turing y brazo · negras' : 'Turing · negras'} ms={reloj.turing} corre={reloj.corre === 'turing'} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lo que ve la cámara, y cómo reconoce la jugada cuadro por cuadro.
// ---------------------------------------------------------------------------------------------------------------------------------------------
function Miniatura({ titulo, src }) {
  return (
    <figure className="m-0 flex flex-col gap-1 min-w-0">
      {src ? (
        <img src={src} alt={titulo} className="w-full h-auto rounded-lg border border-outline-variant bg-surface-container" />
      ) : (
        <div className="w-full aspect-square rounded-lg border border-outline-variant bg-surface-container" />
      )}
      <figcaption className="font-mono-micro text-mono-micro text-on-surface-variant text-center">{titulo}</figcaption>
    </figure>
  );
}

function PanelCamara({ estado }) {
  const { url, error, fps } = useFlujoVivo({ modo: 'camara', camara: 'principal', maxFps: 10 });
  const vista = estado.vista?.disponible ? estado.vista : null;
  const cambiadas = vista?.cambiadas ?? [];
  const rendimiento = estado.rendimiento?.fps_camara;
  return (
    <Tarjeta
      titulo="Lo que ve la cámara"
      subtitulo="Así reconoce tu jugada: compara el antes con el ahora."
      derecha={
        <span className="font-mono-micro text-mono-micro text-on-surface-variant shrink-0" aria-label="Cuadros por segundo de la cámara">
          {rendimiento != null ? `${Math.round(rendimiento)} cuadros/s` : fps ? `${fps} fps` : ''}
        </span>
      }
    >
      <div className="w-full bg-surface-container rounded-xl overflow-hidden flex items-center justify-center aspect-video">
        {url ? (
          <img src={url} alt="Vista en vivo de la cámara sobre el tablero" className="w-full h-full object-contain block" />
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant p-space-md">{error ?? 'Conectando con la cámara…'}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-space-xs" aria-label="Cómo reconoce la jugada">
        <Miniatura titulo="1 · Antes" src={vista?.base} />
        <Miniatura titulo="2 · Ahora" src={vista?.actual} />
        <Miniatura titulo="3 · Qué cambió" src={vista?.diferencia} />
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0 break-words" role="status">
        {vista?.decision || estado.mensaje || 'Esperando la foto base…'}
        {cambiadas.length > 0 && (
          <span className="text-on-surface-variant"> · casillas: <strong className="text-on-surface">{cambiadas.join(', ')}</strong></span>
        )}
      </p>
      {vista?.candidatas?.length > 0 && (
        <details className="font-body-sm text-body-sm text-on-surface-variant">
          <summary className="cursor-pointer min-h-[44px] flex items-center">Ver las jugadas que está comparando</summary>
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {vista.candidatas.map((c, i) => (
              <li key={c.uci} className={`flex items-center justify-between gap-space-xs ${i === 0 ? 'text-on-surface font-medium' : ''}`}>
                <span className="font-mono-micro text-mono-micro">{c.san}</span>
                <span className={c.valida ? 'text-primary' : 'text-error'}>{c.valida ? 'origen y destino cambiaron' : 'no coincide'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// El cerebro de Turing.
// ---------------------------------------------------------------------------------------------------------------------------------------------
function Dato({ etiqueta, valor, tono = 'text-on-surface' }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{etiqueta}</span>
      <span className={`font-body-lg text-body-lg font-medium truncate ${tono}`}>{valor}</span>
    </div>
  );
}

function PanelTuring({ estado, inferencia, analizando }) {
  const pensando = analizando || estado.estado === 'turing_decide';
  const candidatas = inferencia?.candidatas ?? [];
  const top1 = candidatas[0] ?? null;
  const calculo = inferencia?.calculo ?? null;
  const probabilidadElegida = calculo?.candidatas?.find((c) => c.elegida)?.probabilidad ?? top1?.probabilidad ?? null;
  const cmp = inferencia?.comparacion_stockfish ?? null;
  const coincide = cmp ? Math.abs(cmp.diferencia_cp ?? 0) <= 20 : null;
  return (
    <Tarjeta
      titulo="El cerebro de Turing"
      subtitulo={pensando ? 'Calculando la jugada…' : inferencia ? 'Esto fue lo que pensó la red.' : 'Se activa cuando le toca mover.'}
      derecha={<span className={`w-3 h-3 rounded-full shrink-0 mt-2 ${pensando ? 'bg-neon-cyan animate-pulse' : 'bg-outline-variant'}`} aria-hidden="true" />}
    >
      <div className="relative h-[300px] rounded-xl overflow-hidden bg-surface-container">
        <CerebroNeuronal
          saliencia={inferencia?.saliencia ?? Array(64).fill(0)}
          atencionPorBloque={inferencia?.atencion_por_bloque ?? []}
          jugadaElegida={inferencia?.jugada_elegida ?? null}
          probabilidadTop1={top1?.probabilidad ?? 0}
          diferenciaCp={cmp?.diferencia_cp ?? 0}
          analizando={pensando}
          compacto
        />
      </div>
      <div className="grid grid-cols-3 gap-space-xs">
        <Dato etiqueta="Propone" valor={inferencia?.jugada_elegida ?? '—'} tono="text-neon-lime" />
        <Dato etiqueta="Seguridad" valor={probabilidadElegida != null ? `${Math.round(probabilidadElegida * 100)} %` : '—'} />
        <Dato etiqueta="Tardó" valor={inferencia?.latencia_ms != null ? `${Math.round(inferencia.latencia_ms)} ms` : '—'} />
      </div>
      {candidatas.length > 1 && (
        <div className="flex flex-col gap-1" aria-label="Otras jugadas que consideró">
          <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Otras que consideró</span>
          {candidatas.slice(0, 3).map((c) => (
            <div key={c.jugada} className="flex items-center gap-space-xs">
              <span className="font-mono-micro text-mono-micro text-on-surface w-14 shrink-0">{c.jugada}</span>
              <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-neon-cyan" style={{ width: `${Math.max(2, Math.round(c.probabilidad * 100))}%` }} />
              </div>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant w-10 text-right">{Math.round(c.probabilidad * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      {cmp && (
        <p className={`font-body-sm text-body-sm m-0 ${coincide ? 'text-neon-lime' : 'text-neon-orange'}`}>
          {coincide ? 'Stockfish, el motor de referencia, está de acuerdo.' : `Stockfish habría jugado ${cmp.jugada_motor}`} · evaluación {formatearCp(cmp.evaluacion_cp)}
          <span className="text-on-surface-variant"> (solo se compara: no decide).</span>
        </p>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// El tablero digital y las jugadas.
// ---------------------------------------------------------------------------------------------------------------------------------------------
function PanelTablero({ estado, jugadaTuring, resaltadas }) {
  const filas = planilla(estado.jugadas ?? []);
  const flechas = [];
  const flecha = flechaDeUci(jugadaTuring);
  if (flecha) flechas.push({ uci: jugadaTuring, color: '#76ff03', punteada: false });
  return (
    <Tarjeta titulo="El tablero" subtitulo={estado.turno === 'blancas' ? 'Juegan las blancas (vos)' : 'Juegan las negras (Turing)'}>
      <div className="w-full flex justify-center">
        <TableroSoloLectura fen={estado.fen} flechas={flechas} resaltadas={resaltadas} />
      </div>
      <div className="font-mono-micro text-mono-micro text-on-surface max-h-[132px] overflow-y-auto rounded-lg bg-surface-container p-space-xs" aria-label="Jugadas">
        {filas.length === 0 ? (
          <span className="text-on-surface-variant">Todavía no hay jugadas.</span>
        ) : (
          [...filas].reverse().map(([n, blancas, negras]) => (
            <div key={n}>
              {n}. {blancas} {negras}
            </div>
          ))
        )}
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La pantalla.
// ---------------------------------------------------------------------------------------------------------------------------------------------
/**
 * La pantalla de exposición: dibuja el marcador, el tablero, la cámara, el cerebro de Turing y todo lo que puede salir mal con su salida a mano: anular una jugada leída, arreglar la posición,
 * volver a tomar la foto base, escribir la jugada.
 */
function Pantalla({
  estado, error, sinConexion, ocupado, empezar, detener, alternarPausa, resolver, retomarBase, jugadaManual, cancelarLectura, corregirPosicion, inferencia, analizando, jugadaTuring,
}) {
  const [textoManual, setTextoManual] = useState('');
  const [editando, setEditando] = useState(false);
  const [sonido, setSonido] = useState(true);
  const raiz = useRef(null);

  const activa = Boolean(estado?.activa);
  const reloj = useRelojEnPantalla(activa ? estado.reloj : null);
  useAvisoDeTurno(estado, sonido);
  const info = ESTADOS[estado?.estado] ?? { titulo: '', ayuda: '', tono: 'text-on-surface', punto: 'bg-outline-variant' };

  // Si la partida termina o se corta mientras se edita, el editor se cierra solo.
  useEffect(() => {
    if (!activa || !PUEDE_ARREGLAR.includes(estado.estado)) setEditando(false);
  }, [activa, estado?.estado]);

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else raiz.current?.requestFullscreen?.();
  }

  if (!activa) {
    return (
      <div ref={raiz} className="w-full bg-background p-space-md">
        <Preparacion ocupado={ocupado} error={error} sinConexion={sinConexion} alEmpezar={empezar} />
        {estado?.descartada && <p className={`${CLASE_AVISO} mt-space-sm max-w-3xl mx-auto`} role="status">{estado.mensaje}</p>}
      </div>
    );
  }

  const puedeArreglar = PUEDE_ARREGLAR.includes(estado.estado);
  const cambiadas = estado.seguimiento?.cambiadas ?? [];
  const invalida = ['invalida', 'dudosa'].includes(estado.seguimiento?.estado) && estado.estado === 'esperando_humano';
  const variasPiezas = cambiadas.length >= 5;

  return (
    <div ref={raiz} className="w-full bg-background p-space-md flex flex-col gap-space-md">
      <Marcador estado={estado} info={info} reloj={reloj} alCancelarLectura={cancelarLectura} ocupado={ocupado} />

      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="font-mono-micro text-mono-micro text-on-surface-variant px-3 py-1 rounded-full border border-outline-variant" title="Nivel de Turing en esta partida">
          Turing · {nombreDeNivel(estado.nivel ?? 0)}{estado.nivel != null ? ` (nivel ${estado.nivel})` : ''}{estado.usa_brazo ? '' : ' · sin brazo'}
        </span>
        <div className="flex flex-wrap items-center gap-space-xs">
          <button type="button" className={CLASE_BOTON} onClick={() => setEditando(true)} disabled={ocupado || !puedeArreglar} title={puedeArreglar ? 'Decile al sistema cómo están las piezas de verdad' : 'Esperá a que Turing y el brazo terminen'}>
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">edit</span>Arreglar posición</span>
          </button>
          <button type="button" className={CLASE_BOTON} onClick={alternarPausa} disabled={ocupado || estado.estado === 'fin'}>
            {estado.pausada ? 'Reanudar' : 'Pausar'}
          </button>
          <button type="button" className={CLASE_BOTON} onClick={detener} disabled={ocupado}>
            {estado.estado === 'fin' ? 'Nueva partida' : 'Terminar'}
          </button>
          <button type="button" className={CLASE_BOTON} onClick={() => setSonido((s) => !s)} aria-pressed={sonido} aria-label={sonido ? 'Silenciar los avisos' : 'Activar los avisos sonoros'} title={sonido ? 'Silenciar los avisos' : 'Activar los avisos sonoros'}>
            <span className="material-symbols-outlined text-[18px]">{sonido ? 'volume_up' : 'volume_off'}</span>
          </button>
          <button type="button" className={CLASE_BOTON} onClick={pantallaCompleta} aria-label="Pantalla completa" title="Pantalla completa">
            <span className="material-symbols-outlined text-[18px]">fullscreen</span>
          </button>
        </div>
      </div>

      {error && <p className={CLASE_AVISO} role="alert">{error}</p>}
      {sinConexion && <p className={CLASE_AVISO} role="status">Sin respuesta del backend (se está reiniciando o está muy ocupado): reintentando…</p>}

      {estado.estado === 'incidente' && (
        <div className={CLASE_AVISO} role="alert">
          <p className="m-0 font-medium">{estado.incidente}</p>
          <p className="m-0 mt-1">
            Elegí: <strong>Ya coincide</strong> si las piezas del tablero real ya están como en el tablero digital; <strong>Reintentar</strong> si lo dejaste como estaba antes de la jugada del brazo;
            o <strong>Arreglar posición</strong> para decirle al sistema cómo están las piezas de verdad.
          </p>
          <div className="flex flex-wrap gap-space-xs mt-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => resolver('continuar')} disabled={ocupado}>Ya coincide: continuar</button>
            {estado.puede_reintentar && (
              <button type="button" className={CLASE_BOTON} onClick={() => resolver('reintentar')} disabled={ocupado}>Reintentar la jugada del brazo</button>
            )}
            <button type="button" className={CLASE_BOTON} onClick={() => setEditando(true)} disabled={ocupado}>Arreglar posición</button>
          </div>
        </div>
      )}
      {invalida && (
        <div className={CLASE_AVISO} role="alert">
          <p className="m-0 font-medium">
            {variasPiezas ? `Se movieron varias piezas a la vez (${cambiadas.join(', ')}).` : estado.seguimiento.mensaje}
          </p>
          <p className="m-0 mt-1">
            Si lo podés devolver a como estaba, hacelo y el aviso se va solo. Si no, <strong>Arreglar posición</strong> le dice al sistema cómo están las piezas ahora; y si todo ya está en su sitio y el aviso
            sigue, <strong>volvé a tomar la foto base</strong>. Las casillas dudosas están marcadas en el tablero.
          </p>
          <div className="flex flex-wrap gap-space-xs mt-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => setEditando(true)} disabled={ocupado}>Arreglar posición</button>
            <button type="button" className={CLASE_BOTON} onClick={retomarBase} disabled={ocupado}>Todo está en su sitio: volver a tomar la foto base</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-space-md items-start">
        <PanelTablero estado={estado} jugadaTuring={jugadaTuring} resaltadas={invalida ? cambiadas : []} />
        <PanelCamara estado={estado} />
        <PanelTuring estado={estado} inferencia={inferencia} analizando={analizando} />
      </div>

      {estado.estado === 'esperando_humano' && (
        <details className="font-body-sm text-body-sm text-on-surface-variant">
          <summary className="cursor-pointer min-h-[44px] flex items-center">¿La cámara no te sigue? Opciones de respaldo</summary>
          <div className="flex flex-wrap items-end gap-space-xs">
            <button type="button" className={CLASE_BOTON} onClick={retomarBase} disabled={ocupado} title="Úsalo si las piezas ya están como en el tablero digital pero la cámara se confunde">
              Volver a tomar la foto base
            </button>
            <label className="flex flex-col gap-1">
              Tu jugada (Nf3 o g1f3)
              <input
                className="min-h-[44px] w-40 rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs font-mono-micro text-mono-micro"
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className={CLASE_BOTON}
              disabled={ocupado || !textoManual.trim()}
              onClick={async () => { if (await jugadaManual(textoManual.trim())) setTextoManual(''); }}
            >
              Terminé mi jugada
            </button>
          </div>
        </details>
      )}

      {editando && <EditorPosicion fenActual={estado.fen} alAplicar={corregirPosicion} alCerrar={() => setEditando(false)} ocupado={ocupado} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La pantalla con la partida real.
// ---------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Pantalla única de exposición: jugar contra el robot con todo a la vista (el tablero, lo que ve la cámara y cómo reconoce la jugada, el cerebro de Turing, su nivel y los relojes), y con todo lo que
 * puede salir mal resuelto acá mismo. Usa la partida física del backend; cada panel muestra datos reales de `/partida-fisica`, `/vision/flujo` y `/aprendizaje/inferencia`.
 */
export default function Exposicion() {
  const partida = usePartidaExposicion();
  const cerebro = useCerebroTuring(partida.estado);
  return <Pantalla {...partida} {...cerebro} />;
}
