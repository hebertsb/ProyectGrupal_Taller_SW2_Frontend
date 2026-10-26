import { useCallback, useEffect, useState } from 'react';
import { actualizarParametrosBrazo, obtenerParametrosBrazo } from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';

const CAMPO =
  'min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const redondear = (n) => Math.round(n * 10) / 10;

const ZONA_NUEVA = { nombre: 'Trípode de la cámara', forma: 'circulo', radio: 150, x: null, y: null, x1: null, y1: null, x2: null, y2: null, z_min: '', z_max: '' };

function describir(z) {
  const donde = z.forma === 'circulo' ? `círculo en (${redondear(z.x)}, ${redondear(z.y)}), radio ${z.radio} mm` : `rectángulo (${redondear(z.x1)}, ${redondear(z.y1)}) a (${redondear(z.x2)}, ${redondear(z.y2)})`;
  const alto = [z.z_min != null ? `desde ${z.z_min} mm de alto` : null, z.z_max != null ? `hasta ${z.z_max} mm` : null].filter(Boolean).join(' ');
  return `${z.nombre}: ${donde}${alto ? `, ${alto}` : ', de la mesa para arriba'}`;
}

/**
 * Dónde NO puede ir el brazo: el rectángulo de la mesa (la punta no sale de él) y zonas prohibidas (el trípode de la cámara, la cámara, un cable…). Se marcan llevando el brazo a mano
 * (modo arrastre) y tocando «Tomar»: solo se lee su posición. Se comprueba ANTES de cada movimiento: si el recorrido pasa por una zona, el brazo no se mueve y dice cuál es.
 */
