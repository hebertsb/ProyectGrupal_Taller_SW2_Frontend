import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { actualizarPerfil } from './api/backend';
import { aplicarApariencia, guardarAparienciaLocal, leerApariencia, leerPaleta, normalizarModo, normalizarPaleta, temaEfectivo } from './apariencia';

/** Aplica el tema global y sincroniza cambios explícitos con la cuenta, sin sondeos ni peticiones durante la partida. */
export default function useApariencia(usuario, alActualizarUsuario) {
  const cuenta = usuario?.id ?? null;
  const cuentaRef = useRef(cuenta);
  cuentaRef.current = cuenta;
  const [seleccion, setSeleccion] = useState(() => ({ cuenta, modo: leerApariencia(usuario), paleta: leerPaleta(usuario) }));
  const modo = seleccion.cuenta === cuenta ? seleccion.modo : leerApariencia(usuario);
  const paleta = seleccion.cuenta === cuenta ? seleccion.paleta : leerPaleta(usuario);
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
    setSeleccion({ cuenta, modo: leerApariencia(usuario), paleta: leerPaleta(usuario) });
    setFallo(null);
  }, [cuenta, usuario?.tema, usuario?.paleta]);

  useLayoutEffect(() => {
    aplicarApariencia(modo, sistemaOscuro, paleta);
    guardarAparienciaLocal(cuenta, modo, paleta);
  }, [cuenta, modo, paleta, sistemaOscuro]);

  async function guardarSeleccion(nuevoModo, nuevaPaleta) {
    if (pendienteRef.current?.cuenta === cuenta) return;
    setSeleccion({ cuenta, modo: nuevoModo, paleta: nuevaPaleta });
    setFallo(null);
    guardarAparienciaLocal(cuenta, nuevoModo, nuevaPaleta);
    if (cuenta === null) return;

    const pedido = { cuenta };
    pendienteRef.current = pedido;
    setGuardandoCuenta(cuenta);
    try {
      const actualizado = await actualizarPerfil({ tema: nuevoModo, paleta: nuevaPaleta });
      if (actualizado.tema !== nuevoModo || normalizarPaleta(actualizado.paleta) !== nuevaPaleta) {
        throw new Error('El servidor todavía no admite el guardado de esta apariencia');
      }
      if (montadoRef.current && cuentaRef.current === cuenta && pendienteRef.current === pedido) {
        alActualizarUsuario?.(actualizado);
      }
    } catch {
      if (montadoRef.current && cuentaRef.current === cuenta && pendienteRef.current === pedido) {
        setFallo({ cuenta, mensaje: 'La apariencia se aplicó en este equipo, pero no se pudo guardar en tu cuenta.' });
      }
    } finally {
      if (pendienteRef.current === pedido) {
        pendienteRef.current = null;
        if (montadoRef.current) setGuardandoCuenta(null);
      }
    }
  }

  return {
    modo, paleta, efectivo: temaEfectivo(modo, sistemaOscuro),
    cambiarModo: (valor) => guardarSeleccion(normalizarModo(valor), paleta),
    cambiarPaleta: (valor) => guardarSeleccion(modo, normalizarPaleta(valor)),
    guardando: cuenta !== null && guardandoCuenta === cuenta,
    error: fallo?.cuenta === cuenta ? fallo.mensaje : null,
  };
}
