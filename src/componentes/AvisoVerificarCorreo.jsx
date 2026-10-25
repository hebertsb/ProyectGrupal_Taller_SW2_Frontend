import { useState } from 'react';
import { reenviarCodigoCorreo, verificarCorreo } from '../api/backend';

/**
 * Franja que aparece mientras el correo de la cuenta no está verificado (solo si el servidor manda correos): pide el código de
 * 6 dígitos que llegó y permite pedir uno nuevo. Al verificar llama a `alVerificar` con el usuario actualizado.
 */
export default function AvisoVerificarCorreo({ usuario, alVerificar }) {
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  async function confirmar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    try {
      alVerificar(await verificarCorreo(codigo.trim()));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo verificar el código.' });
    } finally {
      setOcupado(false);
    }
  }

  async function pedirOtro() {
    setOcupado(true);
    setMensaje(null);
    try {
      await reenviarCodigoCorreo();
      setMensaje({ tipo: 'ok', texto: 'Te mandamos un código nuevo.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo mandar el código.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div role="region" aria-label="Verificar el correo" className="w-full px-space-lg py-space-sm bg-tertiary/10 border-b border-tertiary/30 flex flex-col gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface">
        <strong>Verificá tu correo.</strong> Te mandamos un código de 6 dígitos a <span className="break-all">{usuario?.email}</span>.
      </p>
      <form onSubmit={confirmar} className="flex flex-wrap items-center gap-space-xs">
        <label htmlFor="codigo-correo" className="sr-only">Código de verificación</label>
        <input
          id="codigo-correo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000000"
          className="w-32 px-space-sm py-space-xs min-h-10 bg-surface-container-lowest border border-outline-variant/40 rounded-lg font-mono-label text-mono-label tracking-widest text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button
          type="submit"
          disabled={ocupado || codigo.trim().length < 6}
          className="px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Verificar
        </button>
        <button
          type="button"
          onClick={pedirOtro}
          disabled={ocupado}
          className="px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm disabled:opacity-50"
        >
          Mandar otro código
        </button>
        {mensaje && (
          <span role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`font-body-sm text-body-sm ${mensaje.tipo === 'error' ? 'text-error' : 'text-primary'}`}>
            {mensaje.texto}
          </span>
        )}
      </form>
    </div>
  );
}
