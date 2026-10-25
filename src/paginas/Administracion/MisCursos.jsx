import PanelCursos from './PanelCursos';

/** Pantalla de «Mis cursos» para el docente y el administrador de una institución (la plataforma los ve dentro de Gestión de Usuarios). */
export default function MisCursos({ usuarioActual = null }) {
  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">groups</span>
        <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mis cursos</h1>
      </div>
      <PanelCursos usuarioActual={usuarioActual} abiertoAlInicio />
    </div>
  );
}
