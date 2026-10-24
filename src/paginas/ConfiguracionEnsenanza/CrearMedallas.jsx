import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  crearMedallaPropia,
  editarMedallaPropia,
  leerArchivoSugerido,
  listarMisMedallas,
  obtenerOpcionesMedallas,
  quitarImagenMedalla,
  subirImagenMedalla,
} from '../../api/backend';
import { validarImagenMedalla } from '../../medallas';
import BocetoMedalla from './BocetoMedalla';
import { AvisoError, BotonReintentar, CajaInfo, Cargando } from './ComunesMedallas';
import FormularioMedalla from './FormularioMedalla';
import IdeasMedallas from './IdeasMedallas';
import ListaMisMedallas from './ListaMisMedallas';
import VistaPreviaMedalla from './VistaPreviaMedalla';
import {
  FORMULARIO_VACIO,
  REGLA_MANUAL,
  cuerpoDeMedalla,
  formularioDesdeIdea,
  formularioDesdeMedalla,
  metaAlCambiarRegla,
  normalizarOpciones,
  reglaPorCodigo,
  rutaImagenIdea,
  validarFormulario,
} from './medallasPropias';
import { useImagenCargable } from './useImagenCargable';

/**
 * "Crear medallas propias": pantalla de un facilitador para diseñar sus medallas (figuritas) con vista previa en vivo.
 * Arriba, ideas listas para usar; en el medio el formulario (a la izquierda) y, fija a la derecha, la vista previa con el
 * boceto guía de qué va en cada campo (en celular la vista previa va arriba del formulario); abajo, la lista de "Mis medallas"
 * con Editar, Entregar (las manuales) y Borrar.
 *
 * Este componente tiene el estado y habla con el backend (siempre por `api/backend.js`); los demás solo dibujan. Pide las
 * opciones y la lista una vez al montarse. El escudo (forma, color y brillo según el nivel) lo pone `MedallaFigurita`: lo
 * único que diseña el facilitador es el nivel, el nombre, la regla y la ilustración del centro.
 *
 * Crear: valida en el cliente, `POST /medallas` y, si hay ilustración elegida, `POST /facilitador/medallas/{codigo}/imagen`.
 * Si la imagen falla pero la medalla se creó, se avisa y el formulario se limpia igual, así un reintento no la duplica
 * (la imagen se sube después desde la lista, con Editar).
 *
 * Ilustración sugerida: al elegir una idea, si existe su ilustración (`public/ideas-medallas/<nombre>.png`) queda elegida
 * sola y se ve en la vista previa. Si el facilitador sube la suya, esa pisa a la sugerida; también puede descartarla. Al
 * crear, la sugerida se sube como cualquier otra imagen, así la medalla nace con su ilustración.
 *
 * El diseño usa el ancho de esta tarjeta (`@container`) y no el de la pantalla: con el menú lateral abierto la tarjeta es
 * 256 px más angosta que la ventana. Dos columnas desde 56 rem (896 px) de tarjeta.
 */
