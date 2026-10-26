/**
 * Franja con el resultado de entrar a un curso por un enlace o un código QR: «Te uniste al curso…» o por qué no se pudo (código vencido,
 * curso cerrado o lleno). Se cierra a mano.
 */
export default function AvisoCurso({ ok, texto, alCerrar }) {
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`w-full px-space-lg py-space-sm border-b flex items-center justify-between gap-space-sm ${
        ok ? 'bg-primary/10 border-primary/30' : 'bg-error-container/40 border-error/40'
      }`}
    >
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-center gap-space-xs min-w-0">
        <span className={`material-symbols-outlined text-[18px] shrink-0 ${ok ? 'text-primary' : 'text-error'}`} aria-hidden="true">
          {ok ? 'groups' : 'link_off'}
        </span>
        <span className="min-w-0 break-words">{texto}</span>
      </p>
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar el aviso"
        className="shrink-0 min-w-10 min-h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
      </button>
    </div>
  );
}
