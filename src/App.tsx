/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, Suspense, lazy } from 'react';
import SalaControl from './paginas/SalaControl/SalaControl';
import RazonamientoNeuronal from './paginas/RazonamientoNeuronal/RazonamientoNeuronal';
import Administracion from './paginas/Administracion/Administracion';
import RegistroPartidas from './paginas/RegistroPartidas/RegistroPartidas';
import Aprendizaje from './paginas/Aprendizaje/Aprendizaje';
import Login from './paginas/Login/Login';
import { backendEnLinea } from './api/backend';
import { ProveedorRazonamiento } from './contexto/ContextoRazonamiento';

const GestionUsuarios = lazy(() => import('./paginas/Administracion/GestionUsuarios.jsx'));

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [backendConectado, setBackendConectado] = useState<boolean | null>(null);
  // Partida activa de Sala de Control — vive acá (no en el estado local de <SalaControl>)
  // para que sobreviva al desmontaje cuando se cambia de pantalla. Nunca se limpia sola:
  // <SalaControl> la actualiza cada vez que crea/carga una partida (ver `onPartidaActivaChange`),
  // así que al volver a montarse recupera la MISMA partida en vez de arrancar una nueva.
  const [partidaActivaId, setPartidaActivaId] = useState<string | null>(null);
  const [partidaParaAprender, setPartidaParaAprender] = useState<string | null>(null);
  const [usuario, setUsuario] = useState(() => obtenerUsuarioGuardado());

  const manejarLogin = (usuarioData) => {
    setUsuario(usuarioData);
    // Redirigir según rol
    if (usuarioData.rol === 'facilitador') {
      setPantallaActiva('usuarios');
    } else {
      setPantallaActiva('control');
    }
  };

  const manejarLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
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

  useEffect(() => {
    const verificar = () => backendEnLinea().then(setBackendConectado);
    verificar();
    const intervalo = setInterval(verificar, 5000);
    return () => clearInterval(intervalo);
  }, []);

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
      ? "flex items-center gap-space-sm px-space-sm py-space-xs transition-colors bg-surface-container-high text-primary font-medium rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)] w-full text-left"
      : "flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm w-full text-left";

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
    <div className="bg-surface-container-lowest font-body-lg text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      <aside className={`fixed left-0 top-0 h-full w-64 bg-surface-container-low/80 backdrop-blur-xl z-50 flex flex-col justify-between py-space-lg px-space-md transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col gap-space-lg">
          <div className="flex items-center justify-between gap-space-xs px-space-xs">
            <div className="flex items-center gap-space-xs">
              <div className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(0,229,255,0.6)]"></div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface uppercase">Ajedrez Robótico</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="flex flex-col gap-space-2xs">
            <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant px-space-xs">Subsystems</span>
            <nav className="flex flex-col gap-space-2xs">
              <button onClick={() => setPantallaActiva('control')} className={navClasses('control')}>
                <span className="material-symbols-outlined text-[18px]">sports_esports</span>Sala de Control
              </button>
              <button onClick={() => setPantallaActiva('neuronal')} className={navClasses('neuronal')}>
                <span className="material-symbols-outlined text-[18px]">neurology</span>Razonamiento Neuronal
              </button>
              <button onClick={() => setPantallaActiva('admin')} className={navClasses('admin')}>
                <span className="material-symbols-outlined text-[18px]">tune</span>Administración
              </button>
              {esFacilitador && (
                <button onClick={() => setPantallaActiva('usuarios')} className={navClasses('usuarios')}>
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>Gestión de Usuarios
                </button>
              )}
              <div className="pl-space-md flex flex-col gap-space-2xs border-l border-outline-variant/20 ml-space-sm mt-space-2xs">
                <button onClick={() => setPantallaActiva('registro')} className={navClasses('registro')}>
                  <span className="material-symbols-outlined text-[16px]">history_edu</span>Registro de Partidas
                </button>
                <button onClick={() => irAAprendizaje()} className={navClasses('aprendizaje')}>
                  <span className="material-symbols-outlined text-[16px]">school</span>Aprendizaje
                </button>
              </div>
            </nav>
          </div>
        </div>
        <div className="flex flex-col gap-space-sm px-space-xs">
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
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[18px]">
                {esFacilitador ? 'admin_panel_settings' : 'person'}
              </span>
            </div>
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
              <nav className="hidden xl:flex items-center gap-space-xs">
                <button onClick={() => setPantallaActiva('control')} className={headerNavClasses('control')}>SALA DE CONTROL</button>
                <button onClick={() => setPantallaActiva('neuronal')} className={headerNavClasses('neuronal')}>RAZONAMIENTO NEURONAL</button>
                <button onClick={() => setPantallaActiva('admin')} className={headerNavClasses('admin')}>ADMINISTRACIÓN</button>
                {esFacilitador && (
                  <button onClick={() => setPantallaActiva('usuarios')} className={headerNavClasses('usuarios')}>GESTIÓN USUARIOS</button>
                )}
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
              <button
                disabled
                title="No disponible — el brazo físico todavía no está conectado (ver CLAUDE.md)"
                className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-outline cursor-not-allowed font-mono-micro text-mono-micro font-medium tracking-wider uppercase"
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">emergency</span><span className="hidden sm:inline">E-STOP</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[18px]">
                  {esFacilitador ? 'admin_panel_settings' : 'person'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-16 bg-surface-container-lowest min-h-screen">
          {pantallaActiva === 'control' && (
            <SalaControl partidaIdInicial={partidaActivaId} onPartidaActivaChange={setPartidaActivaId} />
          )}
          {pantallaActiva === 'neuronal' && <RazonamientoNeuronal />}
          {pantallaActiva === 'admin' && <Administracion />}
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
            />
          )}
          {pantallaActiva === 'aprendizaje' && (
            <Aprendizaje partidaIdInicial={partidaParaAprender} alCargarPartida={() => setPartidaParaAprender(null)} />
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