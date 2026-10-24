/**
 * Utilidades puras de "Crear medallas propias" (CrearMedallas.jsx): formulario, validación, textos y el prompt para la IA
 * de imágenes. Sin JSX ni fetch (mismo criterio que medallas.js y ajedrez.js).
 *
 * Las reglas, los niveles, las piezas, las ideas y los largos permitidos llegan del backend (`GET /medallas/opciones`):
 * acá solo hay valores de respaldo por si alguno faltara, nunca un catálogo propio.
 */
import { NIVELES_MEDALLA, normalizarNivel, normalizarPieza } from '../../medallas';

/** Código de la regla "la entrego yo": no se gana jugando, la entrega el facilitador. */
export const REGLA_MANUAL = 'manual';

const NOMBRE_REGLA_MANUAL = 'Manual: la entrego yo';
const LARGO_NOMBRE_RESPALDO = [2, 30];
const LARGO_DESCRIPCION_RESPALDO = [5, 80];
const PIEZAS_RESPALDO = ['peon', 'caballo', 'alfil', 'torre', 'dama', 'rey'];

/** Letra (en mayúscula) con la que `rutaImagenPieza` busca el dibujo de cada pieza. */
export const LETRA_DE_PIEZA = { peon: 'P', caballo: 'N', alfil: 'B', torre: 'R', dama: 'Q', rey: 'K' };

/** Formulario sin completar. `regla: ''` = todavía no eligió cómo se gana; `meta` va como texto porque es un campo de entrada. */
export const FORMULARIO_VACIO = {
  nombre: '',
  descripcion: '',
  nivel: 'bronce',
  pieza: 'peon',
  regla: '',
  meta: '',
  general: false,
};

/**
 * Nombre de archivo (sin extensión) de la ilustración sugerida de una idea: el nombre sin tildes, en minúscula y con guiones
 * bajos. «Campeón del Torneo» -> `campeon_del_torneo`.
 */
