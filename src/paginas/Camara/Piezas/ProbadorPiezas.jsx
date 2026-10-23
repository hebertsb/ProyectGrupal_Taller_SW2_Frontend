import { useEffect, useMemo, useRef, useState } from 'react';
import { estadoDeLosModelos, problemasDePosicion } from '../../../api/backend';
import { nombreClase } from '../../EntrenarCamara/SubirFotosPieza';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import useCamarasConfiguradas from '../useCamarasConfiguradas';
import useFlujoVivo from '../useFlujoVivo';
import TableroSoloLectura from '../../../componentes/TableroSoloLectura';
import { fenDeCasillas } from './fenCaptura';

const CUADROS_VOTO = 8;

/** Mayoría por casilla entre los últimos cuadros: un error suelto de un cuadro no cambia lo que se muestra. */
function votar(historial) {
  const porCasilla = new Map();
  const ultimaPorCamara = new Map();
  for (const lectura of historial) {
    for (const [casilla, clase, confianza, porCamara] of lectura) {
      const votos = porCasilla.get(casilla) ?? new Map();
      const previo = votos.get(clase) ?? { n: 0, suma: 0 };
      votos.set(clase, { n: previo.n + 1, suma: previo.suma + confianza });
      porCasilla.set(casilla, votos);
      ultimaPorCamara.set(casilla, porCamara ?? []); // lo que vio cada cámara en el cuadro más reciente
    }
  }
  const resultado = [];
  for (const [casilla, votos] of porCasilla) {
    const [clase, { n, suma }] = [...votos.entries()].sort((a, b) => b[1].n - a[1].n || b[1].suma - a[1].suma)[0];
    resultado.push({ casilla, clase, confianza: suma / n, estabilidad: n / historial.length, alternativas: [], porCamara: ultimaPorCamara.get(casilla) ?? [] });
  }
  return resultado;
}

function mensajeError(e) {
  if (e.status === 409) return 'Todavía no hay un modelo de piezas entrenado.';
  if (e.status === 503) return 'La cámara no está disponible.';
  if (e.status === 422) return `No se detectó el tablero: ${e.message}. ¿Está calibrado y completo a la vista?`;
  return e.message;
}

const colorConfianza = (c) => (c >= 0.8 ? 'text-primary' : c >= 0.5 ? 'text-on-surface' : 'text-error');

/**
 * Probador de piezas: la cámara mira el tablero calibrado y el modelo dice qué reconoce en cada casilla (pieza, color y confianza).
 * Poné una pieza en cualquier casilla y mirá si la reconoce. Es video en vivo y se vota entre los últimos 8 cuadros para que un error suelto no cambie el resultado; no guarda nada.
 */
