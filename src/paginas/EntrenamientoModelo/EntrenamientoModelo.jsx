import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { descargarDatasetEntrenamiento, obtenerEstadoEntrenamiento } from '../../api/backend';
import { fechaHoraLegible } from '../../formatoTiempo';

gsap.registerPlugin(useGSAP);

/** Mismo mensaje que ya usa Configuración de Enseñanza para un endpoint todavía no desplegado. */
function mensajeError(err, mensajePorDefecto) {
  if (err?.status === 404 || err?.status === 405) {
    return 'Esta función todavía no está disponible en el servidor.';
  }
  return err?.message || mensajePorDefecto;
}

function CargandoInline({ texto }) {
  return (
    <div className="flex items-center gap-space-xs py-space-sm text-on-surface-variant" role="status">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

function AvisoError({ mensaje, alReintentar }) {
  return (
    <div
      role="alert"
      className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-space-sm flex-wrap"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
      <span className="flex-1 min-w-0">{mensaje}</span>
      {alReintentar && (
        <button
          type="button"
          onClick={alReintentar}
          className="px-space-sm py-space-2xs rounded-lg bg-on-error-container/10 hover:bg-on-error-container/20 font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Cifra chica dentro de la tarjeta de estado: etiqueta arriba, valor abajo. */
function CifraEstado({ etiqueta, valor, icono }) {
  return (
    <div className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1 min-w-0">
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          {icono}
        </span>
        {etiqueta}
      </span>
      <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{valor}</span>
    </div>
  );
}

/** Barra de progreso hacia el umbral de partidas nuevas — mismo criterio visual que `ProgresoSiguienteNivel` (TuNivel.jsx). */
function BarraProgresoUmbral({ progreso, partidasNuevas, umbralPartidas }) {
  const porcentaje = Math.round(Math.min(1, Math.max(0, progreso ?? 0)) * 100);
  const [anchoBarra, setAnchoBarra] = useState(0);
  useEffect(() => {
    const idFrame = requestAnimationFrame(() => setAnchoBarra(porcentaje));
    return () => cancelAnimationFrame(idFrame);
  }, [porcentaje]);

  return (
    <div className="flex flex-col gap-space-2xs">
      <div className="flex items-center justify-between font-mono-micro text-mono-micro text-on-surface-variant">
        <span>Progreso hacia el umbral</span>
        <span className="text-on-surface font-medium">
          {partidasNuevas ?? 0} de {umbralPartidas ?? '—'} partidas nuevas
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-label="Progreso hacia el umbral de partidas nuevas"
        className="h-2.5 rounded-full bg-surface-container-high overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${anchoBarra}%` }}
        />
      </div>
    </div>
  );
}

/** Descripción de la última descarga, o el aviso de que todavía no hubo ninguna. */
function UltimaDescarga({ ultimaDescarga }) {
  if (!ultimaDescarga) {
    return (
      <div className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1">
        <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            history
          </span>
          Última descarga
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">Aún no se descargó nada.</span>
      </div>
    );
  }
  const fecha = fechaHoraLegible(ultimaDescarga.fecha) ?? ultimaDescarga.fecha;
  return (
    <div className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1">
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          history
        </span>
        Última descarga
      </span>
      <span className="font-body-sm text-body-sm font-medium text-on-surface">
        {fecha ?? 'Fecha desconocida'} · {ultimaDescarga.cantidad_partidas ?? 0}{' '}
        {ultimaDescarga.cantidad_partidas === 1 ? 'partida' : 'partidas'}
      </span>
      {ultimaDescarga.facilitador && (
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">Por {ultimaDescarga.facilitador}</span>
      )}
    </div>
  );
}

/**
 * Mensaje de éxito tras la descarga, con la mejor cifra disponible según el
 * estado justo ANTES de descargar (el ZIP en sí es binario, no trae un JSON
 * con conteos) — con "solo nuevas" se conocen partidas y jugadas nuevas; con
 * "todas" el backend no expone un total de jugadas, así que se muestra solo
 * la cantidad de partidas en vez de inventar un número.
 */
function mensajeExitoDescarga(estadoAlDescargar, soloNuevas) {
  if (!estadoAlDescargar) return 'Descarga lista.';
  const partidas = soloNuevas ? estadoAlDescargar.partidas_nuevas : estadoAlDescargar.partidas_validas_total;
  if (partidas == null) return 'Descarga lista.';
  const textoPartidas = `${partidas} ${partidas === 1 ? 'partida' : 'partidas'}`;
  if (soloNuevas && typeof estadoAlDescargar.jugadas_jugador_nuevas === 'number') {
    const jugadas = estadoAlDescargar.jugadas_jugador_nuevas;
    return `Descarga lista: ${textoPartidas}, ${jugadas} ${jugadas === 1 ? 'jugada' : 'jugadas'}.`;
  }
  return `Descarga lista: ${textoPartidas}.`;
}

/**
 * Pantalla "Entrenamiento del modelo" — exclusiva del facilitador. Deja
 * descargar el dataset (PGN + CSV) que alimenta el reentrenamiento por lotes
 * de Turing (HU4). A propósito NO ofrece entrenar desde acá: el reentrenamiento
 * en sí todavía no existe (ver CLAUDE.md — nunca aprendizaje "en vivo", siempre
 * un lote controlado que hace el equipo técnico), así que los pasos 2 y 3 se
 * marcan explícitamente como pendientes.
 *
 * `estadoCompartido`/`alActualizarEstadoCompartido` vienen de App.tsx, que ya
 * sondea `GET /entrenamiento/estado` cada 60 s para la insignia del menú — si
 * ya hay un valor al montar esta pantalla, se usa tal cual y no se repite la
 * consulta; si no (primera carga antes de que ese sondeo responda), esta
 * pantalla la pide ella misma y lo comparte hacia arriba con ese mismo callback.
 */
export default function EntrenamientoModelo({ estadoCompartido = null, alActualizarEstadoCompartido = null }) {
  const raizRef = useRef(null);
  const [estado, setEstado] = useState(estadoCompartido);
  const [cargando, setCargando] = useState(estadoCompartido == null);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(null);

  const [soloNuevas, setSoloNuevas] = useState(false);
  const soloNuevasInicializadoRef = useRef(false);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(null);
  const [exitoDescarga, setExitoDescarga] = useState(null);

  // Si App.tsx recibe un estado más nuevo (su sondeo de 60 s) mientras esta pantalla está abierta, se refleja acá.
  useEffect(() => {
    if (estadoCompartido != null) setEstado(estadoCompartido);
  }, [estadoCompartido]);

  async function cargarEstado({ conSpinner = true } = {}) {
    if (conSpinner) setCargando(true);
    else setActualizando(true);
    setError(null);
    try {
      const datos = await obtenerEstadoEntrenamiento();
      setEstado(datos);
      alActualizarEstadoCompartido?.(datos);
    } catch (err) {
      setError(err);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }

  // Solo pide el estado ella misma si App.tsx todavía no tenía uno (evita duplicar el sondeo de 60 s).
  useEffect(() => {
    if (estadoCompartido == null) cargarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El checkbox arranca marcado si YA hay una descarga previa — una sola vez, para no pisar la
  // elección del facilitador si después el estado se actualiza solo (sondeo de App.tsx).
  useEffect(() => {
    if (soloNuevasInicializadoRef.current || estado == null) return;
    soloNuevasInicializadoRef.current = true;
    setSoloNuevas(Boolean(estado.ultima_descarga));
  }, [estado]);

  useGSAP(
    () => {
      if (!estado) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.entrenamiento-bloque', {
          opacity: 0,
          y: 10,
          duration: 0.35,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope: raizRef, dependencies: [estado != null] }
  );

  async function manejarDescargar() {
    setDescargando(true);
    setErrorDescarga(null);
    setExitoDescarga(null);
    const estadoAlDescargar = estado;
    try {
      const { blob, nombre } = await descargarDatasetEntrenamiento({ soloNuevas });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      setExitoDescarga(mensajeExitoDescarga(estadoAlDescargar, soloNuevas));
      await cargarEstado({ conSpinner: false });
    } catch (err) {
      setErrorDescarga(mensajeError(err, 'No se pudo descargar el dataset.'));
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div ref={raizRef} className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg max-w-4xl mx-auto">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[24px] text-primary">database</span>
        <h1 className="font-headline-sm text-headline-sm text-on-surface">Entrenamiento del modelo</h1>
      </div>

      {cargando && !estado && <CargandoInline texto="Cargando datos de entrenamiento…" />}

      {error && !estado && (
        <AvisoError mensaje={mensajeError(error, 'No se pudo cargar el estado de entrenamiento.')} alReintentar={() => cargarEstado()} />
      )}

      {estado && (
        <>
          {/* 1. Tarjeta de estado */}
          <section className="entrenamiento-bloque bg-surface-container-low rounded-xl p-space-lg shadow-md flex flex-col gap-space-md">
            <div className="flex items-center justify-between gap-space-sm flex-wrap">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Datos para entrenar a Turing</h2>
              {estado.listo_para_entrenar ? (
                <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-primary text-on-primary font-mono-label text-mono-label font-medium animate-pulse motion-reduce:animate-none">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    check_circle
                  </span>
                  Listo para entrenar
                </span>
              ) : (
                <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-mono-label text-mono-label font-medium">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    hourglass_top
                  </span>
                  Reuniendo datos
                </span>
              )}
            </div>

            <BarraProgresoUmbral
              progreso={estado.progreso}
              partidasNuevas={estado.partidas_nuevas}
              umbralPartidas={estado.umbral_partidas}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
              <CifraEstado etiqueta="Partidas válidas en total" valor={estado.partidas_validas_total ?? 0} icono="inventory_2" />
              <CifraEstado etiqueta="Partidas nuevas" valor={estado.partidas_nuevas ?? 0} icono="fiber_new" />
              <CifraEstado etiqueta="Jugadas nuevas del jugador" valor={estado.jugadas_jugador_nuevas ?? 0} icono="touch_app" />
              <CifraEstado etiqueta="Modelo actual" valor={estado.modelo_actual ?? 'Sin información'} icono="smart_toy" />
              <div className="col-span-2 sm:col-span-2">
                <UltimaDescarga ultimaDescarga={estado.ultima_descarga} />
              </div>
            </div>

            {actualizando && (
              <span className="font-mono-micro text-mono-micro text-on-surface-variant flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                Actualizando…
              </span>
            )}
            {error && (
              <AvisoError mensaje={mensajeError(error, 'No se pudo actualizar el estado.')} alReintentar={() => cargarEstado()} />
            )}
          </section>

          {/* 2. Descarga */}
          <section className="entrenamiento-bloque bg-surface-container-low rounded-xl p-space-lg shadow-md flex flex-col gap-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
                download
              </span>
              Descargar dataset
            </h2>

            <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={soloNuevas}
                onChange={(evento) => setSoloNuevas(evento.target.checked)}
                disabled={descargando}
                className="w-4 h-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              Solo las partidas nuevas desde la última descarga
            </label>

            <div>
              <button
                type="button"
                onClick={manejarDescargar}
                disabled={descargando}
                className="px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none hover:bg-primary-fixed disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {descargando ? (
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin motion-reduce:animate-none" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    download
                  </span>
                )}
                {descargando ? 'Descargando…' : 'Descargar datos para entrenar (PGN + CSV)'}
              </button>
            </div>

            {exitoDescarga && (
              <div
                role="status"
                className="px-space-sm py-space-xs rounded-lg bg-surface-bright text-primary font-body-sm text-body-sm flex items-center gap-space-xs"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                  check_circle
                </span>
                <span>{exitoDescarga}</span>
              </div>
            )}
            {errorDescarga && <AvisoError mensaje={errorDescarga} alReintentar={manejarDescargar} />}
          </section>

          {/* 3. Cómo se entrena el modelo */}
          <section className="entrenamiento-bloque bg-surface-container-low rounded-xl p-space-lg shadow-md flex flex-col gap-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">¿Cómo se entrena el modelo?</h2>

            <ol className="flex flex-col gap-space-sm">
              <PasoEntrenamiento numero={1} titulo="Descarga el archivo" enDesarrollo={false}>
                Cuando arriba diga <strong className="text-on-surface">&ldquo;Listo para entrenar&rdquo;</strong>, descarga el
                archivo con el botón de esta pantalla.
              </PasoEntrenamiento>
              <PasoEntrenamiento numero={2} titulo="Entrégaselo al equipo técnico" enDesarrollo>
                El equipo técnico usa ese archivo para reentrenar a Turing en un lote controlado, fuera de una partida en
                curso.
              </PasoEntrenamiento>
              <PasoEntrenamiento numero={3} titulo="Se compara y se activa solo si mejora" enDesarrollo>
                La nueva versión se compara con la actual y solo reemplaza al modelo en uso si mejora.
              </PasoEntrenamiento>
            </ol>

            <div className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container border border-outline-variant/30">
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed flex items-start gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5" aria-hidden="true">
                  shield
                </span>
                Los archivos no incluyen nombres ni correos: los jugadores son anónimos.
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed flex items-start gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5" aria-hidden="true">
                  info
                </span>
                Turing nunca aprende durante una partida: solo se reentrena por lotes, con tu descarga.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PasoEntrenamiento({ numero, titulo, enDesarrollo, children }) {
  return (
    <li className="flex items-start gap-space-sm">
      <span className="w-7 h-7 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-mono-label text-mono-label font-bold">
        {numero}
      </span>
      <div className="flex flex-col gap-space-2xs min-w-0">
        <div className="flex items-center gap-space-xs flex-wrap">
          <span className="font-body-sm text-body-sm font-medium text-on-surface">{titulo}</span>
          {enDesarrollo && (
            <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-mono-micro text-[10px] uppercase tracking-wide">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                construction
              </span>
              En desarrollo (HU4)
            </span>
          )}
        </div>
        <p className="font-mono-micro text-mono-micro text-on-surface-variant leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
