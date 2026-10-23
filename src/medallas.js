/**
 * Utilidades puras de las medallas ("figuritas"): vocabulario del contrato, textos, orden y los eventos con los que
 * las pantallas le piden al notificador global que revise si hay medallas nuevas. Sin JSX ni fetch (mismo criterio
 * que ajedrez.js y nivelJugador.js).
 *
 * Nada de acá conoce una medalla puntual: el catálogo (nombre, descripción, nivel, pieza, progreso, imagen) llega
 * siempre del backend, así que sumar medallas no obliga a tocar el frontend.
 */
import { fechaDesdeIso } from './formatoTiempo';

/** De menor a mayor. Un `nivel` que el backend mande y no esté acá se dibuja como bronce. */
export const NIVELES_MEDALLA = ['bronce', 'plata', 'oro', 'legendaria'];

const ETIQUETA_NIVEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', legendaria: 'Legendaria' };

const ETIQUETA_PIEZA = {
  peon: 'Peón',
  caballo: 'Caballo',
  alfil: 'Alfil',
  torre: 'Torre',
  dama: 'Dama',
  rey: 'Rey',
};

/** Piezas que sabemos dibujar. Una pieza desconocida se dibuja como peón. */
const PIEZA_POR_DEFECTO = 'peon';

/** Evento que cualquier pantalla dispara (con `pedirRevisionMedallas`) para que el notificador revise. */
export const EVENTO_REVISAR_MEDALLAS = 'medallas:revisar';
/** Evento que el notificador dispara cuando encoló medallas nuevas: el álbum y el perfil se refrescan. */
export const EVENTO_MEDALLAS_NUEVAS = 'medallas:nuevas';

/** Formatos y peso máximo de la imagen que el facilitador principal puede subir para una medalla. */
export const TIPOS_IMAGEN_MEDALLA = ['image/png', 'image/jpeg', 'image/webp'];
export const MAXIMO_BYTES_IMAGEN_MEDALLA = 2 * 1024 * 1024;

/**
 * Revisa un archivo antes de mandarlo al backend: devuelve el mensaje de por qué no sirve (para mostrarlo tal cual) o
 * `null` si está bien. El backend vuelve a validar; esto solo evita subir algo que seguro se va a rechazar.
 */
export function validarImagenMedalla(archivo) {
  if (!archivo) return 'Elegí una imagen.';
  if (!TIPOS_IMAGEN_MEDALLA.includes(archivo.type)) {
    return 'Ese archivo no sirve: tiene que ser una imagen PNG, JPG o WEBP.';
  }
  if (archivo.size > MAXIMO_BYTES_IMAGEN_MEDALLA) {
    const megas = (archivo.size / (1024 * 1024)).toLocaleString('es-BO', { maximumFractionDigits: 1 });
    return `La imagen pesa ${megas} MB y el máximo es 2 MB. Probá con una más liviana.`;
  }
  if (archivo.size === 0) return 'El archivo está vacío. Elegí otra imagen.';
  return null;
}

/** Pide al notificador global que consulte las medallas (por ejemplo al terminar una partida). Seguro de llamar siempre. */
export function pedirRevisionMedallas() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENTO_REVISAR_MEDALLAS));
}

/** Nivel conocido para dibujar la figurita (desconocido o ausente = bronce). */
export function normalizarNivel(nivel) {
  return NIVELES_MEDALLA.includes(nivel) ? nivel : 'bronce';
}

/** Posición del nivel de menor (1) a mayor (4): sirve para ordenar y para contar las estrellitas de la figurita. */
export function rangoDeNivel(nivel) {
  return NIVELES_MEDALLA.indexOf(normalizarNivel(nivel)) + 1;
}

/** Nombre del nivel para mostrar ("Bronce"). */
export function etiquetaNivel(nivel) {
  if (ETIQUETA_NIVEL[nivel]) return ETIQUETA_NIVEL[nivel];
  return typeof nivel === 'string' && nivel !== '' ? nivel.charAt(0).toUpperCase() + nivel.slice(1) : 'Bronce';
}

/** Pieza conocida para dibujar la silueta. */
export function normalizarPieza(pieza) {
  return ETIQUETA_PIEZA[pieza] ? pieza : PIEZA_POR_DEFECTO;
}

/** Nombre de la pieza para mostrar ("Caballo"). */
export function etiquetaPieza(pieza) {
  return ETIQUETA_PIEZA[normalizarPieza(pieza)];
}

/**
 * Avance hacia la meta: `{ actual, meta, proporcion }`. El progreso nunca pasa de la meta ni baja de 0, y una meta
 * ausente o menor que 1 se toma como 1 (las medallas de tipo "sí o no" tienen meta 1).
 */
export function progresoDeMedalla(medalla) {
  const meta = Number.isFinite(medalla?.meta) && medalla.meta >= 1 ? medalla.meta : 1;
  const crudo = Number.isFinite(medalla?.progreso) ? medalla.progreso : 0;
  const actual = Math.min(Math.max(crudo, 0), meta);
  return { actual, meta, proporcion: actual / meta };
}

