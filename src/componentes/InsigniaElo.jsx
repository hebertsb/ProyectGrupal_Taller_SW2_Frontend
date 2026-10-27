import { useEffect, useState } from 'react';
import { obtenerMiElo } from '../api/backend';

/**
 * El Elo del jugador en una insignia chica («ELO 1020?», con «?» mientras es provisional) para tenerlo a la vista en la Sala de Control sin entrar al perfil. Lo pide al
 * montarse y lo renueva cada medio minuto y al volver a la pestaña (el Elo cambia al terminar una partida contra otra persona). Si no se puede leer, no muestra nada.
 */
export default function InsigniaElo() {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const leer = () => obtenerMiElo().then((d) => !cancelado && setDatos(d)).catch(() => {});
    const alVolver = () => document.visibilityState === 'visible' && leer();
    leer();
    const intervalo = setInterval(leer, 30000);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  if (!datos) return null;
  return (
    <span
      className="text-primary font-mono-micro px-2 py-0.5 rounded bg-primary/10 font-medium"
      title={datos.provisional ? 'Tu Elo contra otras personas: todavía es provisional (pocas partidas)' : 'Tu Elo contra otras personas'}
    >
      ELO {datos.elo}
      {datos.provisional ? '?' : ''}
    </span>
  );
}
