import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { obtenerInformeAlumno, obtenerMiProgreso } from '../../api/backend';
import { enlaceDeWhatsApp } from '../../enlaceInvitacion';
import { enlaceWhatsApp } from '../../whatsapp';
import { enlaceCorreoFamilia } from '../../contactoFamilia';
import { fechaDesdeIso } from '../../formatoTiempo';
import useModalAccesible from '../../useModalAccesible';
import GraficoElo from './GraficoElo';
import GraficoEvolucion from './GraficoEvolucion';
import { NOMBRE_DE_FASE, TENDENCIAS, haceCuanto, mensajeParaElResponsable, numero, porcentaje, puntos, variacionElo } from './comunes';

const BOTON =
  'flex items-center justify-center gap-space-2xs px-space-md py-space-xs min-h-10 rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BOTON_PRINCIPAL = `${BOTON} bg-primary text-on-primary font-medium hover:brightness-110`;
const BOTON_NEUTRO = `${BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;

function fechaLarga(iso) {
  return fechaDesdeIso(iso)?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '';
}

function Cifra({ etiqueta, valor, detalle = null }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 p-space-sm rounded-xl bg-surface-container">
      <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant break-words">{etiqueta}</span>
      <span className="font-headline-sm text-headline-sm text-on-surface break-words">{valor}</span>
      {detalle && <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">{detalle}</span>}
    </div>
  );
}

function Momento({ titulo, nivel, rango, precision, nota }) {
  return (
    <div className="flex flex-col gap-1 p-space-md rounded-xl bg-surface-container min-w-0">
      <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">{titulo}</span>
      <span className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface">
        {nivel != null ? `Nivel ${nivel}` : '—'}
      </span>
      <span className="font-body-sm text-body-sm text-primary">{rango ?? 'Sin medir'}</span>
      <span className="font-mono-metric text-mono-metric text-on-surface-variant">{precision != null ? `${numero(precision)} % de precisión` : ''}</span>
      {nota && <span className="font-mono-micro text-mono-micro text-on-surface-variant">{nota}</span>}
    </div>
  );
}

/** El antes y el después: dos tarjetas y, en medio, cuánto cambió. Si todavía no hay con qué comparar, lo dice. */
function AntesYDespues({ progreso }) {
  const tendencia = TENDENCIAS[progreso.tendencia];
  return (
    <section aria-label="Antes y después" className="flex flex-col gap-space-sm">
      <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">Antes y después</h3>
      {progreso.calibradas === 0 ? (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Todavía no tiene partidas medidas. Cuando juegue las primeras, acá aparece su punto de partida.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-stretch gap-space-xs">
          <Momento
            titulo="Antes · su diagnóstico"
            nivel={progreso.nivel_antes}
            rango={progreso.rango_antes}
            precision={progreso.precision_antes}
            nota={progreso.diagnostico_completo ? 'Promedio de sus 3 primeras partidas' : `Provisional: ${progreso.calibradas} de 3 partidas`}
          />
          <div className={`flex sm:flex-col items-center justify-center gap-space-2xs px-space-sm py-space-xs rounded-xl ${tendencia.fondo} ${tendencia.clase}`}>
            <span className="material-symbols-outlined text-[28px]" aria-hidden="true">{tendencia.icono}</span>
            <span className="font-mono-metric text-mono-metric font-bold text-center">{progreso.comparable ? puntos(progreso.variacion_precision) : tendencia.texto}</span>
            {progreso.comparable && <span className="font-mono-micro text-mono-micro uppercase">{tendencia.texto}</span>}
          </div>
          {progreso.comparable ? (
            <Momento
              titulo="Después · hoy"
              nivel={progreso.nivel_despues}
              rango={progreso.rango_despues}
              precision={progreso.precision_despues}
              nota={progreso.confirmado ? 'Promedio de sus 3 últimas partidas' : 'Provisional: falta jugar más para confirmarlo'}
            />
          ) : (
            <div className="flex items-center p-space-md rounded-xl border border-dashed border-outline-variant/50 font-body-sm text-body-sm text-on-surface-variant">
              {progreso.diagnostico_completo
                ? 'Con una partida más ya se puede comparar contra su punto de partida.'
                : 'Después de 3 partidas medidas queda fijado su punto de partida.'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BarraDeFase({ fase }) {
  const sinDatos = fase.precision == null;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-space-sm font-body-sm text-body-sm">
        <span className="text-on-surface">{NOMBRE_DE_FASE[fase.fase]}</span>
        <span className="font-mono-metric text-mono-metric text-on-surface-variant">{sinDatos ? 'sin jugadas medidas' : porcentaje(fase.precision)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
        <div className="barra-informe h-full rounded-full bg-primary" style={{ width: `${sinDatos ? 0 : fase.precision}%` }} />
      </div>
    </li>
  );
}

/** Su Elo y lo que ganó, empató y perdió contra compañeros, con las amistosas aparte (esas no mueven el Elo). No se muestra si nunca jugó con otra persona. */
function ConCompaneros({ competencia }) {
  if (!competencia || (competencia.total === 0 && competencia.partidas_elo === 0 && !competencia.puestos_en_torneos?.length)) return null;
  const serias = ['ganadas', 'empatadas', 'perdidas'].map((clave) => (competencia.puntuadas?.[clave] ?? 0) + (competencia.torneos?.[clave] ?? 0));
  const amistosas = ['ganadas', 'empatadas', 'perdidas'].map((clave) => competencia.amistosas?.[clave] ?? 0);
  const detalleElo = [competencia.elo_provisional ? 'provisional' : null, competencia.partidas_elo > 0 ? `${variacionElo(competencia.elo_cambio_30_dias)} en 30 días` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <section aria-label="Con compañeros" className="flex flex-col gap-space-xs">
      <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">Jugando con compañeros</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
        <Cifra etiqueta="Elo" valor={competencia.partidas_elo > 0 ? competencia.elo : '—'} detalle={detalleElo || 'todavía sin partidas puntuadas'} />
        <Cifra etiqueta="Puntuadas y torneos" valor={serias.join(' · ')} detalle="ganadas · empatadas · perdidas" />
        <Cifra etiqueta="Amistosas" valor={amistosas.join(' · ')} detalle="no mueven el Elo" />
      </div>
      {competencia.serie_elo?.length > 1 && (
        <div className="flex flex-col gap-space-2xs">
          <h4 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">Cómo fue cambiando su Elo</h4>
          <GraficoElo serie={competencia.serie_elo} />
        </div>
      )}
      {competencia.puestos_en_torneos?.length > 0 && (
        <div className="flex flex-col gap-space-2xs">
          <h4 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">Torneos</h4>
          <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
            {competencia.puestos_en_torneos.map((torneo) => (
              <li key={`${torneo.nombre}-${torneo.fecha}`} className="flex flex-wrap items-center justify-between gap-space-xs p-space-xs rounded-lg bg-surface-container font-body-sm text-body-sm">
                <span className="text-on-surface break-words min-w-0">{torneo.nombre}</span>
                <span className="font-mono-metric text-mono-metric text-on-surface-variant">
                  {torneo.estado === 'terminado' ? `Puesto ${torneo.puesto} de ${torneo.de}` : `Va ${torneo.puesto} de ${torneo.de} · en juego`} · {numero(torneo.puntos)} {torneo.puntos === 1 ? 'punto' : 'puntos'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
        El Elo mide resultados contra otras personas: empieza en 1000 y es provisional hasta las 20 partidas. No es lo mismo que el nivel, que mide la calidad de las jugadas.
      </p>
    </section>
  );
}

function ContenidoDelInforme({ informe }) {
  const { alumno, progreso, actividad, resultados, medallas } = informe;
  const donde = [alumno.curso, alumno.docente && `Docente: ${alumno.docente}`, alumno.institucion].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-space-md">
      <header className="flex flex-col gap-1 pb-space-sm border-b border-outline-variant/40">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">ChessIA · Informe de progreso</span>
        <h2 id="titulo-informe" className="m-0 font-headline-lg text-headline-lg text-on-surface break-words">{alumno.nombre}</h2>
        {donde && <span className="font-body-sm text-body-sm text-on-surface-variant break-words">{donde}</span>}
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">Generado el {fechaLarga(informe.generado_en)}</span>
      </header>

      <AntesYDespues progreso={progreso} />

      <section aria-label="Evolución" className="flex flex-col gap-space-xs">
        <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">Cómo fue evolucionando</h3>
        <GraficoEvolucion serie={progreso.serie} />
      </section>

      <section aria-label="En palabras" className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container">
        <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">En pocas palabras</h3>
        <ul className="m-0 pl-space-md flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface">
          {informe.lectura.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Constancia y resultados" className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
        <Cifra etiqueta="Partidas jugadas" valor={actividad.partidas} detalle={`${actividad.partidas_30_dias} en los últimos 30 días`} />
        <Cifra etiqueta="Última partida" valor={haceCuanto(actividad.dias_sin_jugar)} />
        <Cifra etiqueta="Resultados" valor={`${resultados.ganadas} · ${resultados.tablas} · ${resultados.perdidas}`} detalle="ganadas · tablas · perdidas" />
        <Cifra etiqueta="Precisión promedio" valor={porcentaje(resultados.precision_promedio)} detalle="de sus jugadas fueron acertadas" />
        <Cifra etiqueta="Racha de victorias" valor={resultados.racha_victorias} />
        <Cifra etiqueta="Medallas" valor={medallas.total ?? 0} detalle={medallas.destacadas?.length ? medallas.destacadas.map((m) => m.nombre).join(', ') : null} />
      </section>

      <ConCompaneros competencia={informe.competencia} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
        <section aria-label="Precisión por fase" className="flex flex-col gap-space-xs">
          <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">Dónde juega mejor</h3>
          <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
            {informe.precision_por_fase.map((fase) => (
              <BarraDeFase key={fase.fase} fase={fase} />
            ))}
          </ul>
        </section>
        <section aria-label="Errores frecuentes" className="flex flex-col gap-space-xs">
          <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">Lo que más se repite</h3>
          {informe.errores_frecuentes.length === 0 ? (
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay jugadas analizadas.</p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
              {informe.errores_frecuentes.map((error) => (
                <li key={error.tipo} className="flex items-center justify-between gap-space-sm p-space-xs rounded-lg bg-surface-container font-body-sm text-body-sm">
                  <span className="capitalize text-on-surface">{error.nombre}</span>
                  <span className="font-mono-metric text-mono-metric text-on-surface-variant">{error.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="m-0 pt-space-sm border-t border-outline-variant/40 font-mono-micro text-mono-micro text-on-surface-variant">
        Cómo se mide: la precisión compara cada jugada del alumno con la mejor posible según un motor de ajedrez. El «antes» es el promedio de
        sus 3 primeras partidas medidas; el «después», el de las últimas 3 posteriores. Un cambio menor a 2 puntos se considera ruido entre
        partidas. Este informe es personal: no se publica en ningún enlace.
      </p>
    </div>
  );
}

/**
 * El informe de progreso de un alumno, para que su docente se lo muestre a sus responsables (o para que el propio jugador se lo muestre a
 * su familia): de dónde partió, cómo va, cuánto juega y qué le conviene trabajar. `alumnoId` vacío = el del jugador que tiene la sesión.
 * Se puede imprimir o guardar como PDF (el navegador deja solo el informe en la hoja) y mandar un resumen corto por WhatsApp.
 */
export default function InformeAlumno({ alumnoId = null, alCerrar }) {
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(null);
  const [informe, setInforme] = useState(null);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);

  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: cerrarRef });

  useEffect(() => {
    let vigente = true;
    (alumnoId == null ? obtenerMiProgreso() : obtenerInformeAlumno(alumnoId))
      .then((datos) => vigente && setInforme(datos))
      .catch((err) => vigente && setError(err.message || 'No se pudo cargar el informe.'));
    return () => {
      vigente = false;
    };
  }, [alumnoId]);

  useEffect(() => {
    if (!copiado) return undefined;
    const temporizador = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(temporizador);
  }, [copiado]);

  async function copiarResumen() {
    try {
      await navigator.clipboard.writeText(mensajeParaElResponsable(informe));
      setCopiado(true);
    } catch {
      setCopiado(false); // sin permiso de portapapeles: queda el botón de WhatsApp
    }
  }

  return createPortal(
    <div
      id="informe-impreso"
      className="fixed inset-0 z-[90] flex items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/85 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-informe"
        className="hoja-informe w-full max-w-3xl max-h-[94dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md sm:p-space-lg flex flex-col gap-space-md"
      >
        <div className="no-imprimir flex flex-wrap items-center justify-between gap-space-xs">
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" onClick={() => window.print()} disabled={!informe} className={`${BOTON_PRINCIPAL} disabled:opacity-50`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">print</span>
              Imprimir o guardar PDF
            </button>
            {informe && (
              <>
                {informe.alumno.tutor_email && <a href={enlaceCorreoFamilia(informe.alumno.tutor_email, mensajeParaElResponsable(informe))} className={`${BOTON_NEUTRO} no-underline`}>Resumen por correo a la familia</a>}
                <a href={enlaceWhatsApp(informe.alumno.tutor_telefono, mensajeParaElResponsable(informe)) || enlaceDeWhatsApp(mensajeParaElResponsable(informe))} target="_blank" rel="noopener noreferrer" className={`${BOTON_NEUTRO} no-underline`}>
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">send</span>
                  Resumen por WhatsApp
                </a>
                <button type="button" onClick={copiarResumen} className={BOTON_NEUTRO}>
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'content_copy'}</span>
                  {copiado ? 'Copiado' : 'Copiar resumen'}
                </button>
              </>
            )}
          </div>
          <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar el informe" className={BOTON_NEUTRO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            Cerrar
          </button>
        </div>

        {!informe && !error && (
          <div role="status" className="flex items-center gap-space-xs py-space-lg justify-center text-on-surface-variant">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
            <span className="font-mono-micro text-mono-micro">Armando el informe…</span>
          </div>
        )}
        {error && <div role="alert" className="p-space-md rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
        {informe && <ContenidoDelInforme informe={informe} />}
      </div>
    </div>,
    document.body,
  );
}
