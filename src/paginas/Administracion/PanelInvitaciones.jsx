import { useCallback, useEffect, useState } from 'react';
import { anularCodigoFacilitador, generarCodigoFacilitador, listarCodigosFacilitador, listarInstituciones } from '../../api/backend';
import CodigoCompartible from '../../componentes/CodigoCompartible';
import { fechaDesdeIso } from '../../formatoTiempo';

const DURACIONES_SIN_INSTITUCION = [
  { minutos: 5, etiqueta: '5 minutos' },
  { minutos: 15, etiqueta: '15 minutos' },
  { minutos: 60, etiqueta: '1 hora' },
  { minutos: 1440, etiqueta: '24 horas' },
];
const DURACIONES_DE_INSTITUCION = [
  { minutos: 1440, etiqueta: '1 día' },
  { minutos: 4320, etiqueta: '3 días' },
  { minutos: 10080, etiqueta: '7 días' },
];

const ESTILO_ESTADO = {
  vigente: { texto: 'VIGENTE', clase: 'bg-primary-container text-primary' },
  usado: { texto: 'USADO', clase: 'bg-surface-bright text-on-surface-variant' },
  vencido: { texto: 'VENCIDO', clase: 'bg-error-container text-error' },
};

const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

/** Minutos y segundos que faltan hasta `expiraEn`, como "12:05" o "2 d 04 h"; `null` si ya pasó. */
function tiempoRestante(expiraEn, ahora) {
  const fecha = fechaDesdeIso(expiraEn);
  if (!fecha) return null;
  const segundos = Math.floor((fecha.getTime() - ahora) / 1000);
  if (segundos <= 0) return null;
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (dias > 0) return `${dias} d ${String(horas).padStart(2, '0')} h`;
  return horas > 0 ? `${horas} h ${String(minutos).padStart(2, '0')} min` : `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Códigos de invitación para nuevos facilitadores. El código se ve una sola vez, apenas se genera, junto a un enlace para mandarlo por
 * WhatsApp: después solo queda su estado. Sirve una vez y vence solo, así no hay un PIN fijo que se filtre.
 *
 * - `modo="plataforma"` (por defecto): la plataforma puede ligar el código a una institución y dejar a la persona como su administrador.
 * - `modo="institucion"`: el director invita docentes a SU institución (`institucion`: `{ id, nombre }`).
 */
export default function PanelInvitaciones({ modo = 'plataforma', institucion = null }) {
  const deInstitucion = modo === 'institucion';
  const [abierto, setAbierto] = useState(deInstitucion);
  const [codigos, setCodigos] = useState([]);
  const [instituciones, setInstituciones] = useState([]);
  const [institucionId, setInstitucionId] = useState('');
  const [comoAdministrador, setComoAdministrador] = useState(false);
  const [minutos, setMinutos] = useState(deInstitucion ? 4320 : 15);
  const [para, setPara] = useState('');
  const [nuevo, setNuevo] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const conInstitucion = deInstitucion || institucionId !== '';
  const duraciones = conInstitucion ? DURACIONES_DE_INSTITUCION : DURACIONES_SIN_INSTITUCION;
  const institucionElegida = instituciones.find((i) => String(i.id) === institucionId);
  const puedeSerAdministrador = !deInstitucion && institucionElegida && institucionElegida.administrador_id == null;

  const cargar = useCallback(async () => {
    try {
      setCodigos(await listarCodigosFacilitador());
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los códigos.');
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    cargar();
    if (!deInstitucion) listarInstituciones().then(setInstituciones).catch(() => setInstituciones([]));
  }, [abierto, cargar, deInstitucion]);

  // Cuenta regresiva en vivo mientras haya un código vigente a la vista.
  useEffect(() => {
    if (!abierto) return undefined;
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [abierto]);

  // Si se cambia de institución, la duración tiene que ser una de las que admite ese tipo de código.
  useEffect(() => {
    if (!duraciones.some((d) => d.minutos === minutos)) setMinutos(duraciones[0].minutos);
    if (!puedeSerAdministrador) setComoAdministrador(false);
  }, [duraciones, minutos, puedeSerAdministrador]);

  async function generar(evento) {
    evento.preventDefault();
    setGenerando(true);
    setError(null);
    try {
      const creado = await generarCodigoFacilitador(minutos, para.trim() || null, {
        institucionId: deInstitucion ? institucion?.id ?? null : institucionId === '' ? null : Number(institucionId),
        comoAdministrador,
      });
      setNuevo(creado);
      setPara('');
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo generar el código.');
    } finally {
      setGenerando(false);
    }
  }

  async function anular(codigo) {
    try {
      await anularCodigoFacilitador(codigo.id);
      if (nuevo?.id === codigo.id) setNuevo(null);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo anular el código.');
    }
  }

  return (
    <section className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center justify-between gap-space-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-lg"
      >
        <span className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[22px] text-primary shrink-0" aria-hidden="true">vpn_key</span>
          <span className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {deInstitucion ? 'Invitar a un docente' : 'Invitar a un nuevo facilitador'}
            </span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              {deInstitucion
                ? `Le mandás un enlace por WhatsApp y queda como docente de ${institucion?.nombre ?? 'tu institución'}.`
                : 'Genera un código de un solo uso que vence solo, con un enlace para mandar por WhatsApp.'}
            </span>
          </span>
        </span>
        <span className="material-symbols-outlined text-[22px] text-on-surface-variant shrink-0" aria-hidden="true">
          {abierto ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {abierto && (
        <div className="flex flex-col gap-space-md pt-space-xs border-t border-outline-variant/20">
          <form onSubmit={generar} className="flex flex-col gap-space-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-xs">
              {!deInstitucion && (
                <div className="flex flex-col gap-1 min-w-0">
                  <label htmlFor="codigo-institucion" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
                    Para la institución (opcional)
                  </label>
                  <select id="codigo-institucion" value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} className={CLASE_INPUT}>
                    <option value="">Ninguna: solo permiso de facilitador</option>
                    {instituciones.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="codigo-duracion" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Dura</label>
                <select id="codigo-duracion" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} className={CLASE_INPUT}>
                  {duraciones.map((d) => (
                    <option key={d.minutos} value={d.minutos}>{d.etiqueta}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-0 xl:col-span-2">
                <label htmlFor="codigo-para" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Para quién (opcional)</label>
                <input id="codigo-para" value={para} onChange={(e) => setPara(e.target.value)} maxLength={100} placeholder="Ej.: Prof. Gómez" className={CLASE_INPUT} />
              </div>
            </div>
            {puedeSerAdministrador && (
              <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface cursor-pointer min-h-10">
                <input type="checkbox" checked={comoAdministrador} onChange={(e) => setComoAdministrador(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                Que quede como administrador de «{institucionElegida.nombre}»
              </label>
            )}
            <button
              type="submit"
              disabled={generando}
              className="self-start px-space-md py-space-xs min-h-10 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:bg-primary-fixed transition-colors disabled:opacity-50 flex items-center justify-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              {generando ? 'Generando…' : 'Generar invitación'}
            </button>
          </form>

          {error && (
            <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">{error}</div>
          )}

          {nuevo && (
            <CodigoCompartible
              codigo={nuevo.codigo}
              expiraEn={nuevo.expira_en}
              institucion={nuevo.institucion_nombre}
              comoAdministrador={nuevo.como_administrador}
            />
          )}

          <div className="flex flex-col gap-space-2xs">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Códigos recientes</span>
            {codigos.length === 0 ? (
              <span className="font-body-sm text-body-sm text-outline">Todavía no generaste ningún código.</span>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs max-h-64 overflow-y-auto">
                {codigos.map((codigo) => {
                  const estilo = ESTILO_ESTADO[codigo.estado] ?? ESTILO_ESTADO.vencido;
                  const restante = codigo.estado === 'vigente' ? tiempoRestante(codigo.expira_en, ahora) : null;
                  return (
                    <li key={codigo.id} className="flex flex-wrap items-center justify-between gap-space-xs px-space-sm py-space-xs rounded-lg bg-surface-container">
                      <span className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm text-on-surface break-words">
                          {codigo.para || 'Sin destinatario'}
                          {codigo.usado_por ? ` → usado por ${codigo.usado_por}` : ''}
                        </span>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                          {fechaDesdeIso(codigo.creado_en)?.toLocaleString('es-ES') ?? codigo.creado_en}
                          {codigo.institucion_nombre ? ` · ${codigo.institucion_nombre} (${codigo.es_evaluacion ? 'evaluación' : codigo.como_administrador ? 'administrador' : 'docente'})` : ''}
                          {restante ? ` · vence en ${restante}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-space-xs">
                        <span className={`font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full font-medium ${estilo.clase}`}>{estilo.texto}</span>
                        {codigo.estado !== 'usado' && (
                          <button
                            type="button"
                            onClick={() => anular(codigo)}
                            aria-label={`Anular el código ${codigo.para ? `para ${codigo.para}` : 'sin destinatario'}`}
                            className="p-1 rounded-lg text-error hover:bg-error/10 min-w-9 min-h-9 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