export default function ProbadorPiezas() {
  const [enVivo, setEnVivo] = useState(true);
  const { calibradas } = useCamarasConfiguradas();
  const [modelos, setModelos] = useState(null);
  useEffect(() => {
    estadoDeLosModelos().then(setModelos).catch(() => setModelos(null));
  }, []);
  const textoModelo = (m, nombre) => (m?.existe ? `${nombre} (recorte ${m.recorte})` : `${nombre}: sin entrenar`);
  const dosCamaras = calibradas.includes('secundaria');
  const [vistaPiezas, setVistaPiezas] = useState('ambas');
  const { url, datos, error: errorFlujo } = useFlujoVivo({ modo: 'piezas', camara: dosCamaras ? 'todas' : 'principal', vista: vistaPiezas, activo: enVivo });
  const error = errorFlujo ? mensajeError({ message: errorFlujo, status: /entrenado|409/.test(errorFlujo) ? 409 : 0 }) : null;
  const historialRef = useRef([]);
  const casillas = useMemo(() => {
    if (!datos) return [];
    historialRef.current = [...historialRef.current, datos].slice(-CUADROS_VOTO);
    return votar(historialRef.current);
  }, [datos]);
  const desacuerdos = casillas.filter((c) => new Set(c.porCamara).size > 1);
  const fenReconocido = useMemo(() => fenDeCasillas(casillas), [casillas]);
  const ocupadas = casillas.filter((c) => c.clase !== 'vacia');
  // Validaciones lógicas de la posición reconocida (se piden solo cuando cambia la posición, no en cada cuadro).
  const [problemas, setProblemas] = useState([]);
  const piezasFen = ocupadas.length ? fenReconocido.split(' ')[0] : '';
  useEffect(() => {
    if (!piezasFen) {
      setProblemas([]);
      return undefined;
    }
    let vigente = true;
    problemasDePosicion(piezasFen)
      .then((r) => vigente && setProblemas(r.problemas ?? []))
      .catch(() => vigente && setProblemas([]));
    return () => {
      vigente = false;
    };
  }, [piezasFen]);

  return (
    <div className="flex flex-col gap-space-md">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Poné una pieza en el tablero y mirá (en vivo) qué reconoce el modelo en cada casilla. El color del círculo indica la confianza:
        verde (80 % o más), ámbar (50–80 %) o rojo (menos). Requiere el tablero calibrado y un modelo entrenado. Qué casillas tienen
        pieza lo decide la cámara que mira más desde arriba, comparando con la foto del tablero vacío (se renueva al capturar «Casilla
        vacía»); el resultado ya respeta las reglas del ajedrez: un rey por bando, hasta 8 peones y nunca en la fila 1 u 8, y piezas de
        más (como un segundo alfil en el mismo color de casilla) solo si faltan peones que hayan coronado.
      </p>
      <div className="flex flex-wrap items-center gap-space-xs" role="group" aria-label="Cómo mostrar el reconocimiento">
        <span className="font-body-sm text-body-sm text-on-surface-variant">Ver:</span>
        {[['plana', 'Tablero plano'], ['cajas', 'Cajas 3D sobre la cámara'], ['ambas', 'Ambas']].map(([id, texto]) => (
          <button key={id} type="button" className={vistaPiezas === id ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={vistaPiezas === id} onClick={() => setVistaPiezas(id)}>
            {texto}
          </button>
        ))}
      </div>
      {modelos && (
        <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">
          Modelos: {textoModelo(modelos.ocupacion, 'ocupación')} · {textoModelo(modelos.piezas, 'piezas')} · {modelos.dos_vistas?.existe ? `dos vistas (recorte ${modelos.dos_vistas.recorte}) — es el que decide` : modelos.dos_vistas?.ignorado ? `dos vistas: no se usa (${modelos.dos_vistas.ignorado})` : 'dos vistas: sin entrenar'}
        </p>
      )}
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" className={CLASE_BOTON} onClick={() => setEnVivo((v) => !v)} aria-pressed={enVivo}>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">{enVivo ? 'pause' : 'play_arrow'}</span>
            {enVivo ? 'Pausar' : 'Reanudar en vivo'}
          </span>
        </button>
      </div>
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <section className={`${CLASE_TARJETA} xl:col-span-2`} aria-labelledby="titulo-probador-imagen">
          <h3 id="titulo-probador-imagen" className="font-body-md text-body-md text-on-surface font-medium">
            Lo que ve la cámara{dosCamaras ? ' (principal y secundaria, resultado combinado)' : ''}
          </h3>
          <div className="w-full bg-surface-container rounded-lg overflow-hidden flex items-center justify-center min-h-[8rem]">
            {url ? (
              <img
                src={url}
                alt="Tablero enderezado con las piezas reconocidas marcadas por casilla"
                className="w-full h-auto"
              />
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant p-space-md">Conectando con la cámara…</span>
            )}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Mayúscula = blanca, minúscula = negra (P peón, N caballo, B alfil, R torre, Q dama, K rey).
            {dosCamaras ? ' Un cuadro magenta marca las casillas donde las dos cámaras no coinciden.' : ''}
          </p>
        </section>
        <section className={CLASE_TARJETA} aria-labelledby="titulo-probador-tablero">
          <h3 id="titulo-probador-tablero" className="font-body-md text-body-md text-on-surface font-medium">
            Posición reconocida{dosCamaras ? ' (decisión entre las dos cámaras)' : ''}
          </h3>
          <div className="w-full flex justify-center">
            <TableroSoloLectura fen={fenReconocido} />
          </div>
          {problemas.length > 0 && (
            <div className={CLASE_AVISO} role="status" aria-live="polite">
              <p className="m-0 font-medium">Esta posición no puede darse en una partida:</p>
              <ul className="m-0 pl-space-md">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {dosCamaras && (
            <div role="status" aria-live="polite">
              {desacuerdos.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Las dos cámaras coinciden en todas las casillas.</p>
              ) : (
                <>
                  <p className="font-body-sm text-body-sm text-on-surface m-0">
                    Casillas donde las cámaras no coinciden ({desacuerdos.length}):
                  </p>
                  <ul className="list-none p-0 m-0 flex flex-col gap-1 font-body-sm text-body-sm">
                    {desacuerdos.map((c) => (
                      <li key={c.casilla} className="text-on-surface-variant">
                        <strong className="text-on-surface">{c.casilla}</strong> · principal: {nombreClase(c.porCamara[0])} · secundaria: {nombreClase(c.porCamara[1])} →{' '}
                        <strong className="text-on-surface">{nombreClase(c.clase)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
        <section className={CLASE_TARJETA} aria-labelledby="titulo-probador-lista">
          <h3 id="titulo-probador-lista" className="font-body-md text-body-md text-on-surface font-medium">
            Piezas reconocidas ({ocupadas.length})
          </h3>
          {datos && ocupadas.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0">No reconoce ninguna pieza: el tablero se ve vacío.</p>
          )}
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {ocupadas.map((c) => (
              <li key={c.casilla} className="flex flex-wrap items-baseline justify-between gap-x-space-sm font-body-sm text-body-sm border-b border-outline-variant pb-1">
                <span className="text-on-surface">
                  <strong>{c.casilla}</strong> · {nombreClase(c.clase)}
                </span>
                <span className={colorConfianza(c.confianza)}>
                  {Math.round(c.confianza * 100)} %
                  {c.confianza < 0.8 && c.alternativas[0] ? (
                    <span className="text-on-surface-variant"> (¿{nombreClase(c.alternativas[0].clase)}?)</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
