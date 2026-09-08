/**
 * Aviso fijo para pantallas que muestran un diseño ya definido pero sin
 * backend real todavía (alcance de tesis, ver PLAN_IMPLEMENTACION_COMPLETO.md
 * sección 0). Los números y nombres de esta pantalla son ilustrativos, no
 * datos en vivo — salvo la parte que `descripcionCorta` aclare como real.
 */
export default function AvisoVistaPrevia({ hu, descripcionCorta }) {
  return (
    <div className="relative z-30 flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-tertiary-container/20 border border-tertiary-fixed-dim/30 text-tertiary-fixed-dim font-mono-micro text-mono-micro">
      <span className="material-symbols-outlined text-[16px]">visibility</span>
      <span>
        VISTA PREVIA DE DISEÑO ({hu}, alcance de tesis){descripcionCorta ? ` — ${descripcionCorta}` : ' — datos ilustrativos, todavía sin conectar'}
      </span>
    </div>
  );
}
