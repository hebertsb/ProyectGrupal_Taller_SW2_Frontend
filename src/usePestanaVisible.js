import { useEffect, useState } from 'react';

const esVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Si la pestaña se está viendo. Sirve para no pedirle nada al backend (video de la cámara, sondeos) desde una pestaña olvidada en segundo plano:
 * ahí nadie mira lo que llega y el backend igual trabaja cada pedido.
 */
export default function usePestanaVisible() {
  const [visible, setVisible] = useState(esVisible);
  useEffect(() => {
    const alCambiar = () => setVisible(esVisible());
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);
  return visible;
}