/** `true` si la medalla se mide con un contador visible (meta mayor que 1). */
export function tieneContador(medalla) {
  return progresoDeMedalla(medalla).meta > 1;
}

/**
 * Texto para lectores de pantalla: "Medalla Primer Peón, nivel bronce, ganada" o
 * "Medalla Torre Incansable, nivel plata, bloqueada, 3 de 5". Con `vistaPrevia` no menciona el estado.
 */
export function describirMedalla(medalla, { vistaPrevia = false } = {}) {
  const partes = [`Medalla ${medalla?.nombre ?? ''}`.trim(), `nivel ${normalizarNivel(medalla?.nivel)}`];
  if (!vistaPrevia) {
    if (medalla?.ganada) {
      partes.push('ganada');
    } else {
      partes.push('bloqueada');
      const { actual, meta } = progresoDeMedalla(medalla);
      if (meta > 1) partes.push(`${actual} de ${meta}`);
    }
  }
  return partes.join(', ');
}

/** "3 / 5" para el avance de una medalla con contador. */
export function textoProgreso(medalla) {
  const { actual, meta } = progresoDeMedalla(medalla);
  return `${actual} / ${meta}`;
}

/** "12 de octubre de 2026", o `null` si el backend no mandó una fecha legible. */
export function fechaLarga(iso) {
  const fecha = fechaDesdeIso(iso);
  if (!fecha) return null;
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "12/10/2026", o `null` si no hay fecha legible. */
export function fechaCorta(iso) {
  const fecha = fechaDesdeIso(iso);
  if (!fecha) return null;
  return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function milisegundosGanada(medalla) {
  return fechaDesdeIso(medalla?.ganada_en)?.getTime() ?? 0;
}

/**
 * Orden del álbum: primero las nuevas, después las ganadas (la más reciente primero) y al final las bloqueadas (las
 * más cercanas a la meta primero). A igualdad se respeta el orden del catálogo. `esNueva` decide qué es "nueva".
 */
export function ordenarMedallas(medallas, esNueva = (medalla) => medalla.nueva === true) {
  const lista = Array.isArray(medallas) ? medallas : [];
  const grupo = (medalla) => (medalla.ganada ? (esNueva(medalla) ? 0 : 1) : 2);
  return lista
    .map((medalla, indice) => ({ medalla, indice }))
    .sort((a, b) => {
      const porGrupo = grupo(a.medalla) - grupo(b.medalla);
      if (porGrupo !== 0) return porGrupo;
      if (a.medalla.ganada) {
        const porFecha = milisegundosGanada(b.medalla) - milisegundosGanada(a.medalla);
        if (porFecha !== 0) return porFecha;
      } else {
        const porAvance = progresoDeMedalla(b.medalla).proporcion - progresoDeMedalla(a.medalla).proporcion;
        if (porAvance !== 0) return porAvance;
      }
      return a.indice - b.indice;
    })
    .map(({ medalla }) => medalla);
}

/** Las ganadas más valiosas primero (mayor nivel y, a igual nivel, la más reciente): para mostrar un puñado. */
export function mejoresGanadas(medallas, cantidad) {
  const ganadas = (Array.isArray(medallas) ? medallas : []).filter((medalla) => medalla.ganada);
  return ganadas
    .map((medalla, indice) => ({ medalla, indice }))
    .sort((a, b) => {
      const porNivel = rangoDeNivel(b.medalla.nivel) - rangoDeNivel(a.medalla.nivel);
      if (porNivel !== 0) return porNivel;
      const porFecha = milisegundosGanada(b.medalla) - milisegundosGanada(a.medalla);
      return porFecha !== 0 ? porFecha : a.indice - b.indice;
    })
    .slice(0, cantidad)
    .map(({ medalla }) => medalla);
}

/** `{ total, ganadas }` de una respuesta de `GET /usuario/medallas`, aunque falten los totales. */
export function resumenDeMedallas(datos) {
  const lista = Array.isArray(datos?.medallas) ? datos.medallas : [];
  return {
    total: Number.isFinite(datos?.total) ? datos.total : lista.length,
    ganadas: Number.isFinite(datos?.ganadas) ? datos.ganadas : lista.filter((medalla) => medalla.ganada).length,
  };
}

/**
 * Medallas que el notificador ya avisó en esta sesión del navegador. El backend deja de marcarlas como `nueva`
 * apenas se avisan; esta memoria hace que el álbum las siga destacando con "Nueva" hasta recargar la página.
 */
const avisadasEnSesion = new Set();

export function recordarMedallasAvisadas(codigos) {
  for (const codigo of codigos ?? []) avisadasEnSesion.add(codigo);
}

export function fueAvisadaEnSesion(codigo) {
  return avisadasEnSesion.has(codigo);
}

/** Una medalla se destaca como nueva si el backend la marca así o si se acaba de avisar en esta sesión. */
export function esMedallaNueva(medalla) {
  return medalla?.ganada === true && (medalla.nueva === true || fueAvisadaEnSesion(medalla.codigo));
}
