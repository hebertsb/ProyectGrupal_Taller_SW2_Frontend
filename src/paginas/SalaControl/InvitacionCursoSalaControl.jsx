import { useEffect, useState } from 'react';
import { obtenerMiCurso } from '../../api/backend';
import TarjetaUnirseCurso from '../PanelAprendizaje/TarjetaUnirseCurso';
import { cargarDescartada } from '../PanelAprendizaje/invitacionCurso';

/**
 * Invitación opcional a un curso en la Sala de Control del jugador (versión compacta de la tarjeta del Panel de
 * Aprendizaje, con el mismo descarte: la clave de localStorage es la misma).
 *
 * Pide `GET /cursos/mio` una sola vez al montarse, igual que el Panel, y solo si el jugador no la descartó ya. Si el
 * pedido falla no se muestra nada (no se invita sin saber si ya está en un curso). Quien la usa decide cuándo
 * montarla: no se ofrece al facilitador ni mientras se mira una partida ajena o una demostración.
 */
export default function InvitacionCursoSalaControl({ usuarioId = null }) {
  // `undefined` = todavía no se sabe (o falló el pedido), `null` = no está en ningún curso, o el curso en que está.
  const [miCurso, setMiCurso] = useState(undefined);
  const [descartada] = useState(() => cargarDescartada(usuarioId));

  useEffect(() => {
    if (descartada) return undefined; // ya dijo "juego por mi cuenta": ni se le pregunta al backend
    let cancelado = false;
    obtenerMiCurso()
      .then((curso) => {
        if (!cancelado) setMiCurso(curso ?? null);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [descartada]);

  if (descartada) return null;
  return <TarjetaUnirseCurso compacta usuarioId={usuarioId} miCurso={miCurso} alUnirse={setMiCurso} />;
}
