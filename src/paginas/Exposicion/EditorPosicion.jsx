import { useEffect, useMemo, useRef, useState } from 'react';
import { fenAMatriz, nombreCasilla, rutaImagenPieza } from '../../ajedrez';
import useModalAccesible from '../../useModalAccesible';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO } from '../Camara/estilos';

const PIEZAS_BLANCAS = ['K', 'Q', 'R', 'B', 'N', 'P'];
const PIEZAS_NEGRAS = ['k', 'q', 'r', 'b', 'n', 'p'];
const NOMBRE = { k: 'rey', q: 'dama', r: 'torre', b: 'alfil', n: 'caballo', p: 'peón' };
const describir = (pieza) => `${NOMBRE[pieza.toLowerCase()]} ${pieza === pieza.toUpperCase() ? 'blanco' : 'negro'}`;

/** La posición del tablero del editor como FEN: los derechos de enroque son los de la posición anterior (el servidor descarta los que ya no valen). */
export function matrizAFen(matriz, turno, derechos) {
  const piezas = matriz
    .map((fila) => {
      let texto = '';
      let vacias = 0;
      fila.forEach((pieza) => {
        if (!pieza) {
          vacias += 1;
          return;
        }
        if (vacias) texto += vacias;
        vacias = 0;
        texto += pieza;
      });
      return vacias ? texto + vacias : texto;
    })
    .join('/');
  return `${piezas} ${turno} ${derechos || '-'} - 0 1`;
}

/** Lo que está mal en la posición armada (para avisar antes de mandarla); vacío si está bien. */
export function problemasDelEditor(matriz) {
  const todas = matriz.flat().filter(Boolean);
  const problemas = [];
  if (todas.filter((p) => p === 'K').length !== 1) problemas.push('tiene que haber exactamente un rey blanco');
  if (todas.filter((p) => p === 'k').length !== 1) problemas.push('tiene que haber exactamente un rey negro');
  if (matriz[0].concat(matriz[7]).some((p) => p === 'P' || p === 'p')) problemas.push('no puede haber peones en la primera ni en la última fila');
  if (todas.filter((p) => p === 'P').length > 8 || todas.filter((p) => p === 'p').length > 8) problemas.push('no puede haber más de 8 peones por bando');
  return problemas;
}

/**
 * Arreglar posición: el tablero digital clickeable para decirle al sistema cómo están DE VERDAD las piezas. Se mueven, se quitan o se agregan piezas hasta que quede igual que el tablero real, se
 * elige quién mueve y se confirma: la partida sigue desde ahí, sin reiniciar. Lo que cambió respecto de lo que el sistema creía se marca en ámbar.
 *
 * @param {string} fenActual la posición que cree el sistema
 * @param {(fen: string) => Promise<{ok: boolean, error?: string}>} alAplicar
 */
