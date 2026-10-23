import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearCurso,
  editarCurso,
  eliminarCurso,
  listarCursos,
  listarEstudiantesCurso,
  listarUsuarios,
  obtenerPerfil,
  reasignarCurso,
  regenerarCodigoCurso,
  sacarEstudianteDeCurso,
} from '../../api/backend';
import AvatarUsuario from '../../componentes/AvatarUsuario';
import InsigniaTonoCurso from '../../componentes/InsigniaTonoCurso';
import { buscarTono, PRESETS_TONO, TONO_HEREDADO, tonoPropioDeCurso } from '../../tonoTuring';
import ReporteCurso from './ReporteCurso';

const NOMBRE_MIN = 2;
const NOMBRE_MAX = 80;

// Cupo de alumnos de un curso: lo define quien lo crea y el backend lo exige entre 1 y 120.
const CUPO_MIN = 1;
const CUPO_MAX = 120;
const CUPO_POR_DEFECTO = 60;
const MENSAJE_CUPO_INVALIDO = `El cupo tiene que ser un número entero entre ${CUPO_MIN} y ${CUPO_MAX}.`;
const AYUDA_CUPO = `Cuántos alumnos pueden inscribirse. Máximo ${CUPO_MAX}.`;

// Tono de Turing del curso: `''` en los selectores = "hereda el del perfil del facilitador" (al crear no se manda
// nada; al editar se manda `TONO_HEREDADO`).
const AYUDA_TONO = 'Cómo les habla Turing a los alumnos de este curso.';
const AYUDA_TONO_HEREDADO = 'Usa el tono que el facilitador eligió en Configuración de Enseñanza.';

/** Opciones de un selector de tono: la de heredar (valor `''`) y los tres tonos. */
function OpcionesTono({ etiquetaHeredar }) {
  return (
    <>
      <option value="">{etiquetaHeredar}</option>
      {PRESETS_TONO.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.nombre}
        </option>
      ))}
    </>
  );
}

/** Cupo escrito en un campo de texto como entero de `CUPO_MIN` a `CUPO_MAX`, o `null` si no sirve (vacío, decimal, fuera de rango). */
function leerCupo(texto) {
  const limpio = String(texto ?? '').trim();
  if (!/^\d+$/.test(limpio)) return null;
  const cupo = Number(limpio);
  return cupo >= CUPO_MIN && cupo <= CUPO_MAX ? cupo : null;
}

const BASE_BOTON =
  'flex items-center justify-center gap-1 px-space-sm py-space-2xs min-h-10 rounded-lg font-mono-label text-mono-label transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const BOTON_NEUTRO = `${BASE_BOTON} bg-surface-container-high hover:bg-surface-bright text-on-surface`;
const BOTON_PELIGRO = `${BASE_BOTON} bg-error/10 hover:bg-error/20 text-error`;
const BOTON_PRINCIPAL = `${BASE_BOTON} bg-primary text-on-primary hover:bg-primary-fixed font-medium`;
const CLASE_INPUT =
  'px-space-sm py-space-xs min-h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

/** "7 / 60 alumnos" (inscritos sobre cupo). Si el backend todavía no manda el cupo, queda el conteo de siempre. */
function textoOcupacion(curso) {
  if (curso.cupo == null) return plural(curso.estudiantes, 'estudiante', 'estudiantes');
  return `${curso.estudiantes} / ${curso.cupo} alumnos`;
}

/** Texto de un facilitador en los selectores: el nombre solo puede repetirse, así que va con su correo. */
function etiquetaFacilitador(facilitador) {
  return `${facilitador.nombre} (${facilitador.email})`;
}

/** Cada cuánto se vuelven a pedir los cursos y los estudiantes mientras el panel está abierto. */
const INTERVALO_SONDEO_MS = 8000;

/**
 * Mezcla una lista nueva del servidor con la que ya está en pantalla, por `id`: sigue el orden y el contenido del
 * servidor (entran los nuevos, salen los que ya no están) pero conserva el mismo objeto cuando no cambió nada.
 */
function fusionarPorId(previos, nuevos) {
  const porId = new Map((previos ?? []).map((item) => [item.id, item]));
  return nuevos.map((nuevo) => {
    const previo = porId.get(nuevo.id);
    if (!previo) return nuevo;
    const igual = Object.keys(nuevo).every((clave) => previo[clave] === nuevo[clave]);
    return igual ? previo : { ...previo, ...nuevo };
  });
}

/**
 * Sondeo liviano y silencioso: mientras `activo` y con la pestaña visible, corre `tarea(vigente)` cada
 * `INTERVALO_SONDEO_MS`. Con la pestaña oculta no pide nada y al volver a verse refresca enseguida. Nunca se
 * solapan dos pedidos, los errores se ignoran (se reintenta en el próximo ciclo) y se limpia al desactivarse, al
 * cambiar `clave` o al desmontar. `vigente()` dice si el sondeo sigue siendo el mismo: la tarea lo mira después de
 * esperar la red para no aplicar un resultado viejo.
 */
function useSondeoSilencioso(activo, tarea, clave = null) {
  const tareaRef = useRef(tarea);
  useEffect(() => {
    tareaRef.current = tarea;
  });

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let enCurso = false;
    async function tic() {
      if (!vivo || enCurso || document.visibilityState === 'hidden') return;
      enCurso = true;
      try {
        await tareaRef.current(() => vivo);
      } catch {
        // silencioso: se conserva lo que había y se reintenta en el próximo ciclo
      } finally {
        enCurso = false;
      }
    }
    const intervalo = setInterval(tic, INTERVALO_SONDEO_MS);
    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') tic();
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [activo, clave]);
}

/** Mensaje de error con `role="alert"`, para que un lector de pantalla lo anuncie. */
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

