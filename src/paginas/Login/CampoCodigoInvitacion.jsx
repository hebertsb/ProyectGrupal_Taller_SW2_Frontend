import { Fragment, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { verificarCodigoFacilitador } from '../../api/backend';

const LONGITUD = 8;

/** Deja solo letras y números, en mayúsculas, hasta la longitud del código. `K7QM-4txd` -> `K7QM4TXD`. */
function limpiar(texto) {
  return String(texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGITUD);
}

function formatearSegundos(segundos) {
  const minutos = Math.floor(segundos / 60);
  return minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Campo para escribir el código de invitación de facilitador: una casilla por carácter, con pegado y
 * navegación con el teclado. Al completar los 8 caracteres lo verifica solo contra el servidor (sin gastarlo)
 * y muestra el resultado antes de crear la cuenta.
 *
 * - `value`: el código tal como se va escribiendo (sin guion).
 * - `onChange(texto)`: cada cambio.
 * - `onEstado(estado)`: `'incompleto' | 'verificando' | 'valido' | 'invalido' | 'bloqueado' | 'error'`.
 * `ref.focus()` lleva el foco a la primera casilla vacía.
 */
const CampoCodigoInvitacion = forwardRef(function CampoCodigoInvitacion({ value, onChange, onEstado }, ref) {
  const reducir = useReducedMotion();
  const casillas = useRef([]);
  const [estado, setEstado] = useState('incompleto');
  const [segundos, setSegundos] = useState(null);
  const consultaVigente = useRef(0);
  const codigo = limpiar(value);

  useImperativeHandle(ref, () => ({
    focus: () => casillas.current[Math.min(codigo.length, LONGITUD - 1)]?.focus(),
  }));

  // Verifica solo al completar el código; cualquier cambio posterior lo vuelve a dejar "incompleto".
  useEffect(() => {
    const numero = ++consultaVigente.current;
    if (codigo.length < LONGITUD) {
      setEstado('incompleto');
      setSegundos(null);
      return undefined;
    }
    setEstado('verificando');
    verificarCodigoFacilitador(codigo)
      .then((respuesta) => {
        if (numero !== consultaVigente.current) return; // llegó tarde: ya cambió el código
        setEstado(respuesta.valido ? 'valido' : 'invalido');
        setSegundos(respuesta.valido ? respuesta.segundos_restantes : null);
      })
      .catch((err) => {
        if (numero !== consultaVigente.current) return;
        setEstado(err?.status === 429 ? 'bloqueado' : 'error');
      });
    return () => {
      consultaVigente.current += 1;
    };
  }, [codigo]);

  useEffect(() => {
    onEstado?.(estado);
  }, [estado, onEstado]);

  // Cuenta regresiva del código ya verificado.
  useEffect(() => {
    if (estado !== 'valido') return undefined;
    const intervalo = setInterval(() => setSegundos((s) => (s == null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(intervalo);
  }, [estado]);

  function escribir(indice, texto) {
    const nuevos = limpiar(texto);
    if (!nuevos) return;
    const cabeza = codigo.slice(0, indice);
    const resultado = limpiar(cabeza + nuevos + codigo.slice(indice + nuevos.length));
    onChange(resultado);
    casillas.current[Math.min(indice + nuevos.length, LONGITUD - 1)]?.focus();
  }

  function alTeclear(evento, indice) {
    if (evento.key === 'Backspace') {
      evento.preventDefault();
      if (codigo[indice]) {
        onChange(codigo.slice(0, indice) + codigo.slice(indice + 1));
      } else if (indice > 0) {
        onChange(codigo.slice(0, indice - 1) + codigo.slice(indice));
        casillas.current[indice - 1]?.focus();
      }
    } else if (evento.key === 'ArrowLeft' && indice > 0) {
      evento.preventDefault();
      casillas.current[indice - 1]?.focus();
    } else if (evento.key === 'ArrowRight' && indice < LONGITUD - 1) {
      evento.preventDefault();
      casillas.current[indice + 1]?.focus();
    }
  }

  function alPegar(evento, indice) {
    evento.preventDefault();
    escribir(indice, evento.clipboardData.getData('text'));
  }

  const colorBorde =
    estado === 'valido'
      ? 'border-exito/70 shadow-[0_0_10px_rgba(52,211,153,0.35)]'
      : estado === 'invalido' || estado === 'bloqueado'
        ? 'border-error/70 shadow-[0_0_10px_rgba(251,113,133,0.3)]'
        : 'border-primary/30 focus:border-primary';

  const mensaje = {
    incompleto: `Escribí los ${LONGITUD} caracteres: se verifica solo.`,
    verificando: 'Verificando el código…',
    valido: segundos != null && segundos > 0 ? `Código verificado · vence en ${formatearSegundos(segundos)}` : 'Código verificado',
    invalido: 'Código inválido, vencido o ya usado. Revisalo o pedí uno nuevo.',
    bloqueado: 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
    error: 'No pude verificarlo ahora. Igual se comprueba al registrarte.',
  }[estado];

  const colorMensaje =
    estado === 'valido' ? 'text-exito' : estado === 'invalido' || estado === 'bloqueado' ? 'text-error' : 'text-on-surface-variant';

  return (
    <div className="flex flex-col gap-2">
      <motion.div
        role="group"
        aria-label="Código de invitación de facilitador"
        className="flex items-center justify-center gap-1 sm:gap-1.5"
        animate={estado === 'invalido' && !reducir ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
      >
        {Array.from({ length: LONGITUD }, (_, indice) => (
          <Fragment key={indice}>
            {indice === LONGITUD / 2 && <span aria-hidden="true" className="shrink-0 w-2 text-center text-on-surface-variant font-mono">-</span>}
            <div className="min-w-0 flex-1 max-w-10">
            <input
              id={indice === 0 ? 'codigoInvitacion' : undefined}
              ref={(nodo) => {
                casillas.current[indice] = nodo;
              }}
              type="text"
              inputMode="text"
              autoComplete={indice === 0 ? 'one-time-code' : 'off'}
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={LONGITUD}
              value={codigo[indice] ?? ''}
              aria-label={`Carácter ${indice + 1} de ${LONGITUD} del código`}
              aria-invalid={estado === 'invalido' || estado === 'bloqueado'}
              onChange={(evento) => escribir(indice, evento.target.value)}
              onKeyDown={(evento) => alTeclear(evento, indice)}
              onPaste={(evento) => alPegar(evento, indice)}
              onFocus={(evento) => evento.target.select()}
              className={`w-full min-w-0 h-10 sm:h-11 text-center rounded-lg bg-on-surface/[0.04] backdrop-blur-md border font-mono text-base sm:text-lg font-bold text-on-surface uppercase caret-primary transition-all focus:outline-none focus:ring-1 focus:ring-primary ${colorBorde}`}
            />
            </div>
          </Fragment>
        ))}
      </motion.div>

      <div role="status" aria-live="polite" className={`flex items-center justify-center gap-1.5 min-h-5 text-[11px] font-mono text-center ${colorMensaje}`}>
        {estado === 'verificando' && (
          <span className="inline-block w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {estado === 'valido' && (
          <motion.span
            initial={reducir ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="material-symbols-outlined text-[16px]"
            aria-hidden="true"
          >
            check_circle
          </motion.span>
        )}
        {(estado === 'invalido' || estado === 'bloqueado') && (
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>
        )}
        <span>{mensaje}</span>
      </div>
    </div>
  );
});

export default CampoCodigoInvitacion;
