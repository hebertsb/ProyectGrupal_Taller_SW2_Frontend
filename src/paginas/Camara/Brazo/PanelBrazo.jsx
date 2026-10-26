import { useCallback, useEffect, useRef, useState } from 'react';
import { estadoControlBrazo, pararBrazo } from '../../../api/backend';
import { CLASE_AVISO } from '../estilos';
import ConexionBrazo from './ConexionBrazo';
import MoverPieza from './MoverPieza';
import CalibracionTableroBrazo from './CalibracionTableroBrazo';
import CentradoBrazo from './CentradoBrazo';
import ParametrosBrazo from './ParametrosBrazo';
import ZonasBrazo from './ZonasBrazo';
import RutinasBrazo from './RutinasBrazo';

const INTERVALO_MS = 700;

/**
 * Control del brazo sin DobotStudio: conexión TCP, telemetría en vivo, parámetros y configuraciones guardadas, y la primera
 * prueba (llevar una pieza de una casilla a otra), más las rutinas guardadas del brazo. El botón PARAR queda fijo y visible mientras haya conexión.
 */
export default function PanelBrazo() {
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [parando, setParando] = useState(false);
  const montadoRef = useRef(true);

  const leer = useCallback(async () => {
    try {
      const datos = await estadoControlBrazo();
      if (montadoRef.current) {
        setEstado(datos);
        setError(null);
      }
    } catch (e) {
      if (montadoRef.current) setError(e.message);
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    let cancelado = false;
    let temporizador = null;
    async function ciclo() {
      await leer();
      if (!cancelado) temporizador = setTimeout(ciclo, INTERVALO_MS);
    }
    ciclo();
    return () => {
      montadoRef.current = false;
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [leer]);

  async function parar() {
    setParando(true);
    try {
      await pararBrazo();
      await leer();
    } catch (e) {
      setError(e.message);
    } finally {
      setParando(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Controlá el brazo desde acá, sin DobotStudio. Probá primero con el emulador. Con el brazo real: encendido, en modo TCP/IP y con la
        mano cerca del botón de parada de emergencia.
      </p>
      {estado?.conectado && (
        <div className="sticky top-2 z-10">
          <button
            type="button"
            onClick={parar}
            disabled={parando}
            className="min-h-[52px] w-full sm:w-auto px-space-lg rounded-xl bg-error text-on-error font-body-md text-body-md font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ■ PARAR
          </button>
        </div>
      )}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          No se pudo leer el estado del brazo: {error}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md items-start">
        <div className="flex flex-col gap-space-md min-w-0">
          <ConexionBrazo estado={estado} onCambio={leer} />
          {estado?.conectado && <CalibracionTableroBrazo estado={estado} alCambio={leer} />}
          {estado?.conectado && <CentradoBrazo estado={estado} />}
          {estado?.conectado && <ZonasBrazo estado={estado} />}
          {estado?.conectado && <MoverPieza estado={estado} />}
        </div>
        <div className="min-w-0">
          {estado?.conectado ? (
            <ParametrosBrazo key={estado.destino} emulador={Boolean(estado.emulador)} />
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Conectate para ver y editar los parámetros.</p>
          )}
        </div>
      </div>
      <RutinasBrazo estado={estado} onCambio={leer} />
    </div>
  );
}
