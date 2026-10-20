import { useState } from 'react';
import {
  conectarBrazo,
  deshabilitarBrazo,
  desconectarBrazo,
  habilitarBrazo,
  inicializarPinza,
  limpiarErrorBrazo,
  moverPinza,
} from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const CAMPO =
  'min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const fmt = (lista) => (lista ? lista.map((n) => n.toFixed(1)).join(', ') : '—');

/** Conexión con el brazo (real o emulador), habilitar, telemetría y pinza. `estado` viene del padre (sondeo único). */
export default function ConexionBrazo({ estado, onCambio }) {
  const [host, setHost] = useState('192.168.5.1');
  const [puerto, setPuerto] = useState(29999);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [ancho, setAncho] = useState(30);

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

  const conectado = Boolean(estado?.conectado);
  const habilitado = estado?.modo === 5 || estado?.modo === 7 || estado?.modo === 8;

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-conexion-brazo">
      <h3 id="titulo-conexion-brazo" className="font-body-md text-body-md text-on-surface font-medium">
        1 · Conexión
      </h3>
      {!conectado ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-space-xs">
            <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
              IP del controlador
              <input className={CAMPO} value={host} onChange={(e) => setHost(e.target.value)} inputMode="decimal" />
            </label>
            <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
              Puerto
              <input className={CAMPO} type="number" value={puerto} onChange={(e) => setPuerto(Number(e.target.value))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={ocupado} onClick={() => ejecutar(() => conectarBrazo(host, puerto, false))}>
              Conectar al brazo
            </button>
            <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => ejecutar(() => conectarBrazo(host, puerto, true))}>
              Probar con el emulador
            </button>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Conectar no habilita ni mueve el brazo: solo lee su estado. En DobotStudio el robot debe estar en modo TCP/IP.
          </p>
        </>
      ) : (
        <>
          <p className="font-body-sm text-body-sm text-on-surface m-0">
            Conectado a <strong>{estado.destino}</strong>
            {estado.emulador ? ' (emulador, no es el brazo real)' : ''}. Estado: <strong>{estado.modo_texto ?? '—'}</strong>
            {estado.falla ? ` — ${estado.falla}` : ''}.
          </p>
          <div className="flex flex-wrap gap-space-xs">
            {!habilitado && (
              <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={ocupado} onClick={() => ejecutar(habilitarBrazo)}>
                Habilitar el brazo
              </button>
            )}
            {habilitado && (
              <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => ejecutar(deshabilitarBrazo)}>
                Deshabilitar
              </button>
            )}
            {estado.modo === 9 && (
              <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => ejecutar(limpiarErrorBrazo)}>
                Limpiar alarma
              </button>
            )}
            <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => ejecutar(desconectarBrazo)}>
              Desconectar
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-space-sm gap-y-1 font-body-sm text-body-sm m-0">
            <dt className="text-on-surface-variant">Pose (x, y, z, rx, ry, rz)</dt>
            <dd className="m-0 text-on-surface break-words">{fmt(estado.pose)}</dd>
            <dt className="text-on-surface-variant">Ángulos J1–J6 (°)</dt>
            <dd className="m-0 text-on-surface break-words">{fmt(estado.angulos)}</dd>
            <dt className="text-on-surface-variant">Pinza</dt>
            <dd className="m-0 text-on-surface">
              {estado.pinza
                ? `${estado.pinza.inicializada ? 'inicializada' : 'sin inicializar'} · posición ${estado.pinza.posicion}/1000`
                : 'sin conectar'}
            </dd>
          </dl>
          <div className="flex flex-wrap items-center gap-space-xs">
            <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => ejecutar(inicializarPinza)}>
              Inicializar pinza
            </button>
            <button type="button" className={CLASE_BOTON} disabled={ocupado || !habilitado} onClick={() => ejecutar(() => moverPinza('abrir'))}>
              Abrir
            </button>
            <button type="button" className={CLASE_BOTON} disabled={ocupado || !habilitado} onClick={() => ejecutar(() => moverPinza('cerrar'))}>
              Cerrar
            </button>
            <input
              className={`${CAMPO} !w-24`}
              type="number"
              min="0"
              max="60"
              value={ancho}
              onChange={(e) => setAncho(Number(e.target.value))}
              aria-label="Ancho de apertura en milímetros"
            />
            <button type="button" className={CLASE_BOTON} disabled={ocupado || !habilitado} onClick={() => ejecutar(() => moverPinza('ancho', ancho))}>
              Abrir a {ancho} mm
            </button>
          </div>
        </>
      )}
      {(error || estado?.error) && (
        <p className={CLASE_AVISO} role="alert">
          {error ?? estado.error}
        </p>
      )}
    </section>
  );
}
