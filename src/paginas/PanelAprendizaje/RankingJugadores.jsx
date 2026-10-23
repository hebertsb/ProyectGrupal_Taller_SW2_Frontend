import { useEffect, useState } from 'react';
import { obtenerRanking } from '../../api/backend';
import { InsigniaProvisional, InsigniaRango } from '../../componentes/InsigniaNivel';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import { describirMedalla } from '../../medallas';
import { NIVEL_MAX_STOCKFISH } from '../../nivelJugador';

/** Cuántos jugadores se piden al backend (los primeros del ranking; el propio puesto viene aparte si quedó afuera). */
const LIMITE_RANKING = 10;

const BOTON_ACTUALIZAR =
  'flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

/**
 * Realce de los tres primeros puestos. No depende solo del color: el número siempre se ve, el círculo va relleno
 * (los demás solo con borde) y lleva un trofeo o una medalla en la esquina.
 */
const MEDALLAS = {
  1: {
    nombre: 'oro',
    icono: 'emoji_events',
    circulo: 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
    esquina: 'text-tertiary-fixed-dim',
  },
  2: {
    nombre: 'plata',
    icono: 'military_tech',
    circulo: 'bg-on-surface-variant text-surface',
    esquina: 'text-on-surface-variant',
  },
  3: {
    nombre: 'bronce',
    icono: 'military_tech',
    circulo: 'bg-on-tertiary-container text-tertiary',
    esquina: 'text-tertiary-container',
  },
};

function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

function AvisoError({ mensaje }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-space-xs px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" aria-hidden="true">
        error
      </span>
      <span className="min-w-0 break-words">{mensaje}</span>
    </div>
  );
}

