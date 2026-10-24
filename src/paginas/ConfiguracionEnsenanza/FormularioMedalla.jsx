import MedallaFigurita from '../../componentes/MedallaFigurita';
import { rutaImagenPieza } from '../../ajedrez';
import { etiquetaNivel, etiquetaPieza, TIPOS_IMAGEN_MEDALLA } from '../../medallas';
import AyudaIlustracion from './AyudaIlustracion';
import {
  AvisoError,
  AvisoListo,
  BOTON_PELIGRO,
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CLASE_AYUDA,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  Giro,
  GIRO_SOBRE_PRINCIPAL,
  NumeroCampo,
} from './ComunesMedallas';
import { LETRA_DE_PIEZA, largoDe, limitesDeMeta, pesoLegible, reglaPorCodigo, tipoDeRegla } from './medallasPropias';

const TARJETA_OPCION =
  'flex flex-col items-center justify-center gap-space-2xs p-space-xs rounded-xl border-2 text-center transition-colors motion-reduce:transition-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50';

function estiloOpcion(seleccionada) {
  return seleccionada
    ? 'bg-primary/10 border-primary'
    : 'bg-surface-container-lowest border-outline-variant/30 hover:bg-surface-container';
}

/** Etiqueta de un campo: su número (el del boceto), el nombre y, a la derecha, un contador de letras si lo hay. */
function EtiquetaCampo({ numero, htmlFor, texto, detalle = null, contador = null }) {
  return (
    <div className="flex items-center justify-between gap-space-xs">
      <label htmlFor={htmlFor} className={`flex items-center gap-space-xs ${CLASE_ETIQUETA}`}>
        {numero && <NumeroCampo numero={numero} />}
        <span>{texto}</span>
        {detalle && <span className="normal-case tracking-normal text-outline">{detalle}</span>}
      </label>
      {contador}
    </div>
  );
}

/** "12 / 30": cuántas letras lleva el campo sobre el máximo. El mínimo se revisa al enviar. */
function Contador({ actual, maximo }) {
  return (
    <span className={CLASE_AYUDA} aria-hidden="true">
      {actual} / {maximo}
    </span>
  );
}

