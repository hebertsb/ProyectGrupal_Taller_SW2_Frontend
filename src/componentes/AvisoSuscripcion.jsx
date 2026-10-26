import { useState } from 'react';

/** Cuántos días antes del vencimiento (de la prueba o del período pagado) empieza a avisarse. */
export const DIAS_DE_AVISO = 7;

function fecha(iso) {
  const momento = iso ? new Date(iso) : null;
  return momento && !Number.isNaN(momento.getTime()) ? momento.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
}

function dias(cantidad) {
  return `${cantidad} ${cantidad === 1 ? 'día' : 'días'}`;
}

/**
 * Qué decirle al director según el estado de la suscripción de su institución, o `null` si no hace falta avisar nada: falta más de una semana,
 * la institución solo está evaluando el sistema o es de demostración. `datos` es la respuesta de `GET /suscripciones/mia`.
 *
 * Devuelve `{ tipo: 'error' | 'alerta' | 'info', titulo, detalle, boton }`; `boton` es el texto del botón que lleva a «Mi suscripción» (o `null`).
 */
export function avisoDeSuscripcion(datos) {
  if (!datos || datos.es_prueba || datos.es_demostracion) return null;
  const { estado, dias_restantes: restantes, pago_pendiente: pendiente } = datos;

  if (estado === 'vencida') {
    return pendiente
      ? {
          tipo: 'info',
          titulo: 'Tu pago está esperando confirmación.',
          detalle: 'Cuando la plataforma lo confirme se reactiva la suscripción. Mientras tanto no pueden entrar alumnos nuevos.',
          boton: null,
        }
      : {
          tipo: 'error',
          titulo: `La suscripción de ${datos.institucion_nombre} venció.`,
          detalle: 'Tus alumnos actuales siguen jugando, pero no pueden entrar alumnos nuevos hasta que la renueves.',
          boton: 'Renovar ahora',
        };
  }
  if (restantes > DIAS_DE_AVISO) return null;

  if (pendiente) {
    return {
      tipo: 'info',
      titulo: 'Tu pago está esperando confirmación.',
      detalle: 'La plataforma lo está revisando; no hace falta que hagas nada más.',
      boton: null,
    };
  }
  if (estado === 'prueba') {
    return {
      tipo: 'alerta',
      titulo: `Te ${restantes === 1 ? 'queda' : 'quedan'} ${dias(restantes)} de prueba gratis.`,
      detalle: `Terminan el ${fecha(datos.prueba_hasta)}. Si pagás antes, el período pagado empieza cuando termina la prueba: no perdés ningún día.`,
      boton: 'Elegir plan',
    };
  }
  return {
    tipo: 'alerta',
    titulo: `Tu suscripción vence en ${dias(restantes)}.`,
    detalle: `El ${fecha(datos.vigente_hasta)}. Renovala antes y se suma al período que ya pagaste.`,
    boton: 'Renovar',
  };
}

const ESTILOS = {
  error: { franja: 'bg-error-container/40 border-error/40', icono: 'error', colorIcono: 'text-error' },
  alerta: { franja: 'bg-tertiary/10 border-tertiary/30', icono: 'schedule', colorIcono: 'text-tertiary' },
  info: { franja: 'bg-primary/10 border-primary/30', icono: 'hourglass_top', colorIcono: 'text-primary' },
};

/**
 * Franja que le avisa al director cuando la suscripción de su institución está por vencer, venció o tiene un pago esperando confirmación.
 * Se puede cerrar y vuelve a aparecer en la próxima sesión, mientras siga haciendo falta. Se oculta sola en «Mi suscripción», donde ya está todo.
 */
export default function AvisoSuscripcion({ datos, alIrAPagar }) {
  const [cerrado, setCerrado] = useState(false);
  const aviso = avisoDeSuscripcion(datos);
  if (!aviso || cerrado) return null;
  const estilo = ESTILOS[aviso.tipo];

  return (
    <div role={aviso.tipo === 'error' ? 'alert' : 'region'} aria-label="Aviso de suscripción" className={`w-full px-space-lg py-space-sm border-b flex flex-wrap items-center justify-between gap-space-xs ${estilo.franja}`}>
      <p className="m-0 font-body-sm text-body-sm text-on-surface flex items-start gap-space-xs min-w-0">
        <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${estilo.colorIcono}`} aria-hidden="true">{estilo.icono}</span>
        <span className="min-w-0 break-words">
          <strong>{aviso.titulo}</strong> {aviso.detalle}
        </span>
      </p>
      <div className="flex items-center gap-space-xs">
        {aviso.boton && (
          <button type="button" onClick={alIrAPagar} className="px-space-md py-space-xs min-h-10 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {aviso.boton}
          </button>
        )}
        <button type="button" onClick={() => setCerrado(true)} aria-label="Cerrar este aviso" className="min-w-10 min-h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  );
}
