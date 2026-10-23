import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  listarCursos,
  listarEstudiantesCurso,
  listarPartidas,
  listarUsuarios,
  obtenerPartida,
  obtenerPerfil,
} from '../../api/backend';
import { turnoDeFen } from '../../ajedrez';
import { fechaDesdeIso } from '../../formatoTiempo';
import TableroSoloLectura from '../../componentes/TableroSoloLectura';

gsap.registerPlugin(useGSAP);

const TAMANO_PAGINA = 4; // patrón "DVR de cámaras": hasta 4 tableros a la vez
const INTERVALO_SONDEO_LISTA_MS = 5000; // refresca qué partidas hay activas
const INTERVALO_SONDEO_GRANDE_MS = 1500; // mismo criterio que DemostracionEnVivo
const INTERVALO_SONDEO_ROSTER_MS = 60000; // el roster cambia poco — alcanza con refrescarlo cada tanto
const CLASE_SELECT =
  'w-full min-h-10 px-space-sm py-space-xs rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Texto de un curso en el filtro: al principal, que ve los de todos, se le agrega el facilitador dueño. */
function etiquetaCurso(curso, conDueno) {
  return conDueno && curso.facilitador_nombre ? `${curso.nombre} · ${curso.facilitador_nombre}` : curso.nombre;
}

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
 *
 * Si el facilitador tiene cursos, aparecen dos filtros en la grilla:
 *  - "Curso": con uno elegido solo se ven los estudiantes inscritos en él (salen de
 *    `GET /cursos/{id}/estudiantes`). Un facilitador principal (`es_principal`, releído de `GET /auth/me`)
 *    elige entre los cursos de TODOS los facilitadores (`GET /cursos?todos=true`, con el nombre del dueño);
 *    los demás, entre los propios.
 *  - "Jugador": depende del curso; con uno elegido la grilla muestra solo a ese jugador.
 * Sin cursos no se muestra ningún filtro y todo queda como siempre.
 */