export default function EditorPosicion({ fenActual, alAplicar, alCerrar, ocupado }) {
  const original = useMemo(() => fenAMatriz(fenActual), [fenActual]);
  const campos = fenActual.split(' ');
  const [matriz, setMatriz] = useState(original);
  const [turno, setTurno] = useState(campos[1] === 'b' ? 'b' : 'w');
  const [seleccion, setSeleccion] = useState(null);
  const [modo, setModo] = useState('mover'); // 'mover' | 'quitar' | una letra de pieza para poner
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState(null);
  const dialogoRef = useRef(null);
  useModalAccesible(dialogoRef, { alCerrar: ocupado ? null : alCerrar });

  const problemas = useMemo(() => problemasDelEditor(matriz), [matriz]);
  const cambiadas = useMemo(() => {
    const lista = [];
    matriz.forEach((fila, f) => fila.forEach((pieza, c) => (pieza !== original[f][c] ? lista.push(nombreCasilla(f, c)) : null)));
    return lista;
  }, [matriz, original]);
  const sinCambios = cambiadas.length === 0 && turno === (campos[1] === 'b' ? 'b' : 'w');

  function cambiar(nueva) {
    setHistorial((h) => [...h, matriz]);
    setMatriz(nueva);
    setError(null);
  }

  function tocar(f, c) {
    if (modo === 'quitar') {
      if (matriz[f][c]) cambiar(matriz.map((fila, i) => fila.map((p, j) => (i === f && j === c ? null : p))));
      return;
    }
    if (modo !== 'mover') {
      cambiar(matriz.map((fila, i) => fila.map((p, j) => (i === f && j === c ? modo : p))));
      return;
    }
    if (!seleccion) {
      if (matriz[f][c]) setSeleccion([f, c]);
      return;
    }
    const [sf, sc] = seleccion;
    setSeleccion(null);
    if (sf === f && sc === c) return;
    const pieza = matriz[sf][sc];
    cambiar(matriz.map((fila, i) => fila.map((p, j) => (i === sf && j === sc ? null : i === f && j === c ? pieza : p))));
  }

  function deshacer() {
    if (!historial.length) return;
    setMatriz(historial[historial.length - 1]);
    setHistorial(historial.slice(0, -1));
    setSeleccion(null);
  }

  function reiniciar() {
    setMatriz(original);
    setHistorial([]);
    setSeleccion(null);
    setTurno(campos[1] === 'b' ? 'b' : 'w');
    setError(null);
  }

  async function aplicar() {
    const resultado = await alAplicar(matrizAFen(matriz, turno, campos[2]));
    if (resultado.ok) alCerrar();
    else setError(resultado.error);
  }

  const boton = (pieza) => (
    <button
      key={pieza}
      type="button"
      onClick={() => {
        setModo(modo === pieza ? 'mover' : pieza);
        setSeleccion(null);
      }}
      aria-pressed={modo === pieza}
      aria-label={`Poner ${describir(pieza)}`}
      className={`w-12 h-12 rounded-lg border flex items-center justify-center ${modo === pieza ? 'border-primary bg-primary/20' : 'border-outline-variant bg-surface-container hover:bg-surface-container-high'}`}
    >
      <img src={rutaImagenPieza(pieza)} alt="" className="w-9 h-9" draggable={false} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-space-sm overflow-y-auto">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editor-posicion"
        tabIndex={-1}
        className="w-full max-w-[980px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md flex flex-col gap-space-sm"
      >
        <header>
          <h2 id="titulo-editor-posicion" className="font-headline-lg text-headline-lg text-on-surface m-0">Arreglar posición</h2>
          <p className="font-body-md text-body-md text-on-surface-variant m-0">
            Dejá este tablero <strong className="text-on-surface">igual que el tablero real</strong>: tocá una pieza y después la casilla donde está de verdad. La partida sigue desde ahí, no se reinicia.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-space-md items-start">
          <div className="grid grid-cols-8 grid-rows-8 aspect-square w-full max-w-[560px] mx-auto rounded-lg overflow-hidden border border-outline-variant" role="group" aria-label="Tablero a corregir">
            {matriz.map((fila, f) =>
              fila.map((pieza, c) => {
                const casilla = nombreCasilla(f, c);
                const clara = (f + c) % 2 === 0;
                const elegida = seleccion?.[0] === f && seleccion?.[1] === c;
                const cambio = cambiadas.includes(casilla);
                return (
                  <button
                    key={casilla}
                    type="button"
                    onClick={() => tocar(f, c)}
                    aria-label={`${casilla}${pieza ? `, ${describir(pieza)}` : ', vacía'}${elegida ? ', elegida' : ''}`}
                    className={`relative w-full h-full min-h-0 flex items-center justify-center p-0 border-0 ${clara ? 'bg-[#b89772]' : 'bg-[#543423]'} ${elegida ? 'ring-4 ring-inset ring-primary' : cambio ? 'ring-[3px] ring-inset ring-amber-400' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
                  >
                    {pieza && <img src={rutaImagenPieza(pieza)} alt="" className="w-[88%] h-[88%] pointer-events-none" draggable={false} />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap gap-space-xs" role="group" aria-label="Herramienta">
              <button type="button" className={modo === 'mover' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={modo === 'mover'} onClick={() => { setModo('mover'); setSeleccion(null); }}>Mover</button>
              <button type="button" className={modo === 'quitar' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={modo === 'quitar'} onClick={() => { setModo(modo === 'quitar' ? 'mover' : 'quitar'); setSeleccion(null); }}>Quitar pieza</button>
              <button type="button" className={CLASE_BOTON} onClick={deshacer} disabled={!historial.length}>Deshacer</button>
            </div>
            <div>
              <p className="font-body-sm text-body-sm text-on-surface-variant m-0 mb-1">Agregar una pieza (elegí y tocá la casilla)</p>
              <div className="flex flex-wrap gap-1">{PIEZAS_BLANCAS.map(boton)}</div>
              <div className="flex flex-wrap gap-1 mt-1">{PIEZAS_NEGRAS.map(boton)}</div>
            </div>
            <fieldset className="border-0 p-0 m-0">
              <legend className="font-body-sm text-body-sm text-on-surface-variant mb-1">¿A quién le toca mover?</legend>
              <div className="flex gap-space-xs">
                <button type="button" className={turno === 'w' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={turno === 'w'} onClick={() => setTurno('w')}>Blancas (vos)</button>
                <button type="button" className={turno === 'b' ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} aria-pressed={turno === 'b'} onClick={() => setTurno('b')}>Negras (Turing)</button>
              </div>
              {turno === 'b' && <p className="font-body-sm text-body-sm text-on-surface-variant m-0 mt-1">Turing va a mover apenas confirmes.</p>}
            </fieldset>
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
              {cambiadas.length === 0 ? 'Sin cambios todavía.' : `Cambiaste ${cambiadas.length === 1 ? 'la casilla' : 'las casillas'} ${cambiadas.join(', ')} (en ámbar).`}
            </p>
            {problemas.length > 0 && <p className={CLASE_AVISO} role="alert">Todavía no se puede usar: {problemas.join('; ')}.</p>}
            {error && <p className={CLASE_AVISO} role="alert">{error}</p>}
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-space-xs">
          <button type="button" className={CLASE_BOTON} onClick={reiniciar} disabled={ocupado || (sinCambios && !historial.length)}>Dejar como estaba</button>
          <button type="button" className={CLASE_BOTON} onClick={alCerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={aplicar} disabled={ocupado || problemas.length > 0}>
            {ocupado ? 'Aplicando…' : 'Así está el tablero: seguir'}
          </button>
        </footer>
      </div>
    </div>
  );
}
