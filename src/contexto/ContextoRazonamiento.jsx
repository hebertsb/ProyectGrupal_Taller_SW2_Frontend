import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { inferenciaModelo } from '../api/backend';

/**
 * Estado de la última inferencia real del modelo propio (HU6 ampliada), compartido
 * a nivel de toda la app. Vive por encima del switch de `pantallaActiva` en App.tsx
 * para que sobreviva al cambio de pantalla — antes vivía solo dentro de
 * RazonamientoNeuronal.jsx y se perdía al desmontar ese componente.
 *
 * Cualquier pantalla puede disparar una inferencia (típicamente Sala de Control,
 * justo después de aplicar una jugada real) sin necesidad de que el panel de
 * Razonamiento Neuronal esté montado ni visible.
 */
const ContextoRazonamiento = createContext(null);

export function ProveedorRazonamiento({ children }) {
  const [ultimaInferencia, setUltimaInferencia] = useState(null);
  const [estaAnalizando, setEstaAnalizando] = useState(false);

  const dispararInferencia = useCallback(async (fen) => {
    if (!fen) return;
    setEstaAnalizando(true);
    try {
      const resultado = await inferenciaModelo(fen);
      setUltimaInferencia({ fen, ...resultado });
    } catch (error) {
      // No rompe la partida por esto — solo se pierde la actualización del panel
      // neuronal; se deja `ultimaInferencia` como estaba (mejor mostrar el último
      // dato real que uno roto o vacío).
      console.error('Fallo la inferencia de razonamiento neuronal', error);
    } finally {
      setEstaAnalizando(false);
    }
  }, []);

  const valor = useMemo(
    () => ({ ultimaInferencia, estaAnalizando, dispararInferencia }),
    [ultimaInferencia, estaAnalizando, dispararInferencia]
  );

  return (
    <ContextoRazonamiento.Provider value={valor}>
      {children}
    </ContextoRazonamiento.Provider>
  );
}

/** Devuelve `null` si se usa fuera del `ProveedorRazonamiento` — quien lo consuma debe tolerarlo. */
export function useRazonamiento() {
  return useContext(ContextoRazonamiento);
}
