import { useState } from 'react';
import { login as loginApi } from '../../api/backend';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolEsperado, setRolEsperado] = useState('jugador');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const data = await loginApi(email, password, rolEsperado);
      localStorage.setItem('access_token', data.tokens.access_token);
      localStorage.setItem('refresh_token', data.tokens.refresh_token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      onLoginSuccess(data.usuario);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center px-space-lg">
      <div className="w-full max-w-md">
        <div className="bg-surface-container-low p-space-xl rounded-2xl shadow-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-primary text-[36px]">sports_esports</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Ajedrez Robótico</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Inicia sesión para continuar
            </p>
          </div>

          {error && (
            <div className="mb-4 p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm text-center animate-in shake-in">
              {error}
            </div>
          )}

          <form onSubmit={manejarSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block font-body-sm text-body-sm text-on-surface-variant mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-space-md py-space-sm rounded-lg bg-surface-container-highest border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block font-body-sm text-body-sm text-on-surface-variant mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-space-md py-space-sm rounded-lg bg-surface-container-highest border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••"
              />
            </div>

            <div>
              <label className="block font-body-sm text-body-sm text-on-surface-variant mb-1">
                Acceder como
              </label>
              <div className="flex gap-space-sm">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="rol"
                    value="jugador"
                    checked={rolEsperado === 'jugador'}
                    onChange={() => setRolEsperado('jugador')}
                    className="sr-only peer"
                  />
                  <div className={`p-space-md rounded-xl border-2 text-center transition-all ${
                    rolEsperado === 'jugador'
                      ? 'border-primary bg-primary-container text-primary'
                      : 'border-outline-variant hover:border-outline hover:bg-surface-container-highest'
                  }`}>
                    <span className="material-symbols-outlined text-[24px] block mb-1">person</span>
                    <span className="font-body-sm text-body-sm font-medium">Jugador</span>
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="rol"
                    value="facilitador"
                    checked={rolEsperado === 'facilitador'}
                    onChange={() => setRolEsperado('facilitador')}
                    className="sr-only peer"
                  />
                  <div className={`p-space-md rounded-xl border-2 text-center transition-all ${
                    rolEsperado === 'facilitador'
                      ? 'border-tertiary bg-tertiary-container text-tertiary'
                      : 'border-outline-variant hover:border-outline hover:bg-surface-container-highest'
                  }`}>
                    <span className="material-symbols-outlined text-[24px] block mb-1">admin_panel_settings</span>
                    <span className="font-body-sm text-body-sm font-medium">Facilitador</span>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-space-md px-space-lg rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-body-sm text-body-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-space-sm"
            >
              {cargando ? (
                <>
                  <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">login</span>
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-space-md rounded-xl bg-surface-container-lowest">
            <p className="font-mono-micro text-mono-micro text-on-surface-variant text-center mb-2">
              Credenciales de prueba:
            </p>
            <div className="grid grid-cols-2 gap-space-xs text-xs font-mono-micro text-mono-micro text-on-surface-variant">
              <div className="p-2 rounded bg-surface-container-highest">
                <strong>Facilitador:</strong><br/>
                facilitador@test.com<br/>
                test123456
              </div>
              <div className="p-2 rounded bg-surface-container-highest">
                <strong>Jugador:</strong><br/>
                jugador@test.com<br/>
                test123456
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}