export default function CrearMedallas({ esPrincipal }) {
  const [datosOpciones, setDatosOpciones] = useState(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);
  const [errorOpciones, setErrorOpciones] = useState(null);

  const [medallas, setMedallas] = useState(null);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState(null);
  const [avisoLista, setAvisoLista] = useState(null);

  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [ideaElegida, setIdeaElegida] = useState(null);
  const [medallaEditada, setMedallaEditada] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [urlLocal, setUrlLocal] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [quitarImagenActual, setQuitarImagenActual] = useState(false);
  const [usarSugerida, setUsarSugerida] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [aviso, setAviso] = useState(null);

  const enviandoRef = useRef(false);
  const pedidoInicialRef = useRef(false);
  const refNombre = useRef(null);
  const refZonaFormulario = useRef(null);

  const opciones = useMemo(() => normalizarOpciones(datosOpciones), [datosOpciones]);

  const cargarOpciones = useCallback(async () => {
    setCargandoOpciones(true);
    setErrorOpciones(null);
    try {
      setDatosOpciones(await obtenerOpcionesMedallas());
    } catch (err) {
      setErrorOpciones(err?.message || 'No se pudieron cargar las opciones para crear medallas.');
    } finally {
      setCargandoOpciones(false);
    }
  }, []);

  /** `mostrarCarga` solo en la primera carga y al reintentar: al refrescar después de una acción no se tapa la lista. */
  const cargarLista = useCallback(async (mostrarCarga) => {
    if (mostrarCarga) setCargandoLista(true);
    setErrorLista(null);
    try {
      const lista = await listarMisMedallas();
      setMedallas(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setErrorLista(err?.message || 'No se pudieron cargar tus medallas.');
    } finally {
      setCargandoLista(false);
    }
  }, []);

  // Una vez cada una al montar (la guarda evita el segundo pedido que hace React en desarrollo).
  useEffect(() => {
    if (pedidoInicialRef.current) return;
    pedidoInicialRef.current = true;
    cargarOpciones();
    cargarLista(true);
  }, [cargarOpciones, cargarLista]);

  // URL local del archivo elegido para la vista previa; se libera al cambiar de archivo y al desmontar.
  useEffect(() => {
    if (!archivo) {
      setUrlLocal(null);
      return undefined;
    }
    const url = URL.createObjectURL(archivo);
    setUrlLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const editando = medallaEditada !== null;
  // Ilustración sugerida de la idea elegida (solo al crear, y solo si el archivo existe). Un archivo propio la pisa.
  const imagenSugerida = useImagenCargable(!editando && ideaElegida ? rutaImagenIdea(ideaElegida) : null);
  const sugerenciaEnUso = imagenSugerida !== null && usarSugerida && archivo === null;
  // Lo que se ve en el centro del escudo: el archivo elegido, si no la sugerida, si no la imagen ya guardada (salvo que se vaya a quitar).
  const imagenDeVistaPrevia =
    urlLocal ?? (sugerenciaEnUso ? imagenSugerida : null) ?? (quitarImagenActual ? null : (medallaEditada?.imagen_url ?? null));

  let textoAlcance = 'La ven los jugadores de tus cursos';
  if (editando) {
    if (medallaEditada.general) textoAlcance = 'La ven todos los jugadores';
    else if (!medallaEditada.es_mia) textoAlcance = 'La ven los jugadores de los cursos de quien la creó';
  } else if (esPrincipal && formulario.general) {
    textoAlcance = 'La ven todos los jugadores';
  }

  function cambiarCampo(campo, valor) {
    setErrorEnvio(null);
    setAviso(null);
    setFormulario((actual) => {
      const siguiente = { ...actual, [campo]: valor };
      if (campo === 'regla') {
        siguiente.meta = valor === '' ? '' : metaAlCambiarRegla(actual.meta, reglaPorCodigo(opciones.reglas, valor));
      }
      return siguiente;
    });
  }

  function usarIdea(idea) {
    if (editando) return;
    setFormulario((actual) => formularioDesdeIdea(idea, actual.general));
    setIdeaElegida(idea.nombre);
    setUsarSugerida(true);
    setErrorEnvio(null);
    setAviso(null);
  }

  function elegirArchivo(elegido) {
    const problema = validarImagenMedalla(elegido);
    if (problema) {
      setErrorArchivo(problema);
      return;
    }
    setErrorArchivo(null);
    setArchivo(elegido);
    setQuitarImagenActual(false);
    setErrorEnvio(null);
    setAviso(null);
  }

  function quitarArchivo() {
    setArchivo(null);
    setErrorArchivo(null);
  }

  /** Vuelve el formulario al estado de "medalla nueva": vacío, sin archivo y fuera del modo edición. */
  function reiniciarFormulario() {
    setFormulario(FORMULARIO_VACIO);
    setMedallaEditada(null);
    setIdeaElegida(null);
    setUsarSugerida(true);
    setArchivo(null);
    setErrorArchivo(null);
    setQuitarImagenActual(false);
    setErrorEnvio(null);
  }

  function llevarAlFormulario() {
    const zona = refZonaFormulario.current;
    if (zona) {
      const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      zona.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
    }
    refNombre.current?.focus({ preventScroll: true });
  }

  function iniciarEdicion(medalla) {
    reiniciarFormulario();
    setMedallaEditada(medalla);
    setFormulario(formularioDesdeMedalla(medalla));
    setAviso(null);
    setAvisoLista(null);
    requestAnimationFrame(llevarAlFormulario);
  }

  function cancelarEdicion() {
    reiniciarFormulario();
    setAviso(null);
  }

  async function crearMedalla() {
    const cuerpo = { ...cuerpoDeMedalla(formulario, opciones.reglas), general: esPrincipal && formulario.general };
    let creada;
    try {
      creada = await crearMedallaPropia(cuerpo);
    } catch (err) {
      setErrorEnvio(err?.message || 'No se pudo crear la medalla.');
      return;
    }
    // Desde acá la medalla existe: lo que pase con la imagen no la vuelve a crear.
    const nombre = creada?.nombre ?? cuerpo.nombre;
    let falloImagen = null;
    let imagenASubir = archivo;
    if (imagenASubir === null && sugerenciaEnUso && creada?.codigo) {
      try {
        imagenASubir = await leerArchivoSugerido(imagenSugerida, imagenSugerida.split('/').pop());
      } catch (err) {
        falloImagen = err?.message || 'error desconocido';
      }
    }
    if (imagenASubir && creada?.codigo) {
      try {
        await subirImagenMedalla(creada.codigo, imagenASubir);
      } catch (err) {
        falloImagen = err?.message || 'error desconocido';
      }
    }
    reiniciarFormulario();
    if (falloImagen) {
      setAviso({
        tipo: 'atencion',
        texto: `La medalla «${nombre}» se creó, pero la imagen no se pudo subir: ${falloImagen}. Podés subirla desde la lista, con Editar.`,
      });
    } else {
      const cierre =
        cuerpo.regla === REGLA_MANUAL
          ? 'Es manual: entregala desde «Mis medallas», más abajo.'
          : cuerpo.general
            ? 'La ven todos los jugadores.'
            : 'La ven los jugadores de tus cursos.';
      setAviso({ tipo: 'ok', texto: `Listo, creaste «${nombre}». ${cierre}` });
    }
    await cargarLista(false);
  }

  async function guardarCambios() {
    const editada = medallaEditada;
    const cuerpo = cuerpoDeMedalla(formulario, opciones.reglas);
    try {
      await editarMedallaPropia(editada.codigo, cuerpo);
    } catch (err) {
      setErrorEnvio(err?.message || 'No se pudieron guardar los cambios.');
      if (err?.status === 404) cargarLista(false); // la borraron desde otro lado: se pone la lista al día
      return;
    }
    let falloImagen = null;
    let accionImagen = 'subir';
    try {
      if (archivo) {
        await subirImagenMedalla(editada.codigo, archivo);
      } else if (quitarImagenActual && editada.imagen_url) {
        accionImagen = 'quitar';
        await quitarImagenMedalla(editada.codigo);
      }
    } catch (err) {
      // 404 al quitar = ya no tenía imagen: el resultado buscado igual se cumplió.
      if (!(accionImagen === 'quitar' && err?.status === 404)) falloImagen = err?.message || 'error desconocido';
    }
    reiniciarFormulario();
    if (falloImagen) {
      setAviso({
        tipo: 'atencion',
        texto: `Los cambios de «${cuerpo.nombre}» se guardaron, pero la imagen no se pudo ${accionImagen}: ${falloImagen}. Podés volver a intentarlo con Editar.`,
      });
    } else {
      setAviso({ tipo: 'ok', texto: `Listo, guardamos los cambios de «${cuerpo.nombre}».` });
    }
    await cargarLista(false);
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviandoRef.current) return;
    const problema = validarFormulario(formulario, opciones);
    if (problema) {
      setErrorEnvio(problema);
      setAviso(null);
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setErrorEnvio(null);
    setAviso(null);
    setAvisoLista(null);
    try {
      if (editando) await guardarCambios();
      else await crearMedalla();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  function medallaBorrada(medalla) {
    setMedallas((actual) => (actual ?? []).filter((otra) => otra.codigo !== medalla.codigo));
    if (medallaEditada?.codigo === medalla.codigo) reiniciarFormulario();
    setAvisoLista(`Borraste «${medalla.nombre}».`);
    cargarLista(false);
  }

  return (
    <section
      aria-labelledby="titulo-crear-medallas"
      className="@container flex flex-col gap-space-lg bg-surface-container-low p-space-md sm:p-space-lg rounded-xl shadow-md min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            workspace_premium
          </span>
          <h2 id="titulo-crear-medallas" className="m-0 font-headline-sm text-headline-sm text-on-surface">
            Crear medallas propias
          </h2>
        </div>
        <span className="flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-mono-micro text-mono-micro uppercase tracking-wide">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            groups
          </span>
          {esPrincipal ? 'Generales o de tus cursos' : 'Las ven los jugadores de tus cursos'}
        </span>
      </div>

      <CajaInfo>
        Diseñá medallas para premiar a tus jugadores. El escudo (forma, color y brillo) lo pone el sistema según el nivel:
        vos elegís el nivel, el nombre, cómo se gana y, si querés, la ilustración del centro. Máximo 30 medallas por
        facilitador.
      </CajaInfo>

      {cargandoOpciones && <Cargando texto="Preparando el formulario…" />}
      {errorOpciones && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={errorOpciones} />
          <BotonReintentar alTocar={cargarOpciones} deshabilitado={cargandoOpciones} />
        </div>
      )}

      {datosOpciones && (
        <>
          <IdeasMedallas
            ideas={opciones.plantillas}
            alElegir={usarIdea}
            ideaElegida={ideaElegida}
            deshabilitado={editando}
          />

          <div
            ref={refZonaFormulario}
            className="scroll-mt-20 grid grid-cols-1 items-start gap-space-md @4xl:grid-cols-[minmax(0,1fr)_22rem] @6xl:grid-cols-[minmax(0,1fr)_26rem] @4xl:gap-space-lg"
          >
            {/* Vista previa y boceto: arriba del formulario en una columna; fijos a la derecha con dos columnas. */}
            <div className="flex flex-col gap-space-sm min-w-0 @4xl:col-start-2 @4xl:row-start-1 @4xl:sticky @4xl:top-20 @4xl:max-h-[calc(100dvh_-_6rem)] @4xl:overflow-y-auto @4xl:overscroll-contain">
              <VistaPreviaMedalla
                formulario={formulario}
                opciones={opciones}
                imagenUrl={imagenDeVistaPrevia}
                textoAlcance={textoAlcance}
              />
              <BocetoMedalla largoNombre={opciones.largoNombre} largoDescripcion={opciones.largoDescripcion} />
            </div>

            <div className="min-w-0 @4xl:col-start-1 @4xl:row-start-1">
              <FormularioMedalla
                formulario={formulario}
                opciones={opciones}
                esPrincipal={esPrincipal}
                medallaEditada={medallaEditada}
                archivo={archivo}
                errorArchivo={errorArchivo}
                quitarImagenActual={quitarImagenActual}
                sugerida={!editando && imagenSugerida ? { url: imagenSugerida, idea: ideaElegida } : null}
                usarSugerida={usarSugerida}
                alUsarSugerida={setUsarSugerida}
                enviando={enviando}
                errorEnvio={errorEnvio}
                aviso={aviso}
                alCambiar={cambiarCampo}
                alElegirArchivo={elegirArchivo}
                alQuitarArchivo={quitarArchivo}
                alMarcarQuitarActual={setQuitarImagenActual}
                alEnviar={enviar}
                alCancelar={cancelarEdicion}
                refNombre={refNombre}
              />
            </div>
          </div>
        </>
      )}

      <ListaMisMedallas
        medallas={medallas}
        cargando={cargandoLista}
        error={errorLista}
        aviso={avisoLista}
        alReintentar={() => cargarLista(true)}
        reglas={opciones.reglas}
        esPrincipal={esPrincipal}
        codigoEditando={medallaEditada?.codigo ?? null}
        alEditar={iniciarEdicion}
        alBorrada={medallaBorrada}
        alEntregada={() => cargarLista(false)}
      />
    </section>
  );
}