export function slugDeIdea(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Ruta de la ilustración sugerida de una idea (archivo estático en `frontend/public/ideas-medallas/`), o `null` si el nombre
 * no da un nombre de archivo. La carpeta NO empieza con «medallas»: ese prefijo se manda al backend. Puede no existir: quien
 * la use tiene que tolerar que la imagen no cargue (ver `useImagenCargable`).
 */
export function rutaImagenIdea(nombre) {
  const slug = slugDeIdea(nombre);
  return slug === '' ? null : `/ideas-medallas/${slug}.png`;
}

/** Prompt para una IA de imágenes: `[SUJETO]` se reemplaza por lo que el facilitador quiere dibujar. */
export const PROMPT_BASE =
  'Render 3D fotorrealista de [SUJETO], como objeto de colección para una medalla de videojuego sobre ajedrez. Materiales realistas (madera pulida, mármol, metal, oro), iluminación de estudio con luz principal suave desde arriba a la izquierda, reflejos y brillos creíbles, detalle nítido, un solo objeto centrado y simétrico que ocupa el 85 % del cuadro dentro de un círculo imaginario, fondo completamente transparente (PNG con canal alfa), sin marco, sin escudo, sin texto ni letras, sin sombra proyectada en el suelo, relación 1:1.';

/** Colapsa los espacios repetidos y recorta los bordes (igual que hace el backend antes de validar el largo). */
export function limpiarTexto(texto) {
  return String(texto ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** Cantidad de caracteres que ve una persona (un emoji cuenta como uno). */
export function largoDe(texto) {
  return Array.from(String(texto ?? '')).length;
}

/** "1 jugador" / "3 jugadores". */
export function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

function rangoValido(valor, respaldo) {
  return Array.isArray(valor) && valor.length === 2 && valor.every(Number.isFinite) ? valor : respaldo;
}

/**
 * Deja las opciones del backend listas para usar: siempre hay lista de reglas (con "Manual" al final), niveles, piezas,
 * ideas y los dos rangos de largo, aunque el backend mande algo incompleto.
 */
export function normalizarOpciones(datos) {
  const reglas = Array.isArray(datos?.reglas) ? datos.reglas : [];
  const manual = reglas.find((regla) => regla.codigo === REGLA_MANUAL) ?? {
    codigo: REGLA_MANUAL,
    nombre: NOMBRE_REGLA_MANUAL,
    tipo: 'manual',
  };
  return {
    reglas: [...reglas.filter((regla) => regla.codigo !== REGLA_MANUAL && regla.tipo !== 'manual'), manual],
    niveles: Array.isArray(datos?.niveles) && datos.niveles.length > 0 ? datos.niveles : NIVELES_MEDALLA,
    piezas: Array.isArray(datos?.piezas) && datos.piezas.length > 0 ? datos.piezas : PIEZAS_RESPALDO,
    plantillas: Array.isArray(datos?.plantillas) ? datos.plantillas : [],
    largoNombre: rangoValido(datos?.largo_nombre, LARGO_NOMBRE_RESPALDO),
    largoDescripcion: rangoValido(datos?.largo_descripcion, LARGO_DESCRIPCION_RESPALDO),
  };
}

/** La regla de la lista con ese código, o `null`. */
export function reglaPorCodigo(reglas, codigo) {
  return (Array.isArray(reglas) ? reglas : []).find((regla) => regla.codigo === codigo) ?? null;
}

/** `contador`, `si_no` o `manual` según el código; `null` si todavía no eligió o la regla no está en la lista. */
export function tipoDeRegla(reglas, codigo) {
  if (codigo === REGLA_MANUAL) return 'manual';
  return reglaPorCodigo(reglas, codigo)?.tipo ?? null;
}

/** Número entero escrito en un campo, o `null` si está vacío, es decimal o tiene otra cosa. */
export function leerMeta(texto) {
  const limpio = String(texto ?? '').trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
}

/** Límites de la cantidad de una regla contador (con respaldo por si el backend no los manda). */
export function limitesDeMeta(regla) {
  const minimo = Number.isFinite(regla?.minimo) ? regla.minimo : 1;
  const maximo = Number.isFinite(regla?.maximo) ? regla.maximo : 500;
  return { minimo, maximo };
}

/**
 * Cantidad que queda al cambiar de regla: la misma si sigue siendo válida para la nueva, el mínimo si la nueva es un
 * contador, y 1 en las que no llevan número (sí o no, manual).
 */
export function metaAlCambiarRegla(metaActual, regla) {
  if (regla?.tipo !== 'contador') return '1';
  const { minimo, maximo } = limitesDeMeta(regla);
  const actual = leerMeta(metaActual);
  return actual !== null && actual >= minimo && actual <= maximo ? String(actual) : String(minimo);
}

/** Formulario con los valores de una idea del backend (sin guardar nada). `general` se conserva: no lo define la idea. */
export function formularioDesdeIdea(idea, general) {
  return {
    nombre: String(idea?.nombre ?? ''),
    descripcion: String(idea?.descripcion ?? ''),
    nivel: normalizarNivel(idea?.nivel),
    pieza: normalizarPieza(idea?.pieza),
    regla: String(idea?.regla ?? ''),
    meta: String(Number.isFinite(idea?.meta) ? idea.meta : 1),
    general,
  };
}

/** Formulario con los datos de una medalla propia ya creada (modo edición). */
export function formularioDesdeMedalla(medalla) {
  return {
    nombre: String(medalla?.nombre ?? ''),
    descripcion: String(medalla?.descripcion ?? ''),
    nivel: normalizarNivel(medalla?.nivel),
    pieza: normalizarPieza(medalla?.pieza),
    regla: String(medalla?.regla ?? ''),
    meta: String(Number.isFinite(medalla?.meta) ? medalla.meta : 1),
    general: medalla?.general === true,
  };
}

/**
 * Revisa el formulario antes de mandarlo: devuelve el mensaje de lo primero que no sirve (para mostrarlo tal cual) o
 * `null` si está bien. El backend vuelve a validar; esto evita ir al servidor con algo que seguro rechaza.
 */
export function validarFormulario(formulario, opciones) {
  const [minimoNombre, maximoNombre] = opciones.largoNombre;
  const largoNombre = largoDe(limpiarTexto(formulario.nombre));
  if (largoNombre < minimoNombre || largoNombre > maximoNombre) {
    return `El nombre tiene que tener entre ${minimoNombre} y ${maximoNombre} letras.`;
  }
  const [minimoDescripcion, maximoDescripcion] = opciones.largoDescripcion;
  const largoDescripcion = largoDe(limpiarTexto(formulario.descripcion));
  if (largoDescripcion < minimoDescripcion || largoDescripcion > maximoDescripcion) {
    return `La descripción tiene que tener entre ${minimoDescripcion} y ${maximoDescripcion} letras.`;
  }
  const tipo = tipoDeRegla(opciones.reglas, formulario.regla);
  if (tipo === null) return 'Elegí cómo se gana la medalla.';
  if (tipo === 'contador') {
    const regla = reglaPorCodigo(opciones.reglas, formulario.regla);
    const { minimo, maximo } = limitesDeMeta(regla);
    const meta = leerMeta(formulario.meta);
    if (meta === null || meta < minimo || meta > maximo) {
      return `La cantidad para «${regla.nombre}» tiene que ser un número entero entre ${minimo} y ${maximo}.`;
    }
  }
  return null;
}

/** Cuerpo para `crearMedallaPropia` / `editarMedallaPropia` (sin `general`, que solo se manda al crear). */
export function cuerpoDeMedalla(formulario, reglas) {
  const tipo = tipoDeRegla(reglas, formulario.regla);
  return {
    nombre: limpiarTexto(formulario.nombre),
    descripcion: limpiarTexto(formulario.descripcion),
    nivel: formulario.nivel,
    pieza: formulario.pieza,
    regla: formulario.regla,
    meta: tipo === 'contador' ? leerMeta(formulario.meta) : 1,
  };
}

/**
 * La regla en palabras: "Partidas ganadas (5 victorias)" o "Ganarle a Turing". `null` si no hay regla elegida. Si la regla
 * no está en la lista (por ejemplo, no cargaron las opciones) se usa `nombreRespaldo` y la cantidad sola.
 */
export function reglaEnPalabras(reglas, codigo, meta, nombreRespaldo = null) {
  if (codigo === REGLA_MANUAL) return null;
  const regla = reglaPorCodigo(reglas, codigo);
  const cantidad = leerMeta(meta);
  if (!regla) {
    if (!nombreRespaldo) return null;
    return cantidad !== null && cantidad > 1 ? `${nombreRespaldo} (${cantidad})` : nombreRespaldo;
  }
  if (regla.tipo !== 'contador' || cantidad === null) return regla.nombre;
  return `${regla.nombre} (${cantidad}${regla.unidad ? ` ${regla.unidad}` : ''})`;
}

/** "Entregada a 3 jugadores (1 ya la tenía)" a partir de `{otorgadas, ya_la_tenian}`. */
export function textoResultadoEntrega(resultado) {
  const otorgadas = Number.isFinite(resultado?.otorgadas) ? resultado.otorgadas : 0;
  const yaLaTenian = Number.isFinite(resultado?.ya_la_tenian) ? resultado.ya_la_tenian : 0;
  const verboYa = yaLaTenian === 1 ? 'ya la tenía' : 'ya la tenían';
  if (otorgadas === 0) {
    return yaLaTenian > 0
      ? `No hubo entregas nuevas: ${plural(yaLaTenian, 'jugador', 'jugadores')} ${verboYa}.`
      : 'No hubo entregas nuevas.';
  }
  const base = `Entregada a ${plural(otorgadas, 'jugador', 'jugadores')}`;
  return yaLaTenian > 0 ? `${base} (${yaLaTenian} ${verboYa}).` : `${base}.`;
}

/** "La ganaron 3 jugadores" / "La ganó 1 jugador" / "Todavía no la ganó nadie". */
export function textoGanadaPor(cantidad) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 'Todavía no la ganó nadie';
  return cantidad === 1 ? 'La ganó 1 jugador' : `La ganaron ${cantidad} jugadores`;
}

/** El prompt con el sujeto puesto; mientras no haya sujeto queda `[SUJETO]` a la vista para que se vea dónde va. */
export function armarPrompt(sujeto) {
  const limpio = limpiarTexto(sujeto);
  return PROMPT_BASE.replace('[SUJETO]', () => (limpio === '' ? '[SUJETO]' : limpio));
}

/** Peso legible de un archivo: "240 KB" o "1,3 MB". */
export function pesoLegible(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`;
}
