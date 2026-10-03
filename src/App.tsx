/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, Suspense, lazy } from 'react';
import SalaControl from './paginas/SalaControl/SalaControl';
import RazonamientoNeuronal from './paginas/RazonamientoNeuronal/RazonamientoNeuronal';
import Administracion from './paginas/Administracion/Administracion';
import RegistroPartidas from './paginas/RegistroPartidas/RegistroPartidas';
import Aprendizaje from './paginas/Aprendizaje/Aprendizaje';
import PanelAprendizaje from './paginas/PanelAprendizaje/PanelAprendizaje';
import Onboarding from './paginas/Onboarding/Onboarding';
import DemostracionEnVivo from './paginas/DemostracionEnVivo/DemostracionEnVivo';
import Monitoreo from './paginas/Monitoreo/Monitoreo';
import ConfiguracionEnsenanza from './paginas/ConfiguracionEnsenanza/ConfiguracionEnsenanza';
import EntrenamientoModelo from './paginas/EntrenamientoModelo/EntrenamientoModelo';
import Perfil from './paginas/Perfil/Perfil';
import Login from './paginas/Login/Login';
import AccesoRestringido from './componentes/AccesoRestringido';
import { backendEnLinea, obtenerDemostracionActiva, obtenerEstadoEntrenamiento, obtenerPerfil } from './api/backend';
import { ProveedorRazonamiento } from './contexto/ContextoRazonamiento';

const GestionUsuarios = lazy(() => import('./paginas/Administracion/GestionUsuarios.jsx'));

// Mismo intervalo que ya usaba el sondeo local de RegistroPartidas.jsx — acá se sondea a nivel
// global (cualquier pantalla), así que ese sondeo local queda redundante pero no molesta.
const INTERVALO_SONDEO_DEMOSTRACION_MS = 8000;

