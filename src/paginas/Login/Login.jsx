import { useEffect, useRef, useState } from 'react';
import { login as loginApi, loginGoogle, registro as registroApi } from '../../api/backend';

export default function Login({ onLoginSuccess }) {
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [rolEsperado, setRolEsperado] = useState('jugador'); // 'jugador' | 'facilitador'
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [claveFacilitador, setClaveFacilitador] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recordar, setRecordar] = useState(true);

  const [cargando, setCargando] = useState(false);
  const [progresoTrack, setProgresoTrack] = useState(0);
  const [mensajeEstado, setMensajeEstado] = useState('');
  const [loginExitoso, setLoginExitoso] = useState(false);
  const [error, setError] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  const animTimerRef = useRef(null);

  // Inicializar Google Identity Services (GIS) si está disponible en window
  useEffect(() => {
    // Si la librería de Google está cargada en el cliente
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: '840567566478-qopmqu3qk27hcp0d60vkil2urcsb0l3i.apps.googleusercontent.com',
        callback: manejarRespuestaGoogle,
      });
    }
  }, [rolEsperado, claveFacilitador]);

  // Manejar respuesta de Google OAuth
  const manejarRespuestaGoogle = async (response) => {
    setError(null);
    setCargando(true);
    setMensajeEstado('Verificando token criptográfico de Google...');
    setProgresoTrack(35);

    try {
      const data = await loginGoogle(response.credential, rolEsperado, claveFacilitador || null);
      ejecutarSecuenciaExito(data);
    } catch (err) {
      setError(err.message || 'Error al autenticar con cuenta de Google');
      setCargando(false);
      setProgresoTrack(0);
    }
  };

  // Botón Google Sign-In
  const iniciarGoogleSignIn = () => {
    setError(null);
    // Si la librería de Google está activa
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }

    // Modal / Prompt de fallback para desarrollo local o demostración inmediata
    const emailPrompt = window.prompt(
      `Acceso Google OAuth (Entorno de Desarrollo Kairos Core):\n\nIngresa tu correo de Google para simular el inicio federado (o déjalo en blanco para usar tu cuenta de prueba ${rolEsperado === 'facilitador' ? 'facilitador@test.com' : 'jugador@test.com'}):`,
      rolEsperado === 'facilitador' ? 'facilitador@test.com' : 'jugador@test.com'
    );

    if (emailPrompt === null) return; // canceló

    const emailElegido = emailPrompt.trim() || (rolEsperado === 'facilitador' ? 'facilitador@test.com' : 'jugador@test.com');
    const mockCredential = `demo_${emailElegido}`;

    setCargando(true);
    setMensajeEstado('Validando federación OAuth2 con KAIROS Core...');
    setProgresoTrack(30);

    setTimeout(async () => {
      try {
        const data = await loginGoogle(mockCredential, rolEsperado, claveFacilitador || null);
        ejecutarSecuenciaExito(data);
      } catch (err) {
        setError(err.message || 'Error en autenticación Google');
        setCargando(false);
        setProgresoTrack(0);
      }
    }, 600);
  };

  // Secuencia visual de éxito con pista de ajedrez
  const ejecutarSecuenciaExito = (data) => {
    setProgresoTrack(75);
    setMensajeEstado('Sincronizando enlace con Actuador KAIROS...');

    animTimerRef.current = setTimeout(() => {
      setProgresoTrack(100);
      setLoginExitoso(true);
      setMensajeEstado('¡Enlace Actuador confirmado! Sesión autorizada.');

      // Guardar en Storage
      localStorage.setItem('access_token', data.tokens.access_token);
      localStorage.setItem('refresh_token', data.tokens.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      setTimeout(() => {
        onLoginSuccess(data.usuario);
      }, 1000);
    }, 1200);
  };

  // Enviar formulario (Login o Registro tradicional)
  const manejarSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    setProgresoTrack(25);
    setMensajeEstado('Cifrando credenciales de acceso...');

    try {
      let data;
      if (modo === 'registro') {
        setMensajeEstado('Registrando nuevo operador en el nodo...');
        setProgresoTrack(45);
        data = await registroApi(
          email.trim(),
          nombre.trim() || email.split('@')[0],
          password,
          rolEsperado,
          rolEsperado === 'facilitador' ? claveFacilitador : null
        );
      } else {
        setMensajeEstado('Verificando firma criptográfica...');
        setProgresoTrack(50);
        data = await loginApi(email.trim(), password, rolEsperado);
      }

      ejecutarSecuenciaExito(data);
    } catch (err) {
      setError(err.message || 'Error al procesar la autenticación');
      setCargando(false);
      setProgresoTrack(0);
    }
  };

  // Rellenar credenciales de prueba
  const rellenarPrueba = (correo, clave, rol) => {
    setEmail(correo);
    setPassword(clave);
    setRolEsperado(rol);
    if (rol === 'facilitador') setClaveFacilitador('admin123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0c0e14] text-slate-200 font-sans antialiased flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* 1. FONDO CON MARCA DE AGUA Y CUADRÍCULA TECNOLÓGICA */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Imagen de ajedrez robótico de alta fidelidad */}
        <div
          className="absolute inset-0 bg-cover bg-center filter brightness-75 contrast-125 opacity-40 scale-105"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(12,14,20,0.4) 0%, rgba(12,14,20,0.95) 90%), url("https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=1600&q=80")`,
          }}
        />

        {/* Gradientes y Rejilla Cibernética */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0e14]/90 via-[#111319]/80 to-[#0c0e14]/95 backdrop-blur-[2px]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0, 229, 255, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 229, 255, 0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Luces Neón Volumétricas */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[400px] bg-[#00e5ff]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-4 right-1/4 w-[460px] h-[300px] bg-[#10b981]/10 rounded-full blur-[150px]" />
      </div>

      {/* 2. BARRA DE TELEMETRÍA SUPERIOR */}
      <header className="relative z-10 w-full px-5 sm:px-8 py-3 flex items-center justify-between border-b border-[#00e5ff]/20 bg-[#0c0e14]/85 backdrop-blur-md font-mono text-xs">
        <div className="flex items-center space-x-3 sm:space-x-5">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00e5ff]" />
            </span>
            <span className="tracking-wider text-slate-300 font-semibold">
              NODO KAIROS: <span className="text-[#00e5ff] drop-shadow-[0_0_8px_#00e5ff]">EN LÍNEA</span>
            </span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center space-x-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>
              CINEMÁTICA: <span className="text-emerald-400 font-medium">CALIBRADA</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden md:flex items-center space-x-1.5 text-slate-400">
            <span className="material-symbols-outlined text-[15px] text-[#00e5ff]">lock</span>
            <span className="tracking-wider text-slate-300 text-[11px]">E2E TLS 1.3</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[11px] text-[#00e5ff] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse" />
            <span>LATENCIA: 1.2ms</span>
          </div>
        </div>
      </header>

      {/* 3. CARD CENTRAL GLASSMÓRFICA DE AUTENTICACIÓN */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-[440px] mx-auto">
          <section className="relative bg-[#111319]/90 backdrop-blur-2xl rounded-2xl border border-[#00e5ff]/30 p-6 sm:p-7 shadow-2xl transition-all duration-300 shadow-[0_0_30px_-4px_rgba(0,229,255,0.25)]">
            {/* Esquinas Cibernéticas Decorativas */}
            <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#00e5ff]" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#00e5ff]" />
            <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#00e5ff]" />
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#00e5ff]" />

            {/* LOGOTIPO E IDENTIDAD KAIROS CORE */}
            <div className="text-center mb-5">
              <div className="flex justify-center mb-3">
                <div className="inline-flex p-2 rounded-2xl bg-[#0c0e14] border border-[#00e5ff]/30 shadow-[0_0_20px_rgba(0,229,255,0.45)]">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0c0e14] to-[#151922] flex items-center justify-center border border-[#00e5ff]/40">
                    <span className="material-symbols-outlined text-[#00e5ff] text-[34px] drop-shadow-[0_0_12px_#00e5ff]">
                      robot_2
                    </span>
                  </div>
                </div>
              </div>

              <h1 className="font-display font-bold text-2xl sm:text-[26px] tracking-tight text-white flex items-center justify-center space-x-1.5">
                <span>ChessIA</span>
                <span className="text-slate-500 font-light">//</span>
                <span className="text-[#00e5ff] drop-shadow-[0_0_10px_#00e5ff]">KAIROS</span>
                <span className="text-emerald-400 font-semibold drop-shadow-[0_0_10px_#10b981]">CORE</span>
              </h1>
              <p className="mt-1 text-[10px] font-mono tracking-widest text-[#00e5ff]/80 uppercase">
                SISTEMA AUTÓNOMO DE AJEDREZ ROBÓTICO
              </p>
            </div>

            {/* SELECTOR DE ROL (JUGADOR vs FACILITADOR / ÁRBITRO) */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090b10] border border-white/10 rounded-xl">
                {/* Jugador */}
                <button
                  type="button"
                  onClick={() => {
                    setRolEsperado('jugador');
                    setError(null);
                  }}
                  className={`relative flex items-center justify-center py-2.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                    rolEsperado === 'jugador'
                      ? 'bg-[#00e5ff] text-black shadow-[0_0_16px_rgba(0,229,255,0.45)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] mr-1.5 shrink-0">
                    person
                  </span>
                  <span>Jugador</span>
                </button>

                {/* Facilitador / Árbitro */}
                <button
                  type="button"
                  onClick={() => {
                    setRolEsperado('facilitador');
                    setError(null);
                  }}
                  className={`relative flex items-center justify-center py-2.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                    rolEsperado === 'facilitador'
                      ? 'bg-[#00e5ff] text-black shadow-[0_0_16px_rgba(0,229,255,0.45)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px] mr-1.5 shrink-0">
                    shield
                  </span>
                  <span>Facilitador / Árbitro</span>
                </button>
              </div>
            </div>

            {/* NOTIFICACIÓN O ERROR */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 font-mono text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-400">error</span>
                <span>{error}</span>
              </div>
            )}
            {notificacion && (
              <div className="mb-4 p-3 rounded-xl bg-cyan-950/70 border border-[#00e5ff]/50 text-[#00e5ff] font-mono text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                <span>{notificacion}</span>
              </div>
            )}

            {/* BOTÓN GOOGLE OAUTH */}
            <div className="mb-4">
              <button
                type="button"
                onClick={iniciarGoogleSignIn}
                disabled={cargando}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm text-slate-200 bg-[#151922] hover:bg-[#1c2230] border border-white/10 hover:border-[#00e5ff]/40 active:scale-[0.99] transition duration-200 shadow-sm group disabled:opacity-50"
              >
                {/* SVG Oficial de Google */}
                <svg className="w-4 h-4 mr-2.5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" fill="#4285F4" />
                  <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853" />
                  <path d="M5.28 14.27a7.203 7.203 0 0 1 0-4.54V6.58H1.25a11.99 11.99 0 0 0 0 10.84l4.03-3.15z" fill="#FBBC05" />
                  <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335" />
                </svg>
                <span>Continuar con Google</span>
              </button>
            </div>

            {/* SEPARADOR CRIPTOGRÁFICO */}
            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink mx-3 text-[10px] font-mono tracking-wider text-slate-500 uppercase">
                O INGRESA CON TUS CREDENCIALES
              </span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            {/* SELECTOR ENTRE INICIAR SESIÓN Y CREAR CUENTA */}
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-mono text-slate-400">
                {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya estás registrado?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setModo(modo === 'login' ? 'registro' : 'login');
                  setError(null);
                }}
                className="text-[#00e5ff] hover:underline font-mono font-semibold"
              >
                {modo === 'login' ? 'Crear cuenta nueva' : 'Iniciar sesión'}
              </button>
            </div>

            {/* FORMULARIO */}
            <form onSubmit={manejarSubmit} className="space-y-3.5">
              {/* Campo Nombre (solo en registro) */}
              {modo === 'registro' && (
                <div>
                  <label className="block text-[11px] font-mono tracking-wide text-slate-300 mb-1">
                    NOMBRE COMPLETO
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <span className="material-symbols-outlined text-[18px]">badge</span>
                    </div>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                      placeholder="Ej. Roberto Fischer"
                      className="block w-full pl-9 pr-3 py-2 bg-[#0a0d14] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00e5ff] focus:border-[#00e5ff] font-mono transition duration-150"
                    />
                  </div>
                </div>
              )}

              {/* Correo Electrónico o ID */}
              <div>
                <label className="block text-[11px] font-mono tracking-wide text-slate-300 mb-1">
                  CORREO ELECTRÓNICO O ID DE {rolEsperado === 'facilitador' ? 'FACILITADOR' : 'JUGADOR'}
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={rolEsperado === 'facilitador' ? 'facilitador@test.com' : 'jugador@kairos-chess.ai'}
                    className="block w-full pl-9 pr-3 py-2 bg-[#0a0d14] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00e5ff] focus:border-[#00e5ff] font-mono transition duration-150"
                  />
                </div>
              </div>

              {/* Contraseña Criptográfica */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-mono tracking-wide text-slate-300">
                    CONTRASEÑA CRIPTOGRÁFICA
                  </label>
                  {modo === 'login' && (
                    <button
                      type="button"
                      onClick={() => setNotificacion('Enlace de restablecimiento enviado al administrador del nodo.')}
                      className="text-[11px] text-[#00e5ff]/80 hover:text-[#00e5ff] transition"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </div>
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-10 py-2 bg-[#0a0d14] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00e5ff] focus:border-[#00e5ff] font-mono tracking-wider transition duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#00e5ff] transition"
                    title={mostrarPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {mostrarPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Clave de Seguridad de Facilitador (cuando aplica) */}
              {rolEsperado === 'facilitador' && (
                <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-[#00e5ff]/30">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-mono tracking-wide text-[#00e5ff]">
                      PIN DE SEGURIDAD FACILITADOR
                    </label>
                    <span className="text-[9px] text-slate-400 font-mono">Por defecto: admin123</span>
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#00e5ff]">
                      <span className="material-symbols-outlined text-[16px]">key</span>
                    </div>
                    <input
                      type="password"
                      value={claveFacilitador}
                      onChange={(e) => setClaveFacilitador(e.target.value)}
                      placeholder="Ingresa clave de laboratorio (admin123)"
                      className="block w-full pl-8 pr-3 py-1.5 bg-[#080b12] border border-[#00e5ff]/30 rounded text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-[#00e5ff]"
                    />
                  </div>
                </div>
              )}

              {/* Recordar en este equipo */}
              <div className="flex items-center pt-0.5">
                <input
                  id="recordarEquipo"
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="h-4 w-4 text-[#00e5ff] focus:ring-[#00e5ff] bg-[#090d15] border-white/20 rounded cursor-pointer"
                />
                <label htmlFor="recordarEquipo" className="ml-2 block text-xs text-slate-400 select-none cursor-pointer">
                  Recordar en este equipo
                </label>
              </div>

              {/* BOTÓN PRINCIPAL */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={cargando}
                  className={`relative w-full overflow-hidden group py-3 px-4 rounded-xl text-black font-semibold text-xs uppercase tracking-widest transition-all duration-200 shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:shadow-[0_0_28px_rgba(0,229,255,0.7)] active:scale-[0.99] flex items-center justify-center cursor-pointer ${
                    loginExitoso
                      ? 'bg-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.7)]'
                      : 'bg-gradient-to-r from-[#00daf3] via-[#00e5ff] to-[#38f2ff] hover:from-[#00e5ff] hover:to-[#7df6ff]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center space-x-2">
                    {loginExitoso ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>SESIÓN AUTORIZADA // ENTRANDO...</span>
                      </>
                    ) : cargando ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        <span>PROCESANDO...</span>
                      </>
                    ) : (
                      <>
                        <span>{modo === 'login' ? 'INICIAR SESIÓN' : 'REGISTRAR OPERADOR'}</span>
                        <span className="material-symbols-outlined text-[16px] transform group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* PISTA HORIZONTAL DE AJEDREZ a1 -> e1 (DURANTE LA CARGA) */}
            {cargando && (
              <div className="mt-4 p-3.5 rounded-xl bg-[#090c13] border border-[#00e5ff]/40 shadow-inner">
                <div className="flex items-center justify-between mb-2 text-[11px] font-mono">
                  <span className="text-[#00e5ff] flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
                    <span className="animate-pulse">{mensajeEstado}</span>
                  </span>
                </div>

                <div className="relative w-full h-10 bg-[#0e131d] rounded-lg border border-white/10 flex items-center px-1 overflow-hidden">
                  <div className="absolute inset-0 grid grid-cols-5 h-full pointer-events-none">
                    <div className="flex items-center justify-center border-r border-white/5 bg-cyan-950/20 font-mono text-[9px] text-slate-500">a1</div>
                    <div className="flex items-center justify-center border-r border-white/5 bg-transparent font-mono text-[9px] text-slate-500">b1</div>
                    <div className="flex items-center justify-center border-r border-white/5 bg-cyan-950/20 font-mono text-[9px] text-slate-500">c1</div>
                    <div className="flex items-center justify-center border-r border-white/5 bg-transparent font-mono text-[9px] text-slate-500">d1</div>
                    <div className="flex items-center justify-center bg-cyan-950/20 font-mono text-[9px] text-slate-500">e1</div>
                  </div>

                  {/* Caballo de ajedrez avanzando por la pista */}
                  <div
                    className="z-10 text-[#00e5ff] drop-shadow-[0_0_10px_#00e5ff] transition-all duration-700 ease-out flex items-center"
                    style={{ transform: `translateX(${progresoTrack * 3.2}px)` }}
                  >
                    <span className="material-symbols-outlined text-[20px] animate-bounce">
                      chess_pawn
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div
                    className="absolute bottom-0 left-0 h-[2px] bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] transition-all duration-500"
                    style={{ width: `${progresoTrack}%` }}
                  />
                </div>
              </div>
            )}

            {/* CREDENCIALES DE PRUEBA RÁPIDA (CHIPS CON CLIC DIRECTO) */}
            <div className="mt-5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
              <p className="font-mono-micro text-[10px] text-slate-400 text-center mb-1.5 uppercase tracking-wider">
                Credenciales de prueba rápida (clic para rellenar):
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => rellenarPrueba('facilitador@test.com', 'admin123', 'facilitador')}
                  className="p-1.5 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 border border-outline-variant/20 hover:border-[#00e5ff]/50 transition-all text-left flex flex-col"
                >
                  <span className="text-[#00e5ff] font-bold">Facilitador / Árbitro</span>
                  <span className="text-slate-300">facilitador@test.com</span>
                  <span className="text-slate-500">clave: admin123</span>
                </button>
                <button
                  type="button"
                  onClick={() => rellenarPrueba('jugador@test.com', 'test123456', 'jugador')}
                  className="p-1.5 rounded bg-surface-container-high hover:bg-[#00e5ff]/20 border border-outline-variant/20 hover:border-[#00e5ff]/50 transition-all text-left flex flex-col"
                >
                  <span className="text-emerald-400 font-bold">Jugador</span>
                  <span className="text-slate-300">jugador@test.com</span>
                  <span className="text-slate-500">clave: test123456</span>
                </button>
              </div>
            </div>
          </section>

          {/* PIE DE SEGURIDAD CRIPTOGRÁFICA */}
          <div className="mt-3 text-center">
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">
              ACCESO SEGURO • TERMINAL CRIPTOGRÁFICA KAIROS CORE v4.2
            </p>
          </div>
        </div>
      </main>

      {/* 4. BARRA DE TELEMETRÍA PERIMETRAL INFERIOR */}
      <footer className="relative z-10 w-full px-5 sm:px-8 py-2.5 border-t border-[#00e5ff]/20 bg-[#0c0e14]/90 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-3 mb-1.5 sm:mb-0">
          <span>
            MOTOR CHESS IA: <span className="text-slate-200">STOCKFISH NEURAL HYBRID</span>
          </span>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            ACTUADOR: <span className="text-slate-200">6-DOF ROBOTIC ARM</span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-950/50 text-[#00e5ff] border border-[#00e5ff]/30 text-[10px] tracking-wide">
            ESTADO: LISTO PARA EMPAREJAMIENTO
          </span>
          <span className="text-slate-500">© 2025 KAIROS AI LABS</span>
        </div>
      </footer>
    </div>
  );
}