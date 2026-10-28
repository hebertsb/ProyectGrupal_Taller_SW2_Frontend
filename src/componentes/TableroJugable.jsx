import { useEffect } from 'react';
import './TableroSoloLectura.css';
import { claseDePieza, nombreCasilla, rutaImagenPieza } from '../ajedrez';
import { esDelColor } from '../anticipadas';
import useAnticipadas from '../useAnticipadas';
import useArrastrePiezas from '../useArrastrePiezas';
import ResumenAnticipadas from './ResumenAnticipadas';

const COLUMNAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const FILAS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/**
 * Tablero de ajedrez CLICKEABLE para jugar contra otra persona: pinta un `fen`, marca la casilla elegida, los destinos legales y la última jugada,
 * y avisa con `alClicCasilla(casilla)` (por ejemplo `"e4"`). No sabe de reglas: quien lo usa decide qué hacer con cada clic. Con
 * `orientacion="negras"` se da vuelta (las negras abajo), como en cualquier sala de ajedrez. Con `deshabilitado` nada responde al clic
 * (para mirar una partida o cuando no es tu turno).
 *
 * **Arrastrar:** una pieza propia se puede arrastrar con el mouse o el dedo (ver `useArrastrePiezas`); un toque sin arrastrar es un clic común.
 *
 * **Jugadas anticipadas:** si `puedeAnticipar` (la partida sigue y todavía no te toca), los clics y arrastres arman jugadas que se hacen solas cuando te toca (hasta 7; ver
 * `useAnticipadas`). Para eso hay que pasar `miColor`, `miTurno` (si ya podés mover), `obtenerDestinosLegales(origen)` y `jugar(origen, destino, promocion)`.
 *
 * Mismo marco de madera que el tablero de solo lectura; el de la Sala de Control tiene el suyo propio porque maneja el brazo y el modelo.
 */
