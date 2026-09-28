import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { describirCambioNivel, precisionAPorcentaje } from '../../nivelJugador';

gsap.registerPlugin(useGSAP);

const MENSAJE_PARTIDA_INCOMPLETA =
  'La partida fue muy corta para medir tu nivel (mínimo 5 jugadas tuyas). Tu nivel sigue igual.';

/**
 * Aviso (modal) que se muestra al terminar una partida propia y calcularse el
 * nivel del jugador. `resultado` es la respuesta de `POST /partida/{id}/calibrar`
 * con `registrada: true`. Es accesible: `role="dialog"`, el foco va al botón
 * principal, Escape cierra, Tab se queda dentro del aviso y al cerrar el foco
 * vuelve a donde estaba.
 */
export default function AvisoNivelCalculado({ resultado, alCerrar, alVerProgreso = null }) {
  const tarjetaRef = useRef(null);
  const botonEntendidoRef = useRef(null);
  // El efecto de teclado se registra una sola vez; la referencia evita reengancharlo (y
  // volver a robar el foco) cada vez que el padre pasa una función `alCerrar` nueva.
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  }, [alCerrar]);

  useEffect(() => {
    const elementoPrevio = document.activeElement;
    botonEntendidoRef.current?.focus();

    function alPulsarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCerrarRef.current?.();
        return;
      }
      if (evento.key !== 'Tab') return;
      const enfocables = tarjetaRef.current?.querySelectorAll('button:not([disabled])');
      if (!enfocables || enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      elementoPrevio?.focus?.();
    };
  }, []);

  // Entrada sutil. Solo opacidad/desplazamiento (nunca `visibility`): un botón oculto no puede
  // recibir el foco de arriba. Con "reducir movimiento" no se anima nada.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(tarjetaRef.current, {
          opacity: 0,
          y: 18,
          scale: 0.97,
          duration: 0.35,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
        gsap.from('.aviso-nivel-bloque', {
          opacity: 0,
          y: 10,
          duration: 0.3,
          stagger: 0.07,
          delay: 0.12,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope: tarjetaRef }
  );

  const esDiagnostico = Boolean(resultado?.es_diagnostico);
  const nivel = typeof resultado?.nivel === 'number' ? resultado.nivel : null;
  const rango = resultado?.rango ?? null;
  const cambio = describirCambioNivel(resultado);
  const precisionPartida = precisionAPorcentaje(resultado?.precision_partida);
  const precisionPromedio = precisionAPorcentaje(resultado?.precision_promedio);
  const partidasConsideradas = resultado?.partidas_consideradas ?? 0;
  const mostrarPromedio = partidasConsideradas > 1 && precisionPromedio != null;

  const titulo = esDiagnostico ? 'Tu nivel inicial' : cambio ? 'Tu nivel se actualizó' : 'Tu nivel se mantiene';
  const etiqueta = esDiagnostico ? 'Diagnóstico completado' : 'Partida analizada';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        // Clic en el fondo (no en la tarjeta) = cerrar.
        if (evento.target === evento.currentTarget) alCerrar?.();
      }}
    >
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-aviso-nivel"
        aria-describedby="descripcion-aviso-nivel"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="aviso-nivel-bloque flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              military_tech
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">{etiqueta}</span>
            <h2 id="titulo-aviso-nivel" className="font-headline-sm text-headline-sm text-on-surface">
              {titulo}
            </h2>
          </div>
        </div>

        {nivel != null && (
          <div className="aviso-nivel-bloque flex items-center justify-between gap-space-md rounded-xl bg-primary/10 border border-primary/30 px-space-md py-space-sm">
            <div className="flex flex-col min-w-0">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">Tu rango</span>
              <span className="font-headline-xl text-headline-xl text-primary truncate">{rango ?? 'Sin rango'}</span>
            </div>
            <div className="w-16 h-16 shrink-0 rounded-full border-2 border-primary flex flex-col items-center justify-center bg-surface-container-lowest">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant leading-none">Nivel</span>
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none">{nivel}</span>
            </div>
          </div>
        )}

        {cambio && (
          <div
            className={`aviso-nivel-bloque flex items-center gap-space-xs rounded-lg px-space-sm py-space-xs border ${
              cambio.sube
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-tertiary-fixed-dim/10 border-tertiary-fixed-dim/30 text-tertiary-fixed-dim'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {cambio.sube ? 'trending_up' : 'trending_down'}
            </span>
            <span className="font-body-sm text-body-sm font-medium">{cambio.principal}</span>
            <span className="ml-auto font-mono-label text-mono-label">{cambio.detalle}</span>
          </div>
        )}

        {(precisionPartida != null || mostrarPromedio) && (
          <div className="aviso-nivel-bloque grid grid-cols-2 gap-space-xs">
            {precisionPartida != null && (
              <div className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
                  Precisión de esta partida
                </span>
                <span className="font-mono-metric text-mono-metric text-on-surface">{precisionPartida} %</span>
              </div>
            )}
            {mostrarPromedio && (
              <div className="bg-surface-container-lowest rounded-lg p-space-sm flex flex-col gap-1">
                <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">
                  Promedio de tus últimas {partidasConsideradas} partidas
                </span>
                <span className="font-mono-metric text-mono-metric text-on-surface">{precisionPromedio} %</span>
              </div>
            )}
          </div>
        )}

        <p id="descripcion-aviso-nivel" className="aviso-nivel-bloque font-body-sm text-body-sm text-on-surface-variant">
          Se calcula comparando tus jugadas con las de Stockfish. Turing y tus próximas partidas se ajustan a este
          nivel.
        </p>

        <div className="aviso-nivel-bloque flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          {alVerProgreso && (
            <button
              type="button"
              onClick={alVerProgreso}
              className="px-space-md py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none flex items-center justify-center gap-space-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                query_stats
              </span>
              Ver mi progreso
            </button>
          )}
          <button
            ref={botonEntendidoRef}
            type="button"
            onClick={alCerrar}
            className="px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors motion-reduce:transition-none hover:bg-primary-fixed flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Estado compacto del cálculo de nivel, debajo de la tarjeta de "Partida
 * finalizada": calculando (unos segundos), listo (con acceso al detalle),
 * partida demasiado corta, o error de red con reintento. Es discreto a
 * propósito: nunca bloquea nada ni tapa el tablero.
 */
export function EstadoCalibracionPartida({ estado, alReintentar, alVerNivel }) {
  if (!estado) return null;

  const contenedor =
    'px-space-md py-space-sm rounded-xl border bg-surface-container-low flex items-start gap-space-sm';

  if (estado.fase === 'calculando') {
    return (
      <div className={`${contenedor} border-outline-variant/30`}>
        <div
          className="w-5 h-5 mt-0.5 shrink-0 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="flex flex-col">
          <span className="font-body-sm text-body-sm font-medium text-on-surface">Calculando tu nivel…</span>
          <span className="font-mono-micro text-[11px] text-on-surface-variant">
            Estamos comparando tus jugadas con las de Stockfish. Tarda unos segundos.
          </span>
        </div>
      </div>
    );
  }

  if (estado.fase === 'listo') {
    const resultado = estado.resultado;
    return (
      <div className={`${contenedor} border-primary/30 items-center justify-between flex-wrap`}>
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">
            check_circle
          </span>
          <span className="font-body-sm text-body-sm text-on-surface">
            Nivel calculado: <span className="font-medium">{resultado?.rango ?? 'Sin rango'}</span> · Nivel{' '}
            {resultado?.nivel}
          </span>
        </div>
        <button
          type="button"
          onClick={alVerNivel}
          className="px-space-sm py-space-2xs rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Ver detalle
        </button>
      </div>
    );
  }

  if (estado.fase === 'incompleta') {
    return (
      <div className={`${contenedor} border-outline-variant/30`}>
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0" aria-hidden="true">
          info
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {MENSAJE_PARTIDA_INCOMPLETA}
          {estado.esDiagnostico && ' Tu próxima partida seguirá siendo la de diagnóstico.'}
        </span>
      </div>
    );
  }

  if (estado.fase === 'error') {
    return (
      <div className={`${contenedor} border-error/40 items-center justify-between flex-wrap`}>
        <div className="flex items-start gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[20px] text-error shrink-0" aria-hidden="true">
            error
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-body-sm text-body-sm text-on-surface">No pudimos calcular tu nivel ahora.</span>
            {estado.mensaje && (
              <span className="font-mono-micro text-[11px] text-on-surface-variant break-words">{estado.mensaje}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={alReintentar}
          className="px-space-sm py-space-2xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return null;
}
