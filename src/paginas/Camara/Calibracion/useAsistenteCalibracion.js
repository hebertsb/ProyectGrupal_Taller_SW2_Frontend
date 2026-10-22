import { useCallback, useEffect, useRef, useState } from 'react';
import {
  comprobarCalibracion,
  guardarCalibracionConFoto,
  obtenerEstadoCalibracion,
  obtenerFotoVision,
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

  useEffect(() => {
    montadoRef.current = true;
    setEstado(null);
    setComprobacion(null);
    cargarEstado();
    const urls = urlsRef.current;
    return () => {
      montadoRef.current = false;
      if (urls.foto) URL.revokeObjectURL(urls.foto);
      if (urls.vista) URL.revokeObjectURL(urls.vista);
    };
  }, [cargarEstado]);

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
    ir(0);
    cargarEstado();
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

  async function previsualizar() {
    const url = await trabajar(() => previsualizarCalibracion(puntosAEsquinas(puntos), foto.blob, camara));
    if (!url) return;
    guardarVista(url);
    ir(3);
  }

  async function guardar() {
    const guardado = await trabajar(() => guardarCalibracionConFoto(puntosAEsquinas(puntos), foto.blob, camara));
    if (guardado) {
      setResultado(guardado);
      window.dispatchEvent(new Event(EVENTO_CALIBRACION_CAMBIO));
      window.dispatchEvent(new Event(EVENTO_CAMARAS_CAMBIO));
    }
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
    estado, paso, foto, puntos, setPuntos, vistaUrl, resultado, comprobacion, ocupado, error, setError,
    entradaImportarRef, ir, cerrar, congelar, previsualizar, guardar, exportar, importar, quitar, comprobar,
  };
}