export default function TableroJugable({
  fen,
  orientacion = 'blancas',
  seleccionada = null,
  destinos = [],
  ultimaJugada = null,
  alClicCasilla,
  deshabilitado = false,
  className = '',
  miColor = null,
  miTurno = false,
  puedeAnticipar = false,
  activoAnticipar = false,
  obtenerDestinosLegales = null,
  jugar = null,
  claveDePartida = '',
}) {
  const anticipando = Boolean(puedeAnticipar && obtenerDestinosLegales && jugar);
  const anticipadas = useAnticipadas({
    fen,
    miColor,
    activo: Boolean(activoAnticipar && obtenerDestinosLegales && jugar),
    miTurno,
    puedeAnticipar: anticipando,
    obtenerDestinosLegales: obtenerDestinosLegales ?? (async () => []),
    jugar: jugar ?? (async () => {}),
    claveDePartida,
  });
  const sinRespuesta = deshabilitado && !anticipando;
  const clicInterno = (casilla) => {
    if (!anticipadas.clic(casilla)) alClicCasilla?.(casilla);
  };
  const arrastre = useArrastrePiezas({
    habilitado: !sinRespuesta && miColor != null,
    puedeArrastrar: (_casilla, pieza) => esDelColor(pieza, miColor),
    seleccionada: anticipando ? anticipadas.seleccion : seleccionada,
    clic: clicInterno,
  });

  // Escape borra las anticipadas.
  useEffect(() => {
    if (anticipadas.cola.length === 0) return undefined;
    const alTeclear = (evento) => evento.key === 'Escape' && anticipadas.cancelar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [anticipadas]);

  const matriz = anticipadas.matrizMostrada(fen);
  const invertido = orientacion === 'negras';
  const indices = [0, 1, 2, 3, 4, 5, 6, 7];
  const filas = invertido ? [...indices].reverse() : indices;
  const columnas = invertido ? [...indices].reverse() : indices;
  const origenUltima = ultimaJugada && ultimaJugada.length >= 4 ? ultimaJugada.slice(0, 2) : null;
  const destinoUltima = ultimaJugada && ultimaJugada.length >= 4 ? ultimaJugada.slice(2, 4) : null;
  const etiquetasFilas = invertido ? [...FILAS].reverse() : FILAS;
  const etiquetasColumnas = invertido ? [...COLUMNAS].reverse() : COLUMNAS;
  const casillaElegida = anticipando ? anticipadas.seleccion : seleccionada;
  const destinosMostrados = anticipando ? anticipadas.destinos : destinos;
  const origenesAnticipados = new Set(anticipadas.cola.map((m) => m.origen));
  const destinosAnticipadosSet = new Set(anticipadas.cola.map((m) => m.destino));

  return (
    <div
      className={`relative w-full max-w-[560px] flex flex-col items-center gap-space-xs ${className}`}
      onContextMenu={(evento) => {
        if (anticipadas.cola.length > 0) {
          evento.preventDefault();
          anticipadas.cancelar();
        }
      }}
    >
      <div
        className="w-full aspect-square rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.7)] relative flex items-center justify-center p-4 sm:p-7"
        style={{
          background: 'var(--tablero-marco)',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8), 0 20px 40px -10px #000',
        }}
      >
        <div className="w-full h-full rounded-lg relative flex items-center justify-center shadow-inner p-1.5 sm:p-3" style={{ background: 'var(--tablero-borde)' }}>
          <div className="w-full h-full grid grid-cols-8 grid-rows-8 rounded shadow-2xl overflow-hidden relative">
            {matriz &&
              filas.map((indiceFila) =>
                columnas.map((indiceColumna) => {
                  const pieza = matriz[indiceFila][indiceColumna];
                  const casilla = nombreCasilla(indiceFila, indiceColumna);
                  const clara = (indiceFila + indiceColumna) % 2 === 0;
                  const esDestino = destinosMostrados.includes(casilla);
                  const esUltima = casilla === origenUltima || casilla === destinoUltima;
                  return (
                    <button
                      key={casilla}
                      type="button"
                      data-casilla={casilla}
                      onClick={() => arrastre.alClic(casilla, clicInterno)}
                      disabled={sinRespuesta}
                      aria-label={`Casilla ${casilla}${pieza ? ', pieza ' + pieza : ', vacía'}${esDestino ? ', jugada válida' : ''}`}
                      className={`relative flex items-center justify-center p-0 border-0 ${clara ? 'bg-tablero-clara' : 'bg-tablero-oscura'} ${casilla === casillaElegida ? 'ring-2 ring-inset ring-primary' : ''} ${sinRespuesta ? 'cursor-default' : 'cursor-pointer'}`}
                      {...arrastre.propsDeCasilla(casilla, pieza)}
                    >
                      {esUltima && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-yellow-300/40" />}
                      {(origenesAnticipados.has(casilla) || destinosAnticipadosSet.has(casilla)) && (
                        <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${destinosAnticipadosSet.has(casilla) ? 'bg-orange-500/50' : 'bg-orange-400/35'}`} />
                      )}
                      {pieza && (
                        <div className={`${claseDePieza(pieza)} ${casilla === arrastre.origenArrastrado ? 'opacity-30' : ''}`}>
                          <img className="chess-piece-imagen" src={rutaImagenPieza(pieza)} alt={pieza} draggable={false} />
                        </div>
                      )}
                      {esDestino && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute rounded-full ${
                            pieza ? 'inset-[8%] border-[3px] border-primary/80 shadow-[0_0_6px_color-mix(in_srgb,var(--color-primary-container)_50%,transparent)]' : 'w-[28%] h-[28%] bg-primary/70 shadow-[0_0_6px_color-mix(in_srgb,var(--color-primary-container)_60%,transparent)]'
                          }`}
                        />
                      )}
                    </button>
                  );
                }),
              )}
          </div>

          <div className="absolute left-0.5 sm:left-1 top-1.5 sm:top-3 bottom-1.5 sm:bottom-3 flex flex-col justify-around font-mono-micro text-[8px] sm:text-[9px] text-tablero-etiquetas pointer-events-none font-bold select-none">
            {etiquetasFilas.map((etiqueta) => (
              <span key={etiqueta}>{etiqueta}</span>
            ))}
          </div>
          <div className="absolute bottom-0 sm:bottom-0.5 left-3 sm:left-4 right-3 sm:right-4 flex justify-around font-mono-micro text-[8px] sm:text-[9px] text-tablero-etiquetas pointer-events-none font-bold select-none">
            {etiquetasColumnas.map((etiqueta) => (
              <span key={etiqueta}>{etiqueta}</span>
            ))}
          </div>
        </div>
      </div>
      <ResumenAnticipadas cola={anticipadas.cola} alCancelar={anticipadas.cancelar} />
      {arrastre.fantasma}
    </div>
  );
}