/** Pregunta de confirmación en línea (sin ventana emergente): explica qué pasa y pide el sí o el no. */
function Confirmacion({ mensaje, textoConfirmar, ocupado, alConfirmar, alCancelar }) {
  return (
    <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
      <p className="m-0 font-body-sm text-body-sm text-on-surface break-words">{mensaje}</p>
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" onClick={alConfirmar} disabled={ocupado} className={BOTON_PELIGRO}>
          {ocupado ? 'Un momento…' : textoConfirmar}
        </button>
        <button type="button" onClick={alCancelar} disabled={ocupado} className={BOTON_NEUTRO}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Jugadores inscritos en un curso. Se monta recién al desplegarla, así que carga la lista al montarse; después se
 * actualiza sola en silencio (ver `useSondeoSilencioso`) sin tocar lo que el usuario esté haciendo.
 */
function ListaEstudiantes({ cursoId, alActualizarCantidad }) {
  const [estudiantes, setEstudiantes] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [sacandoId, setSacandoId] = useState(null);
  const versionLocalRef = useRef(0); // sube con cada cambio hecho acá: un sondeo que empezó antes se descarta

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarEstudiantesCurso(cursoId)
      .then((lista) => {
        if (!cancelado) setEstudiantes(lista);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || 'No se pudo cargar la lista de estudiantes.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [cursoId, recarga]);

  // El número de la tarjeta sigue a la lista (carga, sondeo o "Sacar del curso").
  const cantidad = estudiantes ? estudiantes.length : null;
  useEffect(() => {
    if (cantidad !== null) alActualizarCantidad(cantidad);
  }, [cantidad, alActualizarCantidad]);

  useSondeoSilencioso(
    estudiantes !== null,
    async (vigente) => {
      const version = versionLocalRef.current;
      const lista = await listarEstudiantesCurso(cursoId);
      if (!vigente() || version !== versionLocalRef.current) return;
      setEstudiantes((previos) => (previos === null ? lista : fusionarPorId(previos, lista)));
    },
    cursoId
  );

  async function sacar(estudiante) {
    setSacandoId(estudiante.id);
    setError(null);
    versionLocalRef.current += 1;
    try {
      await sacarEstudianteDeCurso(cursoId, estudiante.id);
      versionLocalRef.current += 1;
      setEstudiantes((previos) => (previos ?? []).filter((e) => e.id !== estudiante.id));
      setConfirmandoId(null);
    } catch (err) {
      setError(err.message || 'No se pudo sacar al estudiante del curso.');
      if (err.status === 404) setRecarga((n) => n + 1); // ya no estaba: se refresca la lista
    } finally {
      setSacandoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs pt-space-xs border-t border-outline-variant/20">
      {error && <AvisoError mensaje={error} />}
      {error && estudiantes === null && !cargando && (
        <button type="button" onClick={() => setRecarga((n) => n + 1)} className={`${BOTON_NEUTRO} self-start`}>
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            refresh
          </span>
          Reintentar
        </button>
      )}
      {cargando && estudiantes === null ? (
        <Cargando texto="Cargando estudiantes…" />
      ) : estudiantes && estudiantes.length === 0 ? (
        <p className="m-0 font-body-sm text-body-sm text-outline">
          Todavía no se inscribió nadie. Pasales el código para que entren desde Mi Perfil.
        </p>
      ) : (
        estudiantes && (
          <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
            {estudiantes.map((estudiante) => (
              <li key={estudiante.id} className="flex flex-col gap-space-xs px-space-sm py-space-xs rounded-lg bg-surface-container-low">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-xs">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <AvatarUsuario url={estudiante.avatar_url} clase="w-9 h-9" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{estudiante.nombre}</span>
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">
                        {estudiante.rango_estimado
                          ? `${estudiante.rango_estimado}${estudiante.nivel_estimado != null ? ` · nivel ~${estudiante.nivel_estimado}` : ''}`
                          : 'Sin diagnosticar'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-space-xs">
                    <span
                      className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${
                        estudiante.activo ? 'bg-primary-container text-primary' : 'bg-error-container text-error'
                      }`}
                    >
                      {estudiante.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmandoId(estudiante.id)}
                      disabled={sacandoId !== null}
                      aria-label={`Sacar a ${estudiante.nombre} del curso`}
                      className={BOTON_PELIGRO}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        person_remove
                      </span>
                      Sacar del curso
                    </button>
                  </div>
                </div>
                {confirmandoId === estudiante.id && (
                  <Confirmacion
                    mensaje={`¿Sacar a ${estudiante.nombre} del curso? Su cuenta no se borra: puede volver a entrar con el código.`}
                    textoConfirmar="Sí, sacar"
                    ocupado={sacandoId === estudiante.id}
                    alConfirmar={() => sacar(estudiante)}
                    alCancelar={() => setConfirmandoId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/**
 * Un curso: su código bien visible, el interruptor de ingresos y las acciones del facilitador.
 * Solo para el facilitador principal: `mostrarDueno` muestra de quién es el curso y `esPrincipal` habilita
 * "Asignar a…" (`facilitadores` = `{ lista, cargando, error, recargar }` con los posibles destinos).
 */
function TarjetaCurso({
  curso,
  alCambiar,
  alSincronizarCantidad,
  alEliminar,
  alReasignado,
  esPrincipal = false,
  mostrarDueno = false,
  miId = null,
  facilitadores = null,
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombreEdicion, setNombreEdicion] = useState(curso.nombre);
  // Cupo: el texto del campo vive acá (no en `curso`), así el sondeo de 8 s no lo pisa mientras se escribe.
  const [editandoCupo, setEditandoCupo] = useState(false);
  const [cupoEdicion, setCupoEdicion] = useState('');
  const [errorCupo, setErrorCupo] = useState(null);
  // Tono de Turing: igual que el cupo, la opción elegida vive acá para que el sondeo de 8 s no la pise mientras se edita.
  const [editandoTono, setEditandoTono] = useState(false);
  const [tonoEdicion, setTonoEdicion] = useState(''); // '' = hereda el del perfil del facilitador
  const [errorTono, setErrorTono] = useState(null);
  const [confirmando, setConfirmando] = useState(null); // 'codigo' | 'eliminar' | 'asignar' | null
  const [destinoId, setDestinoId] = useState(''); // facilitador elegido en "Asignar a…"
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);
  // Qué está desplegado en la tarjeta. Vive acá (no en `curso`) para que el sondeo de 8 s, que solo reemplaza los
  // datos del curso, no cierre ni pise la lista de estudiantes ni el reporte que el facilitador tiene abiertos.
  const [verEstudiantes, setVerEstudiantes] = useState(false);
  const [verReporte, setVerReporte] = useState(false);
  const temporizadorCopiado = useRef(null);
  const idEstudiantes = `estudiantes-curso-${curso.id}`;
  const idReporte = `reporte-curso-${curso.id}`;

  useEffect(() => () => clearTimeout(temporizadorCopiado.current), []);

  // Estable entre renders: la lista de estudiantes lo usa como dependencia de su efecto de carga.
  const actualizarCantidad = useCallback(
    (cantidad) => alSincronizarCantidad(curso.id, cantidad),
    [alSincronizarCantidad, curso.id]
  );

  /**
   * Corre una acción de red marcando el curso como ocupado y mostrando el error en la tarjeta si falla.
   * `fijarError` dice dónde se muestra: por defecto en la tarjeta; los formularios del cupo y del tono usan el suyo.
   */
  async function ejecutar(accion, mensajePorDefecto, fijarError = setError) {
    setOcupado(true);
    setError(null);
    setErrorCupo(null);
    setErrorTono(null);
    try {
      return await accion();
    } catch (err) {
      fijarError(err.message || mensajePorDefecto);
      return undefined;
    } finally {
      setOcupado(false);
    }
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(curso.codigo);
      setCopiado(true);
      clearTimeout(temporizadorCopiado.current);
      temporizadorCopiado.current = setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false); // sin permiso de portapapeles: el código igual está a la vista para dictarlo
    }
  }

  async function alternarIngresos() {
    const actualizado = await ejecutar(
      () => editarCurso(curso.id, { acepta_ingresos: !curso.acepta_ingresos }),
      'No se pudo cambiar si el curso acepta ingresos.'
    );
    if (actualizado) alCambiar(curso.id, actualizado);
  }

  function empezarRenombrar() {
    setNombreEdicion(curso.nombre);
    setError(null);
    setConfirmando(null);
    setRenombrando(true);
  }

  async function guardarNombre(evento) {
    evento.preventDefault();
    const nombre = nombreEdicion.trim();
    if (nombre.length < NOMBRE_MIN) {
      setError(`El nombre tiene que tener al menos ${NOMBRE_MIN} caracteres.`);
      return;
    }
    if (nombre === curso.nombre) {
      setRenombrando(false);
      return;
    }
    const actualizado = await ejecutar(() => editarCurso(curso.id, { nombre }), 'No se pudo renombrar el curso.');
    if (actualizado) {
      alCambiar(curso.id, actualizado);
      setRenombrando(false);
    }
  }

  function empezarEditarCupo() {
    setCupoEdicion(String(curso.cupo ?? CUPO_POR_DEFECTO));
    setError(null);
    setErrorCupo(null);
    setConfirmando(null);
    setEditandoCupo(true);
  }

  async function guardarCupo(evento) {
    evento.preventDefault();
    const cupo = leerCupo(cupoEdicion);
    if (cupo === null) {
      setErrorCupo(MENSAJE_CUPO_INVALIDO);
      return;
    }
    if (cupo === curso.cupo) {
      setEditandoCupo(false);
      return;
    }
    // Si el backend lo rechaza (por ejemplo, menos que los alumnos ya inscritos) su mensaje se muestra tal cual.
    const actualizado = await ejecutar(
      () => editarCurso(curso.id, { cupo }),
      'No se pudo cambiar el cupo del curso.',
      setErrorCupo
    );
    if (actualizado) {
      alCambiar(curso.id, actualizado); // refresca la tarjeta con lo que respondió el servidor (cupo y estudiantes)
      setEditandoCupo(false);
    }
  }

  function empezarEditarTono() {
    setTonoEdicion(tonoPropioDeCurso(curso));
    setError(null);
    setErrorTono(null);
    setConfirmando(null);
    setEditandoTono(true);
  }

  async function guardarTono(evento) {
    evento.preventDefault();
    if (tonoEdicion === tonoPropioDeCurso(curso)) {
      setEditandoTono(false); // no cambió nada: no hace falta pedirle nada al servidor
      return;
    }
    // Si el backend lo rechaza, su mensaje se muestra tal cual en el formulario del tono.
    const actualizado = await ejecutar(
      () => editarCurso(curso.id, { preset_ensenanza: tonoEdicion === '' ? TONO_HEREDADO : tonoEdicion }),
      'No se pudo cambiar el tono del curso.',
      setErrorTono
    );
    if (actualizado) {
      alCambiar(curso.id, actualizado); // refresca la insignia con `preset_ensenanza` y `preset_efectivo` del servidor
      setEditandoTono(false);
    }
  }

  async function generarCodigoNuevo() {
    const actualizado = await ejecutar(() => regenerarCodigoCurso(curso.id), 'No se pudo generar un código nuevo.');
    if (actualizado) {
      alCambiar(curso.id, actualizado);
      setConfirmando(null);
      setCopiado(false);
    }
  }

  async function borrarCurso() {
    const hecho = await ejecutar(async () => {
      await eliminarCurso(curso.id);
      return true;
    }, 'No se pudo eliminar el curso.');
    if (hecho) alEliminar(curso);
  }

  function alternarAsignar() {
    setDestinoId('');
    setError(null);
    setConfirmando((actual) => (actual === 'asignar' ? null : 'asignar'));
  }

  async function asignarCurso() {
    const actualizado = await ejecutar(
      () => reasignarCurso(curso.id, Number(destinoId)),
      'No se pudo asignar el curso a ese facilitador.'
    );
    if (actualizado) {
      setConfirmando(null);
      setDestinoId('');
      alReasignado(actualizado);
    }
  }

  // Si el curso es de otro facilitador (el principal viendo los de todos), "el de mi perfil" sería mentira: el tono
  // heredado es el del perfil de su dueño.
  const duenoAjeno =
    miId != null && curso.facilitador_id != null && curso.facilitador_id !== miId
      ? curso.facilitador_nombre || 'otro facilitador'
      : null;
  const etiquetaHeredarTono = duenoAjeno ? `El del perfil de ${duenoAjeno}` : 'El de mi perfil';
  const tonoElegido = buscarTono(tonoEdicion);
  const abierto = curso.acepta_ingresos;
  const completo =curso.cupo != null && curso.estudiantes >= curso.cupo;
  // Destinos posibles: los facilitadores activos que no son el dueño actual del curso.
  const destinos = (facilitadores?.lista ?? []).filter((f) => f.id !== curso.facilitador_id);
  const destino = destinos.find((f) => String(f.id) === destinoId) ?? null;
  const puedeElegirDestino =
    Boolean(facilitadores) && !facilitadores.error && facilitadores.lista !== null && destinos.length > 0;

  return (
    <li className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container min-w-0">
      {/* Nombre */}
      {renombrando ? (
        <form onSubmit={guardarNombre} className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <label
              htmlFor={`curso-nombre-${curso.id}`}
              className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
            >
              Nombre del curso
            </label>
            <input
              id={`curso-nombre-${curso.id}`}
              value={nombreEdicion}
              onChange={(e) => setNombreEdicion(e.target.value)}
              maxLength={NOMBRE_MAX}
              required
              autoFocus
              className={CLASE_INPUT}
            />
          </div>
          <div className="flex gap-space-xs">
            <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setRenombrando(false)} disabled={ocupado} className={BOTON_NEUTRO}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-space-xs">
          <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface min-w-0 break-words">{curso.nombre}</h3>
          <span
            className={`flex items-center gap-1 font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium shrink-0 ${
              abierto ? 'bg-primary-container text-primary' : 'bg-error-container text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              {abierto ? 'lock_open' : 'lock'}
            </span>
            {abierto ? 'ABIERTO' : 'CERRADO'}
          </span>
        </div>
      )}

      {/* De quién es el curso (solo el facilitador principal, al ver los cursos de todos) */}
      {mostrarDueno && (
        <p className="m-0 flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant min-w-0">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
            admin_panel_settings
          </span>
          <span className="min-w-0 break-words">
            Facilitador:{' '}
            <strong className="text-on-surface">
              {curso.facilitador_nombre || 'sin dueño'}
              {miId != null && curso.facilitador_id === miId ? ' (vos)' : ''}
            </strong>
          </span>
        </p>
      )}

      {/* Tono de Turing vigente en el curso (el propio, o el del perfil del facilitador, o el por defecto) */}
      <InsigniaTonoCurso curso={curso} duenoAjeno={duenoAjeno} />

      {/* Código */}
      <div className="flex flex-col gap-space-2xs p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30">
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
          Código del curso
        </span>
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="font-mono-metric text-[26px] sm:text-[30px] tracking-[0.15em] text-on-surface break-all select-all">
            {curso.codigo}
          </span>
          <button
            type="button"
            onClick={copiarCodigo}
            aria-label={`Copiar el código ${curso.codigo}`}
            className={BOTON_NEUTRO}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              {copiado ? 'check' : 'content_copy'}
            </span>
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        {!abierto && (
          <p className="m-0 font-mono-micro text-mono-micro text-error">
            El curso está cerrado: nadie puede entrar con este código hasta que lo vuelvas a abrir.
          </p>
        )}
      </div>

      {/* Interruptor de ingresos + estudiantes */}
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <button
          type="button"
          role="switch"
          aria-checked={abierto}
          onClick={alternarIngresos}
          disabled={ocupado}
          className="flex items-center gap-space-xs min-h-10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
              abierto ? 'bg-primary-container' : 'bg-surface-bright'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${
                abierto ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-outline'
              }`}
            />
          </span>
          <span className="font-body-sm text-body-sm text-on-surface">Acepta ingresos</span>
          <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant">{abierto ? 'Sí' : 'No'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-space-xs">
          {completo && (
            <span
              className="flex items-center gap-1 font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium shrink-0 bg-tertiary/10 text-tertiary border border-tertiary/40"
              title="El curso llegó a su cupo: nadie más puede entrar hasta que subas el cupo o saques a alguien."
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                event_busy
              </span>
              Completo
            </span>
          )}
          <button
            type="button"
            onClick={() => setVerEstudiantes((v) => !v)}
            aria-expanded={verEstudiantes}
            aria-controls={idEstudiantes}
            className={BOTON_NEUTRO}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              groups
            </span>
            {textoOcupacion(curso)}
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {verEstudiantes ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVerReporte((v) => !v)}
            aria-expanded={verReporte}
            aria-controls={idReporte}
            className={BOTON_NEUTRO}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              monitoring
            </span>
            Reporte
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {verReporte ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {error && <AvisoError mensaje={error} />}

      {/* Acciones */}
      <div className="flex flex-wrap gap-space-xs">
        <button type="button" onClick={empezarRenombrar} disabled={ocupado || renombrando} className={BOTON_NEUTRO}>
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            edit
          </span>
          Renombrar
        </button>
        <button type="button" onClick={empezarEditarCupo} disabled={ocupado || editandoCupo} className={BOTON_NEUTRO}>
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            event_seat
          </span>
          Cupo
        </button>
        <button type="button" onClick={empezarEditarTono} disabled={ocupado || editandoTono} className={BOTON_NEUTRO}>
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            record_voice_over
          </span>
          Tono
        </button>
        <button
          type="button"
          onClick={() => setConfirmando((actual) => (actual === 'codigo' ? null : 'codigo'))}
          disabled={ocupado}
          aria-expanded={confirmando === 'codigo'}
          className={BOTON_NEUTRO}
        >
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            autorenew
          </span>
          Código nuevo
        </button>
        {esPrincipal && (
          <button
            type="button"
            onClick={alternarAsignar}
            disabled={ocupado}
            aria-expanded={confirmando === 'asignar'}
            className={BOTON_NEUTRO}
          >
            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
              swap_horiz
            </span>
            Asignar a…
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmando((actual) => (actual === 'eliminar' ? null : 'eliminar'))}
          disabled={ocupado}
          aria-expanded={confirmando === 'eliminar'}
          className={BOTON_PELIGRO}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            delete
          </span>
          Eliminar
        </button>
      </div>

      {/* Cupo: mismo patrón que "Renombrar" (campo + Guardar/Cancelar), justo debajo de las acciones */}
      {editandoCupo && (
        <div className="flex flex-col gap-space-xs">
          {/* noValidate: el error de cupo fuera de rango se muestra abajo, igual que los del servidor */}
          <form onSubmit={guardarCupo} noValidate className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label
                htmlFor={`curso-cupo-${curso.id}`}
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Cupo de alumnos
              </label>
              <input
                id={`curso-cupo-${curso.id}`}
                type="number"
                inputMode="numeric"
                min={CUPO_MIN}
                max={CUPO_MAX}
                step={1}
                value={cupoEdicion}
                onChange={(e) => setCupoEdicion(e.target.value)}
                autoFocus
                aria-describedby={`curso-cupo-ayuda-${curso.id}`}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex gap-space-xs">
              <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>
                {ocupado ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setEditandoCupo(false)} disabled={ocupado} className={BOTON_NEUTRO}>
                Cancelar
              </button>
            </div>
          </form>
          <p id={`curso-cupo-ayuda-${curso.id}`} className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            {AYUDA_CUPO} Ahora hay {plural(curso.estudiantes, 'inscrito', 'inscritos')}: el cupo no puede ser menor.
          </p>
          {errorCupo && <AvisoError mensaje={errorCupo} />}
        </div>
      )}

      {/* Tono: mismo patrón que el cupo (selector + Guardar/Cancelar), justo debajo de las acciones */}
      {editandoTono && (
        <div className="flex flex-col gap-space-xs">
          <form onSubmit={guardarTono} className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label
                htmlFor={`curso-tono-${curso.id}`}
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Tono de Turing en este curso
              </label>
              <select
                id={`curso-tono-${curso.id}`}
                value={tonoEdicion}
                onChange={(e) => setTonoEdicion(e.target.value)}
                disabled={ocupado}
                autoFocus
                aria-describedby={`curso-tono-ayuda-${curso.id}`}
                className={CLASE_INPUT}
              >
                <OpcionesTono etiquetaHeredar={etiquetaHeredarTono} />
              </select>
            </div>
            <div className="flex gap-space-xs">
              <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>
                {ocupado ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setEditandoTono(false)} disabled={ocupado} className={BOTON_NEUTRO}>
                Cancelar
              </button>
            </div>
          </form>
          <p id={`curso-tono-ayuda-${curso.id}`} className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            {AYUDA_TONO} {tonoElegido ? tonoElegido.descripcion : AYUDA_TONO_HEREDADO}
          </p>
          {errorTono && <AvisoError mensaje={errorTono} />}
        </div>
      )}

      {confirmando === 'codigo' && (
        <Confirmacion
          mensaje="Al generar un código nuevo, el anterior deja de servir. Los estudiantes que ya están inscritos siguen en el curso."
          textoConfirmar="Sí, generar código nuevo"
          ocupado={ocupado}
          alConfirmar={generarCodigoNuevo}
          alCancelar={() => setConfirmando(null)}
        />
      )}
      {esPrincipal && confirmando === 'asignar' && (
        <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/40">
          {facilitadores?.error ? (
            <>
              <AvisoError mensaje={facilitadores.error} />
              <button type="button" onClick={facilitadores.recargar} className={`${BOTON_NEUTRO} self-start`}>
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  refresh
                </span>
                Reintentar
              </button>
            </>
          ) : !facilitadores || facilitadores.lista === null ? (
            <Cargando texto="Cargando facilitadores…" />
          ) : destinos.length === 0 ? (
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              No hay otros facilitadores activos a quienes asignar este curso.
            </p>
          ) : (
            <>
              <label
                htmlFor={`curso-destino-${curso.id}`}
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Asignar a…
              </label>
              <select
                id={`curso-destino-${curso.id}`}
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                disabled={ocupado}
                className={`${CLASE_INPUT} w-full`}
              >
                <option value="">Elegí un facilitador</option>
                {destinos.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {etiquetaFacilitador(f)}
                  </option>
                ))}
              </select>
              {destino && (
                <p role="status" className="m-0 font-body-sm text-body-sm text-on-surface break-words">
                  Los estudiantes siguen en el curso y pasan a ver los videos y el tono de{' '}
                  <strong>{destino.nombre}</strong>.
                </p>
              )}
              <div className="flex flex-wrap gap-space-xs">
                <button
                  type="button"
                  onClick={asignarCurso}
                  disabled={ocupado || !destino}
                  className={BOTON_PRINCIPAL}
                >
                  {ocupado ? 'Asignando…' : destino ? `Sí, asignar a ${destino.nombre}` : 'Asignar'}
                </button>
                <button type="button" onClick={alternarAsignar} disabled={ocupado} className={BOTON_NEUTRO}>
                  Cancelar
                </button>
              </div>
            </>
          )}
          {!puedeElegirDestino && (
            <button type="button" onClick={alternarAsignar} className={`${BOTON_NEUTRO} self-start`}>
              Cerrar
            </button>
          )}
        </div>
      )}
      {confirmando === 'eliminar' && (
        <Confirmacion
          mensaje={`¿Eliminar el curso «${curso.nombre}»? Los estudiantes no se borran: quedan sin curso. No se puede deshacer.`}
          textoConfirmar="Sí, eliminar curso"
          ocupado={ocupado}
          alConfirmar={borrarCurso}
          alCancelar={() => setConfirmando(null)}
        />
      )}

      {verEstudiantes && (
        <div id={idEstudiantes}>
          <ListaEstudiantes cursoId={curso.id} alActualizarCantidad={actualizarCantidad} />
        </div>
      )}

      {verReporte && (
        <div id={idReporte} className="min-w-0">
          <ReporteCurso cursoId={curso.id} />
        </div>
      )}
    </li>
  );
}

/**
 * Cursos del facilitador (solo facilitadores). Cada curso tiene un código que los jugadores escriben en Mi
 * Perfil para entrar; desde acá se crea, se renombra, se cierra a nuevos ingresos, se cambia su código y se
 * ve y se gestiona quién está inscrito.
 *
 * Si el usuario es facilitador principal (`es_principal`) suma: ver los cursos de todos los facilitadores,
 * crear un curso a nombre de otro y asignar un curso a otro facilitador. Para los demás no cambia nada.
 */
export default function PanelCursos({ usuarioActual = null }) {
  const [abierto, setAbierto] = useState(false);
  const [cursos, setCursos] = useState(null); // null = todavía no se cargó
  const [cargando, setCargando] = useState(false);
  const [errorLista, setErrorLista] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [cupoNuevo, setCupoNuevo] = useState(String(CUPO_POR_DEFECTO)); // texto del campo; se valida al crear
  const [tonoNuevo, setTonoNuevo] = useState(''); // '' = hereda el tono del perfil del facilitador (no se manda)
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Facilitador principal. La sesión guardada puede ser de antes de que existiera `es_principal`, así que al abrir
  // el panel se relee el perfil del servidor; mientras tanto se usa lo guardado. El backend igual lo vuelve a
  // exigir en cada pedido (403 si no lo es).
  const [esPrincipal, setEsPrincipal] = useState(usuarioActual?.es_principal === true);
  const [miId, setMiId] = useState(usuarioActual?.id ?? null);
  const [verTodos, setVerTodos] = useState(false);
  const [crearPara, setCrearPara] = useState(''); // '' = para mí, o el id del facilitador destino
  const [listaFacilitadores, setListaFacilitadores] = useState(null); // null = todavía no se cargó
  const [cargandoFacilitadores, setCargandoFacilitadores] = useState(false);
  const [errorFacilitadores, setErrorFacilitadores] = useState(null);
  const [recargaFacilitadores, setRecargaFacilitadores] = useState(0);
  const pedirTodos = esPrincipal && verTodos;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorLista(null);
    try {
      setCursos(await listarCursos(pedirTodos));
    } catch (err) {
      setErrorLista(err.message || 'No se pudieron cargar tus cursos.');
    } finally {
      setCargando(false);
    }
  }, [pedirTodos]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  // Al abrir: confirma con el servidor si el usuario es principal (si el pedido falla se queda con lo guardado).
  useEffect(() => {
    if (!abierto) return undefined;
    let cancelado = false;
    obtenerPerfil()
      .then((perfil) => {
        if (cancelado || !perfil || typeof perfil !== 'object') return;
        setEsPrincipal(perfil.es_principal === true);
        if (perfil.id != null) setMiId(perfil.id);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [abierto]);

  // Facilitadores activos, para los selectores "Crear para…" y "Asignar a…" (solo si es principal).
  useEffect(() => {
    if (!abierto || !esPrincipal) return undefined;
    let cancelado = false;
    setCargandoFacilitadores(true);
    setErrorFacilitadores(null);
    listarUsuarios()
      .then((usuarios) => {
        if (cancelado) return;
        setListaFacilitadores(
          (Array.isArray(usuarios) ? usuarios : []).filter((u) => u.rol === 'facilitador' && u.activo !== false)
        );
      })
      .catch((err) => {
        if (!cancelado) setErrorFacilitadores(err.message || 'No se pudo cargar la lista de facilitadores.');
      })
      .finally(() => {
        if (!cancelado) setCargandoFacilitadores(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, esPrincipal, recargaFacilitadores]);

  const facilitadores = {
    lista: listaFacilitadores,
    cargando: cargandoFacilitadores,
    error: errorFacilitadores,
    recargar: () => setRecargaFacilitadores((n) => n + 1),
  };
  const otrosFacilitadores = (listaFacilitadores ?? []).filter((f) => f.id !== miId);
  // Si el principal crea el curso a nombre de otro, "el de mi perfil" sería mentira: hereda el del perfil de ese facilitador.
  const etiquetaHeredarTonoNuevo = esPrincipal && crearPara !== '' ? 'El del perfil del facilitador' : 'El de mi perfil';
  // Lo que se le dice al principal junto al selector "Crear para…" cuando no hay a quién elegir todavía.
  const ayudaCrearPara =
    !esPrincipal || errorFacilitadores
      ? ''
      : listaFacilitadores === null
        ? 'Cargando facilitadores…'
        : otrosFacilitadores.length === 0
          ? 'No hay otros facilitadores activos: los cursos se crean a tu nombre.'
          : '';

  function alternarVerTodos() {
    setCursos(null); // para no mostrar la lista del otro modo mientras llega la nueva
    setAviso(null);
    setVerTodos((v) => !v);
  }

  // Sube con cada cambio que hace el usuario acá (crear, editar, borrar, asignar): un sondeo que arrancó antes de
  // ese cambio y llega después tiene datos viejos, así que se descarta en vez de pisarlo.
  const versionLocalRef = useRef(0);

  // Estables entre renders: las tarjetas los pasan como dependencia de efectos.
  const cambiarCurso = useCallback((cursoId, cambios) => {
    versionLocalRef.current += 1;
    setCursos((lista) => (lista ?? []).map((c) => (c.id === cursoId ? { ...c, ...cambios } : c)));
  }, []);

  // El número de estudiantes que informa la lista desplegada de un curso: no es un cambio del usuario.
  const sincronizarCantidad = useCallback((cursoId, cantidad) => {
    setCursos((lista) => {
      const actual = lista?.find((c) => c.id === cursoId);
      if (!actual || actual.estudiantes === cantidad) return lista;
      return lista.map((c) => (c.id === cursoId ? { ...c, estudiantes: cantidad } : c));
    });
  }, []);

  const quitarCurso = useCallback((curso) => {
    versionLocalRef.current += 1;
    setCursos((lista) => (lista ?? []).filter((c) => c.id !== curso.id));
    setAviso(`Eliminaste el curso «${curso.nombre}». Sus estudiantes quedaron sin curso.`);
  }, []);

  // Contadores en vivo: mientras el panel está abierto y la pestaña visible, la lista de cursos se vuelve a pedir
  // cada ~8 s y se fusiona por id con lo que hay en pantalla (sin spinner ni tocar nada de lo que el usuario esté
  // haciendo: cursos desplegados, selectores, confirmaciones, textos a medio escribir). Respeta "ver todos".
  useSondeoSilencioso(
    abierto && cursos !== null,
    async (vigente) => {
      const version = versionLocalRef.current;
      const lista = await listarCursos(pedirTodos);
      if (!vigente() || version !== versionLocalRef.current) return;
      setCursos((previos) => (previos === null ? previos : fusionarPorId(previos, lista)));
    },
    pedirTodos
  );

  async function crear(evento) {
    evento.preventDefault();
    const nombre = nombreNuevo.trim();
    if (nombre.length < NOMBRE_MIN) {
      setErrorCrear(`El nombre tiene que tener al menos ${NOMBRE_MIN} caracteres.`);
      return;
    }
    const cupo = leerCupo(cupoNuevo);
    if (cupo === null) {
      setErrorCrear(MENSAJE_CUPO_INVALIDO);
      return;
    }
    setCreando(true);
    setErrorCrear(null);
    setAviso(null);
    try {
      const paraOtro = esPrincipal && crearPara !== '';
      versionLocalRef.current += 1;
      const creado = await crearCurso(nombre, paraOtro ? Number(crearPara) : null, cupo, tonoNuevo || null);
      versionLocalRef.current += 1;
      // Un curso creado a nombre de otro facilitador no es de "mis cursos": solo se agrega si se ven todos.
      if (!paraOtro || pedirTodos) setCursos((lista) => [...(lista ?? []), creado]);
      setNombreNuevo('');
      setAviso(
        paraOtro
          ? `Creaste «${creado.nombre}» a nombre de ${creado.facilitador_nombre}. Su código es ${creado.codigo}.`
          : `Creaste «${creado.nombre}». Compartí el código ${creado.codigo} con tus estudiantes.`
      );
    } catch (err) {
      setErrorCrear(err.message || 'No se pudo crear el curso.');
    } finally {
      setCreando(false);
    }
  }

  // Un curso pasó a otro facilitador: se avisa y se vuelve a pedir la lista (si se ven solo los propios, el curso
  // deja de estar en ella).
  const cursoReasignado = useCallback(
    (actualizado) => {
      versionLocalRef.current += 1;
      setAviso(
        `«${actualizado.nombre}» ahora es de ${actualizado.facilitador_nombre}. Sus estudiantes siguen en el curso y ` +
          'ven los videos y el tono del nuevo facilitador.'
      );
      cargar();
    },
    [cargar]
  );

  return (
    <section className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="panel-cursos-contenido"
        className="flex items-center justify-between gap-space-sm text-left min-h-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-lg"
      >
        <span className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[22px] text-primary shrink-0" aria-hidden="true">
            groups
          </span>
          <span className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface">Mis cursos</span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Armá grupos y dales un código para que tus estudiantes entren.
            </span>
          </span>
        </span>
        <span className="material-symbols-outlined text-[22px] text-on-surface-variant shrink-0" aria-hidden="true">
          {abierto ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {abierto && (
        <div id="panel-cursos-contenido" className="flex flex-col gap-space-md pt-space-xs border-t border-outline-variant/20">
          {/* Solo facilitador principal: ver los cursos de todos los facilitadores */}
          {esPrincipal && (
            <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container border border-outline-variant/30">
              <button
                type="button"
                role="switch"
                aria-checked={verTodos}
                onClick={alternarVerTodos}
                className="flex items-center gap-space-xs min-h-10 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
                    verTodos ? 'bg-primary-container' : 'bg-surface-bright'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${
                      verTodos ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-outline'
                    }`}
                  />
                </span>
                <span className="font-body-sm text-body-sm text-on-surface min-w-0">
                  Ver los cursos de todos los facilitadores
                </span>
                <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant shrink-0">
                  {verTodos ? 'Sí' : 'No'}
                </span>
              </button>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                Sos facilitador principal: podés ver y gestionar los cursos de cualquier facilitador, crearlos a su
                nombre y asignárselos.
              </p>
              {errorFacilitadores && (
                <div className="flex flex-col gap-space-xs">
                  <AvisoError mensaje={errorFacilitadores} />
                  <button type="button" onClick={facilitadores.recargar} className={`${BOTON_NEUTRO} self-start`}>
                    <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                      refresh
                    </span>
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={crear} noValidate className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-space-xs">
            <div className="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-56">
              <label
                htmlFor="curso-nombre-nuevo"
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Nombre del curso nuevo
              </label>
              <input
                id="curso-nombre-nuevo"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                maxLength={NOMBRE_MAX}
                placeholder="Ej.: Ajedrez 2do año B"
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-36 min-w-0">
              <label
                htmlFor="curso-cupo-nuevo"
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Cupo de alumnos
              </label>
              <input
                id="curso-cupo-nuevo"
                type="number"
                inputMode="numeric"
                min={CUPO_MIN}
                max={CUPO_MAX}
                step={1}
                value={cupoNuevo}
                onChange={(e) => setCupoNuevo(e.target.value)}
                aria-describedby="curso-cupo-nuevo-ayuda"
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-52 min-w-0">
              <label
                htmlFor="curso-tono-nuevo"
                className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
              >
                Tono de Turing en este curso
              </label>
              <select
                id="curso-tono-nuevo"
                value={tonoNuevo}
                onChange={(e) => setTonoNuevo(e.target.value)}
                aria-describedby="curso-tono-nuevo-ayuda"
                className={CLASE_INPUT}
              >
                <OpcionesTono etiquetaHeredar={etiquetaHeredarTonoNuevo} />
              </select>
            </div>
            {esPrincipal && (
              <div className="flex flex-col gap-1 sm:w-64 min-w-0">
                <label
                  htmlFor="curso-crear-para"
                  className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant"
                >
                  Crear para…
                </label>
                <select
                  id="curso-crear-para"
                  value={crearPara}
                  onChange={(e) => setCrearPara(e.target.value)}
                  disabled={cargandoFacilitadores && listaFacilitadores === null}
                  aria-describedby="curso-crear-para-ayuda"
                  className={CLASE_INPUT}
                >
                  <option value="">Para mí</option>
                  {otrosFacilitadores.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {etiquetaFacilitador(f)}
                    </option>
                  ))}
                </select>
                <span id="curso-crear-para-ayuda" className="sr-only">
                  Por defecto el curso se crea a tu nombre; podés elegir otro facilitador activo.
                </span>
              </div>
            )}
            <button type="submit" disabled={creando} className={`${BOTON_PRINCIPAL} px-space-md`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add
              </span>
              {creando ? 'Creando…' : 'Crear curso'}
            </button>
          </form>

          <div className="flex flex-col gap-space-2xs -mt-2">
            <p id="curso-cupo-nuevo-ayuda" className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
              {AYUDA_CUPO}
            </p>
            <p id="curso-tono-nuevo-ayuda" className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
              {AYUDA_TONO}
            </p>
          </div>

          {ayudaCrearPara && (
            <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant" role="status">
              {ayudaCrearPara}
            </p>
          )}

          {errorCrear && <AvisoError mensaje={errorCrear} />}
          {aviso && (
            <div
              role="status"
              className="flex items-start justify-between gap-space-sm px-space-sm py-space-xs rounded-lg bg-primary/10 border border-primary/30 text-on-surface font-body-sm text-body-sm"
            >
              <span className="flex items-start gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
                  check_circle
                </span>
                <span className="min-w-0 break-words">{aviso}</span>
              </span>
              <button
                type="button"
                onClick={() => setAviso(null)}
                aria-label="Cerrar aviso"
                className="shrink-0 min-w-9 min-h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          )}

          {errorLista && (
            <div className="flex flex-col gap-space-xs">
              <AvisoError mensaje={errorLista} />
              <button type="button" onClick={cargar} disabled={cargando} className={`${BOTON_NEUTRO} self-start`}>
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  refresh
                </span>
                Reintentar
              </button>
            </div>
          )}

          {cargando && cursos === null ? (
            <Cargando texto={pedirTodos ? 'Cargando los cursos de todos…' : 'Cargando tus cursos…'} />
          ) : cursos && cursos.length === 0 ? (
            <p className="m-0 font-body-sm text-body-sm text-outline">
              {pedirTodos
                ? 'Todavía no hay cursos creados por ningún facilitador.'
                : 'Todavía no creaste ningún curso. Creá uno y compartí su código con tus estudiantes.'}
            </p>
          ) : (
            cursos && (
              <ul className="m-0 p-0 list-none grid grid-cols-1 lg:grid-cols-2 items-start gap-space-sm">
                {cursos.map((curso) => (
                  <TarjetaCurso
                    key={curso.id}
                    curso={curso}
                    alCambiar={cambiarCurso}
                    alSincronizarCantidad={sincronizarCantidad}
                    alEliminar={quitarCurso}
                    alReasignado={cursoReasignado}
                    esPrincipal={esPrincipal}
                    mostrarDueno={pedirTodos}
                    miId={miId}
                    facilitadores={esPrincipal ? facilitadores : null}
                  />
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </section>
  );
}
