import { useEffect, useMemo, useRef, useState } from 'react';
import { comprobarCalibracion, corregirCasillaDataset, entrenarCandidatoPiezas, estadoCandidatoPiezas, estadoDeLosModelos, problemasDePosicion } from '../../../api/backend';
import { nombreClase } from '../../EntrenarCamara/SubirFotosPieza';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import ModoCamaras from '../ModoCamaras';
import useCamarasConfiguradas from '../useCamarasConfiguradas';
import useFlujoVivo from '../useFlujoVivo';
import TableroSoloLectura from '../../../componentes/TableroSoloLectura';
import PartidaFisica from './PartidaFisica';
import SeguimientoPartida from './SeguimientoPartida';
import { CLASE_VACIA, CLASES_BLANCAS, CLASES_NEGRAS, COLUMNAS, fenDeCasillas } from './fenCaptura';

const CUADROS_VOTO = 5;
const CONFIANZA_CLARA = 0.8;
const CLASES_A_ELEGIR = [...CLASES_BLANCAS, ...CLASES_NEGRAS, CLASE_VACIA];
const CASILLAS = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((fila) => [...COLUMNAS].map((columna) => `${columna}${fila}`));

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
 * Poné una pieza en cualquier casilla y mirá si la reconoce. Es video en vivo y se vota entre los últimos 5 cuadros para que un error suelto no cambie el resultado; no guarda nada.
 */
