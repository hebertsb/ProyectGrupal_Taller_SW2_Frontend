/**
 * Landing pública «Humano vs. IA» (diseño de Stitch en `lande page/`). Es lo primero que ve quien abre ChessIA sin sesión.
 *
 * - «Regístrate gratis» lleva a la pantalla de ingreso en modo registro; «Ingresar», en modo inicio de sesión.
 * - El formulario de inscripción al torneo no crea cuenta: arma el mensaje y abre WhatsApp con la organización.
 * - La escena 3D es una ilustración en bucle; no refleja el brazo real.
 * - Sin `alRegistrarse`/`alIngresar` (la versión estática publicada sola, ver `landing.html`) no hay botón de ingreso, «Regístrate» abre la
 *   plataforma (`URL_PLATAFORMA`) y no se muestran los enlaces a pantallas de la app (`#confianza`, `#politica`).
 * - Las cifras de Turing son las mismas que publica la ficha de Confianza (`/#confianza`); si cambian allá, se actualizan acá.
 */
import { useRef, useState } from 'react';
import EscenaBrazoAjedrez from './EscenaBrazoAjedrez';
import './Landing.css';

const WHATSAPP_ORGANIZACION = '59178576780';
const enlaceWa = (mensaje) => `https://wa.me/${WHATSAPP_ORGANIZACION}?text=${encodeURIComponent(mensaje)}`;
// Dónde se crea la cuenta (versión estática) y el grupo oficial de WhatsApp (los dos botones de WhatsApp de la página).
const URL_PLATAFORMA = 'https://home-lab.tail3b5ebb.ts.net/';
const WA_GRUPO = 'https://chat.whatsapp.com/F3FbfRMJ5kp3J3zHkbCEII?mode=gi_t';
const WA_INFO = WA_GRUPO;

// Fuerza medida de Turing v6 (Elo relativo a Stockfish calibrado, 120 partidas por medición; no es un Elo oficial).
const TURING = { version: 'v6', partidas: '35.000', eloPartidas: '2200+', coincidencia: '49 %', eloRed: 1355, eloBusqueda: 1808, rangoBusqueda: '1737–1878' };
const anchoElo = (elo) => `${Math.round(((elo - 1000) / 1000) * 100)}%`;

const CATEGORIAS = ['Abierta (Open)', 'Universitarios FICCT', 'Desafío Blitz vs Dobot CR5'];

const CHIP_POR_FASE = {
  pensando: { texto: 'TURING ESTÁ PENSANDO...', color: 'text-cyan-300 border-cyan-400/60', punto: 'bg-cyan-400 animate-pulse' },
  agarre: { texto: 'DH-ROBOTICS: AGARRE FIRME PEÓN e7', color: 'text-amber-300 border-amber-400/60', punto: 'bg-amber-400 animate-ping' },
  trayectoria: { texto: 'TRAYECTORIA CINEMÁTICA: e7 → e5', color: 'text-[#00E676] border-emerald-400/60', punto: 'bg-[#00E676] animate-pulse' },
  realizada: { texto: 'JUGADA REALIZADA: e7 → e5 ✓', color: 'text-[#00E676] border-emerald-400/80', punto: 'bg-[#00E676]' },
};

const PILARES = [
  { n: '01', titulo: 'APRENDE', texto: 'Mejora tus conocimientos con análisis de aperturas y asistencia táctica guiada.', verde: true },
  { n: '02', titulo: 'PRACTICA', texto: 'Juega contra la IA adaptativa con distintos niveles de dificultad y estilos de juego.' },
  { n: '03', titulo: 'MIDE TU NIVEL', texto: 'Descubre tus habilidades con métricas en tiempo real, precisión de jugada y rating ELO.' },
  { n: '04', titulo: 'COMPITE', texto: 'Participa en torneos oficiales y clasificaciones departamentales abiertas.', verde: true },
];

const FLUJO = [
  { titulo: 'JUGADOR', texto: 'Mueve en tablero físico o pantalla', etiqueta: 'INPUT', tono: 'neutro' },
  { titulo: 'CHESSIA', texto: 'Recibe la jugada en el servidor', etiqueta: 'SERVER', tono: 'cian' },
  { titulo: 'TURING IA', texto: 'Elige la respuesta con su red neuronal propia', etiqueta: 'NEURAL', tono: 'verde' },
  { titulo: 'DOBOT CR5', texto: 'Cinemática inversa y agarre de precisión', etiqueta: 'ROBOTIC', tono: 'cian' },
  { titulo: 'TABLERO REAL', texto: 'Movimiento físico de la pieza de ajedrez', etiqueta: 'EXECUTE', tono: 'final' },
];

