import { useEffect, useRef, useState } from 'react';
import { rutaImagenPieza } from '../../../ajedrez';

const COLUMNAS = 8;
const SEGUNDOS_DESTACADO = 25; // cuánto se marca el lugar de la pieza que acaba de salir del tablero

function Celda({ lugar, letra, titulo, ocupados, destacados, reservas }) {
  const posicionReserva = reservas?.lugares?.indexOf(lugar) ?? -1;
  const esReserva = posicionReserva >= 0;
  const usada = esReserva && posicionReserva < (reservas?.usadas ?? 0);
  const ocupada = ocupados.has(lugar);
  const destacada = destacados.has(lugar);
  const estado = esReserva ? (usada ? 'dama ya usada para coronar' : 'dama para coronar') : ocupada ? 'ocupada' : 'libre';
  return (
    <div
      title={`${titulo}: ${estado}`}
      aria-label={`${titulo}: ${estado}`}
      className={`relative aspect-square rounded border min-w-0 ${
        destacada
          ? 'border-tertiary ring-2 ring-tertiary bg-tertiary/15 animate-pulse motion-reduce:animate-none'
          : ocupada
            ? 'border-primary/60 bg-surface-container-high'
            : esReserva
              ? 'border-dashed border-tertiary/60 bg-surface-container-lowest'
              : 'border-dashed border-outline-variant/60 bg-surface-container-lowest'
      }`}
    >
      <img src={rutaImagenPieza(letra)} alt="" draggable={false} className={`w-full h-full p-px ${ocupada || (esReserva && !usada) ? 'opacity-90' : 'opacity-25'}`} />
      {esReserva && (
        <span aria-hidden="true" className="absolute -top-1 -right-1 px-0.5 rounded bg-tertiary text-on-tertiary font-mono-micro text-[8px] leading-3">
          {usada ? '✓' : 'R'}
        </span>
      )}
    </div>
  );
}

function Zona({ titulo, nota, prefijo, negras, ocupados, destacados, reservas, peonesPorFila }) {
  const poner = (letra) => (negras ? letra : letra.toUpperCase());
  const filasPeones = Math.ceil(COLUMNAS / peonesPorFila);
  const peones = Array.from({ length: COLUMNAS }, (_, k) => ({ letra: poner('p'), fila: Math.floor(k / peonesPorFila), columna: k % peonesPorFila, numero: k + 1 }));
  const piezas = ['n', 'n', 'b', 'b', 'r', 'r', 'q', 'q'].map((letra, columna) => ({ letra: poner(letra), fila: filasPeones, columna, numero: columna + 1 }));
  const nombreColor = negras ? 'negros' : 'blancos';
  return (
    <section className="flex flex-col gap-1 min-w-0 p-space-xs rounded-xl bg-surface-container border border-outline-variant/40" aria-label={titulo}>
      <h4 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">{titulo}</h4>
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">{nota}</p>
      <span className="font-mono-micro text-mono-micro text-on-surface-variant">Junto al tablero · peones {nombreColor}</span>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${peonesPorFila}, minmax(0, 1fr))` }}>
        {peones.map((c) => (
          <Celda key={c.numero} lugar={`${prefijo}${c.fila * COLUMNAS + c.columna}`} letra={c.letra} titulo={`Peón ${c.numero}`} ocupados={ocupados} destacados={destacados} reservas={null} />
        ))}
      </div>
      <span className="font-mono-micro text-mono-micro text-on-surface-variant">Piezas en línea: caballos, alfiles, torres, damas</span>
      <div className="grid grid-cols-8 gap-0.5">
        {piezas.map((c) => {
          const nombre = ['Caballo', 'Caballo', 'Alfil', 'Alfil', 'Torre', 'Torre', 'Dama', 'Dama'][c.columna];
          return (
            <Celda
              key={c.columna}
              lugar={`${prefijo}${c.fila * COLUMNAS + c.columna}`}
              letra={c.letra}
              titulo={`${nombre} ${(c.columna % 2) + 1}`}
              ocupados={ocupados}
              destacados={destacados}
              reservas={reservas}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * Dónde va cada pieza que sale del tablero, con el cementerio ORDENADO por piezas: uno para el jugador (del lado contrario al del brazo) y otro del brazo, con el mismo orden y sombras donde va cada pieza:
 * los peones en un bloque y las demás piezas en línea recta. Las llenas se ven nítidas; el lugar de la pieza que acaba de salir del tablero se marca unos segundos. `cementerio` viene del estado de la partida física.
 */
export default function PlanoCementerio({ cementerio }) {
  const [destacados, setDestacados] = useState(new Set());
  const anteriores = useRef(null);
  const lugares = cementerio?.ocupados?.map((o) => o.lugar) ?? [];
  const clave = lugares.join('|');

  useEffect(() => {
    const ahora = new Set(lugares);
    const previos = anteriores.current;
    anteriores.current = ahora;
    if (previos === null) return undefined;
    const nuevos = lugares.filter((lugar) => !previos.has(lugar));
    if (nuevos.length === 0) return undefined;
    setDestacados(new Set(nuevos));
    const temporizador = setTimeout(() => setDestacados(new Set()), SEGUNDOS_DESTACADO * 1000);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  if (!cementerio) return null;
  if (!cementerio.por_piezas) {
    return (
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
        Las piezas capturadas se dejan por orden de llegada. Para ver dónde va cada una, activá «Ordenar el cementerio por piezas» en Cementerio y reservas.
      </p>
    );
  }
  const ocupados = new Set(lugares);
  const brazoNegras = cementerio.color_brazo === 'negras';
  const peonesPorFila = cementerio.peones_por_fila ?? COLUMNAS;
  return (
    <div className="w-full flex flex-col gap-space-xs" aria-label="Cementerios: dónde va cada pieza">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
        <Zona
          titulo={`Tu cementerio · piezas ${brazoNegras ? 'negras' : 'blancas'}`}
          nota="Del lado contrario al del brazo. Dejá acá, en su sombra, las piezas de Turing que captures."
          prefijo="cementerio_jugador:"
          negras={brazoNegras}
          ocupados={ocupados}
          destacados={destacados}
          reservas={cementerio.reservas}
          peonesPorFila={peonesPorFila}
        />
        <Zona
          titulo={`Cementerio del brazo · piezas ${brazoNegras ? 'blancas' : 'negras'}`}
          nota="El brazo deja acá las tuyas que captura. Si coronás, tomá la dama de acá."
          prefijo="cementerio:"
          negras={!brazoNegras}
          ocupados={ocupados}
          destacados={destacados}
          reservas={null}
          peonesPorFila={peonesPorFila}
        />
      </div>
      <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
        «R» = dama para coronar: dejá en tu cementerio una dama negra (la que capturaste o una de repuesto) en cada casilla «R»; el brazo toma de ahí la que necesite al coronar. La pieza que acaba de salir del tablero se marca unos segundos.
      </p>
    </div>
  );
}
