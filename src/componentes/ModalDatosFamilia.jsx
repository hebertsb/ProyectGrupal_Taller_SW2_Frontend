import { useRef, useState } from 'react';
import { actualizarPerfil } from '../api/backend';
import useModalAccesible from '../useModalAccesible';

const CLASE_INPUT =
  'w-full px-space-sm py-space-xs min-h-10 bg-surface-container border border-outline-variant/30 rounded-lg font-body-sm text-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Ventana donde el jugador carga su edad y los datos de su madre, padre o tutor, y declara que lo autorizó a jugar con otras personas. Sin esos datos (o sin que su
 * curso esté autorizado) un menor solo juega contra Turing y Stockfish. Al guardar llama a `alGuardar(usuarioActualizado)`.
 */
export default function ModalDatosFamilia({ usuario, falta = [], alCerrar, alGuardar }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [edad, setEdad] = useState(usuario?.edad != null ? String(usuario.edad) : '');
  const [tutorNombre, setTutorNombre] = useState(usuario?.tutor_nombre ?? '');
  const [tutorTelefono, setTutorTelefono] = useState(usuario?.tutor_telefono ?? '');
  const [tutorEmail, setTutorEmail] = useState(usuario?.tutor_email ?? '');
  const [autoriza, setAutoriza] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: guardando ? null : alCerrar, focoInicialRef: campoRef });

  const edadNumero = edad === '' ? null : Number(edad);
  const esMenor = edadNumero != null && edadNumero < 18;

  async function guardar(evento) {
    evento.preventDefault();
    setError(null);
    if (edadNumero == null || !Number.isInteger(edadNumero) || edadNumero < 3 || edadNumero > 120) {
      setError('Escribí tu edad (entre 3 y 120 años).');
      return;
    }
    const cambios = { edad: edadNumero, tutor_nombre: tutorNombre.trim() || null, tutor_telefono: tutorTelefono.trim() || null, tutor_email: tutorEmail.trim() || null };
    if (esMenor) {
      if (autoriza && (tutorNombre.trim().length < 3 || tutorTelefono.replace(/\D/g, '').length < 7)) {
        setError('Para declarar la autorización escribí el nombre completo y el teléfono de tu madre, padre o tutor.');
        return;
      }
      if (autoriza) cambios.autorizacion_tutor = true;
    }
    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(cambios);
      alGuardar?.(actualizado);
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los datos.');
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !guardando) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={guardar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-datos-familia"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">family_restroom</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">Jugar con otras personas</span>
            <h2 id="titulo-datos-familia" className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi edad y mi familia</h2>
          </div>
        </div>

        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Si sos menor de 18 años, jugás con tus compañeros y amigos cuando tu madre, padre o tutor lo autoriza. Sus datos los ven solo tu docente y quienes
          cuidan la plataforma, para avisarles si pasa algo. Si tu docente o tu colegio ya tiene la autorización de las familias, no hace falta cargarlos.
          {falta.length > 0 && <strong className="text-on-surface"> Te falta: {falta.map((f) => (f === 'edad' ? 'tu edad' : 'los datos de tu familia')).join(' y ')}.</strong>}
        </p>

        <div className="flex flex-col gap-space-2xs">
          <label htmlFor="familia-edad" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Tu edad</label>
          <input
            id="familia-edad"
            ref={campoRef}
            type="number"
            inputMode="numeric"
            min={3}
            max={120}
            value={edad}
            onChange={(e) => setEdad(e.target.value)}
            disabled={guardando}
            className={CLASE_INPUT}
          />
        </div>

        {(esMenor || usuario?.tutor_nombre || usuario?.tutor_telefono || usuario?.tutor_email) && (
          <>
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="familia-nombre" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Nombre de tu madre, padre o tutor</label>
              <input
                id="familia-nombre"
                type="text"
                autoComplete="off"
                maxLength={100}
                value={tutorNombre}
                onChange={(e) => setTutorNombre(e.target.value)}
                disabled={guardando}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="familia-telefono" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Su teléfono (WhatsApp)</label>
              <input
                id="familia-telefono"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={30}
                value={tutorTelefono}
                onChange={(e) => setTutorTelefono(e.target.value)}
                placeholder="Ej. 71234567"
                disabled={guardando}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-space-2xs">
              <label htmlFor="familia-correo" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Su correo (opcional)</label>
              <input id="familia-correo" type="email" autoComplete="off" maxLength={254} value={tutorEmail} onChange={(e) => setTutorEmail(e.target.value)} disabled={guardando} className={CLASE_INPUT} />
            </div>
            <div className="flex items-start gap-space-xs">
              <input
                id="familia-autoriza"
                type="checkbox"
                checked={autoriza}
                onChange={(e) => setAutoriza(e.target.checked)}
                disabled={guardando}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary"
              />
              <label htmlFor="familia-autoriza" className="font-body-sm text-body-sm text-on-surface leading-snug cursor-pointer">
                Mi madre, padre o tutor sabe que uso la plataforma y me autorizó a jugar con otras personas.
              </label>
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            className="px-space-md py-space-sm min-h-11 rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-space-md py-space-sm min-h-11 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
