import { useState } from 'react';
import InformeAlumno from '../Progreso/InformeAlumno';

/**
 * Acceso del jugador a su informe de progreso: de dónde partió, cómo va y qué le conviene trabajar. Es la hoja que puede mostrarle a su
 * familia o a su docente, imprimirla o guardarla como PDF.
 */
export default function TarjetaMiProgreso() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="w-full bg-surface-container-low p-space-md rounded-xl shadow-md flex flex-col gap-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">monitoring</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Mi progreso</h2>
      </div>
      <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
        Mirá cómo empezaste y cómo vas hoy. Podés imprimir tu informe o guardarlo como PDF para mostrárselo a tu familia o a tu docente.
      </p>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start flex items-center justify-center gap-1 px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-medium font-body-sm text-body-sm hover:brightness-110 transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">description</span>
        Ver mi informe
      </button>
      {abierto && <InformeAlumno alCerrar={() => setAbierto(false)} />}
    </div>
  );
}
