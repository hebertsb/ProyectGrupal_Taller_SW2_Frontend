import { useCallback, useEffect, useState } from 'react';
import { anularCodigoFacilitador, generarCodigoFacilitador, listarCodigosFacilitador } from '../../api/backend';
import { fechaDesdeIso } from '../../formatoTiempo';

const DURACIONES = [
  { minutos: 5, etiqueta: '5 minutos' },
  { minutos: 15, etiqueta: '15 minutos' },
  { minutos: 60, etiqueta: '1 hora' },
  { minutos: 1440, etiqueta: '24 horas' },
];

const ESTILO_ESTADO = {
  vigente: { texto: 'VIGENTE', clase: 'bg-primary-container text-primary' },
  usado: { texto: 'USADO', clase: 'bg-surface-bright text-on-surface-variant' },
  vencido: { texto: 'VENCIDO', clase: 'bg-error-container text-error' },
};

/** Minutos y segundos que faltan hasta `expiraEn`, como "12:05"; `null` si ya pasó. */
function tiempoRestante(expiraEn, ahora) {
  const fecha = fechaDesdeIso(expiraEn);
  if (!fecha) return null;
  const segundos = Math.floor((fecha.getTime() - ahora) / 1000);
  if (segundos <= 0) return null;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = String(segundos % 60).padStart(2, '0');
  return horas > 0 ? `${horas} h ${String(minutos).padStart(2, '0')} min` : `${minutos}:${resto}`;
}

/**
 * Códigos de invitación para nuevos facilitadores (solo facilitadores). El código se ve una sola vez, apenas
 * se genera: después solo queda su estado. Sirve una vez y vence solo, así no hay un PIN fijo que se filtre.
 */
export default function PanelInvitaciones() {
  const [abierto, setAbierto] = useState(false);
  const [codigos, setCodigos] = useState([]);
  const [minutos, setMinutos] = useState(15);
  const [para, setPara] = useState('');
  const [nuevo, setNuevo] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    try {
      setCodigos(await listarCodigosFacilitador());
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los códigos.');
    }
  }, []);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  // Cuenta regresiva en vivo mientras haya un código vigente a la vista.
  useEffect(() => {
    if (!abierto) return undefined;
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [abierto]);

  async function generar(evento) {
    evento.preventDefault();
    setGenerando(true);
    setError(null);
    setCopiado(false);
    try {
      const creado = await generarCodigoFacilitador(minutos, para.trim() || null);
      setNuevo(creado);
      setPara('');
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo generar el código.');
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(nuevo.codigo);
      setCopiado(true);
    } catch {
      setCopiado(false); // sin permiso de portapapeles: el código igual está a la vista para dictarlo
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

  const restanteNuevo = nuevo ? tiempoRestante(nuevo.expira_en, ahora) : null;

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
            <span className="font-headline-sm text-headline-sm text-on-surface">Invitar a un nuevo facilitador</span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Genera un código de un solo uso que vence solo.
            </span>
          </span>
        </span>
        <span className="material-symbols-outlined text-[22px] text-on-surface-variant shrink-0" aria-hidden="true">
          {abierto ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {abierto && (
        <div className="flex flex-col gap-space-md pt-space-xs border-t border-outline-variant/20">
          <form onSubmit={generar} className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
            <div className="flex flex-col gap-1 sm:w-44">
              <label htmlFor="codigo-duracion" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
                Dura
              </label>
              <select
                id="codigo-duracion"
                value={minutos}
                onChange={(e) => setMinutos(Number(e.target.value))}
                className="px-space-sm py-space-xs rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm"
              >
                {DURACIONES.map((d) => (
                  <option key={d.minutos} value={d.minutos}>{d.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label htmlFor="codigo-para" className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
                Para quién (opcional)
              </label>
              <input
                id="codigo-para"
                value={para}
                onChange={(e) => setPara(e.target.value)}
                maxLength={100}
                placeholder="Ej.: Prof. Gómez"
                className="px-space-sm py-space-xs rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0"
              />
            </div>
            <button
              type="submit"
              disabled={generando}
              className="px-space-md py-space-xs min-h-10 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:bg-primary-fixed transition-colors disabled:opacity-50 flex items-center justify-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              {generando ? 'Generando…' : 'Generar código'}
            </button>
          </form>

          {error && (
            <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
              {error}
            </div>
          )}

          {nuevo && (
            <div role="status" className="flex flex-col gap-space-xs p-space-md rounded-xl bg-primary/10 border border-primary/40">
              <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">
                Código nuevo{nuevo.para ? ` para ${nuevo.para}` : ''}
              </span>
              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="font-mono-metric text-[28px] sm:text-[34px] tracking-[0.2em] text-on-surface break-all select-all">
                  {nuevo.codigo}
                </span>
                <button
                  type="button"
                  onClick={copiar}
                  className="flex items-center gap-1 px-space-sm py-space-2xs min-h-9 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                    {copiado ? 'check' : 'content_copy'}
                  </span>
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
                {restanteNuevo
                  ? `Vence en ${restanteNuevo}. Sirve una sola vez.`
                  : 'Este código ya venció.'}{' '}
                Dáselo a la persona: <strong>se muestra solo ahora</strong>, después no se puede volver a ver (si lo perdés,
                generá otro).
              </p>
            </div>
          )}

          <div className="flex flex-col gap-space-2xs">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
              Códigos recientes
            </span>
            {codigos.length === 0 ? (
              <span className="font-body-sm text-body-sm text-outline">Todavía no generaste ningún código.</span>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs max-h-64 overflow-y-auto">
                {codigos.map((codigo) => {
                  const estilo = ESTILO_ESTADO[codigo.estado] ?? ESTILO_ESTADO.vencido;
                  const restante = codigo.estado === 'vigente' ? tiempoRestante(codigo.expira_en, ahora) : null;
                  return (
                    <li
                      key={codigo.id}
                      className="flex flex-wrap items-center justify-between gap-space-xs px-space-sm py-space-xs rounded-lg bg-surface-container"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-body-sm text-body-sm text-on-surface truncate">
                          {codigo.para || 'Sin destinatario'}
                          {codigo.usado_por ? ` → usado por ${codigo.usado_por}` : ''}
                        </span>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                          {fechaDesdeIso(codigo.creado_en)?.toLocaleString('es-ES') ?? codigo.creado_en}
                          {restante ? ` · vence en ${restante}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-space-xs">
                        <span className={`font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full font-medium ${estilo.clase}`}>
                          {estilo.texto}
                        </span>
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
