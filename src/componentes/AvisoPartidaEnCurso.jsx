/**
 * Franja que le recuerda al jugador que tiene una partida con reloj en curso contra otra persona mientras mira otra pantalla: el reloj de su
 * rival no se detiene, así que conviene volver. Mientras esta franja se ve, la aplicación sigue avisando al servidor que el jugador está presente.
 */
export default function AvisoPartidaEnCurso({ rival, alVolver }) {
  return (
    <div role="status" className="w-full px-space-lg py-space-sm bg-tertiary/10 border-b border-tertiary/30 flex flex-wrap items-center justify-between gap-space-xs">
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-center gap-space-xs min-w-0">
        <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0" aria-hidden="true">timer</span>
        <span className="min-w-0 break-words">
          <strong>Tu partida con reloj contra {rival} sigue en curso.</strong> Su reloj no se detiene: volvé cuando puedas.
        </span>
      </p>
      <button
        type="button"
        onClick={alVolver}
        className="px-space-md py-space-xs min-h-10 rounded-lg bg-tertiary text-on-tertiary font-body-sm text-body-sm font-medium hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
      >
        Volver a la partida
      </button>
    </div>
  );
}
