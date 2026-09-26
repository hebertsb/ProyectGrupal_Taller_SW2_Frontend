import { useEffect, useState } from 'react';
import { listarPartidas, listarUsuarios, obtenerPartida } from '../../api/backend';
import { turnoDeFen } from '../../ajedrez';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';

const TAMANO_PAGINA = 4; // patrón "DVR de cámaras": hasta 4 tableros a la vez
const INTERVALO_SONDEO_LISTA_MS = 5000; // refresca qué partidas hay activas
const INTERVALO_SONDEO_GRANDE_MS = 1500; // mismo criterio que DemostracionEnVivo
const INTERVALO_SONDEO_ROSTER_MS = 60000; // el roster cambia poco — alcanza con refrescarlo cada tanto

/**
 * Pantalla de facilitador: ver en simultáneo hasta 4 partidas de estudiantes
 * en curso (grilla 2x2), con paginación si hay más de 4, y clic en cualquier
 * tablero chico para agrandarlo a una vista de una sola partida. Todo de solo
 * lectura — reusa <TableroSoloLectura>, el mismo que usa Demostración en Vivo.
 * No hace falta backend nuevo: `GET /partida` ya trae `usuario_id`,
 * `usuario_nombre`, `terminada`, `fen` de TODAS las partidas del sistema — el
 * filtro (en curso, de un jugador real) se hace acá.
 *
 * OJO con `usuario_id`: filtrar solo por "no es la mía" (`!== usuarioIdPropio`)
 * no alcanza — cualquier otra cuenta de FACILITADOR (o una partida vieja de
 * pruebas) se cuela como si fuera un estudiante jugando. Por eso se cruza
 * contra el roster real (`listarUsuarios()`, rol === 'jugador') en vez de
 * confiar en la ausencia de mi propio id.
 */
