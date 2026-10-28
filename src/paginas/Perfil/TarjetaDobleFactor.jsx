import { useEffect, useState } from 'react';
import { activarDobleFactor, desactivarDobleFactor, prepararDobleFactor } from '../../api/backend';

const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const BOTON_PRINCIPAL =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_NEUTRO =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** El secreto escrito en grupos de 4 para que se pueda copiar a mano a la app. */
function enGrupos(secreto) {
  return secreto.replace(/(.{4})/g, '$1 ').trim();
}

function Aviso({ tipo, children }) {
  const clases = tipo === 'error' ? 'bg-error-container text-error' : 'bg-surface-bright text-primary';
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`p-space-sm rounded-lg font-body-sm text-body-sm break-words ${clases}`}>
      {children}
    </div>
  );
}

/**
 * Verificación en dos pasos del facilitador: vincula una app de códigos (Google Authenticator, Authy…) escaneando un QR o escribiendo
 * una clave, y muestra los códigos de respaldo una sola vez. Si el servidor la exige a esta cuenta, no se puede desactivar.
 */
export default function TarjetaDobleFactor({ usuario, alActualizarUsuario }) {
  const activo = usuario?.doble_factor_activo === true;
  const obligatorio = usuario?.doble_factor_obligatorio === true;
  const [preparado, setPreparado] = useState(null); // { secreto, uri, qr }
  const [codigo, setCodigo] = useState('');
  const [respaldo, setRespaldo] = useState(null); // los 10 códigos, visibles hasta que los confirme guardados
  const [guardeLosCodigos, setGuardeLosCodigos] = useState(false);
  const [desactivando, setDesactivando] = useState(false);
  const [password, setPassword] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(null);
  // Con Google no se pide contraseña de ChessIA: alcanza con el código de la app.
  const conPassword = usuario?.tiene_password !== false && !usuario?.google_id;
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    if (!copiado) return undefined;
    const temporizador = setTimeout(() => setCopiado(null), 2000);
    return () => clearTimeout(temporizador);
  }, [copiado]);

  async function ejecutar(accion) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.');
    } finally {
      setOcupado(false);
    }
  }

  const empezar = () =>
    ejecutar(async () => {
      const datos = await prepararDobleFactor();
      const QRCode = (await import('qrcode')).default; // se baja recién acá: solo lo usa esta pantalla
      const qr = await QRCode.toDataURL(datos.uri, { width: 208, margin: 1, errorCorrectionLevel: 'M' });
      setPreparado({ ...datos, qr });
      setCodigo('');
    });

  const confirmarActivacion = (evento) => {
    evento.preventDefault();
    ejecutar(async () => {
      const { codigos_respaldo: codigos } = await activarDobleFactor(codigo.trim());
      setRespaldo(codigos);
      setPreparado(null);
      setCodigo('');
    });
  };

  const terminarActivacion = () => {
    setRespaldo(null);
    setGuardeLosCodigos(false);
    alActualizarUsuario?.({ ...usuario, doble_factor_activo: true });
  };

  const confirmarDesactivacion = (evento) => {
    evento.preventDefault();
    ejecutar(async () => {
      const actualizado = await desactivarDobleFactor({ password: conPassword ? password : null, codigo: codigo.trim() });
      setDesactivando(false);
      setPassword('');
      setCodigo('');
      alActualizarUsuario?.(actualizado);
    });
  };

  async function copiar(texto, que) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(que);
    } catch {
      setError('No se pudo copiar. Seleccionalo y copialo a mano.');
    }
  }

  function descargarCodigos() {
    const texto = `Códigos de respaldo de ChessIA (cada uno sirve una sola vez)\n\n${respaldo.join('\n')}\n`;
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }));
    enlace.download = 'chessia-codigos-de-respaldo.txt';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <section aria-labelledby="doble-factor-titulo" className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">phonelink_lock</span>
          <h2 id="doble-factor-titulo" className="m-0 font-headline-sm text-headline-sm text-on-surface">Verificación en dos pasos</h2>
        </div>
        <span
          className={`shrink-0 font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${
            activo ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          {activo ? 'Activada' : 'Desactivada'}
        </span>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {respaldo ? (
        <div className="flex flex-col gap-space-sm">
          <Aviso tipo="ok">Listo, quedó activada. Guardá estos códigos: cada uno sirve <strong>una sola vez</strong> si perdés el celular, y no se vuelven a mostrar.</Aviso>
          <ul className="m-0 p-space-sm list-none grid grid-cols-2 gap-x-space-md gap-y-space-2xs rounded-lg bg-surface-container-lowest font-mono-label text-mono-label text-on-surface">
            {respaldo.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" onClick={() => copiar(respaldo.join('\n'), 'codigos')} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">content_copy</span>
              {copiado === 'codigos' ? 'Copiados' : 'Copiar'}
            </button>
            <button type="button" onClick={descargarCodigos} className={BOTON_NEUTRO}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">download</span>
              Descargar
            </button>
          </div>
          <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface cursor-pointer">
            <input type="checkbox" checked={guardeLosCodigos} onChange={(e) => setGuardeLosCodigos(e.target.checked)} className="h-4 w-4 cursor-pointer" />
            Ya guardé mis códigos de respaldo
          </label>
          <button type="button" onClick={terminarActivacion} disabled={!guardeLosCodigos} className={`${BOTON_PRINCIPAL} self-start`}>
            Listo
          </button>
        </div>
      ) : preparado ? (
        <div className="flex flex-col gap-space-sm">
          <ol className="m-0 pl-space-md list-decimal flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
            <li>Abrí Google Authenticator (o Authy, o Microsoft Authenticator) en tu celular.</li>
            <li>Tocá «Agregar» y escaneá este código. Si no podés escanear, escribí la clave.</li>
            <li>Escribí abajo el código de 6 dígitos que te muestra la app.</li>
          </ol>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-space-md">
            <img src={preparado.qr} alt="Código QR para vincular la app de códigos" width="208" height="208" className="rounded-lg bg-white p-space-2xs shrink-0" />
            <div className="flex flex-col gap-space-2xs min-w-0 w-full">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Clave de configuración</span>
              <code className="p-space-xs rounded-lg bg-surface-container-lowest font-mono-label text-mono-label text-on-surface break-all select-all">{enGrupos(preparado.secreto)}</code>
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" onClick={() => copiar(preparado.secreto, 'clave')} className={BOTON_NEUTRO}>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">content_copy</span>
                  {copiado === 'clave' ? 'Copiada' : 'Copiar clave'}
                </button>
                <a href={preparado.uri} className={`${BOTON_NEUTRO} no-underline`}>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">smartphone</span>
                  Abrir en la app
                </a>
              </div>
            </div>
          </div>
          <form onSubmit={confirmarActivacion} className="flex flex-wrap items-end gap-space-xs">
            <div className="flex flex-col gap-1">
              <label htmlFor="doble-factor-codigo" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Código de 6 dígitos</label>
              <input
                id="doble-factor-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="000000"
                className={`${CLASE_INPUT} w-36 tracking-widest`}
              />
            </div>
            <button type="submit" disabled={ocupado || codigo.trim().length < 6} className={BOTON_PRINCIPAL}>
              {ocupado ? 'Comprobando…' : 'Activar'}
            </button>
            <button type="button" onClick={() => { setPreparado(null); setError(null); }} disabled={ocupado} className={BOTON_NEUTRO}>
              Cancelar
            </button>
          </form>
        </div>
      ) : activo ? (
        desactivando ? (
          <form onSubmit={confirmarDesactivacion} className="flex flex-col gap-space-sm">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              Para desactivarla, confirmá que sos vos{conPassword ? ' con tu contraseña de ChessIA y' : ' con'} un código de la app (o uno de respaldo).
            </p>
            {conPassword && (
              <div className="flex flex-col gap-1">
                <label htmlFor="doble-factor-password" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Contraseña</label>
                <div className="relative sm:w-72">
                  <input
                    id="doble-factor-password"
                    type={verPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={`${CLASE_INPUT} w-full pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{verPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="doble-factor-codigo-baja" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Código</label>
              <input id="doble-factor-codigo-baja" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="one-time-code" maxLength={30} required className={`${CLASE_INPUT} sm:w-72 tracking-widest`} />
            </div>
            <div className="flex flex-wrap gap-space-xs">
              <button type="submit" disabled={ocupado} className="flex items-center justify-center px-space-md py-space-xs min-h-10 rounded-lg bg-error text-on-error font-body-sm text-body-sm font-medium disabled:opacity-50">
                {ocupado ? 'Desactivando…' : 'Desactivar'}
              </button>
              <button type="button" onClick={() => { setDesactivando(false); setError(null); }} disabled={ocupado} className={BOTON_NEUTRO}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-space-sm">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              Al iniciar sesión te pedimos, además de la contraseña, el código de tu app. Así nadie entra a tu cuenta aunque se robe tu contraseña.
            </p>
            {obligatorio ? (
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">El servidor la exige a tu cuenta: no se puede desactivar.</p>
            ) : (
              <button type="button" onClick={() => { setDesactivando(true); setCodigo(''); }} className={`${BOTON_NEUTRO} self-start`}>
                Desactivar
              </button>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-space-sm">
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
            {obligatorio
              ? 'El servidor exige este paso a tu cuenta: sin activarlo no podés usar el sistema.'
              : 'Protegé tu cuenta con una app de códigos (Google Authenticator, Authy…). Al iniciar sesión te pedimos, además de la contraseña, un código que cambia cada 30 segundos.'}
          </p>
          <button type="button" onClick={empezar} disabled={ocupado} className={`${BOTON_PRINCIPAL} self-start`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">qr_code_2</span>
            {ocupado ? 'Preparando…' : 'Activar'}
          </button>
        </div>
      )}
    </section>
  );
}