export default function ProbadorPiezas() {
  const [enVivo, setEnVivo] = useState(true);
  // Mientras hay una partida física, el backend sigue el tablero a cada cuadro de la cámara: el video de piezas (la red en las 64 casillas) se pausa para no
  // quitarle CPU, y el seguimiento a mano no se puede usar (es el mismo seguimiento).
  const [partidaFisicaActiva, setPartidaFisicaActiva] = useState(false);
  const { calibradas } = useCamarasConfiguradas();
  const [modelos, setModelos] = useState(null);
  useEffect(() => {
    estadoDeLosModelos().then(setModelos).catch(() => setModelos(null));
  }, []);
  const textoModelo = (m, nombre) => (m?.existe ? `${nombre} (recorte ${m.recorte})` : `${nombre}: sin entrenar`);
  const haySecundaria = calibradas.includes('secundaria');
  // Con qué cámara(s) se reconoce: `principal`, `secundaria` o `todas` (las dos, decidiendo entre ambas). Sin elegir, las dos si hay secundaria calibrada.
  const [eleccionCamara, setEleccionCamara] = useState(null);
  const camaraElegida = haySecundaria ? (eleccionCamara ?? 'todas') : 'principal';
  const dosCamaras = camaraElegida === 'todas';
  const [vistaPiezas, setVistaPiezas] = useState('ambas');
  const [unoPorSegundo, setUnoPorSegundo] = useState(true); // reconocer cada cuadro de la webcam recarga mucho la máquina: por defecto, 1 por segundo
  const { url, datos, error: errorFlujo } = useFlujoVivo({ modo: 'piezas', camara: camaraElegida, vista: vistaPiezas, maxFps: unoPorSegundo ? 1 : 0, activo: enVivo && !partidaFisicaActiva });
  const error = errorFlujo ? mensajeError({ message: errorFlujo, status: /entrenado|409/.test(errorFlujo) ? 409 : 0 }) : null;
  const historialRef = useRef([]);
  // ¿Se movió alguna de las cámaras en uso desde que se calibró? Con la grilla corrida el modelo ve recortes que no son casillas y reconoce cualquier cosa.
  const [camarasMovidas, setCamarasMovidas] = useState([]);
  useEffect(() => {
    let vigente = true;
    setCamarasMovidas([]);
    const enUso = camaraElegida === 'todas' ? ['principal', 'secundaria'] : [camaraElegida];
    Promise.all(
      enUso.map((camara) =>
        comprobarCalibracion(camara)
          .then((r) => (r.movida === true ? { camara, mensaje: r.mensaje } : null))
          .catch(() => null)
      )
    ).then((resultados) => vigente && setCamarasMovidas(resultados.filter(Boolean)));
    return () => {
      vigente = false;
    };
  }, [camaraElegida]);
  const casillas = useMemo(() => {
    if (!datos) return [];
    historialRef.current = [...historialRef.current, datos].slice(-CUADROS_VOTO);
    return votar(historialRef.current);
  }, [datos]);
  const desacuerdos = casillas.filter((c) => new Set(c.porCamara).size > 1);
  const fenReconocido = useMemo(() => fenDeCasillas(casillas), [casillas]);
  const ocupadas = casillas.filter((c) => c.clase !== 'vacia');
  const dudosas = ocupadas.filter((c) => c.confianza < CONFIANZA_CLARA).map((c) => c.casilla);
  // Entrenamiento de un modelo candidato (GPU del Mac): solo reemplaza al actual si lo supera en validación.
  const [candidato, setCandidato] = useState(null);
  const [errorCandidato, setErrorCandidato] = useState(null);
  const [soloPosicionActual, setSoloPosicionActual] = useState(true);
  const [incluirSecundaria, setIncluirSecundaria] = useState(true);
  const entrenando = candidato?.estado === 'en_curso';
  useEffect(() => {
    estadoCandidatoPiezas().then(setCandidato).catch(() => setCandidato(null));
  }, []);
  useEffect(() => {
    if (!entrenando) return undefined;
    const intervalo = setInterval(() => {
      estadoCandidatoPiezas()
        .then((estado) => {
          setCandidato(estado);
          if (estado.estado !== 'en_curso') estadoDeLosModelos().then(setModelos).catch(() => {});
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(intervalo);
  }, [entrenando]);
  async function entrenarCandidato(recorte) {
    setErrorCandidato(null);
    try {
      await entrenarCandidatoPiezas(recorte, soloPosicionActual, incluirSecundaria);
      setCandidato(await estadoCandidatoPiezas());
    } catch (e) {
      setErrorCandidato(e.status === 400 ? `Todavía hay pocas muestras: ${e.message}` : e.message);
    }
  }
  // Corrección de una casilla mal leída: guarda su recorte (de las dos cámaras) con la clase correcta para el próximo reentrenamiento.
  const [casillaCorregida, setCasillaCorregida] = useState('');
  const [claseCorrecta, setClaseCorrecta] = useState('');
  const [guardandoCorreccion, setGuardandoCorreccion] = useState(false);
  const [resultadoCorreccion, setResultadoCorreccion] = useState(null);
  async function guardarCorreccion() {
    setGuardandoCorreccion(true);
    setResultadoCorreccion(null);
    try {
      const r = await corregirCasillaDataset(casillaCorregida, claseCorrecta, dosCamaras ? undefined : [camaraElegida]);
      setResultadoCorreccion({
        ok: true,
        texto: `Guardado: ${casillaCorregida} como «${nombreClase(claseCorrecta)}» (${r.guardadas} ${r.guardadas === 1 ? 'foto' : 'fotos'}, ${r.total_clase} en esa clase). Se usa en el próximo reentrenamiento.${r.avisos?.length ? ` ${r.avisos.join(' ')}` : ''}`,
      });
    } catch (e) {
      setResultadoCorreccion({ ok: false, texto: e.message });
    } finally {
      setGuardandoCorreccion(false);
    }
  }
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
      <ModoCamaras />
      {haySecundaria && (
        <div className="flex flex-wrap items-center gap-space-xs" role="group" aria-label="Con qué cámara reconocer">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Cámara:</span>
          {[['principal', 'Solo la principal'], ['secundaria', 'Solo la secundaria'], ['todas', 'Las dos']].map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={camaraElegida === id ? CLASE_BOTON_PRIMARIO : CLASE_BOTON}
              aria-pressed={camaraElegida === id}
              onClick={() => {
                historialRef.current = [];
                setEleccionCamara(id);
              }}
            >
              {texto}
            </button>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant min-h-[44px]">
        <input type="checkbox" checked={unoPorSegundo} onChange={(e) => setUnoPorSegundo(e.target.checked)} />
        Reconocer solo 1 vez por segundo (usa mucho menos la máquina; sin marcar, analiza cada cuadro de la cámara)
      </label>
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
        <button type="button" className={CLASE_BOTON} onClick={() => setEnVivo((v) => !v)} aria-pressed={enVivo} disabled={partidaFisicaActiva}>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">{enVivo ? 'pause' : 'play_arrow'}</span>
            {enVivo ? 'Pausar' : 'Reanudar en vivo'}
          </span>
        </button>
        {partidaFisicaActiva && (
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0 self-center" role="status">
            En pausa mientras hay una partida física: el seguimiento del tablero necesita la máquina.
          </p>
        )}
      </div>
      {error && (
        <p className={CLASE_AVISO} role="alert">
          {error}
        </p>
      )}
      {camarasMovidas.map(({ camara, mensaje }) => (
        <p key={camara} className={CLASE_AVISO} role="alert">
          Cámara {camara}: {mensaje} Mientras tanto el reconocimiento no es confiable: acomodá la cámara con la grilla guía del asistente de calibración o recalibrala.
        </p>
      ))}
      {ocupadas.length > 32 && (
        <p className={CLASE_AVISO} role="alert">
          Se reconocen {ocupadas.length} piezas y en un tablero nunca hay más de 32: la grilla no calza con el tablero (la cámara o el tablero se movieron) o la
          foto del tablero vacío quedó vieja. Recalibrá la cámara y volvé a sacar «Casilla vacía».
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md items-start">
        <section className={`${CLASE_TARJETA} min-w-0`} aria-labelledby="titulo-probador-imagen">
          <h3 id="titulo-probador-imagen" className="font-body-md text-body-md text-on-surface font-medium">
            Lo que ve la cámara{dosCamaras ? ' (principal y secundaria, resultado combinado)' : camaraElegida === 'secundaria' ? ' (solo la secundaria)' : ''}
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
        <section className={`${CLASE_TARJETA} min-w-0`} aria-labelledby="titulo-probador-tablero">
          <h3 id="titulo-probador-tablero" className="font-body-md text-body-md text-on-surface font-medium">
            Posición reconocida{dosCamaras ? ' (decisión entre las dos cámaras)' : ''}
          </h3>
          <div className="w-full flex justify-center">
            <TableroSoloLectura fen={fenReconocido} resaltadas={dudosas} />
          </div>
          {dudosas.length > 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0" role="status">
              Borde ámbar: casillas con confianza menor a {Math.round(CONFIANZA_CLARA * 100)} % ({dudosas.join(', ')}). Si alguna está mal, corregila abajo.
            </p>
          )}
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
        <PartidaFisica alCambiarActiva={setPartidaFisicaActiva} />
        <SeguimientoPartida bloqueado={partidaFisicaActiva} />
        <section className={`${CLASE_TARJETA} lg:col-span-2`} aria-labelledby="titulo-probador-entrenar">
          <h3 id="titulo-probador-entrenar" className="font-body-md text-body-md text-on-surface font-medium">
            Entrenar con mis correcciones
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant m-0">
            Entrena un modelo nuevo con todas tus fotos de la cámara principal y las casillas corregidas, usando la GPU del Mac (unos pocos minutos).
            Elige con qué recorte aprende: <strong>2D</strong> (la casilla vista desde arriba, con un margen) o <strong>3D</strong> (la caja que ocupa la pieza). El modelo
            actual solo se reemplaza si el nuevo reconoce mejor las mismas casillas apartadas para validar; si no, queda como está (y el actual se respalda al reemplazarlo).
            Después, la vista «Tablero plano» y las «Cajas 3D» de arriba sirven para probar cada uno.
          </p>
          <label className="inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant min-h-[44px]">
            <input type="checkbox" checked={soloPosicionActual} onChange={(e) => setSoloPosicionActual(e.target.checked)} disabled={entrenando} />
            Usar solo las fotos tomadas desde la última calibración de la principal (su posición actual)
          </label>
          <label className="inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant min-h-[44px]">
            <input type="checkbox" checked={incluirSecundaria} onChange={(e) => setIncluirSecundaria(e.target.checked)} disabled={entrenando} />
            Sumar las fotos de la cámara que antes estaba arriba (la secundaria), degradadas a la nitidez de la webcam. Solo sirven para entrenar: se valida únicamente con fotos de la principal.
          </label>
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={() => entrenarCandidato('ampliado')} disabled={entrenando}>
              {entrenando ? 'Entrenando…' : 'Entrenar en 2D (plano)'}
            </button>
            <button type="button" className={CLASE_BOTON} onClick={() => entrenarCandidato('volumen')} disabled={entrenando}>
              Entrenar en 3D (cajas)
            </button>
          </div>
          {entrenando && (
            <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
              {candidato.progreso ?? 'Preparando los datos…'}
            </p>
          )}
          {candidato?.estado === 'terminado' && candidato.resultado && (
            <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">
              {candidato.resultado.startsWith('reemplazado') ? '✓ ' : ''}
              {candidato.resultado}
            </p>
          )}
          {candidato?.estado === 'error' && (
            <p className={CLASE_AVISO} role="alert">
              El entrenamiento falló. {candidato.log.split('\n').slice(-3).join(' · ')}
            </p>
          )}
          {errorCandidato && (
            <p className={CLASE_AVISO} role="alert">
              {errorCandidato}
            </p>
          )}
        </section>
        <section className={`${CLASE_TARJETA} lg:col-span-2`} aria-labelledby="titulo-probador-lista">
          <h3 id="titulo-probador-lista" className="font-body-md text-body-md text-on-surface font-medium">
            Piezas reconocidas ({ocupadas.length})
          </h3>
          {datos && ocupadas.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0">No reconoce ninguna pieza: el tablero se ve vacío.</p>
          )}
          <div className="flex flex-wrap items-end gap-space-xs" role="group" aria-label="Corregir una casilla mal reconocida">
            <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
              Casilla
              <select className="min-h-[44px] rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs" value={casillaCorregida} onChange={(e) => setCasillaCorregida(e.target.value)}>
                <option value="">Elegí…</option>
                {CASILLAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant">
              Lo que hay de verdad
              <select className="min-h-[44px] rounded-xl border border-outline-variant bg-surface-container text-on-surface px-space-xs" value={claseCorrecta} onChange={(e) => setClaseCorrecta(e.target.value)}>
                <option value="">Elegí…</option>
                {CLASES_A_ELEGIR.map((clase) => (
                  <option key={clase} value={clase}>{nombreClase(clase)}</option>
                ))}
              </select>
            </label>
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={guardarCorreccion} disabled={!casillaCorregida || !claseCorrecta || guardandoCorreccion}>
              {guardandoCorreccion ? 'Guardando…' : 'Guardar corrección'}
            </button>
          </div>
          {resultadoCorreccion && (
            <p className={resultadoCorreccion.ok ? 'font-body-sm text-body-sm text-on-surface m-0' : CLASE_AVISO} role={resultadoCorreccion.ok ? 'status' : 'alert'}>
              {resultadoCorreccion.texto}
            </p>
          )}
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {ocupadas.map((c) => (
              <li key={c.casilla} className="flex flex-wrap items-baseline justify-between gap-x-space-sm font-body-sm text-body-sm border-b border-outline-variant pb-1">
                <span className="text-on-surface">
                  <strong>{c.casilla}</strong> · {nombreClase(c.clase)}
                </span>
                <span className={`inline-flex items-center gap-space-xs ${colorConfianza(c.confianza)}`}>
                  <button
                    type="button"
                    className="min-h-[44px] px-space-xs font-body-sm text-body-sm text-primary underline"
                    onClick={() => {
                      setCasillaCorregida(c.casilla);
                      setClaseCorrecta('');
                      setResultadoCorreccion(null);
                    }}
                    aria-label={`Corregir la casilla ${c.casilla}`}
                  >
                    Corregir
                  </button>
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
