import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { obtenerNivelJugador } from '../../api/backend';
import { BANDAS_POR_DEFECTO, NIVEL_DIAGNOSTICO, NIVEL_MAX_MODELO, NIVEL_MAX_STOCKFISH, precisionAPorcentaje } from '../../nivelJugador';

gsap.registerPlugin(useGSAP);

/**
 * Sección "Tu nivel" del Panel de Aprendizaje. Muestra el nivel MEDIDO del
 * jugador (el backend lo calcula comparando sus jugadas con las de Stockfish;
 * Turing no interviene): encabezado, progreso hacia el siguiente nivel, la
 * escalera 0-20 por rango y la precisión de sus últimas partidas.
 *
 * El acordeón solo monta su contenido cuando la sección está abierta, así que
 * los datos se vuelven a pedir cada vez que se abre. Nunca inventa un rango: si
 * todavía no hay diagnóstico lo dice, y si la consulta falla cae a mostrar solo
 * el último rango guardado en el perfil (si existe).
 */
export default function TuNivel({
  usuario,
  alIrASalaControl = null,
  claseTextoContenido = 'font-body-sm text-body-sm',
}) {
  const raizRef = useRef(null);
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    obtenerNivelJugador()
      .then((respuesta) => {
        if (!cancelado) setDatos(respuesta);
      })
      .catch((err) => {
        if (!cancelado) setError(err);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [intento]);

  // Entrada sutil de los bloques y de los chips de la escalera; con "reducir
  // movimiento" no se anima nada. Solo opacidad/escala.
  useGSAP(
    () => {
      if (!datos) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.tu-nivel-bloque', {
          opacity: 0,
          y: 10,
          duration: 0.35,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
        gsap.from('.tu-nivel-chip', {
          opacity: 0,
          scale: 0.85,
          duration: 0.25,
          stagger: 0.015,
          delay: 0.15,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope: raizRef, dependencies: [datos] }
  );

  const sinMedir = datos != null && (datos.diagnostico_completado === false || datos.nivel_estimado == null);

  return (
    <div ref={raizRef} className="flex flex-col gap-space-md">
      {cargando && !datos && (
        <div className="flex items-center gap-2 py-2 text-on-surface-variant" role="status">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Cargando tu nivel…</span>
        </div>
      )}

      {error && !datos && (
        <ErrorNivel
          error={error}
          rangoGuardado={usuario?.rango_estimado ?? null}
          alReintentar={() => setIntento((actual) => actual + 1)}
        />
      )}

      {sinMedir && <SinMedir alIrASalaControl={alIrASalaControl} claseTexto={claseTextoContenido} />}

      {datos && !sinMedir && <NivelMedido datos={datos} claseTexto={claseTextoContenido} />}
    </div>
  );
}

function ErrorNivel({ error, rangoGuardado, alReintentar }) {
  return (
    <div className="flex flex-col gap-space-sm">
      <div
        className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-start gap-2"
        role="alert"
      >
        <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
          error
        </span>
        <span>No pudimos cargar tu nivel ahora. {error?.message}</span>
      </div>
      {rangoGuardado && (
        <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 p-space-sm flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
            military_tech
          </span>
          <div className="flex flex-col">
            <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
              Último rango guardado
            </span>
            <span className="font-body-sm text-body-sm font-medium text-on-surface">{rangoGuardado}</span>
          </div>
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={alReintentar}
          className="px-space-md py-space-xs rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none flex items-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            refresh
          </span>
          Reintentar
        </button>
      </div>
    </div>
  );
}

function SinMedir({ alIrASalaControl, claseTexto }) {
  return (
    <div className="tu-nivel-bloque rounded-xl bg-primary/10 border border-primary/30 p-space-md flex flex-col gap-space-sm">
      <div className="flex items-start gap-space-sm">
        <span className="material-symbols-outlined text-[28px] text-primary shrink-0" aria-hidden="true">
          target
        </span>
        <div className="flex flex-col gap-space-2xs min-w-0">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Nivel sin medir</h3>
          <p className={`${claseTexto} text-on-surface-variant`}>
            Todavía no medimos tu nivel. Juega tu partida de diagnóstico en la Sala de Control (contra Stockfish, nivel{' '}
            {NIVEL_DIAGNOSTICO}).
          </p>
        </div>
      </div>
      {alIrASalaControl && (
        <div>
          <button
            type="button"
            onClick={alIrASalaControl}
            className="px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none hover:bg-primary-fixed flex items-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              sports_esports
            </span>
            Ir a la Sala de Control
          </button>
        </div>
      )}
    </div>
  );
}

function NivelMedido({ datos, claseTexto }) {
  const nivel = datos.nivel_estimado;
  const escala = datos.escala ?? {};
  const bandas = escala.bandas ?? BANDAS_POR_DEFECTO;
  const nivelMaxModelo = escala.nivel_max_modelo ?? NIVEL_MAX_MODELO;
  const nivelMax = escala.nivel_max ?? NIVEL_MAX_STOCKFISH;
  const hayNivelesSoloStockfish = Object.values(bandas).some(([, hasta]) => hasta > nivelMaxModelo);
  const promedio = precisionAPorcentaje(datos.precision_promedio);
  const partidasCalibradas = datos.partidas_calibradas ?? 0;

  return (
    <>
      {/* Encabezado: nivel y rango medidos */}
      <div className="tu-nivel-bloque rounded-xl bg-primary/10 border border-primary/30 p-space-md flex items-center gap-space-md">
        <div className="w-14 h-14 shrink-0 rounded-full bg-surface-container-lowest border-2 border-primary text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[30px]" aria-hidden="true">
            military_tech
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-on-surface-variant">
            Tu nivel actual
          </span>
          <h3 className="font-headline-xl text-headline-xl-mobile sm:text-headline-xl text-on-surface break-words">
            Nivel {nivel}
            {datos.rango_estimado ? ` · ${datos.rango_estimado}` : ''}
          </h3>
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            {partidasCalibradas > 0
              ? `Medido con ${partidasCalibradas} ${partidasCalibradas === 1 ? 'partida' : 'partidas'}`
              : 'Medido'}
            {promedio != null ? ` · precisión promedio ${promedio} %` : ''}
          </span>
        </div>
      </div>

      <ProgresoSiguienteNivel
        nivel={nivel}
        nivelMax={nivelMax}
        progreso={datos.progreso_siguiente_nivel}
        precisionSiguiente={datos.precision_siguiente_nivel}
      />

      {/* Escalera de niveles por rango */}
      <div className="tu-nivel-bloque flex flex-col gap-space-xs">
        <h4 className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
          Escalera de niveles
        </h4>
        <EscaleraNiveles nivel={nivel} bandas={bandas} nivelMaxModelo={nivelMaxModelo} />
        <LeyendaEscalera hayNivelesSoloStockfish={hayNivelesSoloStockfish} nivelMaxModelo={nivelMaxModelo} nivelMax={nivelMax} />
      </div>

      {/* Precisión de las últimas partidas */}
      <div className="tu-nivel-bloque flex flex-col gap-space-xs">
        <h4 className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
          Precisión de tus últimas partidas
        </h4>
        <GraficaPrecision calibraciones={datos.calibraciones} partidasCalibradas={partidasCalibradas} />
        <p className={`${claseTexto} text-on-surface-variant`}>
          Tu nivel usa el promedio de tus últimas 3 partidas frente a Stockfish; sube cuando mantienes la precisión, no
          por días.
        </p>
      </div>
    </>
  );
}

function ProgresoSiguienteNivel({ nivel, nivelMax, progreso, precisionSiguiente }) {
  const visible = typeof progreso === 'number' && nivel < nivelMax;
  const porcentaje = visible ? Math.round(Math.min(1, Math.max(0, progreso)) * 100) : 0;
  const requerida = precisionAPorcentaje(precisionSiguiente);
  // La barra parte de 0 y "crece" hasta su valor; con reducir movimiento la transición se anula por CSS.
  const [anchoBarra, setAnchoBarra] = useState(0);
  useEffect(() => {
    const idFrame = requestAnimationFrame(() => setAnchoBarra(porcentaje));
    return () => cancelAnimationFrame(idFrame);
  }, [porcentaje]);

  if (!visible) return null;

  return (
    <div className="tu-nivel-bloque rounded-xl bg-surface-container-lowest border border-outline-variant/20 p-space-sm flex flex-col gap-space-xs">
      <span className="font-body-sm text-body-sm font-medium text-on-surface flex items-center gap-space-2xs">
        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
          trending_up
        </span>
        Siguiente nivel: {nivel + 1}
      </span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-label={`Progreso hacia el nivel ${nivel + 1}`}
        className="h-2.5 rounded-full bg-surface-container-high overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${anchoBarra}%` }}
        />
      </div>
      <p className="font-mono-micro text-mono-micro text-on-surface-variant">
        {porcentaje} % hacia el nivel {nivel + 1}
        {requerida != null ? ` · necesitás ~${requerida} % de precisión` : ''}
      </p>
    </div>
  );
}

function EscaleraNiveles({ nivel, bandas, nivelMaxModelo }) {
  return (
    <div className="flex flex-col gap-space-xs">
      {Object.entries(bandas).map(([rango, [desde, hasta]]) => {
        const niveles = Array.from({ length: hasta - desde + 1 }, (_, indice) => desde + indice);
        const esRangoActual = nivel >= desde && nivel <= hasta;
        return (
          <div
            key={rango}
            className={`rounded-xl border p-space-sm flex flex-col gap-space-xs ${
              esRangoActual ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/20 bg-surface-container-lowest'
            }`}
          >
            <div className="flex items-center justify-between gap-space-xs flex-wrap">
              <span className="font-body-sm text-body-sm font-medium text-on-surface flex items-center gap-space-2xs">
                {esRangoActual && (
                  <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                    location_on
                  </span>
                )}
                {rango}
                {esRangoActual && <span className="font-mono-micro text-mono-micro uppercase text-primary">tu rango</span>}
              </span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant">
                Niveles {desde}-{hasta}
              </span>
            </div>
            <ul className="flex flex-wrap gap-space-2xs" aria-label={`Niveles de ${rango}`}>
              {niveles.map((n) => (
                <ChipNivel key={n} n={n} nivelActual={nivel} soloStockfish={n > nivelMaxModelo} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Un nivel de la escalera. El estado no depende solo del color: superado =
 * check, actual = relleno + aro (y `aria-current`), pendiente = borde
 * punteado; los niveles que solo existen en Stockfish llevan la marca "SF".
 */
function ChipNivel({ n, nivelActual, soloStockfish }) {
  const estado = n < nivelActual ? 'superado' : n === nivelActual ? 'actual' : 'pendiente';
  const clasesPorEstado = {
    superado: 'bg-primary/10 border-primary/30 text-primary',
    actual:
      'bg-primary text-on-primary border-primary font-bold ring-2 ring-primary/40 ring-offset-2 ring-offset-surface-container-lowest',
    pendiente: 'bg-transparent border-dashed border-outline-variant/50 text-on-surface-variant',
  };
  const textoEstado = { superado: 'superado', actual: 'tu nivel actual', pendiente: 'pendiente' }[estado];
  const etiqueta = `Nivel ${n}, ${textoEstado}${soloStockfish ? ', solo existe en Stockfish' : ''}`;

  return (
    <li
      aria-label={etiqueta}
      aria-current={estado === 'actual' ? 'step' : undefined}
      title={etiqueta}
      className={`tu-nivel-chip relative w-10 h-10 rounded-lg border flex items-center justify-center font-mono-label text-mono-label ${clasesPorEstado[estado]}`}
    >
      {estado === 'superado' && (
        <span className="material-symbols-outlined absolute top-0.5 right-0.5 text-[11px] leading-none" aria-hidden="true">
          check
        </span>
      )}
      <span aria-hidden="true">{n}</span>
      {soloStockfish && (
        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] leading-none opacity-80" aria-hidden="true">
          SF
        </span>
      )}
    </li>
  );
}

function LeyendaEscalera({ hayNivelesSoloStockfish, nivelMaxModelo, nivelMax }) {
  return (
    <div className="flex flex-col gap-space-2xs font-mono-micro text-mono-micro text-on-surface-variant">
      <div className="flex items-center gap-space-sm flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-primary/30 bg-primary/10 inline-flex items-center justify-center" aria-hidden="true">
            <span className="material-symbols-outlined text-[9px] leading-none text-primary">check</span>
          </span>
          Superado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-primary bg-primary" aria-hidden="true" />
          Tu nivel
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-dashed border-outline-variant/60" aria-hidden="true" />
          Pendiente
        </span>
      </div>
      {hayNivelesSoloStockfish && (
        <p className="flex items-start gap-1">
          <span className="material-symbols-outlined text-[13px] shrink-0" aria-hidden="true">
            info
          </span>
          <span>
            SF: nivel que solo existe en Stockfish. Turing juega como Maestro hasta el nivel {nivelMaxModelo}; del{' '}
            {nivelMaxModelo + 1} al {nivelMax} el reto es Stockfish.
          </span>
        </p>
      )}
    </div>
  );
}

const ANCHO_GRAFICA = 340;
const ALTO_GRAFICA = 176;
const MARGEN_GRAFICA = { izquierda: 30, derecha: 14, arriba: 20, abajo: 38 };

/**
 * Gráfica de líneas (SVG, sin librerías) con la precisión de las últimas
 * calibraciones. Eje Y fijo 0-100; cada punto lleva su valor arriba y, abajo,
 * el número de partida (P) y el nivel que quedó tras ella (N).
 */
function GraficaPrecision({ calibraciones, partidasCalibradas }) {
  const puntos = (Array.isArray(calibraciones) ? calibraciones : [])
    .map((calibracion) => ({ ...calibracion, precisionPct: precisionAPorcentaje(calibracion?.precision) }))
    .filter((calibracion) => calibracion.precisionPct != null);

  if (puntos.length === 0) {
    return (
      <p className="font-mono-micro text-mono-micro text-outline">
        Todavía no hay partidas medidas para graficar.
      </p>
    );
  }

  const anchoUtil = ANCHO_GRAFICA - MARGEN_GRAFICA.izquierda - MARGEN_GRAFICA.derecha;
  const altoUtil = ALTO_GRAFICA - MARGEN_GRAFICA.arriba - MARGEN_GRAFICA.abajo;
  const posX = (indice) =>
    puntos.length === 1
      ? MARGEN_GRAFICA.izquierda + anchoUtil / 2
      : MARGEN_GRAFICA.izquierda + (indice / (puntos.length - 1)) * anchoUtil;
  const posY = (valor) => MARGEN_GRAFICA.arriba + (1 - valor / 100) * altoUtil;

  // Número de partida de cada punto: las últimas N de un total de `partidasCalibradas`.
  const primeraPartida = Math.max(1, (partidasCalibradas || puntos.length) - puntos.length + 1);
  const trazado = puntos.map((punto, indice) => `${indice === 0 ? 'M' : 'L'} ${posX(indice)} ${posY(punto.precisionPct)}`).join(' ');
  const descripcion = `Precisión por partida: ${puntos
    .map((punto, indice) => `partida ${primeraPartida + indice}, ${punto.precisionPct} %`)
    .join('; ')}.`;

  return (
    <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/20 p-space-sm">
      <svg
        viewBox={`0 0 ${ANCHO_GRAFICA} ${ALTO_GRAFICA}`}
        role="img"
        aria-label={descripcion}
        className="w-full max-w-md h-auto mx-auto"
      >
        {[0, 50, 100].map((marca) => (
          <g key={marca}>
            <line
              x1={MARGEN_GRAFICA.izquierda}
              x2={ANCHO_GRAFICA - MARGEN_GRAFICA.derecha}
              y1={posY(marca)}
              y2={posY(marca)}
              className="stroke-outline-variant"
              strokeOpacity={0.5}
              strokeDasharray={marca === 0 ? undefined : '3 3'}
            />
            <text
              x={MARGEN_GRAFICA.izquierda - 6}
              y={posY(marca) + 3}
              textAnchor="end"
              className="fill-on-surface-variant font-mono-micro text-mono-micro"
            >
              {marca}
            </text>
          </g>
        ))}

        {puntos.length > 1 && (
          <path d={trazado} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {puntos.map((punto, indice) => {
          const esUltimo = indice === puntos.length - 1;
          return (
            <g key={`${punto.partida_id ?? 'p'}-${indice}`}>
              <circle
                cx={posX(indice)}
                cy={posY(punto.precisionPct)}
                r={esUltimo ? 5 : 3.5}
                className="fill-primary stroke-surface-container-lowest"
                strokeWidth={1.5}
              />
              <text
                x={posX(indice)}
                y={posY(punto.precisionPct) - 9}
                textAnchor="middle"
                className="fill-on-surface font-mono-micro text-mono-micro"
              >
                {punto.precisionPct}
              </text>
              <text
                x={posX(indice)}
                y={ALTO_GRAFICA - 22}
                textAnchor="middle"
                className="fill-on-surface-variant font-mono-micro text-mono-micro"
              >
                P{primeraPartida + indice}
              </text>
              {typeof punto.nivel === 'number' && (
                <text
                  x={posX(indice)}
                  y={ALTO_GRAFICA - 9}
                  textAnchor="middle"
                  className="fill-outline font-mono-micro text-mono-micro"
                >
                  N{punto.nivel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="font-mono-micro text-mono-micro text-outline text-center">
        P = número de partida · N = nivel tras esa partida · eje: precisión (%)
      </p>
    </div>
  );
}
