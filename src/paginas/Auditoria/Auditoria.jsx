import { useCallback, useEffect, useState } from 'react';
import { listarAuditoria } from '../../api/backend';
import { fechaDesdeIso } from '../../formatoTiempo';

/** Cómo se lee cada acción que anota el servidor. */
const ACCIONES = {
  'usuario.eliminar': { texto: 'Eliminó una cuenta', icono: 'person_remove' },
  'usuario.baja_propia': { texto: 'Una persona se dio de baja', icono: 'logout' },
  'usuario.editar': { texto: 'Editó una cuenta', icono: 'edit' },
  'institucion.crear': { texto: 'Creó una institución', icono: 'add_business' },
  'institucion.editar': { texto: 'Editó una institución', icono: 'edit_note' },
  'institucion.docente_asignar': { texto: 'Sumó un docente a una institución', icono: 'person_add' },
  'institucion.docente_quitar': { texto: 'Quitó un docente de una institución', icono: 'person_off' },
  'codigo.generar': { texto: 'Generó un código de invitación', icono: 'key' },
  'codigo.anular': { texto: 'Anuló un código de invitación', icono: 'key_off' },
  'pago.avisar': { texto: 'Una institución avisó un pago', icono: 'request_quote' },
  'pago.confirmar': { texto: 'Confirmó un pago', icono: 'paid' },
  'pago.rechazar': { texto: 'Rechazó un pago', icono: 'money_off' },
  'suscripcion.extender_prueba': { texto: 'Alargó la prueba gratis de una institución', icono: 'more_time' },
  'demostracion.cargar': { texto: 'Cargó datos de demostración', icono: 'science' },
  'demostracion.quitar': { texto: 'Quitó los datos de demostración', icono: 'delete_sweep' },
  'doble_factor.activar': { texto: 'Activó la verificación en dos pasos', icono: 'phonelink_lock' },
  'doble_factor.desactivar': { texto: 'Desactivó la verificación en dos pasos', icono: 'phonelink_erase' },
  'doble_factor.reiniciar': { texto: 'Reinició la verificación en dos pasos de una cuenta', icono: 'lock_reset' },
};

const OBJETIVOS = { usuario: 'la cuenta', institucion: 'la institución', codigo_invitacion: 'el código', pago: 'el pago' };

function textoDeAccion(accion) {
  return ACCIONES[accion]?.texto ?? accion;
}

const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

/** Auditoría (solo la plataforma): qué hicieron los administradores sobre cuentas, instituciones y códigos, y cuándo. */
export default function Auditoria() {
  const [eventos, setEventos] = useState(null); // null = todavía no se cargó
  const [accion, setAccion] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setEventos(await listarAuditoria({ limite: 100, accion: accion || null }));
    } catch (err) {
      setError(err.message || 'No se pudo cargar la auditoría.');
      setEventos((previos) => previos ?? []);
    } finally {
      setCargando(false);
    }
  }, [accion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-md animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[24px] text-primary shrink-0" aria-hidden="true">history</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Auditoría</h1>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="shrink-0 flex items-center gap-space-xs px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">refresh</span>
          Actualizar
        </button>
      </div>

      <p className="m-0 max-w-3xl font-body-sm text-body-sm text-on-surface-variant">
        Las últimas acciones de los administradores. No guarda correos ni nombres de las cuentas afectadas, solo su número, y se conserva
        durante un año.
      </p>

      <div className="flex flex-col gap-1 sm:w-72">
        <label htmlFor="auditoria-accion" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
          Filtrar por acción
        </label>
        <select id="auditoria-accion" value={accion} onChange={(e) => setAccion(e.target.value)} className={CLASE_INPUT}>
          <option value="">Todas</option>
          {Object.entries(ACCIONES).map(([valor, { texto }]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>
      )}

      {eventos === null ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Cargando…</span>
        </div>
      ) : eventos.length === 0 ? (
        <p className="m-0 p-space-lg rounded-xl bg-surface-container-low text-center font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay acciones registradas.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {eventos.map((evento) => (
            <li key={evento.id} className="flex flex-col gap-space-2xs p-space-sm rounded-xl bg-surface-container-low min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
                <span className="flex items-center gap-space-xs min-w-0 font-body-sm text-body-sm font-medium text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
                    {ACCIONES[evento.accion]?.icono ?? 'history'}
                  </span>
                  <span className="break-words">{textoDeAccion(evento.accion)}</span>
                </span>
                <time dateTime={evento.creado_en} className="font-mono-micro text-mono-micro text-on-surface-variant">
                  {fechaDesdeIso(evento.creado_en)?.toLocaleString('es-ES') ?? evento.creado_en}
                </time>
              </div>
              <div className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                Por {evento.actor_nombre ?? (evento.actor_id != null ? `una cuenta que ya no existe (n.º ${evento.actor_id})` : 'el sistema')}
                {evento.objetivo_tipo && ` · sobre ${OBJETIVOS[evento.objetivo_tipo] ?? evento.objetivo_tipo} n.º ${evento.objetivo_id}`}
                {evento.detalle && ` · ${evento.detalle}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
