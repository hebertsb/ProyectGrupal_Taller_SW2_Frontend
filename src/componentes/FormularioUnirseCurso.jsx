import { useState } from 'react';
import { unirseACurso } from '../api/backend';

const BASE_BOTON =
  'flex items-center justify-center gap-space-xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Campo del código de curso + botón "Unirme", compartido por Mi Perfil y por el Panel de Aprendizaje.
 * El código se escribe en cualquier formato (mayúsculas, minúsculas, con o sin guion). Si el backend lo rechaza
 * (código inválido, curso cerrado, demasiados intentos) muestra su mensaje tal cual. Al entrar llama a
 * `alUnido(curso)` con `{id, nombre, facilitador_nombre, facilitador_avatar_url, preset_ensenanza}`.
 * `idCampo` tiene que ser único en la pantalla (lo usa el `<label>`). `autoEnfocar` pone el cursor en el campo al
 * aparecer (para cuando el formulario se despliega al tocar un botón).
 */
export default function FormularioUnirseCurso({ alUnido, idCampo = 'curso-codigo', autoEnfocar = false }) {
  const [codigo, setCodigo] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState(null);

  async function enviar(evento) {
    evento.preventDefault();
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) {
      setError('Escribí el código que te dio tu facilitador.');
      return;
    }
    setUniendo(true);
    setError(null);
    try {
      const unido = await unirseACurso(codigoLimpio);
      setCodigo('');
      alUnido(unido);
    } catch (err) {
      setError(err.message || 'No se pudo entrar al curso.');
    } finally {
      setUniendo(false);
    }
  }

  return (
    <>
      <form onSubmit={enviar} className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
        <div className="flex flex-col gap-space-2xs flex-1 min-w-0">
          <label htmlFor={idCampo} className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
            Código del curso
          </label>
          <input
            id={idCampo}
            autoFocus={autoEnfocar}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Ej.: K7Q-M4T"
            className="w-full min-h-10 px-space-sm py-space-xs bg-surface-container border border-outline-variant/30 rounded-lg font-mono-metric text-mono-metric tracking-widest uppercase text-on-surface placeholder:normal-case placeholder:tracking-normal placeholder-outline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>
        <button
          type="submit"
          disabled={uniendo || !codigo.trim()}
          className={`${BASE_BOTON} bg-primary text-on-primary font-medium`}
        >
          {uniendo && (
            <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
          )}
          {uniendo ? 'Entrando…' : 'Unirme'}
        </button>
      </form>
      {error && (
        <div
          role="alert"
          className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm flex items-start gap-space-xs"
        >
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5" aria-hidden="true">
            error
          </span>
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
    </>
  );
}
