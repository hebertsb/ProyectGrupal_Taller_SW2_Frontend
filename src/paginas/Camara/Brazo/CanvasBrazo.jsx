import { useEffect, useRef, useState } from 'react';
import { actualizarParametrosBrazo, moverArticulacionesBrazo, moverRelativoBrazo } from '../../../api/backend';
import SimuladorBrazoTablero3D from '../../../componentes/SimuladorBrazoTablero3D';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

// Mismos límites que valida el backend (control_brazo.LIMITES_ARTICULACIONES).
const LIMITES = [
  [-360, 360],
  [-180, 180],
  [-160, 160],
  [-360, 360],
  [-360, 360],
  [-360, 360],
];
const PASO_JOG_MM = 10;

/** Canvas 3D del brazo que sigue la telemetría y permite moverlo: articulaciones J1–J6, jog XYZ y velocidad global. */
export default function CanvasBrazo({ estado, onCambio }) {
  const habilitado = estado?.modo === 5;
  const moviendo = estado?.tarea?.estado === 'ejecutando';
  const [destino, setDestino] = useState(null); // ángulos objetivo editados en los sliders
  const [velocidad, setVelocidad] = useState(estado?.velocidad_global ?? 20);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const sincronizadoRef = useRef(false);

  // Los sliders arrancan en la pose real y se resincronizan al terminar cada movimiento.
  useEffect(() => {
    if (!estado?.angulos) return;
    if (!sincronizadoRef.current || (!moviendo && !destino)) {
      setDestino(estado.angulos.map((a) => Math.round(a * 10) / 10));
      sincronizadoRef.current = true;
    }
  }, [estado?.angulos, moviendo, destino]);

  useEffect(() => {
    if (estado?.velocidad_global) setVelocidad(estado.velocidad_global);
  }, [estado?.velocidad_global]);

  async function ejecutar(accion) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      await onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const cambiarJunta = (indice, valor) => setDestino((d) => d.map((a, i) => (i === indice ? valor : a)));
  const irADestino = () =>
    ejecutar(async () => {
      await moverArticulacionesBrazo(destino);
      setDestino(null); // se vuelve a leer de la telemetría al terminar
    });
  const aplicarVelocidad = () => ejecutar(() => actualizarParametrosBrazo({ velocidad_global: velocidad }));
  const jog = (dx, dy, dz) => ejecutar(() => moverRelativoBrazo(dx, dy, dz, 20));

  const bloqueado = ocupado || moviendo || !habilitado;

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-canvas-brazo">
      <h3 id="titulo-canvas-brazo" className="font-body-md text-body-md text-on-surface font-medium">
        Brazo en vivo
      </h3>
      <div className="rounded-xl overflow-hidden border border-outline-variant">
        <SimuladorBrazoTablero3D angulosExternos={estado?.angulos ?? null} />
      </div>
      {!habilitado && (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Habilitá el brazo para poder moverlo desde acá.</p>
      )}
      {moviendo && <p className="font-body-sm text-body-sm text-on-surface m-0">Moviendo: {estado.tarea.descripcion}…</p>}

      <fieldset className="flex flex-col gap-space-xs border-0 p-0 m-0" disabled={bloqueado}>
        <legend className="font-body-sm text-body-sm text-on-surface-variant mb-1">Articulaciones (grados)</legend>
        {destino &&
          destino.map((valor, i) => (
            <label key={i} className="grid grid-cols-[2rem_1fr_4.5rem] items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
              J{i + 1}
              <input
                type="range"
                min={LIMITES[i][0]}
                max={LIMITES[i][1]}
                step="0.5"
                value={valor}
                onChange={(e) => cambiarJunta(i, Number(e.target.value))}
                aria-label={`Ángulo de J${i + 1}`}
              />
              <span className="text-right tabular-nums">{valor.toFixed(1)}°</span>
            </label>
          ))}
        <div className="flex flex-wrap gap-space-xs pt-1">
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={irADestino}>
            Mover a estos ángulos
          </button>
          <button type="button" className={CLASE_BOTON} onClick={() => setDestino(estado.angulos.map((a) => Math.round(a * 10) / 10))}>
            Descartar cambios
          </button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-space-xs border-0 p-0 m-0" disabled={bloqueado}>
        <legend className="font-body-sm text-body-sm text-on-surface-variant mb-1">Mover la punta ({PASO_JOG_MM} mm por clic)</legend>
        <div className="flex flex-wrap gap-space-xs">
          {[
            ['X −', -PASO_JOG_MM, 0, 0],
            ['X +', PASO_JOG_MM, 0, 0],
            ['Y −', 0, -PASO_JOG_MM, 0],
            ['Y +', 0, PASO_JOG_MM, 0],
            ['Z −', 0, 0, -PASO_JOG_MM],
            ['Z +', 0, 0, PASO_JOG_MM],
          ].map(([texto, dx, dy, dz]) => (
            <button key={texto} type="button" className={CLASE_BOTON} onClick={() => jog(dx, dy, dz)}>
              {texto}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-space-xs">
        <label className="grid grid-cols-[auto_1fr_3.5rem] items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
          Velocidad
          <input
            type="range"
            min="1"
            max="100"
            value={velocidad}
            onChange={(e) => setVelocidad(Number(e.target.value))}
            aria-label="Velocidad global del brazo en porcentaje"
          />
          <span className="text-right tabular-nums">{velocidad}%</span>
        </label>
        <div>
          <button type="button" className={CLASE_BOTON} disabled={ocupado || velocidad === estado?.velocidad_global} onClick={aplicarVelocidad}>
            Aplicar velocidad
          </button>
        </div>
      </div>

      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
