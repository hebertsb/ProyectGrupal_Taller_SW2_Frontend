import { useRef, useState } from 'react';
import useModalAccesible from '../../useModalAccesible';
import { login2fa } from '../../api/backend';

/**
 * Segundo paso del inicio de sesión de una cuenta con verificación en dos pasos: pide el código de 6 dígitos de la app (o uno de
 * respaldo). Se muestra encima del formulario. Al terminar bien llama a `alCompletar` con la respuesta del login.
 */
export default function PasoDobleFactor({ token, alCompletar, alCancelar }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: verificando ? null : alCancelar, focoInicialRef: campoRef });

  async function verificar(evento) {
    evento.preventDefault();
    setVerificando(true);
    setError(null);
    try {
      alCompletar(await login2fa(token, codigo.trim()));
    } catch (err) {
      setError(err.message || 'No se pudo verificar el código.');
      setVerificando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        ref={dialogoRef}
        onSubmit={verificar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-paso-2"
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#0e131d] border border-[#00e5ff]/30 shadow-2xl p-5 flex flex-col gap-4 select-text"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-[#00e5ff]" aria-hidden="true">phonelink_lock</span>
          <h2 id="titulo-paso-2" className="m-0 text-base font-semibold text-white">Verificación en dos pasos</h2>
        </div>
        <p className="m-0 text-sm text-slate-300 leading-snug">
          Abrí tu app de códigos (Google Authenticator o la que uses) y escribí el código de 6 dígitos de <strong>ChessIA</strong>. Si perdiste el
          celular, usá uno de tus códigos de respaldo.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="codigo-paso-2" className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Código</label>
          <input
            id="codigo-paso-2"
            ref={campoRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={30}
            placeholder="123456"
            required
            disabled={verificando}
            className="w-full px-3 py-2.5 bg-[#0a0d14] border border-white/10 rounded-lg text-lg text-white font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-1 focus:ring-[#00e5ff] focus:border-[#00e5ff]"
          />
        </div>
        {error && (
          <div role="alert" className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs break-words">{error}</div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={alCancelar}
            disabled={verificando}
            className="flex-1 min-h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={verificando || codigo.trim().length < 6}
            className="flex-1 min-h-11 rounded-xl bg-gradient-to-r from-[#00daf3] via-[#00e5ff] to-[#38f2ff] text-black text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verificando ? 'Verificando…' : 'Verificar'}
          </button>
        </div>
      </form>
    </div>
  );
}