function obtenerUsuarioGuardado() {
  try {
    const stored = localStorage.getItem('usuario');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [pantallaActiva, setPantallaActiva] = useState('control');
  // En pantallas angostas (menos de lg) la barra lateral arranca cerrada: si no, tapa el contenido.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches,
  );
  // En pantallas angostas, elegir una opción del menú cierra la barra para ver la pantalla.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setIsSidebarOpen(false);
  }, [pantallaActiva]);
  const [backendConectado, setBackendConectado] = useState<boolean | null>(null);
  // Partida activa de Sala de Control — vive acá (no en el estado local de <SalaControl>)
  // para que sobreviva al desmontaje cuando se cambia de pantalla. Nunca se limpia sola:
  // <SalaControl> la actualiza cada vez que crea/carga una partida (ver `onPartidaActivaChange`),
  // así que al volver a montarse recupera la MISMA partida en vez de arrancar una nueva.
  const [partidaActivaId, setPartidaActivaId] = useState<string | null>(null);
  const [partidaParaAprender, setPartidaParaAprender] = useState<string | null>(null);
  const [seccionPanelAprendizaje, setSeccionPanelAprendizaje] = useState<string | null>(null);
  // Partida que el jugador abrió desde el banner "tu facilitador está
  // transmitiendo" — ver Registro de Partidas y DemostracionEnVivo.
  const [partidaDemostracionId, setPartidaDemostracionId] = useState<string | null>(null);
  const [usuario, setUsuario] = useState(() => obtenerUsuarioGuardado());
  // Estado de "datos para entrenar a Turing" (HU4) — solo tiene sentido para el facilitador.
  // Se sondea acá (una vez al iniciar sesión y después cada 60 s) para poder mostrar la insignia
  // del menú aunque la pantalla de Entrenamiento del modelo nunca se haya abierto; esa pantalla
  // reusa este mismo estado para no repetir la consulta apenas se abre.
  const [estadoEntrenamiento, setEstadoEntrenamiento] = useState<any>(null);
  // Transmisión en vivo del facilitador, sondeada en cualquier pantalla (no solo Registro de
  // Partidas) para que un jugador se entere aunque esté jugando su propia partida en Sala de
  // Control. `null` si no hay ninguna activa. Se descarta apenas se cierra sesión o el rol pasa a
  // facilitador (a él nunca le corresponde este aviso). Un id de demostración "cerrado" a mano por
  // el jugador (botón "×" del banner) no vuelve a mostrarse solo — hasta que cambie a otra distinta.
  const [demostracionActiva, setDemostracionActiva] = useState<any>(null);
  const [bannerDemoDescartadoId, setBannerDemoDescartadoId] = useState<string | null>(null);

  // Limpiar partidas activas en memoria al cambiar de cuenta para que cada usuario tenga su propio tablero independiente
  useEffect(() => {
    setPartidaActivaId(null);
    setPartidaParaAprender(null);
    setPartidaDemostracionId(null);
    setSeccionPanelAprendizaje(null);
  }, [usuario?.id]);

  const manejarLogin = (usuarioData) => {
    setUsuario(usuarioData);
    setPartidaActivaId(null);
    setPartidaParaAprender(null);
    setPartidaDemostracionId(null);
    setSeccionPanelAprendizaje(null);
    // Todos entran a la Sala de Control; el facilitador llega a Gestión de Usuarios desde el menú.
    setPantallaActiva('control');
  };

  const manejarActualizarUsuario = (usuarioActualizado) => {
    setUsuario(usuarioActualizado);
    try {
      localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
    } catch {
      // localStorage puede fallar (modo privado, cuota, etc.) — no es crítico,
      // el estado en memoria ya se actualizó.
    }
  };

  // Relee el perfil del servidor y lo mezcla con el usuario guardado. El `usuario`
  // de localStorage se fija al loguear y nunca se actualizaba solo, por eso un
  // nivel recalibrado no llegaba a la Sala de Control. Silenciosa a propósito:
  // si el backend no responde (o todavía no expone los campos nuevos) la UI
  // sigue con lo que ya tenía. Devuelve el usuario ya mezclado, o null si no se pudo actualizar.
  const usuarioRef = useRef(usuario);
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  async function refrescarUsuario() {
    try {
      const perfil = await obtenerPerfil();
      const actual = usuarioRef.current;
      // Si mientras tanto se cerró la sesión o cambió la cuenta, no se reescribe nada.
      if (!perfil || typeof perfil !== 'object' || !actual) return null;
      if (perfil.id != null && actual.id != null && perfil.id !== actual.id) return null;
      const combinado = { ...actual, ...perfil };
      usuarioRef.current = combinado;
      manejarActualizarUsuario(combinado);
      return combinado;
    } catch {
      return null;
    }
  }

  const manejarLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
    setPartidaActivaId(null);
    setPartidaParaAprender(null);
    setPartidaDemostracionId(null);
    setSeccionPanelAprendizaje(null);
    setUsuario(null);
    setPantallaActiva('control');
  };

  const esFacilitador = usuario?.rol === 'facilitador';

  function irASalaControl(partidaId?: string) {
    // Sin id explícito (ej. click genérico en "Sala de Control" del nav) simplemente
    // se muestra la pantalla — no se toca `partidaActivaId`, para no perder la partida
    // en curso. Con id explícito (ej. desde Registro de Partidas) sí se fuerza esa carga.
    if (partidaId) setPartidaActivaId(partidaId);
    setPantallaActiva('control');
  }

  function irAAprendizaje(partidaId?: string) {
    setPartidaParaAprender(partidaId ?? null);
    setPantallaActiva('aprendizaje');
  }

  function irAPanelAprendizaje(seccion: string = 'turing') {
    setSeccionPanelAprendizaje(seccion);
    setPantallaActiva('panelAprendizaje');
  }

  function irADemostracion(partidaId?: string) {
    setPartidaDemostracionId(partidaId ?? null);
    setPantallaActiva('demostracion');
  }

  useEffect(() => {
    const verificar = () => backendEnLinea().then(setBackendConectado);
    verificar();
    const intervalo = setInterval(verificar, 5000);
    return () => clearInterval(intervalo);
  }, []);

  // Estado de "datos para entrenar a Turing" — solo para facilitadores, silencioso ante errores (es
  // apenas la insignia del menú). Se sondea al iniciar sesión y cada 60 s; se limpia al cerrar sesión
  // o dejar de ser facilitador. La pantalla de Entrenamiento del modelo reusa este mismo estado.
  useEffect(() => {
    if (!esFacilitador || usuario?.id == null) {
      setEstadoEntrenamiento(null);
      return;
    }
    let cancelado = false;
    const sondear = () => {
      obtenerEstadoEntrenamiento()
        .then((datos) => {
          if (!cancelado) setEstadoEntrenamiento(datos);
        })
        .catch(() => {
          // Silencioso a propósito: esto solo alimenta una insignia informativa del menú.
        });
    };
    sondear();
    const intervalo = setInterval(sondear, 60000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [esFacilitador, usuario?.id]);

  // Transmisión en vivo del facilitador — sondeo GLOBAL (no solo en Registro de Partidas) para que
  // un jugador se entere aunque esté en otra pantalla, por ejemplo jugando su propia partida en
  // Sala de Control. Solo para jugadores; silencioso ante errores (mismo criterio que arriba).
  useEffect(() => {
    if (esFacilitador || usuario?.id == null) {
      setDemostracionActiva(null);
      return;
    }
    let cancelado = false;
    const sondear = () => {
      obtenerDemostracionActiva()
        .then((datos) => {
          if (!cancelado) setDemostracionActiva(datos);
        })
        .catch(() => {
          // Silencioso a propósito: no hay nada que el jugador deba hacer si esto falla.
        });
    };
    sondear();
    const intervalo = setInterval(sondear, INTERVALO_SONDEO_DEMOSTRACION_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [esFacilitador, usuario?.id]);

  // Si aparece una demostración nueva (id distinto de la que el jugador ya cerró a mano), el banner
  // vuelve a mostrarse — cerrar el aviso de UNA transmisión no debe silenciar la siguiente.
  useEffect(() => {
    if (demostracionActiva?.id == null) setBannerDemoDescartadoId(null);
  }, [demostracionActiva?.id]);

  // Al entrar a la Sala de Control o al Panel de Aprendizaje se relee el perfil, para que el nivel precargado
  // (y el estado del diagnóstico) sea el vigente y no el de cuando se inició sesión.
  // Una vez por entrada: solo depende de la pantalla y de la cuenta.
  useEffect(() => {
    if ((pantallaActiva === 'control' || pantallaActiva === 'panelAprendizaje') && usuario?.id != null) {
      refrescarUsuario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantallaActiva, usuario?.id]);

  // Verificar token al cargar
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && !usuario) {
      // Token existe pero no hay usuario en estado - podría ser token expirado
      // El backend responderá 401 en las llamadas y la UI lo manejará
    }
  }, [usuario]);

  const navClasses = (path: string) => 
    pantallaActiva === path
      ? "boton-nav flex items-center gap-space-sm px-space-sm py-space-xs transition-colors bg-surface-container-high text-primary font-medium rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)] w-full text-left"
      : "boton-nav flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm w-full text-left";

  const headerNavClasses = (path: string) =>
    pantallaActiva === path
      ? "px-space-sm py-space-2xs transition-colors font-body-sm uppercase tracking-wide bg-surface-container-high text-primary rounded-lg"
      : "px-space-sm py-space-2xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg transition-colors font-body-sm text-body-sm uppercase tracking-wide";

  // Si no hay usuario, mostrar login
  if (!usuario) {
    return (
      <ProveedorRazonamiento>
        <Login onLoginSuccess={manejarLogin} />
      </ProveedorRazonamiento>
    );
  }

  return (
    <ProveedorRazonamiento>
    <div className="bg-surface-container-lowest font-body-lg text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-dvh">
      {/* Tutorial de reglas básicas (HU12): solo para jugadores, una vez por usuario en este navegador. */}
      {!esFacilitador && (
        <Onboarding
          usuario={usuario}
          alVerPiezas={() => {
            setPantallaActiva('panelAprendizaje');
            setSeccionPanelAprendizaje('piezas');
          }}
        />
      )}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
        />
      )}
      <aside className={`barra-lateral fixed left-0 top-0 h-dvh overflow-hidden w-64 bg-surface-container-low/80 backdrop-blur-xl z-50 flex flex-col justify-between py-space-lg px-space-md transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col gap-space-lg min-h-0 flex-1">
          <div className="flex items-center justify-between gap-space-xs px-space-xs">
            <div className="flex items-center gap-space-xs">
              <div className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.6)]"></div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface uppercase">Ajedrez Robótico</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="flex flex-col gap-space-2xs min-h-0 flex-1">
            <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant px-space-xs">Subsystems</span>
            <nav className="flex flex-col gap-space-2xs min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <button onClick={() => setPantallaActiva('control')} className={navClasses('control')}>
                <span className="material-symbols-outlined text-[18px]">sports_esports</span>Sala de Control
              </button>
              {!esFacilitador && (
                <button onClick={() => setPantallaActiva('panelAprendizaje')} className={navClasses('panelAprendizaje')}>
                  <span className="material-symbols-outlined text-[18px]">auto_stories</span>Panel de Aprendizaje
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('neuronal')} className={navClasses('neuronal')}>
                  <span className="material-symbols-outlined text-[18px]">neurology</span>Razonamiento Neuronal
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('monitoreo')} className={navClasses('monitoreo')}>
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>Monitoreo
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('admin')} className={navClasses('admin')}>
                  <span className="material-symbols-outlined text-[18px]">tune</span>Administración
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('usuarios')} className={navClasses('usuarios')}>
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>Gestión de Usuarios
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('ensenanza')} className={navClasses('ensenanza')}>
                  <span className="material-symbols-outlined text-[18px]">video_settings</span>Configuración de Enseñanza
                </button>
              )}
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('entrenamiento')} className={navClasses('entrenamiento')}>
                  <span className="material-symbols-outlined text-[18px]">database</span>Entrenamiento del modelo
                  {estadoEntrenamiento?.listo_para_entrenar && (
                    <>
                      <span className="relative flex h-2 w-2 shrink-0 ml-auto" aria-hidden="true">
                        <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span className="sr-only">, datos listos</span>
                    </>
                  )}
                </button>
              )}
              <button onClick={() => setPantallaActiva('perfil')} className={navClasses('perfil')}>
                <span className="material-symbols-outlined text-[18px]">account_circle</span>Mi Perfil
              </button>
              <div className="pl-space-md flex flex-col gap-space-2xs border-l border-outline-variant/20 ml-space-sm mt-space-2xs">
                <button onClick={() => setPantallaActiva('registro')} className={navClasses('registro')}>
                  <span className="material-symbols-outlined text-[16px]">history_edu</span>Registro de Partidas
                </button>
                <button onClick={() => irAAprendizaje()} className={navClasses('aprendizaje')}>
                  <span className="material-symbols-outlined text-[16px]">troubleshoot</span>Análisis Jugada a Jugada
                </button>
              </div>
            </nav>
          </div>
        </div>
        <div className="flex flex-col gap-space-sm px-space-xs shrink-0">
          <div className="p-space-sm rounded-lg bg-surface-container-lowest/60 flex flex-col gap-space-2xs">
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Backend</span>
              <span className={`font-mono-micro text-mono-micro ${backendConectado ? 'text-primary-fixed-dim' : 'text-error'}`}>
                {backendConectado === null ? 'VERIFICANDO' : backendConectado ? 'CONECTADO' : 'SIN CONEXIÓN'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Brazo robótico</span>
              <span className="font-mono-micro text-mono-micro text-outline">SOLO SIMULADO</span>
            </div>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-lowest/60 flex items-center gap-space-sm">
            <button
              onClick={() => setPantallaActiva('perfil')}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              type="button"
              title="Ver mi perfil"
            >
              {usuario.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="material-symbols-outlined text-on-primary text-[18px]">
                  {esFacilitador ? 'admin_panel_settings' : 'person'}
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{usuario.nombre}</span>
              <span className={`font-mono-micro text-mono-micro ${esFacilitador ? 'text-tertiary' : 'text-secondary'}`}>
                {esFacilitador ? 'Facilitador' : 'Jugador'}
              </span>
            </div>
            <button
              onClick={manejarLogout}
              className="p-space-xs rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"
              type="button"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:pl-64' : 'pl-0'}`}>
        <header className={`fixed top-0 right-0 h-16 bg-surface-container-low/70 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-all duration-300 ${isSidebarOpen ? 'left-0 lg:left-64' : 'left-0'}`}>
          <div className="h-16 w-full px-space-lg flex items-center justify-between">
            <div className="flex items-center gap-space-xl">
              <div className="flex items-center gap-space-xs">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="mr-2 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
                </button>
                <span className="font-mono-metric text-mono-metric tracking-tight text-on-surface font-medium">AJEDREZ</span>
                <span className="font-mono-label text-mono-label text-outline">//</span>
                <span className="font-mono-label text-mono-label text-on-surface-variant hidden sm:inline">BRAZO ROBÓTICO</span>
              </div>
              {/* Menú superior solo en pantalla ancha. La barra lateral ocupa 256px: con ella abierta
                  se necesita más ancho para que el menú no se encime con el estado y E-STOP. */}
              <nav className={`${isSidebarOpen ? 'hidden min-[2200px]:flex' : 'hidden min-[1920px]:flex'} items-center gap-space-xs`}>
                <button onClick={() => setPantallaActiva('control')} className={headerNavClasses('control')}>SALA DE CONTROL</button>
                {!esFacilitador && (
                  <button onClick={() => setPantallaActiva('panelAprendizaje')} className={headerNavClasses('panelAprendizaje')}>PANEL DE APRENDIZAJE</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('neuronal')} className={headerNavClasses('neuronal')}>RAZONAMIENTO NEURONAL</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('monitoreo')} className={headerNavClasses('monitoreo')}>MONITOREO</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('admin')} className={headerNavClasses('admin')}>ADMINISTRACIÓN</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('usuarios')} className={headerNavClasses('usuarios')}>GESTIÓN USUARIOS</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('ensenanza')} className={headerNavClasses('ensenanza')}>ENSEÑANZA</button>
                )}
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('entrenamiento')} className={`${headerNavClasses('entrenamiento')} relative`}>
                    ENTRENAMIENTO
                    {estadoEntrenamiento?.listo_para_entrenar && (
                      <>
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2" aria-hidden="true">
                          <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="sr-only">, datos listos</span>
                      </>
                    )}
                  </button>
                )}
                <button onClick={() => setPantallaActiva('perfil')} className={headerNavClasses('perfil')}>MI PERFIL</button>
              </nav>
            </div>
            <div className="flex items-center gap-space-md">
              <div className="hidden md:flex items-center gap-space-sm px-space-sm py-space-2xs rounded-lg bg-surface-container">
                <div className="flex items-center gap-space-2xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${backendConectado ? 'bg-primary shadow-[0_0_6px_rgba(0,229,255,0.8)]' : 'bg-error'}`}></div>
                  <span className={`font-mono-micro text-mono-micro uppercase font-medium ${backendConectado ? 'text-primary' : 'text-error'}`}>
                    {backendConectado === null ? 'VERIFICANDO BACKEND' : backendConectado ? 'BACKEND CONECTADO' : 'BACKEND SIN CONEXIÓN'}
                  </span>
                </div>
              </div>
              {esFacilitador && (
                <button
                  disabled
                  title="No disponible — el brazo físico todavía no está conectado (ver CLAUDE.md)"
                  className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-outline cursor-not-allowed font-mono-micro text-mono-micro font-medium tracking-wider uppercase"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">emergency</span><span className="hidden sm:inline">E-STOP</span>
                </button>
              )}
              <button
                onClick={() => setPantallaActiva('perfil')}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                type="button"
                title="Ver mi perfil"
              >
                {usuario.avatar_url ? (
                  <img
                    src={usuario.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-primary text-[18px]">
                    {esFacilitador ? 'admin_panel_settings' : 'person'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="w-full pt-16 bg-surface-container-lowest min-h-screen">
          {/* Banner global de transmisión en vivo — a propósito NO es un toast: se queda mientras
              la transmisión siga activa y el jugador no la esté viendo, en CUALQUIER pantalla (no
              solo Registro de Partidas). Nunca se le muestra al facilitador. */}
          {!esFacilitador && pantallaActiva !== 'demostracion' && demostracionActiva?.id && demostracionActiva.id !== bannerDemoDescartadoId && (
            <div
              role="status"
              className="w-full px-space-lg py-space-sm bg-primary/10 border-b border-primary/30 flex items-center justify-between gap-space-sm flex-wrap"
            >
              <div className="flex items-center gap-space-sm">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
                <span className="font-body-sm text-body-sm text-on-surface">
                  Tu facilitador está transmitiendo una partida en vivo
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <button
                  type="button"
                  onClick={() => irADemostracion(demostracionActiva.id)}
                  className="px-space-md py-space-2xs rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:brightness-110 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Ver transmisión
                </button>
                <button
                  type="button"
                  onClick={() => setBannerDemoDescartadoId(demostracionActiva.id)}
                  aria-label="Cerrar aviso de transmisión en vivo"
                  className="text-on-surface-variant hover:text-on-surface rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )}
          {pantallaActiva === 'control' && (
            <SalaControl
              key={`sala-control-${usuario?.id ?? 'anon'}`}
              partidaIdInicial={partidaActivaId}
              onPartidaActivaChange={setPartidaActivaId}
              esFacilitador={esFacilitador}
              usuarioIdPropio={usuario?.id ?? null}
              usuario={usuario}
              alActualizarUsuario={refrescarUsuario}
              alIrAMiNivel={esFacilitador ? null : () => irAPanelAprendizaje('nivel')}
              alIrAAprendizaje={(id?: string) => {
                if (esFacilitador) {
                  irAAprendizaje(id);
                } else {
                  setPantallaActiva('panelAprendizaje');
                }
              }}
              demostracionActiva={demostracionActiva}
              alVerDemostracion={irADemostracion}
            />
          )}
          {pantallaActiva === 'neuronal' && (
            esFacilitador ? (
              <RazonamientoNeuronal />
            ) : (
              <AccesoRestringido
                icono="smartphone"
                colorIcono="text-primary"
                titulo="Esta vista es para tu facilitador"
                mensaje="El Razonamiento Neuronal es un panel de diagnóstico para tu facilitador. Para jugar y aprender desde tu celular, usá la app móvil."
                textoBoton="Ir a Registro de Partidas"
                alClickBoton={() => setPantallaActiva('registro')}
              />
            )
          )}
          {pantallaActiva === 'monitoreo' && (
            esFacilitador ? (
              <Monitoreo />
            ) : (
              <AccesoRestringido
                icono="smartphone"
                colorIcono="text-primary"
                titulo="Esta vista es para tu facilitador"
                mensaje="El Monitoreo de partidas es un panel de supervisión para tu facilitador. Para jugar y aprender desde tu celular, usá la app móvil."
                textoBoton="Ir a Registro de Partidas"
                alClickBoton={() => setPantallaActiva('registro')}
              />
            )
          )}
          {pantallaActiva === 'ensenanza' && (
            esFacilitador ? (
              <ConfiguracionEnsenanza usuario={usuario} alActualizarUsuario={manejarActualizarUsuario} />
            ) : (
              <AccesoRestringido
                icono="smartphone"
                colorIcono="text-primary"
                titulo="Esta vista es para tu facilitador"
                mensaje="La Configuración de Enseñanza es un panel para tu facilitador. Para jugar y aprender desde tu celular, usá la app móvil."
                textoBoton="Ir a Registro de Partidas"
                alClickBoton={() => setPantallaActiva('registro')}
              />
            )
          )}
          {pantallaActiva === 'entrenamiento' && (
            esFacilitador ? (
              <EntrenamientoModelo
                estadoCompartido={estadoEntrenamiento}
                alActualizarEstadoCompartido={setEstadoEntrenamiento}
              />
            ) : (
              <AccesoRestringido
                icono="smartphone"
                colorIcono="text-primary"
                titulo="Esta vista es para tu facilitador"
                mensaje="El Entrenamiento del modelo es un panel para tu facilitador. Para jugar y aprender desde tu celular, usá la app móvil."
                textoBoton="Ir a Registro de Partidas"
                alClickBoton={() => setPantallaActiva('registro')}
              />
            )
          )}
          {pantallaActiva === 'panelAprendizaje' && (
            esFacilitador ? (
              <AccesoRestringido
                icono="school"
                colorIcono="text-secondary"
                titulo="Este panel es para el jugador"
                mensaje="El Panel de Aprendizaje es la vista de tutoría personal de cada jugador. Como facilitador, podés ver el progreso desde Gestión de Usuarios."
                textoBoton="Ir a Gestión de Usuarios"
                alClickBoton={() => setPantallaActiva('usuarios')}
              />
            ) : (
              <PanelAprendizaje
                usuario={usuario}
                seccionInicial={seccionPanelAprendizaje}
                onSeccionConsumida={() => setSeccionPanelAprendizaje(null)}
                alIrASalaControl={() => irASalaControl()}
              />
            )
          )}
          {pantallaActiva === 'admin' && (
            esFacilitador ? (
              <Administracion />
            ) : (
              <AccesoRestringido
                icono="smartphone"
                colorIcono="text-primary"
                titulo="Esta vista es para tu facilitador"
                mensaje="Administración es la consola de telemetría del brazo y de todas las sesiones — es un panel para tu facilitador. Para jugar y aprender desde tu celular, usá la app móvil."
                textoBoton="Ir a Registro de Partidas"
                alClickBoton={() => setPantallaActiva('registro')}
              />
            )
          )}
          {pantallaActiva === 'perfil' && (
            <Perfil usuario={usuario} alActualizarUsuario={manejarActualizarUsuario} />
          )}
          {pantallaActiva === 'usuarios' && esFacilitador && (
            <Suspense fallback={
              <div className="w-full px-space-lg py-space-lg flex flex-col items-center justify-center min-h-[40vh]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando gestión de usuarios...</span>
              </div>
            }>
              <GestionUsuarios />
            </Suspense>
          )}
          {pantallaActiva === 'registro' && (
            <RegistroPartidas
              alIrASalaControl={irASalaControl}
              alIrARazonamiento={() => setPantallaActiva('neuronal')}
              alIrAAprendizaje={irAAprendizaje}
              alIrAPanelAprendizaje={() => irAPanelAprendizaje('turing')}
              alVerDemostracion={irADemostracion}
              esFacilitador={esFacilitador}
              usuario={usuario}
            />
          )}
          {pantallaActiva === 'aprendizaje' && (
            <Aprendizaje
              partidaIdInicial={partidaParaAprender}
              alCargarPartida={() => setPartidaParaAprender(null)}
              alIrASalaControl={() => irASalaControl()}
              usuario={usuario}
              esFacilitador={esFacilitador}
            />
          )}
          {pantallaActiva === 'demostracion' && (
            <DemostracionEnVivo
              partidaId={partidaDemostracionId}
              alVolver={() => setPantallaActiva('registro')}
            />
          )}
          {pantallaActiva === 'usuarios' && !esFacilitador && (
            <div className="w-full px-space-lg py-space-lg flex flex-col items-center justify-center min-h-[40vh] text-center">
              <span className="material-symbols-outlined text-[48px] text-error mb-2">lock</span>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Acceso denegado</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Solo los facilitadores pueden acceder a la gestión de usuarios.
              </p>
              <button
                onClick={() => setPantallaActiva('control')}
                className="mt-4 px-space-lg py-space-md bg-primary text-on-primary rounded-xl font-body-sm text-body-sm"
              >
                Ir a Sala de Control
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
    </ProveedorRazonamiento>
  );
}