function Cargando({ texto }) {
  return (
    <div className="flex items-center gap-space-xs py-space-xs text-on-surface-variant" role="status">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

/** Puesto en un círculo: los tres primeros van rellenos y con trofeo o medalla; el resto, solo con borde. */
function CeldaPuesto({ puesto }) {
  const medalla = MEDALLAS[puesto];
  return (
    <span
      title={medalla ? `Medalla de ${medalla.nombre}` : undefined}
      className={`relative shrink-0 min-w-10 h-10 px-space-2xs rounded-full flex items-center justify-center font-mono-metric text-mono-metric font-bold ${
        medalla ? medalla.circulo : 'border border-outline-variant/40 bg-surface-container-high text-on-surface-variant'
      }`}
    >
      <span className="sr-only">Puesto </span>
      <span>{puesto}</span>
      {medalla && (
        <span
          className={`material-symbols-outlined absolute -top-2 -right-2 text-[18px] leading-none ${medalla.esquina}`}
          aria-hidden="true"
        >
          {medalla.icono}
        </span>
      )}
    </span>
  );
}

/**
 * Medallas de un jugador junto a su nombre: un contador ("🏅 N", con el ícono de Material Symbols) y hasta 3 figuritas
 * chicas con las destacadas (las de mayor nivel). No dibuja nada si no tiene medallas. En pantallas angostas la fila
 * baja de renglón en vez de romperse. Las figuritas son decorativas: el nombre y el nivel de cada una van en el texto
 * oculto para lectores de pantalla y en el `title` (al pasar el mouse).
 */
function MedallasDeJugador({ medallas }) {
  const total = Number.isFinite(medallas?.total) ? medallas.total : 0;
  if (total <= 0) return null;
  const destacadas = Array.isArray(medallas.destacadas) ? medallas.destacadas.slice(0, 3) : [];
  const nombres = destacadas.map((medalla) => medalla.nombre).join(', ');
  const resumen = plural(total, 'medalla', 'medallas');

  return (
    <span className="flex flex-wrap items-center gap-x-space-xs gap-y-space-2xs min-w-0" title={nombres ? `${resumen}: ${nombres}` : resumen}>
      <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface font-mono-micro text-mono-micro tracking-wide whitespace-nowrap">
        <span className="material-symbols-outlined text-[14px] text-tertiary-fixed-dim" aria-hidden="true">
          workspace_premium
        </span>
        <span aria-hidden="true">{total}</span>
        <span className="sr-only">
          {resumen}
          {nombres ? `, entre ellas ${nombres}` : ''}
        </span>
      </span>
      {destacadas.length > 0 && (
        <span className="flex items-center gap-1" aria-hidden="true">
          {destacadas.map((medalla) => (
            <MedallaFigurita
              key={medalla.codigo}
              medalla={{ ...medalla, ganada: true }}
              tamano="xs"
              decorativa
              titulo={describirMedalla({ ...medalla, ganada: true })}
            />
          ))}
        </span>
      )}
    </span>
  );
}

/** Una fila del ranking: puesto, nombre (con "Vos" si es el propio), rango, marca provisional, medallas y nivel de 0 a 20. */
function FilaRanking({ jugador }) {
  const { puesto, nombre, nivel, rango, confirmado, soy_yo: soyYo, medallas } = jugador;
  return (
    <li
      aria-current={soyYo ? 'true' : undefined}
      className={`flex items-center gap-space-sm min-h-14 px-space-sm py-space-xs rounded-xl border min-w-0 ${
        soyYo
          ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/30'
          : 'bg-surface-container-lowest border-outline-variant/20'
      }`}
    >
      <CeldaPuesto puesto={puesto} />

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-space-xs gap-y-1 min-w-0">
          <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">{nombre}</span>
          {soyYo && (
            <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-primary text-on-primary font-mono-micro text-mono-micro tracking-wide uppercase font-medium">
              <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                person
              </span>
              Vos
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-space-2xs">
          <InsigniaRango rango={rango} />
          {!confirmado && <InsigniaProvisional />}
        </span>
        <MedallasDeJugador medallas={medallas} />
      </div>

      <span className="flex flex-col items-end gap-1 shrink-0 leading-none">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Nivel</span>
        <span className="font-mono-metric text-headline-sm font-bold text-on-surface">
          {nivel ?? '—'}
          <span className="font-normal text-mono-micro text-on-surface-variant">/{NIVEL_MAX_STOCKFISH}</span>
        </span>
      </span>
    </li>
  );
}

/**
 * Ranking de jugadores por nivel (0 a 20). Muestra el de su curso si el jugador está inscrito en uno, o el de los
 * jugadores que juegan por cuenta propia (el backend decide cuál). Se monta recién cuando el jugador abre la
 * sección, así que pide el ranking al abrirse; después solo se actualiza con el botón (sin sondeo). Los nombres ya
 * llegan abreviados ("Ana P.") y se muestran tal cual.
 */
export default function RankingJugadores({ claseTexto = 'font-body-sm text-body-sm' }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    obtenerRanking(LIMITE_RANKING)
      .then((respuesta) => {
        if (vigente) setDatos(respuesta);
      })
      .catch((err) => {
        if (vigente) setError(err.message || 'No se pudo cargar el ranking.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const jugadores = datos?.jugadores ?? [];
  const miPuesto = datos?.mi_puesto ?? null;
  const hayLista = jugadores.length > 0 || miPuesto !== null;
  const sinNadie = datos !== null && (datos.total === 0 || !hayLista);
  const apareceElJugador = jugadores.some((j) => j.soy_yo) || miPuesto !== null;

  let titulo = 'Ranking';
  if (datos?.alcance === 'curso') titulo = `Ranking de ${datos.curso || 'tu curso'}`;
  else if (datos?.alcance === 'general') titulo = 'Ranking de jugadores por cuenta propia';

  return (
    <div className="flex flex-col gap-space-sm min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <div className="flex flex-col min-w-0">
          <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{titulo}</h3>
          {datos && datos.total > 0 && (
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              {plural(datos.total, 'jugador con nivel', 'jugadores con nivel')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRecarga((n) => n + 1)}
          disabled={cargando}
          className={BOTON_ACTUALIZAR}
        >
          <span
            className={`material-symbols-outlined text-[16px] text-primary ${cargando ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          >
            refresh
          </span>
          {cargando && datos ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={error} />
          <button
            type="button"
            onClick={() => setRecarga((n) => n + 1)}
            disabled={cargando}
            className={`${BOTON_ACTUALIZAR} self-start`}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              refresh
            </span>
            Reintentar
          </button>
        </div>
      )}

      {cargando && datos === null && <Cargando texto="Cargando el ranking…" />}

      {sinNadie && (
        <div className="flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/20">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant shrink-0" aria-hidden="true">
            leaderboard
          </span>
          <p className={`m-0 ${claseTexto} text-on-surface-variant min-w-0 break-words`}>
            Todavía nadie tiene nivel: el ranking se arma con las partidas que se juegan.
          </p>
        </div>
      )}

      {datos && hayLista && (
        <ol
          aria-label={titulo}
          aria-busy={cargando}
          className="m-0 p-0 list-none flex flex-col gap-space-2xs w-full max-w-2xl"
        >
          {jugadores.map((jugador, indice) => (
            <FilaRanking key={`${jugador.puesto}-${indice}`} jugador={jugador} />
          ))}
          {miPuesto && (
            <>
              <li className="flex items-center justify-center py-space-2xs text-on-surface-variant font-mono-metric text-mono-metric leading-none">
                <span aria-hidden="true">…</span>
                <span className="sr-only">Tu puesto, más abajo en el ranking</span>
              </li>
              <FilaRanking jugador={miPuesto} />
            </>
          )}
        </ol>
      )}

      {datos && !apareceElJugador && (
        <p
          className={`m-0 flex items-start gap-space-xs px-space-sm py-space-xs rounded-lg bg-primary/10 border border-primary/30 text-on-surface ${claseTexto}`}
        >
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            sports_esports
          </span>
          <span className="min-w-0 break-words">
            Terminá una partida (de 5 jugadas o más) para aparecer en el ranking.
          </span>
        </p>
      )}

      {datos && (
        <p className="m-0 flex items-start gap-space-xs font-body-sm text-[12px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5" aria-hidden="true">
            info
          </span>
          <span className="min-w-0 break-words">
            El nivel sale del promedio de tus últimas 3 partidas. Es provisional hasta que completes 3. Solo se muestra
            tu nombre y la inicial del apellido.
          </span>
        </p>
      )}
    </div>
  );
}