/** 1. Nivel: cuatro botones con su mini escudo. La elegida lleva borde, fondo y un ícono distinto (no solo color). */
function CampoNivel({ formulario, niveles, alCambiar }) {
  return (
    <div className="flex flex-col gap-space-xs" role="radiogroup" aria-labelledby="medalla-nivel-etiqueta">
      <span id="medalla-nivel-etiqueta" className={`flex items-center gap-space-xs ${CLASE_ETIQUETA}`}>
        <NumeroCampo numero={1} />
        Nivel
      </span>
      <div className="grid grid-cols-2 @lg:grid-cols-4 gap-space-xs">
        {niveles.map((nivel) => {
          const seleccionado = formulario.nivel === nivel;
          return (
            <label key={nivel} className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="medalla-nivel"
                value={nivel}
                checked={seleccionado}
                onChange={() => alCambiar('nivel', nivel)}
                className="peer sr-only"
              />
              <span className={`${TARJETA_OPCION} min-h-24 ${estiloOpcion(seleccionado)}`}>
                <MedallaFigurita
                  medalla={{ codigo: nivel, nombre: etiquetaNivel(nivel), nivel, pieza: formulario.pieza }}
                  tamano="sm"
                  vistaPrevia
                  decorativa
                />
                <span className="flex items-center gap-1 font-body-sm text-body-sm font-medium text-on-surface">
                  <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                    {seleccionado ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  {etiquetaNivel(nivel)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className={CLASE_AYUDA}>El color y el brillo del escudo se aplican solos según el nivel.</p>
    </div>
  );
}

/**
 * La ilustración sugerida de la idea elegida: se ve en grande, se usa sola al crear la medalla y se puede descartar. Si el
 * facilitador sube la suya (`archivo`), esa manda y la sugerida queda a un toque de volver.
 */
function IlustracionSugerida({ sugerida, archivo, usarSugerida, alUsarSugerida }) {
  let texto = 'Se usa al crear la medalla. Si querés otra, tocá «Subir imagen».';
  if (archivo) texto = 'Vas a usar la que elegiste vos. Si la quitás, vuelve esta.';
  else if (!usarSugerida) texto = 'No se va a usar: la medalla se crea sin ilustración (se ve la silueta de la pieza).';

  return (
    <div className="flex items-center gap-space-sm p-space-sm rounded-xl border border-primary/40 bg-primary/5 min-w-0">
      <img
        src={sugerida.url}
        alt=""
        className="w-16 h-16 shrink-0 rounded-lg bg-surface-container-high object-contain"
        draggable="false"
      />
      <div className="flex flex-col items-start gap-space-2xs min-w-0 flex-1">
        <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">
          Ilustración sugerida para «{sugerida.idea}»
        </span>
        <span className={CLASE_AYUDA}>{texto}</span>
        {!archivo && (
          <button
            type="button"
            onClick={() => alUsarSugerida(!usarSugerida)}
            className={`${BOTON_SECUNDARIO} min-h-11`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {usarSugerida ? 'block' : 'check'}
            </span>
            {usarSugerida ? 'No usar esta' : 'Usar esta'}
          </button>
        )}
      </div>
    </div>
  );
}

/** 2. Ilustración: elegir, cambiar o quitar el archivo, con la validación del cliente y la ayuda para hacerla. */
function CampoIlustracion({
  archivo,
  errorArchivo,
  imagenActual,
  quitarImagenActual,
  editando,
  sugerida,
  usarSugerida,
  alUsarSugerida,
  alElegirArchivo,
  alQuitarArchivo,
  alMarcarQuitarActual,
}) {
  function manejarSeleccion(evento) {
    const elegido = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo después
    if (elegido) alElegirArchivo(elegido);
  }

  const tieneActual = editando && Boolean(imagenActual);
  let textoBoton = 'Subir imagen';
  if (archivo) textoBoton = 'Elegir otra imagen';
  else if (tieneActual && !quitarImagenActual) textoBoton = 'Reemplazar imagen';

  let estado = null;
  if (archivo) {
    estado = `Elegida: ${archivo.name} (${pesoLegible(archivo.size)}). Se sube al ${editando ? 'guardar los cambios' : 'crear la medalla'}.`;
  } else if (quitarImagenActual) {
    estado = 'La ilustración actual se quita al guardar los cambios: va a volver la silueta de la pieza.';
  } else if (tieneActual) {
    estado = 'Esta medalla ya tiene una ilustración subida.';
  } else if (editando) {
    estado = 'Todavía no tiene ilustración: se ve la silueta de la pieza.';
  }

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center gap-space-xs">
        <span id="medalla-imagen-etiqueta" className={`flex items-center gap-space-xs ${CLASE_ETIQUETA}`}>
          <NumeroCampo numero={2} />
          Ilustración
          <span className="normal-case tracking-normal text-outline">(opcional)</span>
        </span>
      </div>
      <p id="medalla-imagen-ayuda" className={CLASE_AYUDA}>
        Tu dibujo va en el centro del escudo y es lo único que diseñás vos. Sin ilustración se ve la silueta de la pieza.
      </p>

      {sugerida && (
        <IlustracionSugerida
          sugerida={sugerida}
          archivo={archivo}
          usarSugerida={usarSugerida}
          alUsarSugerida={alUsarSugerida}
        />
      )}

      <div className="flex flex-wrap gap-space-xs">
        <label
          className={`${BOTON_SECUNDARIO} relative cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary has-disabled:opacity-50 has-disabled:pointer-events-none`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            upload
          </span>
          {textoBoton}
          <input
            type="file"
            accept={TIPOS_IMAGEN_MEDALLA.join(',')}
            className="sr-only"
            onChange={manejarSeleccion}
            aria-describedby="medalla-imagen-ayuda"
          />
        </label>
        {archivo && (
          <button type="button" onClick={alQuitarArchivo} className={BOTON_PELIGRO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
            Quitar la elegida
          </button>
        )}
        {!archivo && tieneActual && !quitarImagenActual && (
          <button type="button" onClick={() => alMarcarQuitarActual(true)} className={BOTON_PELIGRO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              delete
            </span>
            Quitar imagen
          </button>
        )}
        {!archivo && quitarImagenActual && (
          <button type="button" onClick={() => alMarcarQuitarActual(false)} className={BOTON_SECUNDARIO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              undo
            </span>
            Deshacer
          </button>
        )}
      </div>

      {estado && <p className={`${CLASE_AYUDA} break-all`}>{estado}</p>}
      {errorArchivo && <AvisoError mensaje={errorArchivo} />}

      <AyudaIlustracion />
    </div>
  );
}

/** 3. Nombre: una línea, con contador y ejemplo. */
function CampoNombre({ formulario, largoNombre, alCambiar, refNombre }) {
  return (
    <div className="flex flex-col gap-1">
      <EtiquetaCampo
        numero={3}
        htmlFor="medalla-nombre"
        texto="Nombre"
        contador={<Contador actual={largoDe(formulario.nombre)} maximo={largoNombre[1]} />}
      />
      <input
        id="medalla-nombre"
        ref={refNombre}
        value={formulario.nombre}
        onChange={(evento) => alCambiar('nombre', evento.target.value)}
        maxLength={largoNombre[1]}
        autoComplete="off"
        placeholder="Ej.: Racha de Fuego"
        aria-describedby="medalla-nombre-ayuda"
        className={CLASE_INPUT}
      />
      <p id="medalla-nombre-ayuda" className={CLASE_AYUDA}>
        Aparece debajo de la figurita. Entre {largoNombre[0]} y {largoNombre[1]} letras. Ej.: «Racha de Fuego».
      </p>
    </div>
  );
}

/** 4. Descripción: dos renglones, con contador y ejemplo. */
function CampoDescripcion({ formulario, largoDescripcion, alCambiar }) {
  return (
    <div className="flex flex-col gap-1">
      <EtiquetaCampo
        numero={4}
        htmlFor="medalla-descripcion"
        texto="Descripción"
        contador={<Contador actual={largoDe(formulario.descripcion)} maximo={largoDescripcion[1]} />}
      />
      <textarea
        id="medalla-descripcion"
        value={formulario.descripcion}
        onChange={(evento) => alCambiar('descripcion', evento.target.value)}
        maxLength={largoDescripcion[1]}
        rows={2}
        placeholder="Ej.: Ganá 3 partidas seguidas."
        aria-describedby="medalla-descripcion-ayuda"
        className={`${CLASE_INPUT} resize-y`}
      />
      <p id="medalla-descripcion-ayuda" className={CLASE_AYUDA}>
        Cuenta cómo se gana. Entre {largoDescripcion[0]} y {largoDescripcion[1]} letras. Ej.: «Ganá 3 partidas seguidas.».
      </p>
    </div>
  );
}

/** Pieza: seis botones con el dibujo de cada una. Se ve en la figurita mientras no haya ilustración. */
function CampoPieza({ formulario, piezas, alCambiar }) {
  return (
    <div className="flex flex-col gap-space-xs" role="radiogroup" aria-labelledby="medalla-pieza-etiqueta">
      <span id="medalla-pieza-etiqueta" className={CLASE_ETIQUETA}>
        Pieza
      </span>
      <div className="grid grid-cols-3 @lg:grid-cols-6 gap-space-xs">
        {piezas.map((pieza) => {
          const seleccionada = formulario.pieza === pieza;
          return (
            <label key={pieza} className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="medalla-pieza"
                value={pieza}
                checked={seleccionada}
                onChange={() => alCambiar('pieza', pieza)}
                className="peer sr-only"
              />
              <span className={`${TARJETA_OPCION} relative min-h-20 ${estiloOpcion(seleccionada)}`}>
                <span
                  className="material-symbols-outlined absolute top-1 right-1 text-[16px] text-primary"
                  aria-hidden="true"
                >
                  {seleccionada ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <img
                  src={rutaImagenPieza(LETRA_DE_PIEZA[pieza] ?? 'P')}
                  alt=""
                  className="w-8 h-8 shrink-0"
                  draggable="false"
                />
                <span className="font-body-sm text-body-sm text-on-surface">{etiquetaPieza(pieza)}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className={CLASE_AYUDA}>Se ve mientras no subas tu ilustración.</p>
    </div>
  );
}

/** Cómo se gana: la regla de la lista y, si es un contador, la cantidad (con sus límites y su unidad). */
function CampoComoSeGana({ formulario, reglas, alCambiar }) {
  const tipo = tipoDeRegla(reglas, formulario.regla);
  const regla = reglaPorCodigo(reglas, formulario.regla);
  const { minimo, maximo } = limitesDeMeta(regla);

  let ayuda = 'Elegí una condición de la lista. Si preferís entregarla vos, elegí «Manual».';
  if (tipo === 'contador') {
    ayuda = `Se gana al llegar a ${formulario.meta === '' ? 'la cantidad' : formulario.meta} ${regla.unidad ?? ''}`.trim();
    ayuda += `. Va de ${minimo} a ${maximo}.`;
  } else if (tipo === 'si_no') {
    ayuda = 'Se gana al cumplirlo una vez.';
  } else if (tipo === 'manual') {
    ayuda = 'Después de crearla, la entregás desde la lista de abajo a un curso o a jugadores.';
  }

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-col gap-1">
        <label htmlFor="medalla-regla" className={CLASE_ETIQUETA}>
          Cómo se gana
        </label>
        <select
          id="medalla-regla"
          value={formulario.regla}
          onChange={(evento) => alCambiar('regla', evento.target.value)}
          aria-describedby="medalla-regla-ayuda"
          className={CLASE_INPUT}
        >
          <option value="">Elegí cómo se gana…</option>
          {reglas.map((opcion) => (
            <option key={opcion.codigo} value={opcion.codigo}>
              {opcion.nombre}
            </option>
          ))}
        </select>
      </div>

      {tipo === 'contador' && (
        <div className="flex flex-col gap-1 @lg:max-w-xs">
          <label htmlFor="medalla-meta" className={CLASE_ETIQUETA}>
            Cantidad{regla.unidad ? ` (${regla.unidad})` : ''}
          </label>
          <input
            id="medalla-meta"
            type="number"
            inputMode="numeric"
            min={minimo}
            max={maximo}
            step={1}
            value={formulario.meta}
            onChange={(evento) => alCambiar('meta', evento.target.value)}
            aria-describedby="medalla-regla-ayuda"
            className={CLASE_INPUT}
          />
        </div>
      )}

      <p id="medalla-regla-ayuda" className={CLASE_AYUDA}>
        {ayuda}
      </p>
    </div>
  );
}

/** Quién la ve: el principal elige; el resto la ve en sus cursos. Al editar no se puede cambiar. */
function CampoAlcance({ formulario, esPrincipal, medallaEditada, alCambiar }) {
  if (medallaEditada) {
    return (
      <p className={`${CLASE_AYUDA} flex items-start gap-space-xs`}>
        <span className="material-symbols-outlined text-[16px] text-primary shrink-0" aria-hidden="true">
          groups
        </span>
        <span>
          {medallaEditada.general
            ? 'La ven todos los jugadores (general).'
            : 'La ven los jugadores de los cursos de quien la creó.'}{' '}
          Esto no se cambia al editar.
        </span>
      </p>
    );
  }
  if (!esPrincipal) {
    return (
      <p className={`${CLASE_AYUDA} flex items-start gap-space-xs`}>
        <span className="material-symbols-outlined text-[16px] text-primary shrink-0" aria-hidden="true">
          groups
        </span>
        <span>La verán los jugadores de tus cursos.</span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="medalla-alcance" className={CLASE_ETIQUETA}>
        Quién la ve
      </label>
      <select
        id="medalla-alcance"
        value={formulario.general ? 'general' : 'cursos'}
        onChange={(evento) => alCambiar('general', evento.target.value === 'general')}
        className={CLASE_INPUT}
      >
        <option value="general">Todos los jugadores (general)</option>
        <option value="cursos">Solo los jugadores de mis cursos</option>
      </select>
    </div>
  );
}

/**
 * Formulario para crear (o editar) una medalla propia. Es controlado: el estado, la validación y los pedidos al backend
 * viven en CrearMedallas.jsx; acá solo se dibujan los campos y se avisa qué cambió. Los campos 1 a 4 llevan el mismo número
 * que el boceto guía. Mientras se envía, todos los campos y botones se deshabilitan (`fieldset disabled`).
 *
 * Es su propio `@container`: las grillas de niveles y piezas se acomodan según el ancho del formulario, no el de la
 * pantalla.
 */
export default function FormularioMedalla({
  formulario,
  opciones,
  esPrincipal,
  medallaEditada,
  archivo,
  errorArchivo,
  quitarImagenActual,
  sugerida = null,
  usarSugerida = true,
  alUsarSugerida = () => {},
  enviando,
  errorEnvio,
  aviso,
  alCambiar,
  alElegirArchivo,
  alQuitarArchivo,
  alMarcarQuitarActual,
  alEnviar,
  alCancelar,
  refNombre,
}) {
  const editando = medallaEditada !== null;

  return (
    <form onSubmit={alEnviar} noValidate className="@container flex flex-col gap-space-md min-w-0">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
          {editando ? 'edit' : 'add_circle'}
        </span>
        <h3 className="m-0 font-headline-sm text-headline-sm text-on-surface">
          {editando ? 'Editar medalla' : 'Armá tu medalla'}
        </h3>
      </div>

      {editando && (
        <div
          role="status"
          className="flex items-start gap-space-xs p-space-sm rounded-xl bg-primary/10 border border-primary/40 font-body-sm text-body-sm text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            edit
          </span>
          <span className="min-w-0 break-words">
            Estás editando «{medallaEditada.nombre}». Los jugadores que ya la ganaron la conservan.
          </span>
        </div>
      )}

      <fieldset disabled={enviando} className="m-0 p-0 border-0 min-w-0 flex flex-col gap-space-md">
        <CampoNivel formulario={formulario} niveles={opciones.niveles} alCambiar={alCambiar} />
        <CampoIlustracion
          archivo={archivo}
          errorArchivo={errorArchivo}
          imagenActual={medallaEditada?.imagen_url ?? null}
          quitarImagenActual={quitarImagenActual}
          editando={editando}
          sugerida={sugerida}
          usarSugerida={usarSugerida}
          alUsarSugerida={alUsarSugerida}
          alElegirArchivo={alElegirArchivo}
          alQuitarArchivo={alQuitarArchivo}
          alMarcarQuitarActual={alMarcarQuitarActual}
        />
        <CampoNombre
          formulario={formulario}
          largoNombre={opciones.largoNombre}
          alCambiar={alCambiar}
          refNombre={refNombre}
        />
        <CampoDescripcion formulario={formulario} largoDescripcion={opciones.largoDescripcion} alCambiar={alCambiar} />
        <CampoPieza formulario={formulario} piezas={opciones.piezas} alCambiar={alCambiar} />
        <CampoComoSeGana formulario={formulario} reglas={opciones.reglas} alCambiar={alCambiar} />
        <CampoAlcance
          formulario={formulario}
          esPrincipal={esPrincipal}
          medallaEditada={medallaEditada}
          alCambiar={alCambiar}
        />

        <div className="flex flex-wrap gap-space-xs pt-space-xs">
          <button type="submit" className={`${BOTON_PRINCIPAL} grow @lg:grow-0`}>
            {enviando ? (
              <Giro colores={GIRO_SOBRE_PRINCIPAL} />
            ) : (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {editando ? 'save' : 'add'}
              </span>
            )}
            {enviando ? (editando ? 'Guardando…' : 'Creando…') : editando ? 'Guardar cambios' : 'Crear medalla'}
          </button>
          {editando && (
            <button type="button" onClick={alCancelar} className={`${BOTON_SECUNDARIO} grow @lg:grow-0`}>
              Cancelar
            </button>
          )}
        </div>
      </fieldset>

      {errorEnvio && <AvisoError mensaje={errorEnvio} />}
      {aviso && aviso.tipo === 'ok' && <AvisoListo mensaje={aviso.texto} />}
      {aviso && aviso.tipo === 'atencion' && <AvisoError mensaje={aviso.texto} icono="warning" />}
    </form>
  );
}
