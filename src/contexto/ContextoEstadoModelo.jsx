import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { estadoModelo } from '../api/backend';

/**
 * Estado del modelo propio (Turing): qué versión del checkpoint está activa y si se puede usar.
 * Se pide UNA sola vez al abrir la sesión (`GET /aprendizaje/estado-modelo`) y lo comparten la Sala
 * de Control, el avatar del rival y cualquier etiqueta que nombre la versión, para que ninguna
 * pantalla repita la consulta ni deje escrito un "v5" a mano que mañana ya no sea cierto.
 *
 * Fases:
 *  - 'cargando':      todavía no respondió el servidor (no se sabe nada: no se inventa un número).
 *  - 'disponible':    hay checkpoint. `version` es el número real, o `null` si el nombre del archivo no lo trae.
 *  - 'no_disponible': el servidor dice que no hay modelo (`disponible: false`), respondió 404/500/503
 *                     o no se pudo llegar a él. Quien lo use no debe ofrecer a Turing como rival.
 */
const ContextoEstadoModelo = createContext(null);

const ESTADO_INICIAL = { fase: 'cargando', version: null };
const ESTADO_NO_DISPONIBLE = { fase: 'no_disponible', version: null };

/**
 * Traduce la respuesta del servidor a una fase. El backend contesta 200 con `disponible: false` cuando
 * falta el checkpoint; si algún día contestara con un error HTTP, eso también cae en 'no_disponible'
 * (ver el `catch` del proveedor). Un 200 sin el campo `disponible` se toma como modelo disponible.
 */
function interpretarRespuesta(datos) {
  if (!datos || typeof datos !== 'object' || datos.disponible === false) return ESTADO_NO_DISPONIBLE;
  const version = Number.isInteger(datos.version) && datos.version > 0 ? datos.version : null;
  return { fase: 'disponible', version };
}

export function ProveedorEstadoModelo({ children }) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  // Hay una consulta en vuelo (la inicial o un "Reintentar"): sirve para deshabilitar el botón sin
  // tener que volver a la fase 'cargando', que habilitaría a Turing de nuevo mientras se espera.
  const [consultando, setConsultando] = useState(false);
  const numeroDePedidoRef = useRef(0);
  const montadoRef = useRef(false);
  const pedidoInicialHechoRef = useRef(false);

  const consultar = useCallback(() => {
    const numeroDePedido = numeroDePedidoRef.current + 1;
    numeroDePedidoRef.current = numeroDePedido;
    setConsultando(true);
    const sigueVigente = () => montadoRef.current && numeroDePedido === numeroDePedidoRef.current;
    estadoModelo()
      .then((datos) => {
        if (sigueVigente()) setEstado(interpretarRespuesta(datos));
      })
      .catch(() => {
        // 404, 500, 503 o sin red: da lo mismo el motivo, Turing no se puede usar ahora.
        if (sigueVigente()) setEstado(ESTADO_NO_DISPONIBLE);
      })
      .finally(() => {
        if (sigueVigente()) setConsultando(false);
      });
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    // Una sola consulta por sesión: el modo estricto de React en desarrollo monta dos veces, y un
    // ref sobrevive a ese segundo montaje (un estado no), así que no se repite el pedido.
    if (!pedidoInicialHechoRef.current) {
      pedidoInicialHechoRef.current = true;
      consultar();
    }
    return () => {
      montadoRef.current = false;
    };
  }, [consultar]);

  const valor = useMemo(
    () => ({ fase: estado.fase, version: estado.version, consultando, recargar: consultar }),
    [estado, consultando, consultar]
  );

  return <ContextoEstadoModelo.Provider value={valor}>{children}</ContextoEstadoModelo.Provider>;
}

const VALOR_SIN_PROVEEDOR = { fase: 'cargando', version: null, consultando: false, recargar: () => {} };

/**
 * `{ fase, version, consultando, recargar }`. Fuera del proveedor devuelve la fase 'cargando' (no se sabe
 * nada), así que quien lo use se comporta igual que mientras espera la respuesta.
 */
export function useEstadoModelo() {
  return useContext(ContextoEstadoModelo) ?? VALOR_SIN_PROVEEDOR;
}