export default function ZonasBrazo({ estado }) {
  const [limites, setLimites] = useState(null);
  const [esquinas, setEsquinas] = useState([null, null]);
  const [zonas, setZonas] = useState([]);
  const [nueva, setNueva] = useState(ZONA_NUEVA);
  const [guardarEnDisco, setGuardarEnDisco] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const real = Boolean(estado?.conectado) && !estado?.emulador;
  const puedeTomar = Boolean(estado?.conectado) && Array.isArray(estado?.pose);

  const cargar = useCallback(async () => {
    try {
      const p = await obtenerParametrosBrazo();
      setLimites(p.limites_mesa ?? null);
      setZonas(p.zonas_prohibidas ?? []);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (estado?.conectado) cargar();
  }, [estado?.conectado, estado?.destino, cargar]);

  const tomar = () => [redondear(estado.pose[0]), redondear(estado.pose[1])];
  const fijarLimites = () => {
    if (!esquinas[0] || !esquinas[1]) return;
    setLimites([Math.min(esquinas[0][0], esquinas[1][0]), Math.min(esquinas[0][1], esquinas[1][1]), Math.max(esquinas[0][0], esquinas[1][0]), Math.max(esquinas[0][1], esquinas[1][1])]);
  };

  function agregarZona() {
    const z = { nombre: nueva.nombre.trim() || 'Zona', forma: nueva.forma };
    if (nueva.forma === 'circulo') {
      if (nueva.x == null) return setError('Toma el centro de la zona con «Tomar el centro».');
      Object.assign(z, { x: nueva.x, y: nueva.y, radio: Number(nueva.radio) || 0 });
    } else {
      if (nueva.x1 == null || nueva.x2 == null) return setError('Toma las dos esquinas del rectángulo.');
      Object.assign(z, { x1: nueva.x1, y1: nueva.y1, x2: nueva.x2, y2: nueva.y2 });
    }
    if (nueva.z_min !== '') z.z_min = Number(nueva.z_min);
    if (nueva.z_max !== '') z.z_max = Number(nueva.z_max);
    setError(null);
    setZonas((lista) => [...lista, z]);
    setNueva(ZONA_NUEVA);
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const nuevos = await actualizarParametrosBrazo({ limites_mesa: limites, zonas_prohibidas: zonas }, guardarEnDisco && real);
      setLimites(nuevos.limites_mesa ?? null);
      setZonas(nuevos.zonas_prohibidas ?? []);
      setMensaje(guardarEnDisco && real ? 'Guardado en brazo.json y aplicado.' : 'Aplicado al brazo (no se guardó en el archivo).');
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-zonas-brazo">
      <h3 id="titulo-zonas-brazo" className="font-body-md text-body-md text-on-surface font-medium">
        Límites de la mesa y zonas prohibidas (trípode, cámara…)
      </h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
        Marca con el brazo (modo arrastre, la punta apoyada en el lugar) adónde NO puede ir. Antes de cada movimiento se comprueba el recorrido: si pasa por una zona o se sale de la mesa, no se
        mueve y te dice cuál. Se agranda cada zona 25 mm por seguridad. Solo se comprueba la punta de la pinza en las jugadas; en el modo en vivo y las rutinas, el brazo entero.
      </p>

      <h4 className="font-body-md text-body-md text-on-surface font-medium m-0">Límites de la mesa</h4>
      <div className="flex flex-wrap items-center gap-space-xs">
        {[0, 1].map((i) => (
          <button key={i} type="button" className={CLASE_BOTON} disabled={!puedeTomar} onClick={() => setEsquinas((e) => e.map((v, k) => (k === i ? tomar() : v)))}>
            Tomar la esquina {i + 1} de la mesa {esquinas[i] ? '✓' : ''}
          </button>
        ))}
        <button type="button" className={CLASE_BOTON} disabled={!esquinas[0] || !esquinas[1]} onClick={fijarLimites}>
          Usar estas esquinas
        </button>
        {limites && (
          <button type="button" className={CLASE_BOTON} onClick={() => setLimites(null)}>
            Quitar límites
          </button>
        )}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface m-0">
        {limites ? `Mesa: x de ${limites[0]} a ${limites[2]}, y de ${limites[1]} a ${limites[3]} (mm). La punta no sale de ahí.` : 'Sin límites de mesa: el brazo puede ir a cualquier lado (también al borde).'}
      </p>

      <h4 className="font-body-md text-body-md text-on-surface font-medium m-0">Zonas prohibidas</h4>
      {zonas.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Todavía no hay ninguna.</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {zonas.map((z, i) => (
            <li key={`${z.nombre}-${i}`} className="flex flex-wrap items-center justify-between gap-space-xs border-b border-outline-variant pb-1 font-body-sm text-body-sm text-on-surface">
              <span className="min-w-0 break-words">{describir(z)}</span>
              <button type="button" className={CLASE_BOTON} onClick={() => setZonas((lista) => lista.filter((_, k) => k !== i))}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-space-xs border border-outline-variant rounded-xl p-space-sm">
        <span className="font-body-sm text-body-sm text-on-surface font-medium">Agregar una zona</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Nombre
            <input className={CAMPO} value={nueva.nombre} maxLength={40} onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))} />
          </label>
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Forma
            <select className={CAMPO} value={nueva.forma} onChange={(e) => setNueva((n) => ({ ...n, forma: e.target.value }))}>
              <option value="circulo">Círculo (un trípode, un poste)</option>
              <option value="rectangulo">Rectángulo (una caja, una pared)</option>
            </select>
          </label>
        </div>
        {nueva.forma === 'circulo' ? (
          <div className="flex flex-wrap items-end gap-space-xs">
            <button type="button" className={CLASE_BOTON} disabled={!puedeTomar} onClick={() => { const [x, y] = tomar(); setNueva((n) => ({ ...n, x, y })); }}>
              Tomar el centro {nueva.x != null ? `✓ (${nueva.x}, ${nueva.y})` : ''}
            </button>
            <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
              Radio (mm): del centro hasta lo más lejano de la pata o la base
              <input className={`${CAMPO} w-28`} type="number" min="1" value={nueva.radio} onChange={(e) => setNueva((n) => ({ ...n, radio: e.target.value }))} />
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-space-xs">
            {[1, 2].map((i) => (
              <button key={i} type="button" className={CLASE_BOTON} disabled={!puedeTomar} onClick={() => { const [x, y] = tomar(); setNueva((n) => ({ ...n, [`x${i}`]: x, [`y${i}`]: y })); }}>
                Tomar la esquina {i} {nueva[`x${i}`] != null ? '✓' : ''}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-space-xs">
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Desde qué altura (mm, opcional)
            <input className={CAMPO} type="number" value={nueva.z_min} placeholder="desde la mesa" onChange={(e) => setNueva((n) => ({ ...n, z_min: e.target.value }))} />
          </label>
          <label className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
            Hasta qué altura (mm, opcional)
            <input className={CAMPO} type="number" value={nueva.z_max} placeholder="sin límite" onChange={(e) => setNueva((n) => ({ ...n, z_max: e.target.value }))} />
          </label>
        </div>
        <div>
          <button type="button" className={CLASE_BOTON} onClick={agregarZona}>
            Agregar la zona a la lista
          </button>
        </div>
      </div>

      <label className="min-h-[44px] flex items-center gap-2 font-body-sm text-body-sm text-on-surface cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-primary" checked={guardarEnDisco && real} disabled={!real} onChange={(e) => setGuardarEnDisco(e.target.checked)} />
        Guardar también en brazo.json{real ? '' : ' (solo con el brazo real)'}
      </label>
      <div>
        <button type="button" className={CLASE_BOTON_PRIMARIO} disabled={!estado?.conectado || ocupado} onClick={guardar}>
          Guardar límites y zonas
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
    </section>
  );
}
