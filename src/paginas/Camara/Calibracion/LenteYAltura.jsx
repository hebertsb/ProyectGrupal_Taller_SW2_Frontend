import { useCallback, useEffect, useRef, useState } from 'react';
import { agregarFotoLente, borrarLente, calcularLente, estadoLente, fijarCampoDeVision, vistaDeCajas } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../estilos';

const ETIQUETA_ORIGEN = {
  supuesto: 'Supuesto (campo de visión típico)',
  autocalibrado: 'Calibrado con fotos del tablero',
  manual: 'Fijado a mano',
};

/**
 * Lente y altura de las piezas (3D) de una cámara: calibra la distancia focal con fotos del propio tablero, muestra dónde está la cámara
 * respecto de él y dibuja la caja 3D de varias casillas sobre la imagen para comprobar a ojo que la geometría coincide con las piezas.
 * Con eso el recorte de cada casilla sigue a la pieza completa aunque sea alta (rey de 6 cm) y la cámara esté inclinada.
 */
export default function LenteYAltura({ camara }) {
  const [estado, setEstado] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [vista, setVista] = useState(null);
  const [fov, setFov] = useState(70);
  const vistaRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await estadoLente(camara));
      setError(null);
    } catch (e) {
      setEstado(null);
      setError(e.message);
    }
  }, [camara]);

  useEffect(() => {
    cargar();
    return () => {
      if (vistaRef.current) URL.revokeObjectURL(vistaRef.current);
      vistaRef.current = null;
    };
  }, [cargar]);

  async function correr(accion, textoOk) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await accion();
      if (textoOk) setMensaje(typeof textoOk === 'function' ? textoOk(r) : textoOk);
      await cargar();
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function verCajas() {
    setOcupado(true);
    setError(null);
    try {
      const url = await vistaDeCajas(camara);
      if (vistaRef.current) URL.revokeObjectURL(vistaRef.current);
      vistaRef.current = url;
      setVista(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const lente = estado?.lente;
  const diag = estado?.diagnostico;

  return (
    <div className="flex flex-col gap-space-xs border-t border-outline-variant pt-space-sm" role="group" aria-labelledby={`titulo-lente-${camara}`}>
      <h4 id={`titulo-lente-${camara}`} className="font-body-sm text-body-sm text-on-surface font-medium m-0">
        Lente y altura de las piezas (3D) — cámara {camara}
      </h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        La app calcula dónde está la cámara respecto del tablero (casilla de {estado?.casilla_mm ?? 30} mm, rey de{' '}
        {(estado?.altura_pieza_mm ?? 60) / 10} cm) para recortar cada casilla siguiendo la caja de la pieza completa. Hace falta tener el tablero
        calibrado en esta cámara.
      </p>
      {lente && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-space-sm gap-y-1 font-body-sm text-body-sm m-0">
          <dt className="text-on-surface-variant">Lente</dt>
          <dd className="m-0 text-on-surface">
            {ETIQUETA_ORIGEN[lente.origen] ?? lente.origen} · campo de visión {lente.fov_horizontal}°
            {lente.error_px != null ? ` · error ${lente.error_px} px` : ''}
          </dd>
          {diag && (
            <>
              <dt className="text-on-surface-variant">Cámara</dt>
              <dd className="m-0 text-on-surface">
                a {Math.round(diag.altura_mm / 10)} cm de altura, {Math.round(diag.distancia_mm / 10)} cm del centro del tablero, inclinada{' '}
                {diag.inclinacion_grados}° (0° = mira derecho hacia abajo) · error de calibración {diag.error_px} px
              </dd>
            </>
          )}
          <dt className="text-on-surface-variant">Fotos para el lente</dt>
          <dd className="m-0 text-on-surface">{estado.fotos_guardadas} guardadas</dd>
        </dl>
      )}
      {estado?.aviso && (
        <p className={CLASE_AVISO} role="alert">
          {estado.aviso}
        </p>
      )}
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Para calibrar el lente: con el tablero entero a la vista y SIN piezas encima, tocá «Agregar foto». Movelo o inclinalo un poco y repetí
        (de 3 a 8 fotos). Después «Calcular lente».
      </p>
      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          className={CLASE_BOTON}
          disabled={ocupado}
          onClick={() =>
            correr(
              () => agregarFotoLente(camara),
              (r) => (r.detectada ? `Foto guardada (${r.fotos_guardadas}).` : 'No se ven las esquinas internas del tablero: que esté entero, parejo y sin piezas.')
            )
          }
        >
          Agregar foto
        </button>
        <button
          type="button"
          className={CLASE_BOTON_PRIMARIO}
          disabled={ocupado || !estado?.fotos_guardadas}
          onClick={() =>
            correr(
              () => calcularLente(camara),
              (r) => (r.guardado ? 'Lente calibrado y guardado.' : `No se guardó: ${r.avisos.join(' ')}`)
            )
          }
        >
          Calcular lente
        </button>
        <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={verCajas}>
          Ver las cajas 3D
        </button>
        <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => correr(() => borrarLente(camara), 'Lente borrado: se vuelve al campo de visión típico.')}>
          Borrar lente
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-space-xs">
        <label className="font-body-sm text-body-sm text-on-surface-variant" htmlFor={`fov-${camara}`}>
          Campo de visión (°):
        </label>
        <input
          id={`fov-${camara}`}
          type="number"
          min="20"
          max="170"
          value={fov}
          onChange={(e) => setFov(Number(e.target.value))}
          className="min-h-[44px] w-24 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm"
        />
        <button type="button" className={CLASE_BOTON} disabled={ocupado} onClick={() => correr(() => fijarCampoDeVision(fov, camara), `Campo de visión fijado en ${fov}°.`)}>
          Fijar a mano
        </button>
      </div>
      {mensaje && (
        <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      {vista && (
        <figure className="flex flex-col gap-space-xs m-0">
          <img src={vista} alt="Imagen de la cámara con las cajas 3D de varias casillas dibujadas encima" className="w-full h-auto rounded-lg border border-outline-variant" />
          <figcaption className="font-body-sm text-body-sm text-on-surface-variant">
            Verde: la base de cada casilla. Naranja: la tapa, a la altura del rey. Celeste: las aristas verticales. Poné un rey en una de esas
            casillas: la caja tiene que envolverlo. Si queda corrida o se ve más chica o más grande que la pieza, ajustá el campo de visión.
          </figcaption>
        </figure>
      )}
    </div>
  );
}
