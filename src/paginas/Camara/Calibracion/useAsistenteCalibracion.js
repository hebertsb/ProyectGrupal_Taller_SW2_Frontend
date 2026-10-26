import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activarPerfilTablero,
  borrarPerfilTablero,
  comprobarCalibracion,
  guardarCalibracionConFoto,
  obtenerEstadoCalibracion,
  obtenerFotoVision,
  obtenerPerfilesTablero,
  previsualizarCalibracion,
  quitarCalibracionCamara,
} from '../../../api/backend';
import { EVENTO_CAMARAS_CAMBIO } from '../useCamarasConfiguradas';
import { ESQUINAS_ORDEN, puntosAEsquinas, validarEsquinas } from './esquinas';

export const EVENTO_CALIBRACION_CAMBIO = 'calibracion-cambio';

/**
 * Estado y acciones del asistente de calibración: `paso` 0 = en reposo, 1 a 4 = pasos del asistente. Maneja la foto congelada, las
 * esquinas marcadas, la vista previa de la grilla, el guardado y las acciones de reposo (exportar, importar, quitar, comprobar).
 * Avisa con `EVENTO_CALIBRACION_CAMBIO` cuando se guarda o se quita una calibración y con `onEnCursoChange` mientras está abierto.
 */
export default function useAsistenteCalibracion(camara, onEnCursoChange) {
  const [estado, setEstado] = useState(null);
  const [perfiles, setPerfiles] = useState([]); // [{nombre, activo, calibrada, fecha}], el activo primero
  // Tablero que se está calibrando en el asistente: `null` mientras se recalibra el que ya está activo (de siempre); un
  // nombre cuando se arrancó con "Calibrar un tablero nuevo" — ahí `guardar()` lo guarda aparte y lo deja activo.
  const [perfilObjetivo, setPerfilObjetivo] = useState(null);
  const [paso, setPaso] = useState(0); // 0 = en reposo
  const [foto, setFoto] = useState(null); // { url, blob } de la foto congelada
  const [puntos, setPuntos] = useState([]);
  const [vistaUrl, setVistaUrl] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [comprobacion, setComprobacion] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const montadoRef = useRef(true);
  const urlsRef = useRef({ foto: null, vista: null });
  const entradaImportarRef = useRef(null);

  const cargarEstado = useCallback(async () => {
    try {
      const datos = await obtenerEstadoCalibracion(camara);
      if (montadoRef.current) setEstado(datos);
    } catch (e) {
      if (montadoRef.current) {
        setEstado(null);
        setError(e.message);
      }
    }
  }, [camara]);

  const cargarPerfiles = useCallback(async () => {
    try {
      const datos = await obtenerPerfilesTablero(camara);
      if (montadoRef.current) setPerfiles(datos);
    } catch {
      if (montadoRef.current) setPerfiles([]);
    }
  }, [camara]);

  useEffect(() => {
    montadoRef.current = true;
    setEstado(null);
    setComprobacion(null);
    cargarEstado();
    cargarPerfiles();
    const urls = urlsRef.current;
    return () => {
      montadoRef.current = false;
      if (urls.foto) URL.revokeObjectURL(urls.foto);
      if (urls.vista) URL.revokeObjectURL(urls.vista);
    };
  }, [cargarEstado, cargarPerfiles]);

  function guardarFotoCongelada(nueva) {
    if (urlsRef.current.foto) URL.revokeObjectURL(urlsRef.current.foto);
    urlsRef.current.foto = nueva?.url ?? null;
    setFoto(nueva);
  }

  function guardarVista(url) {
    if (urlsRef.current.vista) URL.revokeObjectURL(urlsRef.current.vista);
    urlsRef.current.vista = url;
    setVistaUrl(url);
  }

  function ir(nuevoPaso) {
    setPaso(nuevoPaso);
    onEnCursoChange?.(nuevoPaso !== 0);
  }

  function cerrar() {
    guardarFotoCongelada(null);
    guardarVista(null);
    setPuntos([]);
    setResultado(null);
    setError(null);
    setPerfilObjetivo(null);
    ir(0);
    cargarEstado();
    cargarPerfiles();
    window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
    window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
  }

  /** Ejecuta una operación con el indicador de carga y el error visibles. */
  async function trabajar(operacion) {
    setOcupado(true);
    setError(null);
    try {
      return await operacion();
    } catch (e) {
      if (montadoRef.current) setError(e.message);
      return undefined;
    } finally {
      if (montadoRef.current) setOcupado(false);
    }
  }

  async function congelar() {
    const nueva = await trabajar(() => obtenerFotoVision(false, camara));
    if (!nueva) return;
    guardarFotoCongelada(nueva);
    setPuntos([]);
    ir(2);
  }

  /** Arranca el asistente para armar un tablero NUEVO (`nombre`), sin tocar la calibración del que esté activo ahora. */
  async function calibrarTableroNuevo(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setPerfilObjetivo(limpio);
    await congelar();
  }

  async function previsualizar() {
    const url = await trabajar(() => previsualizarCalibracion(puntosAEsquinas(puntos), foto.blob, camara));
    if (!url) return;
    guardarVista(url);
    ir(3);
  }

  async function guardar() {
    const guardado = await trabajar(() => guardarCalibracionConFoto(puntosAEsquinas(puntos), foto.blob, camara, perfilObjetivo));
    if (guardado) {
      setResultado(guardado);
      cargarPerfiles();
      window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
      window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
    }
  }

  /** Cambia, sin recalibrar, a la calibración ya guardada de `nombre`. */
  async function activarPerfil(nombre) {
    const nuevoEstado = await trabajar(() => activarPerfilTablero(nombre, camara));
    if (!nuevoEstado) return;
    setEstado(nuevoEstado);
    await cargarPerfiles();
    window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
    window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
  }

  /** Borra un tablero calibrado (no el por defecto). Si era el activo, `camara` vuelve a este. */
  async function borrarPerfilDeCamara(nombre) {
    if (!window.confirm(`¿Borrar el tablero «${nombre}»? No se puede deshacer.`)) return;
    const lista = await trabajar(() => borrarPerfilTablero(nombre, camara));
    if (!lista) return;
    setPerfiles(lista);
    await cargarEstado();
    window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
    window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
  }

  function exportar() {
    if (!estado?.esquinas) return;
    const blob = new Blob([JSON.stringify(estado.esquinas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = camara === 'principal' ? 'esquinas_tablero.json' : `esquinas_tablero_${camara}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importar(e) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    let esquinas;
    try {
      esquinas = validarEsquinas(JSON.parse(await archivo.text()));
    } catch (err) {
      setError(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message);
      return;
    }
    // Las esquinas importadas se revisan sobre una foto nueva, que además queda como referencia al guardar.
    const nueva = await trabajar(() => obtenerFotoVision(false, camara));
    if (!nueva) return;
    guardarFotoCongelada(nueva);
    const importados = ESQUINAS_ORDEN.map((clave) => esquinas[clave]);
    setPuntos(importados);
    const url = await trabajar(() => previsualizarCalibracion(esquinas, nueva.blob, camara));
    if (url) {
      guardarVista(url);
      ir(3);
    } else {
      ir(2);
    }
  }

  async function quitar() {
    if (!window.confirm(`¿Quitar la calibración de la cámara ${camara}?${camara === 'principal' ? ' Se vuelve a la detección automática.' : ''}`)) return;
    await trabajar(() => quitarCalibracionCamara(camara));
    await cargarEstado();
    window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
    window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
  }

  async function comprobar() {
    setComprobacion(null);
    const datos = await trabajar(() => comprobarCalibracion(camara));
    if (datos) setComprobacion(datos);
  }

  return {
    estado, perfiles, perfilObjetivo, paso, foto, puntos, setPuntos, vistaUrl, resultado, comprobacion, ocupado, error, setError,
    entradaImportarRef, ir, cerrar, congelar, calibrarTableroNuevo, previsualizar, guardar, exportar, importar, quitar, comprobar,
    activarPerfil, borrarPerfilDeCamara,
  };
}