export default function Monitoreo() {
  const [partidas, setPartidas] = useState([]);
  const [jugadores, setJugadores] = useState(new Map()); // usuario_id (jugador real) -> rango_estimado
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('grilla'); // 'grilla' | 'grande'
  const [partidaSeleccionadaId, setPartidaSeleccionadaId] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [partidaGrande, setPartidaGrande] = useState(null);
  const [errorGrande, setErrorGrande] = useState(null);

  // Roster de usuarios — para saber quién es REALMENTE un jugador (no alcanza
  // con "usuario_id distinto al mío", ver comentario arriba) y de paso mostrar
  // el nivel estimado de cada uno. No hace falta pedirlo tan seguido como las
  // partidas: el roster casi no cambia mientras la pantalla está abierta.
  useEffect(() => {
    let cancelado = false;
    function sondearRoster() {
      listarUsuarios()
        .then((usuarios) => {
          if (cancelado) return;
          const mapa = new Map(
            usuarios.filter((u) => u.rol === 'jugador').map((u) => [u.id, u.rango_estimado ?? null])
          );
          setJugadores(mapa);
        })
        .catch(() => {
          // Silencioso: si falla, el filtro de abajo simplemente no muestra
          // ninguna partida (más seguro que mostrar partidas sin verificar de
          // quién son) — el sondeo de partidas ya tiene su propio `error`.
        });
    }
    sondearRoster();
    const intervalo = setInterval(sondearRoster, INTERVALO_SONDEO_ROSTER_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  // Lista completa de partidas — corre siempre en segundo plano (aunque esté
  // en vista grande) para que la grilla ya esté al día al volver.
  useEffect(() => {
    let cancelado = false;
    function sondear() {
      listarPartidas()
        .then((datos) => {
          if (cancelado) return;
          setPartidas(datos);
          setError(null);
        })
        .catch((err) => {
          if (cancelado) return;
          setError(err.message || 'No se pudo cargar la lista de partidas.');
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }
    sondear();
    const intervalo = setInterval(sondear, INTERVALO_SONDEO_LISTA_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  // Sondeo rápido de la partida puntual que se agrandó — mismo espíritu que
  // el polling de DemostracionEnVivo.jsx.
  useEffect(() => {
    if (vista !== 'grande' || !partidaSeleccionadaId) {
      setPartidaGrande(null);
      setErrorGrande(null);
      return;
    }
    let cancelado = false;
    function sondear() {
      obtenerPartida(partidaSeleccionadaId)
        .then((datos) => {
          if (cancelado) return;
          setPartidaGrande(datos);
          setErrorGrande(null);
        })
        .catch((err) => {
          if (cancelado) return;
          setErrorGrande(err.message || 'No se pudo cargar esta partida.');
        });
    }
    sondear();
    const intervalo = setInterval(sondear, INTERVALO_SONDEO_GRANDE_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [vista, partidaSeleccionadaId]);

  // Monitoreo es "quién está jugando ahora", no un historial: un jugador
  // puede tener varias partidas viejas sin terminar (ej. de sesiones de
  // prueba) y acá solo debe aparecer UNA tarjeta por jugador — su partida
  // activa más reciente. Se agrupa por `usuario_id` quedándose, de cada
  // grupo, con la de `creada_en` más nueva; el resto se descarta para esta
  // vista (no para el sistema — siguen existiendo, solo no se muestran acá).
  const masRecientePorJugador = partidas
    .filter((p) => p.terminada === false && jugadores.has(p.usuario_id))
    .reduce((porUsuario, partida) => {
      const actual = porUsuario.get(partida.usuario_id);
      if (!actual || new Date(partida.creada_en) > new Date(actual.creada_en)) {
        porUsuario.set(partida.usuario_id, partida);
      }
      return porUsuario;
    }, new Map());

  const partidasActivas = Array.from(masRecientePorJugador.values()).sort(
    (a, b) => new Date(b.creada_en) - new Date(a.creada_en)
  );

  const totalPaginas = Math.max(1, Math.ceil(partidasActivas.length / TAMANO_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const partidasPagina = partidasActivas.slice(
    paginaSegura * TAMANO_PAGINA,
    paginaSegura * TAMANO_PAGINA + TAMANO_PAGINA
  );

  function abrirPartidaGrande(id) {
    setPartidaSeleccionadaId(id);
    setVista('grande');
  }

  function volverALaGrilla() {
    setVista('grilla');
    setPartidaSeleccionadaId(null);
  }

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[24px] text-primary">grid_view</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">Monitoreo</span>
        </div>
        <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-primary-fixed-dim">
          {partidasActivas.length} EN CURSO
        </span>
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Cargando partidas…</span>
        </div>
      ) : partidasActivas.length === 0 ? (
        <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center flex flex-col items-center gap-space-xs">
          <span className="material-symbols-outlined text-[32px] text-outline">sports_esports</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No hay partidas de estudiantes en curso ahora mismo.
          </p>
        </div>
      ) : vista === 'grande' ? (
        <VistaGrande
          partida={partidaGrande}
          rango={partidaGrande ? jugadores.get(partidaGrande.usuario_id) : null}
          error={errorGrande}
          alVolver={volverALaGrilla}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {partidasPagina.map((partida) => (
              <button
                key={partida.id}
                type="button"
                onClick={() => abrirPartidaGrande(partida.id)}
                className="bg-surface-container-low rounded-xl p-space-sm shadow-md flex flex-col gap-space-xs hover:bg-surface-container-high transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-center justify-between px-space-2xs gap-space-xs">
                  <span className="font-body-sm text-body-sm font-medium text-on-surface truncate flex items-center gap-1 min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">person</span>
                    <span className="truncate">{partida.usuario_nombre ?? 'Jugador'}</span>
                  </span>
                  <span className="font-mono-micro text-mono-micro text-primary uppercase shrink-0">
                    {turnoDeFen(partida.fen) === 'w' ? 'BLANCAS' : 'NEGRAS'}
                  </span>
                </div>
                <div className="px-space-2xs">
                  <BadgeRango rango={jugadores.get(partida.usuario_id)} />
                </div>
                <TableroSoloLectura fen={partida.fen} tamano="chico" />
              </button>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-space-sm pt-space-xs">
              <button
                onClick={() => setPagina((p) => Math.max(p - 1, 0))}
                disabled={paginaSegura === 0}
                className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                Anterior
              </button>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant px-space-sm">
                Grupo {paginaSegura + 1} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas - 1))}
                disabled={paginaSegura >= totalPaginas - 1}
                className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                type="button"
              >
                Siguiente
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VistaGrande({ partida, rango, error, alVolver }) {
  const turnoActual = partida?.fen ? turnoDeFen(partida.fen) : 'w';

  return (
    <div className="flex flex-col items-center gap-space-md">
      <div className="w-full max-w-[560px] flex items-center justify-between gap-space-sm">
        <button
          onClick={alVolver}
          className="flex items-center gap-1 font-mono-micro text-mono-micro text-on-surface-variant hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          VOLVER A LA GRILLA
        </button>
        {partida?.usuario_nombre && (
          <div className="flex items-center gap-space-xs min-w-0">
            <span className="font-mono-label text-mono-label text-on-surface-variant flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0">person</span>
              <span className="truncate">{partida.usuario_nombre}</span>
            </span>
            <BadgeRango rango={rango} />
          </div>
        )}
      </div>

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm w-full max-w-[560px]">
          {error}
        </div>
      )}

      {!partida ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Conectando…</span>
        </div>
      ) : (
        <>
          <TableroSoloLectura fen={partida.fen} tamano="grande" />
          <div className="font-mono-metric text-mono-metric text-primary font-medium">
            {partida.terminada
              ? `TERMINADA — ${partida.resultado}`
              : `TURNO: ${turnoActual === 'w' ? 'BLANCAS' : 'NEGRAS'}`}
          </div>
        </>
      )}
    </div>
  );
}

/** Nivel estimado del jugador (diagnóstico "Mide tu nivel") — `null` si todavía no lo hizo. */
function BadgeRango({ rango }) {
  if (!rango) {
    return (
      <span className="font-mono-micro text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-surface-container-high text-outline shrink-0">
        Sin diagnosticar
      </span>
    );
  }
  return (
    <span className="font-mono-micro text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5 shrink-0">
      <span className="material-symbols-outlined text-[11px]">stars</span>
      {rango}
    </span>
  );
}
