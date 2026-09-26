import './TableroSoloLectura.css';
import { claseDePieza, fenAMatriz, nombreCasilla, rutaImagenPieza } from '../ajedrez';

// Ajustes de tamaño — "grande" es el tablero de una sola partida (Demostración
// en Vivo, vista grande de Monitoreo); "chico" es la miniatura de la grilla de
// Monitoreo (hasta 4 a la vez), con menos padding y coordenadas más finas para
// que no compitan visualmente con las piezas a ese tamaño.
const VARIANTES = {
  grande: {
    contenedor: 'max-w-[560px] p-5 sm:p-7',
    interior: 'p-2.5 sm:p-3',
    etiqueta: 'text-[9px]',
    gutterFilas: 'left-1 top-2 bottom-2',
    gutterColumnas: 'bottom-0.5 left-4 right-4',
  },
  chico: {
    contenedor: 'p-1.5 sm:p-2',
    interior: 'p-1 sm:p-1.5',
    etiqueta: 'text-[5px] sm:text-[6px]',
    gutterFilas: 'left-0.5 top-1 bottom-1',
    gutterColumnas: 'bottom-0 left-1.5 right-1.5',
  },
};

/**
 * Tablero de ajedrez SIN interacción — pinta un `fen` y nada más, ninguna
 * casilla tiene `onClick`. Pensado para vistas de "estoy mirando, no jugando":
 * Demostración en Vivo (un jugador viendo la partida de su facilitador) y
 * Monitoreo (un facilitador viendo varias partidas de estudiantes a la vez).
 * Si en algún momento hace falta un tablero clickeable, ese es un componente
 * aparte — `SalaControl.jsx` sigue con su propio tablero inline porque maneja
 * selección de casilla, destinos válidos, etc., que esto no necesita.
 */
export default function TableroSoloLectura({ fen, tamano = 'grande', className = '' }) {
  const matriz = fen ? fenAMatriz(fen) : null;
  const variante = VARIANTES[tamano] ?? VARIANTES.grande;

  return (
    <div
      className={`relative w-full flex items-center justify-center ${tamano === 'grande' ? 'max-w-[560px]' : ''} ${className}`}
    >
      <div
        className={`w-full aspect-square rounded-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.7)] relative flex items-center justify-center ${variante.contenedor}`}
        style={{
          background: 'linear-gradient(135deg, #422617 0%, #2c180e 25%, #4a2b1b 50%, #20110a 75%, #3d2215 100%)',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8), 0 20px 40px -10px #000',
        }}
      >
        <div
          className={`w-full h-full rounded-lg relative flex items-center justify-center shadow-inner ${variante.interior}`}
          style={{ background: 'linear-gradient(180deg, #1b0e08 0%, #2d180f 100%)' }}
        >
          <div className="w-full h-full grid grid-cols-8 grid-rows-8 rounded shadow-2xl overflow-hidden relative">
            {matriz &&
              matriz.map((fila, indiceFila) =>
                fila.map((pieza, indiceColumna) => {
                  const casilla = nombreCasilla(indiceFila, indiceColumna);
                  const clara = (indiceFila + indiceColumna) % 2 === 0;
                  return (
                    <div
                      key={casilla}
                      aria-label={`Casilla ${casilla}${pieza ? ', pieza ' + pieza : ', vacía'}`}
                      className={`relative flex items-center justify-center ${clara ? 'bg-[#b89772]' : 'bg-[#543423]'}`}
                    >
                      {pieza && (
                        <div className={claseDePieza(pieza)}>
                          <img className="chess-piece-imagen" src={rutaImagenPieza(pieza)} alt={pieza} draggable={false} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
          </div>

          <div
            className={`absolute flex flex-col justify-around font-mono-micro text-[#e0cfba]/40 pointer-events-none font-bold select-none ${variante.etiqueta} ${variante.gutterFilas}`}
          >
            <span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
          </div>
          <div
            className={`absolute flex justify-around font-mono-micro text-[#e0cfba]/40 pointer-events-none font-bold select-none ${variante.etiqueta} ${variante.gutterColumnas}`}
          >
            <span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
