import { useEffect, useRef, useState } from 'react';
import { leerSesion } from '../../api/sesion';
import usePestanaVisible from '../../usePestanaVisible';

const DECODIFICADOR = new TextDecoder();
const REINTENTO_MS = 1500;

/** Posición de la primera aparición de `secuencia` (bytes) en `datos` desde `desde`, o -1. */
function buscar(datos, secuencia, desde = 0) {
  const limite = datos.length - secuencia.length;
  for (let i = desde; i <= limite; i += 1) {
    let coincide = true;
    for (let j = 0; j < secuencia.length; j += 1) {
      if (datos[i + j] !== secuencia[j]) {
        coincide = false;
        break;
      }
    }
    if (coincide) return i;
  }
  return -1;
}

const FIN_CABECERA = new TextEncoder().encode('\r\n\r\n');

/**
 * Video EN VIVO del backend (`GET /vision/flujo`, multipart/x-mixed-replace de JPEG). Se lee con fetch (lleva el token) y
 * cada cuadro nuevo reemplaza al anterior, así que la imagen sigue a la cámara sin acumular atraso: si llegan varios cuadros
 * juntos solo se muestra el último. Devuelve `{url, datos, error}`: `url` es el object URL del cuadro actual, `datos` lo que el
 * backend adjunta (en modo `piezas`, `[[casilla, clase, confianza], …]`) y `fps` los cuadros por segundo mostrados, y `error` el mensaje si el flujo falló (reintenta solo).
 *
 * @param {'camara'|'piezas'|'vista'} modo
 * @param {string[]} casillas casillas a resaltar en modo `vista`
 * @param {''|'blanca'|'negra'} auto en modo `vista`, el backend detecta solo la casilla de la pieza de ese color (`datos` = `[[casilla, estado, confianza]]`)
 * @param {'principal'|'secundaria'|'todas'} camara qué cámara mostrar; `todas` junta las dos lado a lado (y en modo `piezas`/`vista` fusiona el resultado)
 * @param {'plana'|'cajas'|'ambas'} vista en modo `piezas`: el tablero enderezado, la imagen de la cámara con la caja 3D de cada pieza, o ambas
 * @param {number} maxFps si es mayor que 0, el backend procesa y envía como mucho esos cuadros por segundo (el resto no se analiza): alivia la máquina en el reconocimiento
 * @param {boolean} activo si es false no se conecta (y se desconecta si estaba conectado). Con la pestaña oculta tampoco: el backend no analiza cuadros que nadie ve
 */
export default function useFlujoVivo({ modo, casillas = [], auto = '', camara = 'principal', vista = 'plana', maxFps = 0, activo: pedido = true }) {
  const visible = usePestanaVisible();
  const activo = pedido && visible;
  const [url, setUrl] = useState(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [fps, setFps] = useState(0);
  const urlRef = useRef(null);
  const cuadrosRef = useRef(0);
  const claveCasillas = casillas.join(',');

  useEffect(() => {
    if (!activo) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      setDatos(null);
      setError(null);
      return undefined;
    }
    let cancelado = false;
    let controlador = null;
    let temporizador = null;

    function mostrar(bytes, casillasAdjuntas) {
      const nueva = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = nueva;
      cuadrosRef.current += 1;
      setUrl(nueva);
      if (casillasAdjuntas !== undefined) setDatos(casillasAdjuntas);
    }

    async function conectar() {
      controlador = new AbortController();
      try {
        const token = leerSesion('access_token');
        const consulta = new URLSearchParams({ modo, camara });
        if (modo === 'piezas') consulta.set('vista', vista);
        if (maxFps > 0) consulta.set('max_fps', String(maxFps));
        if (claveCasillas) consulta.set('casillas', claveCasillas);
        if (auto) consulta.set('auto', auto);
        const respuesta = await fetch(`/vision/flujo?${consulta}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controlador.signal,
          cache: 'no-store',
        });
        if (!respuesta.ok) {
          let detalle = `Error ${respuesta.status}`;
          try {
            detalle = (await respuesta.json()).detail ?? detalle;
          } catch {
            /* sin cuerpo JSON */
          }
          throw new Error(detalle);
        }
        const lector = respuesta.body.getReader();
        let pendiente = new Uint8Array(0);
        for (;;) {
          const { done, value } = await lector.read();
          if (done || cancelado) break;
          const junto = new Uint8Array(pendiente.length + value.length);
          junto.set(pendiente);
          junto.set(value, pendiente.length);
          pendiente = junto;

          let ultimo = null;
          for (;;) {
            const finCabecera = buscar(pendiente, FIN_CABECERA);
            if (finCabecera < 0) break;
            const cabecera = DECODIFICADOR.decode(pendiente.subarray(0, finCabecera));
            const largo = Number(/content-length:\s*(\d+)/i.exec(cabecera)?.[1]);
            const inicio = finCabecera + FIN_CABECERA.length;
            if (!largo || pendiente.length < inicio + largo) break;
            const adjunto = /x-casillas:\s*(.+)/i.exec(cabecera)?.[1];
            const aviso = /x-aviso:\s*(.+)/i.exec(cabecera)?.[1];
            let casillasAdjuntas = null;
            try {
              casillasAdjuntas = adjunto ? JSON.parse(adjunto.trim()) : null;
            } catch {
              casillasAdjuntas = null;
            }
            ultimo = { bytes: pendiente.slice(inicio, inicio + largo), casillasAdjuntas, aviso: aviso?.trim() ?? null };
            pendiente = pendiente.slice(inicio + largo);
          }
          if (ultimo && !cancelado) {
            mostrar(ultimo.bytes, ultimo.casillasAdjuntas ?? undefined);
            setError(ultimo.aviso);
          }
        }
        if (!cancelado) throw new Error('Se cortó el video de la cámara');
      } catch (e) {
        if (cancelado || e.name === 'AbortError') return;
        setError(e.message);
        temporizador = setTimeout(conectar, REINTENTO_MS);
      }
    }
    conectar();

    return () => {
      cancelado = true;
      if (controlador) controlador.abort();
      if (temporizador) clearTimeout(temporizador);
    };
  }, [modo, claveCasillas, auto, camara, vista, maxFps, activo]);

  // Cuadros por segundo realmente mostrados (0 = sin señal): sirve para ver a ojo que el video está vivo.
  useEffect(() => {
    if (!activo) {
      setFps(0);
      return undefined;
    }
    const intervalo = setInterval(() => {
      setFps(cuadrosRef.current);
      cuadrosRef.current = 0;
    }, 1000);
    return () => clearInterval(intervalo);
  }, [activo]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    []
  );

  return { url, datos, error, fps };
}
