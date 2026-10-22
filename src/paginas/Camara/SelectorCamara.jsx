import { useEffect, useRef, useState } from 'react';
import { fotoDeCamara, girarCamara, listarCamaras, quitarCamaraSecundaria, seleccionarCamara } from '../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from './estilos';
import { EVENTO_CAMARAS_CAMBIO } from './useCamarasConfiguradas';

const NOMBRES = { principal: 'principal', secundaria: 'secundaria' };

/**
 * Elegir qué cámara es la principal y cuál la secundaria (opcional: otro ángulo del mismo tablero). Busca las que abren, muestra una
 * miniatura de cada una para reconocerlas y asigna al instante; cada cámara necesita una fuente distinta y tiene su propio giro.
 * Mientras busca, el video en vivo se corta un momento.
 */
export default function SelectorCamara() {
  const [abierto, setAbierto] = useState(false);
  const [camaras, setCamaras] = useState([]);
  const [asignadas, setAsignadas] = useState({ principal: null, secundaria: null });
  const [miniaturas, setMiniaturas] = useState({});
  const [estado, setEstado] = useState('');
  const [error, setError] = useState(null);
  const [url, setUrl] = useState('');
  const urlsRef = useRef([]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  const avisar = () => window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));

  async function buscar() {
    setError(null);
    setEstado('Buscando cámaras…');
    try {
      const datos = await listarCamaras();
      setAsignadas(datos.asignadas ?? { principal: { fuente: datos.actual, rotacion: datos.rotacion }, secundaria: null });
      setCamaras(datos.camaras);
      for (const c of datos.camaras.filter((x) => x.disponible)) {
        setEstado(`Mirando la cámara ${c.indice}…`);
        try {
          const foto = await fotoDeCamara(c.indice);
          urlsRef.current.push(foto);
          setMiniaturas((m) => ({ ...m, [c.indice]: foto }));
        } catch {
          /* sin miniatura: la cámara se sigue pudiendo elegir */
        }
      }
      setEstado('');
    } catch (e) {
      setError(e.message);
      setEstado('');
    }
  }

  async function asignar(fuente, camara) {
    setError(null);
    setEstado(`Asignando a la cámara ${camara}…`);
    try {
      const r = await seleccionarCamara(fuente, camara);
      setAsignadas((a) => ({ ...a, [camara]: { fuente: r.actual, rotacion: a[camara]?.rotacion ?? 0 } }));
      setEstado(`Cámara ${camara}: ahora usa ${r.actual}. Volvé a calibrar su tablero.`);
      avisar();
    } catch (e) {
      setError(`No se pudo usar esa cámara: ${e.message}`);
      setEstado('');
    }
  }

  async function quitarSecundaria() {
    setError(null);
    try {
      await quitarCamaraSecundaria();
      setAsignadas((a) => ({ ...a, secundaria: null }));
      setEstado('Ya no se usa la cámara secundaria.');
      avisar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function rotar(grados, camara) {
    setError(null);
    try {
      const r = await girarCamara(grados, camara);
      setAsignadas((a) => ({ ...a, [camara]: { ...a[camara], rotacion: r.rotacion } }));
      setEstado(grados === 0 ? `Cámara ${camara}: sin giro.` : `Cámara ${camara} girada ${grados}°. Volvé a calibrar su tablero.`);
      avisar();
    } catch (e) {
      setError(e.message);
    }
  }

  const rol = (indice) => Object.keys(NOMBRES).find((c) => asignadas[c] && String(asignadas[c].fuente) === String(indice));

  return (
    <div className="flex flex-col gap-space-xs">
      <button
        type="button"
        className={CLASE_BOTON}
        aria-expanded={abierto}
        onClick={() => {
          const nuevo = !abierto;
          setAbierto(nuevo);
          if (nuevo) buscar();
        }}
      >
        <span className="inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">cameraswitch</span>
          {abierto ? 'Ocultar cámaras' : 'Elegir cámaras (principal y secundaria)'}
        </span>
      </button>
      {abierto && (
        <div className="flex flex-col gap-space-xs">
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            La <strong>principal</strong> es la que se usa siempre. La <strong>secundaria</strong> es opcional: otro ángulo del mismo tablero
            para reconocer mejor las piezas (se calibra aparte y los resultados de las dos se combinan). Para usar el iPhone: mismo Apple
            ID, Wi-Fi y Bluetooth activos y el iPhone bloqueado apuntando al tablero.
          </p>
          {estado && (
            <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
              {estado}
            </p>
          )}
          <ul className="list-none p-0 m-0 grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
            {camaras
              .filter((c) => c.disponible)
              .map((c) => {
                const rolActual = rol(c.indice);
                return (
                  <li key={c.indice} className="flex flex-col gap-1 border border-outline-variant rounded-xl p-space-xs">
                    {miniaturas[c.indice] ? (
                      <img src={miniaturas[c.indice]} alt={`Vista de la cámara ${c.indice}`} className="w-full h-auto rounded-lg" />
                    ) : (
                      <div className="aspect-video bg-surface-container rounded-lg" />
                    )}
                    <span className="font-body-sm text-body-sm text-on-surface">
                      Cámara {c.indice} · {c.ancho}×{c.alto}
                      {rolActual ? <strong className="text-primary"> · {rolActual}</strong> : ''}
                    </span>
                    <button type="button" className={rolActual === 'principal' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} disabled={rolActual === 'principal'} onClick={() => asignar(c.indice, 'principal')}>
                      {rolActual === 'principal' ? 'Es la principal' : 'Usar como principal'}
                    </button>
                    <button type="button" className={rolActual === 'secundaria' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} disabled={rolActual === 'secundaria'} onClick={() => asignar(c.indice, 'secundaria')}>
                      {rolActual === 'secundaria' ? 'Es la secundaria' : 'Usar como secundaria'}
                    </button>
                  </li>
                );
              })}
          </ul>
          {camaras.length > 0 && camaras.every((c) => !c.disponible) && (
            <p className="font-body-sm text-body-sm text-on-surface m-0">No se encontró ninguna cámara. Revisá el permiso de cámara de macOS.</p>
          )}
          {Object.keys(NOMBRES).map((camara) => (
            <div key={camara} className="flex flex-wrap items-center gap-space-xs" role="group" aria-label={`Girar la imagen de la cámara ${camara}`}>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Girar la {camara}:</span>
              {[0, 90, 180, 270].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={(asignadas[camara]?.rotacion ?? 0) === g ? CLASE_BOTON_PRIMARIO : CLASE_BOTON}
                  aria-pressed={(asignadas[camara]?.rotacion ?? 0) === g}
                  disabled={!asignadas[camara]}
                  onClick={() => rotar(g, camara)}
                >
                  {g}°
                </button>
              ))}
              {camara === 'secundaria' && asignadas.secundaria && (
                <button type="button" className={CLASE_BOTON} onClick={quitarSecundaria}>
                  Quitar la secundaria
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-space-xs">
            <input
              className="min-h-[44px] w-full min-w-0 px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="o una URL de stream, ej. http://192.168.1.23:8080/video"
              aria-label="URL de una cámara de red"
            />
            <button type="button" className={CLASE_BOTON} disabled={!url.trim()} onClick={() => asignar(url.trim(), 'principal')}>
              URL → principal
            </button>
            <button type="button" className={CLASE_BOTON} disabled={!url.trim()} onClick={() => asignar(url.trim(), 'secundaria')}>
              URL → secundaria
            </button>
            <button type="button" className={CLASE_BOTON} onClick={buscar}>
              Buscar de nuevo
            </button>
          </div>
          {error && (
            <p className={CLASE_AVISO} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