const ENTIDADES = [
  { sigla: 'UAGRM FICCT', texto: 'Facultad de Computación', color: 'text-cyan-400' },
  { sigla: 'ADASC', texto: 'Ajedrez Santa Cruz', color: 'text-[#00E676]' },
  { sigla: 'SCZ GOB.', texto: 'Gobernación Auton.', color: 'text-amber-400' },
  { sigla: 'DICIT', texto: 'Ciencia y Tecnología', color: 'text-cyan-300' },
  { sigla: 'DEIS', texto: 'Extensión Social', color: 'text-emerald-300' },
  { sigla: 'VICERRECT.', texto: 'UAGRM Rectorado', color: 'text-blue-300' },
];

function Insignia({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono-label text-[9px] lg:text-[11px] font-bold tracking-widest uppercase ${className}`}>
      {children}
    </span>
  );
}

function TituloSeccion({ antetitulo, titulo, texto }) {
  return (
    <div className="text-center">
      {antetitulo && <div className="text-[9px] lg:text-[11px] font-mono-label text-cyan-300 font-bold uppercase tracking-widest">{antetitulo}</div>}
      {titulo && <h2 className="text-xl lg:text-3xl font-extrabold uppercase text-white font-mono-label tracking-tight mt-0.5">{titulo}</h2>}
      {texto && <p className="text-xs lg:text-sm text-slate-300 mt-1 max-w-md mx-auto leading-relaxed">{texto}</p>}
    </div>
  );
}

export default function Landing({ alRegistrarse: alRegistrarseApp = null, alIngresar = null }) {
  const enApp = alRegistrarseApp != null;
  const [fase, setFase] = useState('pensando');
  const [pedidoCamara, setPedidoCamara] = useState(0);
  const [pedidoJugada, setPedidoJugada] = useState(0);
  const [avisoVision, setAvisoVision] = useState(false);
  const inscripcionRef = useRef(null);
  const [inscripcion, setInscripcion] = useState({ nombre: '', telefono: '', categoria: CATEGORIAS[0], elo: '' });

  const irAInscripcion = () => inscripcionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const alRegistrarse = alRegistrarseApp ?? (() => window.open(URL_PLATAFORMA, '_blank', 'noopener,noreferrer'));
  const chip = CHIP_POR_FASE[fase];

  const enviarInscripcion = (evento) => {
    evento.preventDefault();
    const mensaje = [
      'Hola, quiero inscribirme al Torneo de Ajedrez Humano vs. IA.',
      `Nombre: ${inscripcion.nombre.trim()}`,
      `WhatsApp: ${inscripcion.telefono.trim()}`,
      `Categoría: ${inscripcion.categoria}`,
      inscripcion.elo.trim() && `Nivel / ELO: ${inscripcion.elo.trim()}`,
    ].filter(Boolean).join('\n');
    window.open(enlaceWa(mensaje), '_blank', 'noopener,noreferrer');
  };

  const actualizar = (campo) => (evento) => setInscripcion((previa) => ({ ...previa, [campo]: evento.target.value }));

  return (
    <div className="landing min-h-dvh text-slate-100 antialiased pb-28 lg:pb-0">
      {/* Cabecera con telemetría */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#060d17]/90 border-b border-cyan-500/25 px-3 lg:px-8 py-2 shadow-2xl">
        <div className="max-w-md lg:max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-white/5 text-[8.5px] lg:text-[10px] font-mono-label">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-[#00E676]" />
              <span className="text-cyan-300 font-bold tracking-wider">TURING {TURING.version.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-200">DOBOT CR5</span>
              <span className="text-slate-600">•</span>
              <span className="text-[#00E676] font-semibold">VISIÓN POR COMPUTADOR</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base lg:text-xl font-extrabold tracking-wider font-mono-label text-white">
                CHESS<span className="text-[#00E676]">IA</span>
              </span>
              <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[#00E676] text-[8px] lg:text-[10px] font-mono-label font-bold uppercase tracking-wider">
                AI + ROBOTICS LAB
              </span>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-3">
              <div className="flex items-center gap-1 bg-[#0b1523] border border-cyan-500/30 rounded-md px-2 py-1">
                <span className="text-[10px] font-black tracking-tight text-white font-mono-label">UAGRM</span>
                <span className="h-3 w-px bg-cyan-400/30" />
                <span className="text-[7.5px] font-bold text-cyan-300 uppercase font-mono-label">FICCT</span>
              </div>
              <div className="hidden sm:flex items-center gap-1 bg-[#0b1523] border border-emerald-500/40 rounded-md px-2 py-1">
                <span className="text-[9px] text-emerald-400 leading-none">♟</span>
                <span className="text-[9px] font-black text-emerald-300 tracking-wider font-mono-label">ADASC</span>
              </div>
              {alIngresar && (
                <button
                  type="button"
                  onClick={alIngresar}
                  className="lp-boton-secundario px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold uppercase tracking-wider font-mono-label"
                >
                  Ingresar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md lg:max-w-6xl mx-auto px-4 lg:px-8 pt-3 lg:pt-10 space-y-6 lg:space-y-16">
        {/* Hero + escena 3D */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center space-y-6 lg:space-y-0">
          <section className="text-center lg:text-left pt-2 space-y-3 lg:space-y-5">
            <Insignia className="bg-slate-900/90 border border-emerald-400/50 text-[#00E676] shadow-lg shadow-emerald-950/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-ping" />
              ROBÓTICA INDUSTRIAL &amp; AJEDREZ COGNITIVO
            </Insignia>
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold uppercase tracking-tight flex items-center justify-center lg:justify-start gap-2 lg:gap-4">
                <span className="text-white tracking-wide">HUMANO</span>
                <span className="text-base lg:text-2xl font-black text-cyan-400 italic">VS.</span>
                <span className="text-[#00E676] lp-neon-verde font-black">IA</span>
              </h1>
              <p className="text-xs sm:text-sm lg:text-lg font-bold tracking-wider text-cyan-300 uppercase font-mono-label">
                ¿TE ATREVES A JUGAR CONTRA UN ROBOT?
              </p>
            </div>
            <p className="text-xs lg:text-base text-slate-300 leading-relaxed max-w-sm lg:max-w-lg mx-auto lg:mx-0 px-1 lg:px-0">
              Enfréntate a un Dobot CR5 controlado por Inteligencia Artificial y juega una partida de ajedrez como nunca antes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 pt-1 lg:max-w-lg">
              <button type="button" onClick={alRegistrarse} className="lp-boton-primario w-full py-3 rounded-xl font-extrabold text-xs lg:text-sm uppercase tracking-wider font-mono-label">
                [ REGÍSTRATE GRATIS ]
              </button>
              <a href={WA_GRUPO} target="_blank" rel="noopener noreferrer" className="lp-boton-secundario w-full py-3 rounded-xl font-bold text-xs lg:text-sm uppercase tracking-wider text-center font-mono-label">
                💬 [ GRUPO DE WHATSAPP ]
              </a>
            </div>
          </section>

          <section className="space-y-2.5" aria-label="Demostración del brazo robótico">
            <div className="relative w-full rounded-2xl overflow-hidden lp-vidrio border border-emerald-500/35 shadow-2xl bg-gradient-to-b from-[#081322] via-[#050c18] to-black">
              <div className="lp-haz z-10 pointer-events-none" />
              <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
                <div
                  role="status"
                  aria-live="polite"
                  className={`px-2.5 py-1 rounded-md bg-black/85 backdrop-blur-md border text-[8.5px] lg:text-[10px] font-mono-label shadow-md flex items-center gap-1.5 transition-all duration-300 ${chip.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${chip.punto}`} />
                  <span className="font-bold">{chip.texto}</span>
                </div>
                <div className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-cyan-400/40 text-[8px] lg:text-[10px] font-mono-label text-cyan-300">
                  IK 6-AXIS
                </div>
              </div>
              <div className="absolute bottom-12 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none text-[8px] lg:text-[10px] font-mono-label">
                <div className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-cyan-400/30 text-cyan-200">
                  TURING: <strong className="text-[#00E676]">ELO ≈ {TURING.eloBusqueda}</strong>
                </div>
                <div className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-cyan-400/30 text-slate-300">
                  ANIMACIÓN ILUSTRATIVA
                </div>
              </div>
              <div className="w-full h-80 lg:h-[26rem]">
                <EscenaBrazoAjedrez alCambiarFase={setFase} pedidoCamara={pedidoCamara} pedidoJugada={pedidoJugada} />
              </div>
              {avisoVision && (
                <div className="absolute inset-x-2.5 bottom-14 z-30 px-3 py-2 rounded-lg bg-black/90 border border-cyan-400/50 text-[10px] lg:text-xs font-mono-label text-cyan-200 text-center">
                  Visión por computador: una cámara sobre el tablero reconoce las piezas y confirma cada jugada.
                </div>
              )}
              <div className="p-2 bg-black/90 backdrop-blur-md border-t border-cyan-500/30 flex items-center justify-between gap-1.5 text-[9.5px] lg:text-xs font-mono-label relative z-20">
                <button type="button" onClick={() => setPedidoCamara((n) => n + 1)} className="flex-1 py-1.5 px-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold transition active:scale-95">
                  🔄 Perspectiva 3D
                </button>
                <button type="button" onClick={() => setPedidoJugada((n) => n + 1)} className="flex-1 py-1.5 px-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-[#00E676] font-bold transition active:scale-95">
                  ⚡ Forzar jugada IA
                </button>
                <button
                  type="button"
                  aria-pressed={avisoVision}
                  onClick={() => setAvisoVision((v) => !v)}
                  className="flex-1 py-1.5 px-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600/40 text-slate-200 font-bold transition active:scale-95"
                >
                  👁️ Visión comp.
                </button>
              </div>
            </div>
            <div className="p-3.5 rounded-xl lp-vidrio border border-cyan-500/30 text-center space-y-1">
              <div className="text-[10px] lg:text-xs font-mono-label font-bold text-[#00E676] tracking-wider">
                BRAZO ROBÓTICO → TOMA LA PIEZA → LA MUEVE → REALIZA LA JUGADA
              </div>
              <p className="text-[11px] lg:text-sm text-slate-300 leading-relaxed">
                Una demostración en vivo de robótica colaborativa Dobot CR5 de 6 ejes con pinza DH-Robotics y visión por computador.
              </p>
            </div>
          </section>
        </div>

        {/* Conoce a Turing */}
        <section className="lp-vidrio p-4 lg:p-8 rounded-2xl border border-cyan-500/30 lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center space-y-3.5 lg:space-y-0">
          <div className="text-center lg:text-left">
            <Insignia className="bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 mb-1">🧠 COGNITIVE CHESS ENGINE</Insignia>
            <h2 className="text-xl lg:text-3xl font-extrabold uppercase text-white font-mono-label tracking-wider">CONOCE A TURING</h2>
            <p className="text-xs lg:text-base font-semibold text-emerald-400 font-mono-label">La Inteligencia Artificial detrás del tablero.</p>
            <p className="text-xs lg:text-sm text-slate-300 mt-1 leading-relaxed">
              Turing es el modelo propio de ChessIA: una red neuronal entrenada con partidas de maestros que propone jugadas, y una búsqueda de 3 jugadas que evita los errores tácticos.
            </p>
          </div>
          <dl className="p-3 lg:p-5 rounded-xl bg-black/60 border border-cyan-500/30 font-mono-label text-[10px] lg:text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <dt className="text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00E676]" /> MOTOR
              </dt>
              <dd className="text-[#00E676] font-bold text-right">RED NEURONAL PROPIA + BÚSQUEDA</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-400">ENTRENADO CON:</dt>
              <dd className="text-cyan-300 font-bold text-right">{TURING.partidas} PARTIDAS DE {TURING.eloPartidas}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-400">COINCIDE CON EL MAESTRO:</dt>
              <dd className="text-[#00E676] font-bold text-right">{TURING.coincidencia} DE LAS JUGADAS</dd>
            </div>
            <div className="pt-1 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between gap-2 text-[9px] lg:text-[11px]">
                  <dt className="text-slate-400">RED SOLA:</dt>
                  <dd className="text-cyan-300 font-bold">ELO ≈ {TURING.eloRed}</dd>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-cyan-400" style={{ width: anchoElo(TURING.eloRed) }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between gap-2 text-[9px] lg:text-[11px]">
                  <dt className="text-slate-400">RED + BÚSQUEDA:</dt>
                  <dd className="text-[#00E676] font-bold">ELO ≈ {TURING.eloBusqueda} ({TURING.rangoBusqueda})</dd>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-[#00E676]" style={{ width: anchoElo(TURING.eloBusqueda) }} />
                </div>
              </div>
            </div>
            <p className="text-[9px] lg:text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-white/10">
              Elo medido contra Stockfish calibrado (no oficial).
              {enApp && (
                <>
                  {' '}
                  <a href="#confianza" className="text-cyan-300 underline underline-offset-2">Cómo se midió</a>
                </>
              )}
            </p>
          </dl>
        </section>

        {/* Mucho más que un robot */}
        <section className="space-y-3.5 lg:space-y-6">
          <TituloSeccion titulo="MUCHO MÁS QUE UN ROBOT" texto="ChessIA es una plataforma integral de aprendizaje, práctica y competencia de ajedrez." />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
            {PILARES.map((pilar) => (
              <div key={pilar.n} className={`p-3.5 lg:p-5 rounded-2xl lp-vidrio border flex flex-col justify-between space-y-2 ${pilar.verde ? 'border-emerald-500/30' : 'border-cyan-500/30'}`}>
                <div className={`w-8 h-8 rounded-lg font-mono-label font-bold flex items-center justify-center text-xs border ${pilar.verde ? 'bg-emerald-500/20 text-[#00E676] border-emerald-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'}`}>
                  {pilar.n}
                </div>
                <div>
                  <h3 className={`text-xs lg:text-sm font-bold uppercase font-mono-label ${pilar.verde ? 'text-[#00E676]' : 'text-cyan-300'}`}>{pilar.titulo}</h3>
                  <p className="text-[11px] lg:text-sm text-slate-300 mt-1 leading-relaxed">{pilar.texto}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-1 lg:max-w-sm lg:mx-auto">
            <button type="button" onClick={alRegistrarse} className="lp-boton-primario block w-full py-3 rounded-xl font-extrabold text-xs lg:text-sm uppercase tracking-wider font-mono-label">
              [ REGÍSTRATE GRATIS ]
            </button>
          </div>
        </section>

        {/* Del digital al físico */}
        <section className="lp-vidrio p-4 lg:p-8 rounded-2xl border border-cyan-500/30 space-y-3.5 lg:space-y-6">
          <TituloSeccion antetitulo="ECOSISTEMA INTEGRADO" titulo="DEL DIGITAL AL FÍSICO" texto="Flujo tecnológico continuo de datos hacia el movimiento real." />
          <ol className="flex flex-col lg:flex-row lg:items-stretch gap-1.5 lg:gap-2">
            {FLUJO.map((paso, i) => {
              const borde = { neutro: 'border-slate-700/60 bg-black/60', cian: 'border-cyan-500/40 bg-black/60', verde: 'border-emerald-500/40 bg-black/60', final: 'border-emerald-400/50 bg-emerald-950/40' }[paso.tono];
              const numero = paso.tono === 'final' ? 'bg-emerald-500 text-black' : paso.tono === 'verde' ? 'bg-emerald-950 text-[#00E676]' : 'bg-cyan-950 text-cyan-300';
              const titulo = paso.tono === 'cian' && i === 1 ? 'text-cyan-300' : paso.tono === 'verde' ? 'text-[#00E676]' : 'text-white';
              return (
                <li key={paso.titulo} className="contents">
                  {i > 0 && (
                    <span aria-hidden="true" className={`text-center text-xs font-mono-label leading-none self-center ${i % 2 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      <span className="lg:hidden">↓</span>
                      <span className="hidden lg:inline">→</span>
                    </span>
                  )}
                  <div className={`p-2.5 lg:p-3 rounded-xl border flex lg:flex-col items-center lg:items-start justify-between gap-2 lg:flex-1 ${borde}`}>
                    <div className="flex lg:flex-col items-center lg:items-start gap-2.5 lg:gap-2">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono-label font-bold ${numero}`}>{i + 1}</span>
                      <div>
                        <div className={`text-xs font-bold font-mono-label ${titulo}`}>{paso.titulo}</div>
                        <div className="text-[10px] lg:text-[11px] text-slate-300">{paso.texto}</div>
                      </div>
                    </div>
                    <span className={`font-mono-label text-xs ${paso.tono === 'neutro' ? 'text-slate-500' : paso.tono === 'cian' ? 'text-cyan-300' : 'text-[#00E676]'}`}>{paso.etiqueta}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Torneo + inscripción */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 space-y-6 lg:space-y-0">
          <section className="space-y-3.5">
            <TituloSeccion titulo="JUEGA. COMPITE. SUPÉRATE." texto="Regístrate gratuitamente y sé parte de los torneos de ajedrez más innovadores de Bolivia." />
            <div className="lp-vidrio p-4 lg:p-6 rounded-2xl border-2 border-emerald-500/40 shadow-[0_0_25px_rgba(0,230,118,0.45)] space-y-3.5">
              <div className="flex items-center justify-between">
                <Insignia className="bg-emerald-500/20 text-[#00E676] border border-emerald-500/30 !px-2.5 !py-0.5">TORNEO OFICIAL • EXPO CIENCIA 2026</Insignia>
                <span className="text-xs" aria-hidden="true">🏆</span>
              </div>
              <div>
                <h3 className="text-base lg:text-xl font-extrabold uppercase text-white font-mono-label tracking-tight leading-tight">TORNEO DE AJEDREZ HUMANO VS. IA</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono-label">
                  <div className="p-2 rounded-lg bg-black/50 border border-white/10">
                    <span className="text-[8.5px] lg:text-[10px] text-slate-400 block uppercase">FECHA</span>
                    <span className="text-xs lg:text-sm font-bold text-[#00E676]">28 y 29 Oct 2026</span>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/10">
                    <span className="text-[8.5px] lg:text-[10px] text-slate-400 block uppercase">LUGAR</span>
                    <span className="text-xs lg:text-sm font-bold text-cyan-300">Paraninfo UAGRM</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] lg:text-[11px] uppercase font-mono-label font-bold text-slate-400">CATEGORÍAS:</span>
                <ul className="grid gap-1 text-[11px] lg:text-sm font-mono-label text-slate-200">
                  {CATEGORIAS.map((categoria, i) => (
                    <li key={categoria} className="flex items-center gap-1.5">
                      <span className={['text-[#00E676]', 'text-cyan-400', 'text-amber-400'][i]}>▪</span>
                      {categoria}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" onClick={irAInscripcion} className="lp-boton-primario block w-full py-2.5 rounded-xl font-extrabold text-xs lg:text-sm uppercase tracking-wider font-mono-label">
                [ PARTICIPAR ]
              </button>
            </div>
          </section>

          <section ref={inscripcionRef} className="scroll-mt-24 lp-vidrio p-5 lg:p-6 rounded-2xl border-2 border-[#00E676]/40 shadow-[0_0_25px_rgba(0,230,118,0.45)] space-y-4">
            <div className="text-center border-b border-white/10 pb-3">
              <span className="text-[9px] lg:text-[11px] font-mono-label uppercase tracking-widest text-cyan-300 font-bold">HUMANO VS. IA</span>
              <h2 className="text-xl lg:text-2xl font-extrabold uppercase text-white font-mono-label tracking-tight mt-0.5">¿LISTO PARA JUGAR?</h2>
              <p className="text-xs lg:text-sm text-slate-300">Inscríbete gratis al desafío: te confirmamos el horario por WhatsApp.</p>
            </div>
            <form className="space-y-3" onSubmit={enviarInscripcion}>
              <div>
                <label className="block text-[9px] lg:text-[11px] font-mono-label uppercase font-bold text-cyan-300 mb-1" htmlFor="lp-nombre">NOMBRE Y APELLIDO</label>
                <input id="lp-nombre" className="lp-campo" placeholder="Ej: Carlos Suárez" required autoComplete="name" value={inscripcion.nombre} onChange={actualizar('nombre')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] lg:text-[11px] font-mono-label uppercase font-bold text-cyan-300 mb-1" htmlFor="lp-telefono">WHATSAPP</label>
                  <input id="lp-telefono" type="tel" inputMode="tel" className="lp-campo" placeholder="Ej: 71234567" required autoComplete="tel" value={inscripcion.telefono} onChange={actualizar('telefono')} />
                </div>
                <div>
                  <label className="block text-[9px] lg:text-[11px] font-mono-label uppercase font-bold text-cyan-300 mb-1" htmlFor="lp-categoria">CATEGORÍA</label>
                  <select id="lp-categoria" className="lp-campo !px-2" value={inscripcion.categoria} onChange={actualizar('categoria')}>
                    {CATEGORIAS.map((categoria) => <option key={categoria}>{categoria}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] lg:text-[11px] font-mono-label uppercase font-bold text-cyan-300 mb-1" htmlFor="lp-elo">NIVEL ELO / EXPERIENCIA</label>
                <input id="lp-elo" className="lp-campo" placeholder="Ej: 1650 FIDE o Aficionado" value={inscripcion.elo} onChange={actualizar('elo')} />
              </div>
              <button type="submit" className="lp-boton-primario w-full py-3 rounded-xl font-extrabold text-xs lg:text-sm uppercase tracking-wider font-mono-label">
                [ INSCRIBIRME POR WHATSAPP ]
              </button>
            </form>
            <div className="pt-2 text-center space-y-2">
              <a href={WA_GRUPO} target="_blank" rel="noopener noreferrer" className="lp-boton-secundario block w-full py-2.5 px-3 rounded-xl font-bold text-xs lg:text-sm uppercase tracking-wider font-mono-label">
                💬 [ ÚNETE AL GRUPO DE WHATSAPP ]
              </a>
              {enApp && (
                <p className="text-[10px] lg:text-xs text-slate-400 font-mono-label">
                  ¿Quieres jugar en la plataforma?{' '}
                  <button type="button" onClick={alRegistrarse} className="text-[#00E676] underline underline-offset-2 font-bold">Crea tu cuenta</button>
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Respaldo institucional */}
        <section className="space-y-3 lg:space-y-5">
          <TituloSeccion antetitulo="INGENIERÍA & INNOVACIÓN CRUCEÑA" texto="Tecnología, Inteligencia Artificial y ajedrez desarrollados desde Santa Cruz." />
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="lp-vidrio p-3.5 lg:p-5 rounded-xl border-l-4 !border-l-[#00E676]">
              <div className="text-[9px] lg:text-[11px] font-mono-label text-[#00E676] uppercase font-bold tracking-wider mb-0.5">TALENTO UNIVERSITARIO</div>
              <p className="text-xs lg:text-sm text-slate-200 leading-relaxed">
                Desarrollado por estudiantes e investigadores de Ingeniería Informática de la <strong className="text-white font-semibold">UAGRM – FICCT</strong>.
              </p>
            </div>
            <div className="lp-vidrio p-3.5 lg:p-5 rounded-xl border-l-4 !border-l-[#00D2FF] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-lg text-emerald-400 shrink-0" aria-hidden="true">♟</div>
              <p className="text-xs lg:text-sm text-slate-200 leading-relaxed">
                Con el respaldo oficial de la <strong className="text-emerald-400 font-semibold">Asociación Departamental de Ajedrez de Santa Cruz (ADASC)</strong>.
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-center pt-1 font-mono-label text-[8px] lg:text-[10px]">
            {ENTIDADES.map((entidad) => (
              <li key={entidad.sigla} className="p-2 rounded-lg bg-black/40 border border-white/10">
                <div className={`font-bold text-[10px] lg:text-xs ${entidad.color}`}>{entidad.sigla}</div>
                <span className="text-slate-400 block mt-0.5">{entidad.texto}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pt-2 pb-4 lg:pb-8 text-center text-[8.5px] lg:text-[11px] font-mono-label text-slate-400 space-y-1">
          <div>© 2026 CHESSIA LAB • ADASC • UAGRM FICCT • 1ª Expo Ciencia Emprende Santa Cruz.</div>
          {enApp && (
            <div className="space-x-3">
              <a href="#politica" className="underline underline-offset-2 hover:text-slate-200">Términos y privacidad</a>
              <a href="#confianza" className="underline underline-offset-2 hover:text-slate-200">Confianza</a>
            </div>
          )}
        </footer>
      </main>

      {/* Barra fija inferior (solo móvil) */}
      <aside className="lg:hidden fixed bottom-0 inset-x-0 z-50 lp-vidrio border-t border-cyan-500/30 p-2.5 backdrop-blur-xl !bg-[#060d17]/95">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="leading-tight min-w-0">
            <div className="text-[8.5px] font-bold uppercase text-slate-400 font-mono-label">LUGAR</div>
            <div className="text-[11px] font-extrabold text-cyan-300 font-mono-label truncate">Paraninfo UAGRM</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={WA_INFO} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap px-2.5 py-2 rounded-xl bg-slate-800/90 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold active:scale-95 transition font-mono-label">
              💬 WhatsApp
            </a>
            <button type="button" onClick={alRegistrarse} className="lp-boton-primario whitespace-nowrap px-3 py-2 rounded-xl font-extrabold text-[11px] uppercase tracking-wide font-mono-label">
              REGÍSTRATE GRATIS
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
