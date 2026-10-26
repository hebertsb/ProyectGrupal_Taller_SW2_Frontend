import { useRef, useState } from 'react';
import { confirmarRecuperacionPassword, pedirRecuperacionPassword } from '../../api/backend';
import useModalAccesible from '../../useModalAccesible';

const INPUT = 'w-full min-h-11 rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-on-surface';
const BOTON = 'min-h-11 rounded-lg px-4 py-2 bg-primary text-on-primary disabled:opacity-50';

export default function RecuperarPassword({ correoInicial = '', alCerrar, alCompletar }) {
  const dialogo = useRef(null);
  const primerCampo = useRef(null);
  const [email, setEmail] = useState(correoInicial.includes('@') ? correoInicial : '');
  const [paso, setPaso] = useState('correo');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  useModalAccesible(dialogo, { alCerrar: ocupado ? null : alCerrar, focoInicialRef: primerCampo });

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    if (paso === 'codigo' && password !== repetida) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setOcupado(true);
    try {
      if (paso === 'correo') {
        const respuesta = await pedirRecuperacionPassword(email.trim());
        setAviso(respuesta.mensaje);
        setPaso('codigo');
      } else {
        await confirmarRecuperacionPassword(email.trim(), codigo, password);
        alCompletar(email.trim());
      }
    } catch (err) {
      setError(err.message || 'No se pudo completar la recuperación.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 p-4 flex items-center justify-center">
      <form ref={dialogo} onSubmit={enviar} role="dialog" aria-modal="true" aria-labelledby="recuperar-titulo"
        className="bg-surface-container-low text-on-surface w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-3 font-body-sm text-body-sm">
        <h2 id="recuperar-titulo" className="m-0 text-xl">Recuperar mi contraseña</h2>
        <p className="m-0 text-on-surface-variant">Si tu docente creó tu usuario sin correo, pedile una clave nueva. Si entrás con Google, usá «Continuar con Google».</p>
        {aviso && <p role="status" className="m-0 rounded-lg bg-primary/10 p-3 break-words">{aviso}</p>}
        {error && <p role="alert" className="m-0 rounded-lg bg-error-container text-on-error-container p-3 break-words">{error}</p>}
        <label htmlFor="recuperar-correo">Correo de tu cuenta</label>
        <input ref={primerCampo} id="recuperar-correo" type="email" autoComplete="email" autoCapitalize="none" maxLength={254}
          value={email} onChange={(e) => setEmail(e.target.value)} readOnly={paso === 'codigo'} disabled={ocupado} required className={INPUT} />
        {paso === 'codigo' && <>
          <label htmlFor="recuperar-codigo">Código de 6 dígitos del correo</label>
          <input id="recuperar-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} disabled={ocupado} required className={INPUT} />
          <label htmlFor="recuperar-clave">Contraseña nueva (8 o más caracteres, letras y números)</label>
          <input id="recuperar-clave" type="password" autoComplete="new-password" minLength={8} maxLength={100}
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={ocupado} required className={INPUT} />
          <label htmlFor="recuperar-repetir">Repetí la contraseña nueva</label>
          <input id="recuperar-repetir" type="password" autoComplete="new-password" minLength={8} maxLength={100}
            value={repetida} onChange={(e) => setRepetida(e.target.value)} disabled={ocupado} required className={INPUT} />
          <p className="m-0 text-on-surface-variant">El código vence en 15 minutos y sirve una sola vez. Revisá también el correo no deseado.</p>
          <button type="button" onClick={() => { setPaso('correo'); setCodigo(''); setError(null); }} disabled={ocupado} className="min-h-11 text-primary underline">Corregir correo o pedir otro código</button>
        </>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={alCerrar} disabled={ocupado} className="min-h-11 rounded-lg bg-surface-container-high px-4 py-2">Cancelar</button>
          <button type="submit" disabled={ocupado} className={BOTON}>{ocupado ? 'Procesando…' : paso === 'correo' ? 'Pedir código' : 'Guardar contraseña'}</button>
        </div>
      </form>
    </div>
  );
}
