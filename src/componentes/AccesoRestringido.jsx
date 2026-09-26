/**
 * Bloque simple para pantallas gateadas por rol: en vez de dejar la pantalla
 * en blanco o rota cuando el usuario no tiene permiso, explica por qué y
 * ofrece un botón de vuelta a una pantalla que sí funciona para su rol.
 * Mismo patrón que ya usaba la pantalla "usuarios" antes de esto (ver App.tsx).
 */
export default function AccesoRestringido({
  icono = 'lock',
  colorIcono = 'text-error',
  titulo,
  mensaje,
  textoBoton,
  alClickBoton,
}) {
  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col items-center justify-center min-h-[40vh] text-center">
      <span className={`material-symbols-outlined text-[48px] ${colorIcono} mb-2`}>{icono}</span>
      <h2 className="font-headline-md text-headline-md text-on-surface mb-2">{titulo}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">{mensaje}</p>
      {textoBoton && (
        <button
          type="button"
          onClick={alClickBoton}
          className="mt-4 px-space-lg py-space-md bg-primary text-on-primary rounded-xl font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {textoBoton}
        </button>
      )}
    </div>
  );
}