export default function Monitoreo() {
  const [partidas, setPartidas] = useState([]);
  const [jugadores, setJugadores] = useState(new Map()); // usuario_id (jugador real) -> rango_estimado
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [cursos, setCursos] = useState([]); // cursos para el filtro (los propios, o todos si es principal)
  const [cursoFiltro, setCursoFiltro] = useState('todos'); // 'todos' o el id (texto) del curso elegido
  const [jugadorFiltro, setJugadorFiltro] = useState('todos'); // 'todos' o el id (texto) del jugador elegido
  const [estudiantesCurso, setEstudiantesCurso] = useState(null); // inscritos en el curso elegido; null = sin filtro, cargando o con error
  const [errorFiltro, setErrorFiltro] = useState(null);
  const [recargaFiltro, setRecargaFiltro] = useState(0);
  const [vista, setVista] = useState('grilla'); // 'grilla' | 'grande'
  const [partidaSeleccionadaId, setPartidaSeleccionadaId] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [partidaGrande, setPartidaGrande] = useState(null);
  const [errorGrande, setErrorGrande] = useState(null);

  // --- Capa de animación (GSAP) — solo presentación, no toca el sondeo ni el
  // estado de arriba. `rejillaRef` acota los selectores de esta pantalla;
  // `tarjetasRefs` guarda el nodo DOM de cada tarjeta (clave: partida.id) para
  // poder destacar solo la que recibió una jugada nueva; `fensPreviosRef`
  // recuerda el último FEN visto de cada partida para detectar ese cambio.
  const rejillaRef = useRef(null);
  const tarjetasRefs = useRef(new Map());
  const fensPreviosRef = useRef(new Map());
  const prefiereMovimientoReducidoRef = useRef(false);

  function registrarTarjetaRef(id, nodo) {
    if (nodo) tarjetasRefs.current.set(id, nodo);
    else tarjetasRefs.current.delete(id);
  }

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

  // Cursos para armar el filtro. Primero se confirma con el servidor si el usuario es facilitador principal
  // (la sesión guardada puede ser vieja): el principal elige entre los cursos de todos los facilitadores, los
  // demás entre los propios. Si algo falla o no hay cursos, el filtro no se muestra y la pantalla funciona igual
  // que antes (no vale la pena un error por algo opcional).
  useEffect(() => {
    let cancelado = false;
    async function cargarCursos() {
      let principal = false;
      try {
        const perfil = await obtenerPerfil();
        principal = perfil?.es_principal === true;
      } catch {
        // sin el perfil se sigue como facilitador común
      }
      if (cancelado) return;
      setEsPrincipal(principal);
      let lista = null;
      try {
        lista = await listarCursos(principal);
      } catch {
        if (principal) {
          try {
            lista = await listarCursos(false);
          } catch {
            // sin cursos: no hay filtro
          }
        }
      }
      if (!cancelado) setCursos(Array.isArray(lista) ? lista : []);
    }
    cargarCursos();
    return () => {
      cancelado = true;
    };
  }, []);

  // Estudiantes del curso elegido en el filtro. Se vuelven a pedir con el mismo ritmo que el roster: alguien
  // puede entrar al curso o salir de él mientras esta pantalla está abierta. Si el pedido falla no se adivina:
  // se muestra el error con "Reintentar" (y, si ya había una lista, se sigue con la que había).
  useEffect(() => {
    if (cursoFiltro === 'todos') return undefined;
    let cancelado = false;
    function sondearEstudiantes() {
      listarEstudiantesCurso(cursoFiltro)
        .then((estudiantes) => {
          if (cancelado) return;
          setEstudiantesCurso(estudiantes);
          setErrorFiltro(null);
        })
        .catch((err) => {
          if (!cancelado) setErrorFiltro(err.message || 'No se pudieron cargar los jugadores de ese curso.');
        });
    }
    sondearEstudiantes();
    const intervalo = setInterval(sondearEstudiantes, INTERVALO_SONDEO_ROSTER_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [cursoFiltro, recargaFiltro]);

  // Si el jugador elegido ya no está en el curso (lo sacaron o salió), se vuelve a "Todos los jugadores".
  useEffect(() => {
    if (jugadorFiltro === 'todos' || estudiantesCurso === null) return;
    if (!estudiantesCurso.some((e) => String(e.id) === jugadorFiltro)) setJugadorFiltro('todos');
  }, [estudiantesCurso, jugadorFiltro]);

  // Cambiar de curso reinicia el jugador a "Todos" y vuelve a la primera página.
  function elegirCurso(valor) {
    setErrorFiltro(null);
    setEstudiantesCurso(null);
    setJugadorFiltro('todos');
    setPagina(0);
    setCursoFiltro(valor);
  }

  function elegirJugador(valor) {
    setPagina(0);
    setJugadorFiltro(valor);
  }

  function reintentarFiltro() {
    setErrorFiltro(null);
    setRecargaFiltro((n) => n + 1);
  }

  function quitarFiltros() {
    elegirCurso('todos');
  }

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
  // `fechaDesdeIso` (no `new Date` a pelo) interpreta como UTC un ISO del backend sin sufijo de
  // zona — acá el orden relativo ya daba igual con el bug (el mismo corrimiento se aplicaba a
  // ambos lados de cada comparación), pero se prolija junto con el resto de las pantallas.
  const masRecientePorJugador = partidas
    .filter((p) => p.terminada === false && jugadores.has(p.usuario_id))
    .reduce((porUsuario, partida) => {
      const actual = porUsuario.get(partida.usuario_id);
      const fechaPartida = fechaDesdeIso(partida.creada_en)?.getTime() ?? 0;
      const fechaActual = actual ? (fechaDesdeIso(actual.creada_en)?.getTime() ?? 0) : -Infinity;
      if (!actual || fechaPartida > fechaActual) {
        porUsuario.set(partida.usuario_id, partida);
      }
      return porUsuario;
    }, new Map());

  const partidasActivasTodas = Array.from(masRecientePorJugador.values()).sort(
    (a, b) => (fechaDesdeIso(b.creada_en)?.getTime() ?? 0) - (fechaDesdeIso(a.creada_en)?.getTime() ?? 0)
  );

  // Filtros. Con un curso elegido solo cuentan sus estudiantes (y con un jugador elegido, solo ese); mientras llega
  // la lista del curso no se muestra ninguna partida (ni se adivina si falló).
  const filtrandoCurso = cursoFiltro !== 'todos';
  const filtrandoJugador = filtrandoCurso && jugadorFiltro !== 'todos';
  const cargandoFiltro = filtrandoCurso && estudiantesCurso === null && !errorFiltro;
  const falloFiltro = filtrandoCurso && estudiantesCurso === null && Boolean(errorFiltro);
  const idsDelCurso = estudiantesCurso ? new Set(estudiantesCurso.map((e) => e.id)) : null;
  const cursoElegido = filtrandoCurso ? cursos.find((c) => String(c.id) === cursoFiltro) : null;
  const jugadorElegido = filtrandoJugador ? estudiantesCurso?.find((e) => String(e.id) === jugadorFiltro) : null;
  const partidasActivas = filtrandoCurso
    ? partidasActivasTodas.filter(
        (p) => Boolean(idsDelCurso?.has(p.usuario_id)) && (!filtrandoJugador || String(p.usuario_id) === jugadorFiltro)
      )
    : partidasActivasTodas;

  const totalPaginas = Math.max(1, Math.ceil(partidasActivas.length / TAMANO_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const partidasPagina = partidasActivas.slice(
    paginaSegura * TAMANO_PAGINA,
    paginaSegura * TAMANO_PAGINA + TAMANO_PAGINA
  );
  // Clave estable del grupo de tarjetas visible — cambia solo cuando cambia
  // DE VERDAD qué partidas se ven (otra página, alguien empezó/terminó), no
  // en cada sondeo de 5s aunque el array se haya vuelto a crear igual.
  const clavePagina = partidasPagina.map((partida) => partida.id).join(',');

  // Respeta "reducir movimiento" (gsap.matchMedia(), patrón oficial de GSAP)
  // — una sola vez para toda la pantalla.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ reducido: '(prefers-reduced-motion: reduce)' }, (contexto) => {
        prefiereMovimientoReducidoRef.current = contexto.conditions.reducido;
        return () => {
          prefiereMovimientoReducidoRef.current = false;
        };
      });
      return () => mm.revert();
    },
    { scope: rejillaRef, dependencies: [] }
  );

  // Entrada escalonada de las tarjetas — solo cuando cambia el GRUPO que se
  // ve (no en cada sondeo silencioso de la lista).
  useGSAP(
    () => {
      if (prefiereMovimientoReducidoRef.current || !clavePagina) return;
      gsap.from('.tarjeta-partida', {
        autoAlpha: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      });
    },
    { scope: rejillaRef, dependencies: [clavePagina] }
  );

  // Destello breve en una tarjeta cuando su partida recibió una jugada nueva
  // en vivo — se compara contra el último FEN visto de cada una; la primera
  // vez que se ve un `partida.id` no cuenta como "cambio" (recién se cargó).
  useGSAP(
    () => {
      for (const partida of partidasPagina) {
        const fenPrevio = fensPreviosRef.current.get(partida.id);
        fensPreviosRef.current.set(partida.id, partida.fen);
        if (!fenPrevio || fenPrevio === partida.fen || prefiereMovimientoReducidoRef.current) continue;
        const nodo = tarjetasRefs.current.get(partida.id);
        if (!nodo) continue;
        gsap.fromTo(
          nodo,
          { boxShadow: '0 0 0px rgba(0,229,255,0)' },
          {
            boxShadow: '0 0 20px rgba(0,229,255,0.55)',
            duration: 0.25,
            ease: 'power2.out',
            yoyo: true,
            repeat: 1,
            overwrite: 'auto',
          }
        );
      }
    },
    { scope: rejillaRef, dependencies: [partidasPagina] }
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

      {/* Filtros Curso → Jugador: solo si hay cursos, y solo en la grilla (no en la vista grande) */}
      {cursos.length > 0 && vista === 'grilla' && (
        <div className="flex flex-col gap-space-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            <div className="flex flex-col gap-space-2xs min-w-0">
              <label
                htmlFor="monitoreo-curso"
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Curso
              </label>
              <select
                id="monitoreo-curso"
                value={cursoFiltro}
                onChange={(e) => elegirCurso(e.target.value)}
                className={CLASE_SELECT}
              >
                <option value="todos">Todos los cursos</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={String(curso.id)}>
                    {etiquetaCurso(curso, esPrincipal)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-space-2xs min-w-0">
              <label
                htmlFor="monitoreo-jugador"
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Jugador
              </label>
              <select
                id="monitoreo-jugador"
                value={jugadorFiltro}
                onChange={(e) => elegirJugador(e.target.value)}
                disabled={!filtrandoCurso || !estudiantesCurso || estudiantesCurso.length === 0}
                className={`${CLASE_SELECT} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <option value="todos">
                  {!filtrandoCurso
                    ? 'Todos los jugadores'
                    : !estudiantesCurso
                      ? falloFiltro
                        ? 'No se pudo cargar'
                        : 'Cargando jugadores…'
                      : estudiantesCurso.length === 0
                        ? 'Sin jugadores inscritos'
                        : 'Todos los jugadores del curso'}
                </option>
                {(estudiantesCurso ?? []).map((estudiante) => (
                  <option key={estudiante.id} value={String(estudiante.id)}>
                    {estudiante.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtrandoCurso && (
            <div className="flex flex-wrap items-center gap-x-space-sm gap-y-space-2xs">
              {estudiantesCurso && (
                <p role="status" className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                  Mostrando {partidasActivas.length} de {partidasActivasTodas.length}{' '}
                  {partidasActivasTodas.length === 1 ? 'partida en curso' : 'partidas en curso'}
                </p>
              )}
              <button
                type="button"
                onClick={quitarFiltros}
                className="flex items-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  filter_alt_off
                </span>
                Quitar filtros
              </button>
            </div>
          )}

          {errorFiltro && (
            <div className="flex flex-col gap-space-xs">
              <div
                role="alert"
                className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm"
              >
                {errorFiltro}
              </div>
              {falloFiltro && (
                <button
                  type="button"
                  onClick={reintentarFiltro}
                  className="self-start flex items-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono-label text-mono-label transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                    refresh
                  </span>
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-space-md py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
          {error}
        </div>
      )}

      {cargando || cargandoFiltro ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant" role="status">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-2"></div>
          <span className="font-mono-micro text-mono-micro">
            {cargandoFiltro ? 'Cargando jugadores del curso…' : 'Cargando partidas…'}
          </span>
        </div>
      ) : falloFiltro ? null /* el error y "Reintentar" ya están arriba, junto a los filtros */ : partidasActivas.length === 0 ? (
        <div className="rounded-lg p-space-lg bg-surface-container-lowest text-center flex flex-col items-center gap-space-xs">
          <span className="material-symbols-outlined text-[32px] text-outline" aria-hidden="true">
            sports_esports
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {!filtrandoCurso
              ? 'No hay partidas de estudiantes en curso ahora mismo.'
              : estudiantesCurso?.length === 0
                ? `El curso «${cursoElegido?.nombre ?? ''}» todavía no tiene estudiantes inscritos.`
                : filtrandoJugador
                  ? `${jugadorElegido?.nombre ?? 'Ese jugador'} no está jugando ahora mismo.`
                  : `Ningún jugador de «${cursoElegido?.nombre ?? ''}» está jugando ahora mismo.`}
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
          <div ref={rejillaRef} className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {partidasPagina.map((partida) => (
              <button
                key={partida.id}
                ref={(nodo) => registrarTarjetaRef(partida.id, nodo)}
                type="button"
                onClick={() => abrirPartidaGrande(partida.id)}
                className="tarjeta-partida bg-surface-container-low rounded-xl p-space-sm shadow-md flex flex-col gap-space-xs hover:bg-surface-container-high transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
  const contenedorRef = useRef(null);

  // Transición suave al "agrandar" un tablero — se dispara una sola vez, al
  // montar (entrar a esta vista desde la grilla), no en cada sondeo de 1.5s
  // que solo actualiza el `fen` ya montado.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ reducido: '(prefers-reduced-motion: reduce)' }, (contexto) => {
        if (!contexto.conditions.reducido) {
          gsap.from(contenedorRef.current, {
            autoAlpha: 0,
            scale: 0.94,
            duration: 0.35,
            ease: 'power2.out',
          });
        }
      });
      return () => mm.revert();
    },
    { scope: contenedorRef, dependencies: [] }
  );

  return (
    <div ref={contenedorRef} className="flex flex-col items-center gap-space-md">
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
