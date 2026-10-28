import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { actualizarPerfil } from './api/backend';
import { aplicarApariencia, guardarAparienciaLocal, leerApariencia, normalizarModo, temaEfectivo } from './apariencia';

/** Aplica el tema global y sincroniza cambios explícitos con la cuenta, sin sondeos ni peticiones durante la partida. */
export default function useApariencia(usuario, alActualizarUsuario) {
  const cuenta = usuario?.id ?? null;
  const cuentaRef = useRef(cuenta);
  cuentaRef.current = cuenta;
  const [seleccion, setSeleccion] = useState(() => ({ cuenta, modo: leerApariencia(usuario) }));
  const modo = seleccion.cuenta === cuenta ? seleccion.modo : leerApariencia(usuario);
  const [sistemaOscuro, setSistemaOscuro] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(null);
  const [fallo, setFallo] = useState(null);
  const pendienteRef = useRef(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)');
    const actualizar = () => setSistemaOscuro(consulta?.matches ?? false);
    actualizar();
    consulta?.addEventListener('change', actualizar);
    return () => {
      montadoRef.current = false;
      consulta?.removeEventListener('change', actualizar);
    };
  }, []);

  useEffect(() => {
    setSeleccion({ cuenta, modo: leerApariencia(usuario) });
    setFallo(null);
  }, [cuenta, usuario?.tema]);

  useLayoutEffect(() => {
    aplicarApariencia(modo, sistemaOscuro);
    guardarAparienciaLocal(cuenta, modo);
  }, [cuenta, modo, sistemaOscuro]);

  async function cambiarModo(valor) {
    const nuevo = normalizarModo(valor);
    if (pendienteRef.current?.cuenta === cuenta) return;
    setSeleccion({ cuenta, modo: nuevo });
    setFallo(null);
    guardarAparienciaLocal(cuenta, nuevo);
    if (cuenta === null) return;

    const pedido = { cuenta };
    pendienteRef.current = pedido;
    setGuardandoCuenta(cuenta);
    try {
      const actualizado = await actualizarPerfil({ tema: nuevo });
      if (actualizado.tema !== nuevo) throw new Error('El servidor todavía no admite el guardado del tema');
      if (montadoRef.current && cuentaRef.current === cuenta && pendienteRef.current === pedido) {
        alActualizarUsuario?.(actualizado);
      }
    } catch {
      if (montadoRef.current && cuentaRef.current === cuenta && pendienteRef.current === pedido) {
        setFallo({ cuenta, mensaje: 'El tema se aplicó en este equipo, pero no se pudo guardar en tu cuenta.' });
      }
    } finally {
      if (pendienteRef.current === pedido) {
        pendienteRef.current = null;
        if (montadoRef.current) setGuardandoCuenta(null);
      }
    }
  }

  return {
    modo, efectivo: temaEfectivo(modo, sistemaOscuro), cambiarModo,
    guardando: cuenta !== null && guardandoCuenta === cuenta,
    error: fallo?.cuenta === cuenta ? fallo.mensaje : null,
  };
}
