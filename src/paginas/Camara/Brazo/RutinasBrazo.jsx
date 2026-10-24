import { useCallback, useEffect, useRef, useState } from 'react';
import {
  borrarRutinaBrazo,
  ejecutarRutinaBrazo,
  estadoControlBrazo,
  guardarRutinaBrazo,
  limitesBrazo,
  listarRutinasBrazo,
  moverArticulacionesBrazo,
  moverPinza,
  obtenerParametrosBrazo,
  obtenerRutinaBrazo,
  pararBrazo,
  verificarGeometriaBrazo,
} from '../../../api/backend';
import { CLASE_AVISO, CLASE_BOTON, CLASE_BOTON_PRIMARIO, CLASE_TARJETA } from '../estilos';
import EsqueletoBrazo3D, { VISTAS_3D } from './EsqueletoBrazo3D';
import { problemasDePose, problemasDeTrayectoria, REGLAS_POR_DEFECTO } from './esqueleto';

const POSE_INICIAL = [0, 0, 90, 0, 90, 0];
const PASOS_JOG = [1, 5, 15];
const GRADOS_POR_SEGUNDO_AL_100 = 180; // para la vista previa: a velocidad 100 % las articulaciones giran ~180°/s
const INTERVALO_MANTENER_MS = 90;
const ADELANTO_VIVO_GRADOS = 15; // en modo en vivo, la pose del esqueleto nunca se adelanta más que esto al brazo real (por articulación)
const SALTO_VIVO_GRADOS = 10; // y cada orden al brazo real avanza como mucho esto por articulación
const ESPERA_FIN_MOVIMIENTO_MS = 60_000;
const CARRERA_PINZA_MM = 26; // la pinza DH PGE-50-26 abre 26 mm en total (posición 1000)
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const CLASE_CAMPO =
  'min-h-[44px] px-space-sm rounded-xl border border-outline-variant bg-surface-container text-on-surface font-body-sm text-body-sm min-w-0';
const ICONOS = { articulaciones: 'precision_manufacturing', pinza: 'pan_tool', esperar: 'schedule', rutina: 'playlist_play' };

const limitar = (valor, [minimo, maximo]) => Math.min(maximo, Math.max(minimo, valor));
const redondear = (a) => Math.round(a * 10) / 10;

function describirPaso(paso) {
  if (paso.tipo === 'articulaciones') return `Pose · ${paso.angulos.map((a) => Math.round(a)).join(' ')} · ${paso.velocidad}%`;
  if (paso.tipo === 'pinza') return `Pinza ${paso.apertura === 1000 ? 'abierta' : paso.apertura === 0 ? 'cerrada' : `a ${paso.apertura}`}`;
  if (paso.tipo === 'esperar') return `Esperar ${paso.segundos} s`;
  return `Rutina «${paso.nombre}»`;
}

/** Los pasos con cada `rutina` reemplazada por los suyos (para la vista previa); falla si hay un ciclo o demasiada anidación. */
async function aplanar(pasos, profundidad = 0, vistas = []) {
  if (profundidad > 5) throw new Error('Demasiadas rutinas anidadas');
  const planos = [];
  for (const paso of pasos) {
    if (paso.tipo !== 'rutina') {
      planos.push(paso);
      continue;
    }
    if (vistas.includes(paso.nombre)) throw new Error(`«${paso.nombre}» se llama a sí misma`);
    const sub = await obtenerRutinaBrazo(paso.nombre);
    planos.push(...(await aplanar(sub.pasos, profundidad + 1, [...vistas, paso.nombre])));
  }
  return planos;
}

/** Botón que repite su acción mientras se mantiene apretado (como un joystick). */
function BotonMantener({ onPaso, etiqueta, children }) {
  const temporizador = useRef(null);
  const accion = useRef(onPaso);
  accion.current = onPaso; // el intervalo llama siempre a la versión más reciente (con la pose actual)
  const parar = useCallback(() => {
    if (temporizador.current) clearInterval(temporizador.current);
    temporizador.current = null;
  }, []);
  useEffect(() => parar, [parar]);
  const empezar = (e) => {
    e.preventDefault();
    parar();
    accion.current();
    temporizador.current = setInterval(() => accion.current(), INTERVALO_MANTENER_MS);
  };
  return (
    <button
      type="button"
      className={`${CLASE_BOTON} !px-0 w-12 text-lg select-none touch-none`}
      aria-label={etiqueta}
      onPointerDown={empezar}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && onPaso()}
    >
      {children}
    </button>
  );
}

function Icono({ nombre }) {
  return (
    <span className="material-symbols-outlined text-[18px] align-middle" aria-hidden="true">
      {nombre}
    </span>
  );
}

/**
 * Rutinas del brazo. Un solo canvas 3D con el esqueleto: se gira con el mouse, se toca una articulación para elegirla y se mueve con − / + o
 * el slider; «Grabar paso» guarda lo que se ve (pose y pinza). La lista de pasos se prueba en pantalla, se guarda con un nombre y se ejecuta
 * en el emulador (que la valida) y, ya validada, en el brazo real.
 */
export default function RutinasBrazo({ estado, onCambio }) {
  const [pose, setPose] = useState(POSE_INICIAL);
  const [apertura, setApertura] = useState(1000);
  const [seleccionada, setSeleccionada] = useState(2);
  const [paso, setPaso] = useState(5);
  const [vista, setVista] = useState('iso');
  const [fuerza, setFuerza] = useState(50);
  const [velocidadPinza, setVelocidadPinza] = useState(50);
  const [velocidadPaso, setVelocidadPaso] = useState(20);
  const [espera, setEspera] = useState(1);

  const [lista, setLista] = useState([]);
  const [nombre, setNombre] = useState('');
  const [pasos, setPasos] = useState([]);
  const [validada, setValidada] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [factor, setFactor] = useState(1);
  const [subrutina, setSubrutina] = useState('');
  const [elegido, setElegido] = useState(null);
  const [activo, setActivo] = useState(null);
  const [reglas, setReglas] = useState(REGLAS_POR_DEFECTO);
  const [incorporada, setIncorporada] = useState(null); // nombre de la rutina incorporada abierta, mientras no se edite
  const [verificacion, setVerificacion] = useState(null);

  const [ocupado, setOcupado] = useState(false);
  const [animando, setAnimando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const cancelarRef = useRef(false);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const [enVivo, setEnVivo] = useState(false);
  const vivoRef = useRef(false);
  const realRef = useRef(null); // ángulos que el brazo real tiene ahora (el último dato leído)
  const empujandoRef = useRef(false);
  const aperturaRef = useRef(apertura);
  aperturaRef.current = apertura;
  const pinzaRealRef = useRef(1000);
  const pinzaOcupadaRef = useRef(false);

  const habilitado = estado?.modo === 5;
  const moviendo = estado?.tarea?.estado === 'ejecutando';
  const conectado = Boolean(estado?.conectado);
  const velocidadGlobal = estado?.velocidad_global;

  const cargarLista = useCallback(async () => {
    try {
      setLista(await listarRutinasBrazo());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargarLista();
    return () => {
      cancelarRef.current = true;
    };
  }, [cargarLista]);

  // Los valores de los pasos nuevos salen de la configuración activa del brazo (velocidad de las poses, fuerza y velocidad de la pinza):
  // se leen al conectarse y cuando cambia la velocidad global (por ejemplo, al aplicar una configuración).
  useEffect(() => {
    if (!conectado) return undefined;
    let vigente = true;
    obtenerParametrosBrazo()
      .then((p) => {
        if (!vigente) return;
        if (p.velocidad_global) setVelocidadPaso(p.velocidad_global);
        if (p.fuerza) setFuerza(p.fuerza);
        if (p.velocidad_pinza) setVelocidadPinza(p.velocidad_pinza);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [conectado, velocidadGlobal]);

  // Límites y distancias de seguridad (las mismas que valida el backend); la altura del tablero cambia al conectarse.
  useEffect(() => {
    let vigente = true;
    limitesBrazo()
      .then((l) => vigente && setReglas({ limites: l.limites_articulaciones, margenMesa: l.margen_mesa_m, distanciaMinima: l.distancia_minima_eslabones_m, puntaMinima: l.punta_minima_m, largoPinza: l.largo_pinza_m }))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [conectado]);

  const correr = async (accion) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await accion();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const bloqueado = ocupado || animando;
  /** Aplica la pose solo si el brazo puede estar así (rango real de cada articulación, mesa, tablero y choques); si no, avisa por qué. */
  const intentarPose = (pedida) => {
    // En vivo, el esqueleto va como mucho unos grados por delante del brazo real: así, aunque se mantenga apretado el botón, el brazo no sale corriendo detrás.
    const candidata = enVivo && realRef.current ? pedida.map((a, i) => Math.min(realRef.current[i] + ADELANTO_VIVO_GRADOS, Math.max(realRef.current[i] - ADELANTO_VIVO_GRADOS, a))) : pedida;
    const problemas = problemasDePose(candidata, reglas);
    if (problemas.length) {
      setAviso(null);
      setError(`No se puede mover ahí: ${problemas[0]}.`);
      return false;
    }
    setError(null);
    setPose(candidata);
    return true;
  };
  const mover = (indice, delta) => intentarPose(poseRef.current.map((a, i) => (i === indice ? redondear(limitar(a + delta, reglas.limites[i])) : a)));
  const cambiarPasos = (nuevos) => {
    if (incorporada) {
      setNombre(`${incorporada} copia`); // editar una rutina incorporada guarda una copia con otro nombre
      setIncorporada(null);
    }
    setPasos(nuevos);
    setSinGuardar(true);
  };
  const problemasActuales = problemasDePose(pose, reglas);
  const invalida = problemasActuales.length > 0;

  // --- grabar pasos -------------------------------------------------------------------------------------------------------
  /** Guarda lo que se ve: la pose (si cambió desde el último paso) y la pinza (si cambió desde el último estado de la pinza). */
  const grabarPaso = () => {
    const ultimaPose = [...pasos].reverse().find((p) => p.tipo === 'articulaciones')?.angulos;
    const ultimaPinza = [...pasos].reverse().find((p) => p.tipo === 'pinza')?.apertura ?? 1000;
    const nuevos = [];
    if (!ultimaPose || ultimaPose.some((a, i) => Math.abs(a - pose[i]) > 0.05)) {
      if (invalida) {
        setError(`Esa pose es imposible: ${problemasActuales[0]}.`);
        return;
      }
      const camino = ultimaPose ? problemasDeTrayectoria(ultimaPose, pose, reglas) : [];
      if (camino.length) {
        setError(`Entre el paso anterior y esta pose el brazo pasaría por una pose imposible: ${camino[0]}. Grabá antes una pose intermedia que lo rodee.`);
        return;
      }
      nuevos.push({ tipo: 'articulaciones', angulos: pose.map(redondear), velocidad: velocidadPaso });
    }
    if (apertura !== ultimaPinza) nuevos.push({ tipo: 'pinza', apertura, fuerza, velocidad: velocidadPinza });
    if (nuevos.length === 0) {
      setAviso('No cambiaste nada desde el último paso: mové una articulación o la pinza y volvé a grabar.');
      return;
    }
    cambiarPasos([...pasos, ...nuevos]);
    setElegido(null);
    setAviso(null);
  };
  const agregarEspera = () => cambiarPasos([...pasos, { tipo: 'esperar', segundos: espera }]);
  const agregarSubrutina = () => {
    if (!subrutina) return;
    cambiarPasos([...pasos, { tipo: 'rutina', nombre: subrutina }]);
    setSubrutina('');
  };

  // --- editar la lista ---------------------------------------------------------------------------------------------------
  const elegirPaso = (i) => {
    setElegido(i);
    if (enVivo) {
      setAviso('En vivo no se salta a un paso (movería el brazo de golpe): salí del modo en vivo para verlo.');
      return;
    }
    const p = pasos[i];
    if (p.tipo === 'articulaciones') setPose(p.angulos);
    if (p.tipo === 'pinza') setApertura(p.apertura);
  };
  const quitar = (i) => {
    cambiarPasos(pasos.filter((_, j) => j !== i));
    setElegido(null);
  };
  const subir = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= pasos.length) return;
    const copia = [...pasos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    cambiarPasos(copia);
    setElegido(j);
  };
  const actualizarPaso = (i) => {
    const p = pasos[i];
    if (p.tipo === 'articulaciones') cambiarPasos(pasos.map((q, j) => (j === i ? { ...q, angulos: pose.map(redondear) } : q)));
    if (p.tipo === 'pinza') cambiarPasos(pasos.map((q, j) => (j === i ? { ...q, apertura } : q)));
  };
  /** Pone SOLO el esqueleto virtual en la posición inicial de la calibración (no mueve ningún brazo). */
  const virtualAPosicionInicial = () =>
    correr(async () => {
      const rutina = await obtenerRutinaBrazo('posición inicial');
      const angulos = rutina.pasos.find((p) => p.tipo === 'articulaciones')?.angulos;
      if (!angulos) throw new Error('No hay posición inicial calibrada.');
      setPose(angulos.map(redondear));
      setAviso('El brazo virtual está en la posición inicial (el brazo conectado no se movió).');
    });
  const deTelemetria = () => {
    if (estado?.angulos) setPose(estado.angulos.map(redondear));
    if (estado?.pinza?.inicializada) setApertura(estado.pinza.posicion);
  };

  // --- rutinas guardadas -------------------------------------------------------------------------------------------------
  const nueva = () => {
    setIncorporada(null);
    setNombre('');
    setPasos([]);
    setValidada(false);
    setSinGuardar(false);
    setElegido(null);
    setError(null);
    setAviso(null);
  };
  const abrir = (n) =>
    correr(async () => {
      const rutina = await obtenerRutinaBrazo(n);
      setNombre(rutina.nombre);
      setIncorporada(rutina.incorporada ? rutina.nombre : null);
      setPasos(rutina.pasos);
      setValidada(rutina.validada);
      setSinGuardar(false);
      setElegido(null);
    });
  const guardar = () =>
    correr(async () => {
      const rutina = await guardarRutinaBrazo(nombre.trim(), pasos);
      setNombre(rutina.nombre);
      setPasos(rutina.pasos);
      setValidada(rutina.validada);
      setSinGuardar(false);
      setAviso(`Rutina «${rutina.nombre}» guardada.`);
      await cargarLista();
    });
  const borrar = () =>
    correr(async () => {
      if (!window.confirm(`¿Borrar la rutina «${nombre}»? No se puede deshacer.`)) return;
      await borrarRutinaBrazo(nombre);
      nueva();
      await cargarLista();
    });

  // --- probar en pantalla (sin conectar nada) ----------------------------------------------------------------------------
  const tween = (duracionMs, alCuadro) =>
    new Promise((resolver) => {
      const inicio = performance.now();
      const cuadro = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / duracionMs);
        alCuadro(t);
        if (t < 1 && !cancelarRef.current) requestAnimationFrame(cuadro);
        else resolver();
      };
      requestAnimationFrame(cuadro);
    });
  const probar = () =>
    correr(async () => {
      if (enVivo) {
        setError('Salí del modo en vivo para probar en pantalla.');
        return;
      }
      cancelarRef.current = false;
      setAnimando(true);
      let actual = [...pose];
      let abierta = apertura;
      try {
        for (let i = 0; i < pasos.length && !cancelarRef.current; i += 1) {
          setActivo(i);
          for (const p of await aplanar([pasos[i]])) {
            if (cancelarRef.current) break;
            if (p.tipo === 'articulaciones') {
              const desde = actual;
              const grados = Math.max(...desde.map((d, k) => Math.abs(p.angulos[k] - d)));
              const duracion = Math.max(300, (grados / (GRADOS_POR_SEGUNDO_AL_100 * (p.velocidad / 100) * factor)) * 1000);
              await tween(duracion, (t) => setPose(desde.map((d, k) => d + (p.angulos[k] - d) * t)));
              actual = [...p.angulos];
            } else if (p.tipo === 'pinza') {
              const desde = abierta;
              await tween(500 / factor, (t) => setApertura(Math.round(desde + (p.apertura - desde) * t)));
              abierta = p.apertura;
            } else {
              await tween((p.segundos * 1000) / factor, () => {});
            }
          }
        }
      } finally {
        setActivo(null);
        setAnimando(false);
      }
    });
  const detener = () => {
    cancelarRef.current = true;
  };

  // --- ejecutar en el brazo (emulador o real) ----------------------------------------------------------------------------
  const ejecutar = () =>
    correr(async () => {
      if (enVivo) salirDeVivo(); // la rutina mueve el brazo: el modo en vivo no puede llevarlo de vuelta a la pose del esqueleto
      let confirmar = false;
      if (!estado?.emulador) {
        confirmar = window.confirm('Vas a ejecutar la rutina en el brazo REAL. ¿Tenés la mano en el botón de parada de emergencia?');
        if (!confirmar) return;
      }
      if (!incorporada && (sinGuardar || !lista.some((r) => r.nombre === nombre))) {
        const rutina = await guardarRutinaBrazo(nombre.trim(), pasos);
        setNombre(rutina.nombre);
        setSinGuardar(false);
        await cargarLista();
      }
      await ejecutarRutinaBrazo(incorporada ?? nombre.trim(), factor, confirmar);
      setAviso('Ejecutando… el avance se ve abajo.');
      await onCambio?.();
    });
  // --- modo en vivo: los controles mueven el brazo real (o el emulador) y el esqueleto lo refleja -------------------------------------------
  // El brazo real se guarda cada vez que llega un dato nuevo del panel; el esqueleto parte SIEMPRE de la pose real (si no, la primera orden lo llevaría de golpe
  // a la pose del esqueleto).
  useEffect(() => {
    if (estado?.angulos && !empujandoRef.current) realRef.current = estado.angulos;
  }, [estado]);

  const salirDeVivo = useCallback(() => {
    vivoRef.current = false;
    setEnVivo(false);
  }, []);

  const esperarFinDeMovimiento = async () => {
    const limite = Date.now() + ESPERA_FIN_MOVIMIENTO_MS;
    for (;;) {
      await pausa(150);
      const lectura = await estadoControlBrazo();
      if (lectura.tarea?.estado !== 'ejecutando') return lectura;
      if (Date.now() > limite) throw new Error('El brazo tardó demasiado en terminar el movimiento.');
    }
  };

  /** Lleva el brazo real hacia la pose del esqueleto en tandas cortas; si el esqueleto cambió mientras tanto, sigue con lo último. Una sola tanda a la vez. */
  const empujarVivo = async () => {
    if (empujandoRef.current || !vivoRef.current) return;
    empujandoRef.current = true;
    try {
      while (vivoRef.current && realRef.current) {
        const real = realRef.current;
        const objetivo = poseRef.current;
        const diferencia = objetivo.map((a, i) => a - real[i]);
        if (diferencia.every((d) => Math.abs(d) < 0.4)) break;
        const siguiente = real.map((r, i) => redondear(r + Math.max(-SALTO_VIVO_GRADOS, Math.min(SALTO_VIVO_GRADOS, diferencia[i]))));
        await moverArticulacionesBrazo(siguiente);
        const lectura = await esperarFinDeMovimiento();
        if (lectura.tarea?.estado !== 'terminada') throw new Error(lectura.tarea?.mensaje || 'El movimiento no terminó.');
        realRef.current = lectura.angulos ?? siguiente;
      }
    } catch (e) {
      setError(e.status === 422 ? `El brazo no puede ir ahí: ${e.message}` : e.message);
      if (e.status !== 422) salirDeVivo();
      try {
        const lectura = await estadoControlBrazo(); // el esqueleto vuelve adonde está el brazo de verdad
        if (lectura.angulos) {
          realRef.current = lectura.angulos;
          setPose(lectura.angulos.map(redondear));
        }
      } catch {
        /* sin lectura: queda como está */
      }
    } finally {
      empujandoRef.current = false;
      onCambio?.();
    }
  };

  useEffect(() => {
    if (enVivo) empujarVivo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, enVivo]);

  const empujarPinza = async () => {
    if (pinzaOcupadaRef.current || !vivoRef.current) return;
    pinzaOcupadaRef.current = true;
    try {
      while (vivoRef.current) {
        const objetivo = aperturaRef.current;
        if (Math.abs(objetivo - pinzaRealRef.current) < 15) break;
        if (objetivo >= 995) await moverPinza('abrir');
        else if (objetivo <= 5) await moverPinza('cerrar');
        else await moverPinza('ancho', Math.round(((objetivo / 1000) * CARRERA_PINZA_MM) * 10) / 10);
        pinzaRealRef.current = objetivo; // si cerró sobre una pieza se queda donde la sintió: no se insiste
      }
    } catch (e) {
      setError(`Pinza: ${e.message}`);
    } finally {
      pinzaOcupadaRef.current = false;
    }
  };

  useEffect(() => {
    if (!enVivo || !estado?.pinza?.inicializada) return undefined;
    const temporizador = setTimeout(empujarPinza, 250);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apertura, enVivo]);

  // Si el brazo se desconecta, se deshabilita o hay otro movimiento (una rutina, «Llevar pieza»), el modo en vivo se apaga solo.
  // Ojo: mientras el brazo se mueve, su modo es 7 («ejecutando»), no 5: eso NO es haberlo deshabilitado.
  const sigueHabilitado = [5, 7, 8].includes(estado?.modo);
  useEffect(() => {
    if (enVivo && (!conectado || !sigueHabilitado || (moviendo && estado?.tarea?.descripcion !== 'Mover articulaciones'))) salirDeVivo();
  }, [enVivo, conectado, sigueHabilitado, moviendo, salirDeVivo]);

  const activarVivo = () =>
    correr(async () => {
      if (!estado?.angulos) throw new Error('No hay lectura de los ángulos del brazo: esperá un momento y volvé a probar.');
      if (!estado.emulador && !window.confirm('Los controles van a mover el brazo REAL en tiempo real. ¿Está Hebert en el laboratorio, la velocidad global al 20 % y tenés la mano en la parada de emergencia?')) return;
      realRef.current = estado.angulos;
      setPose(estado.angulos.map(redondear));
      if (estado.pinza?.inicializada) {
        setApertura(estado.pinza.posicion);
        pinzaRealRef.current = estado.pinza.posicion;
      }
      vivoRef.current = true;
      setEnVivo(true);
      setAviso('Modo en vivo: lo que muevas acá lo hace el brazo. Grabá los pasos cuando esté como querés.');
    });
  const pararTodo = async () => {
    salirDeVivo();
    try {
      await pararBrazo();
    } catch (e) {
      setError(e.message);
    }
    onCambio?.();
  };

  const irAPose = () => correr(() => moverArticulacionesBrazo(pose).then(() => onCambio?.()));

  // Cuando termina la rutina en el emulador queda validada: se relee para mostrar la insignia.
  const terminada = estado?.tarea?.estado === 'terminada';
  useEffect(() => {
    if (terminada && nombre && lista.some((r) => r.nombre === nombre)) {
      obtenerRutinaBrazo(nombre).then((r) => setValidada(r.validada)).catch(() => {});
      cargarLista();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminada]);

  const alTeclado = (e) => {
    const accion = { ArrowLeft: () => mover(seleccionada, -paso), ArrowRight: () => mover(seleccionada, paso), ArrowUp: () => setSeleccionada((s) => (s + 5) % 6), ArrowDown: () => setSeleccionada((s) => (s + 1) % 6) }[e.key];
    if (accion && !animando) {
      e.preventDefault();
      accion();
    }
  };

  const enLista = lista.some((r) => r.nombre === nombre);
  const guardada = lista.some((r) => r.nombre === nombre && !r.incorporada);
  const puedeEjecutar = conectado && habilitado && !moviendo && !bloqueado && (incorporada || (nombre.trim() && pasos.length > 0));
  const textoApertura = apertura === 1000 ? 'abierta' : apertura === 0 ? 'cerrada' : apertura;

  return (
    <section className={CLASE_TARJETA} aria-labelledby="titulo-rutinas-brazo">
      <div className="flex flex-wrap items-end gap-space-sm">
        <h3 id="titulo-rutinas-brazo" className="font-body-md text-body-md text-on-surface font-medium m-0 w-full">
          Rutinas del brazo
        </h3>
        <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant min-w-[11rem] flex-1">
          Rutina
          <select className={CLASE_CAMPO} value={enLista ? nombre : ''} onChange={(e) => e.target.value && abrir(e.target.value)} disabled={bloqueado}>
            <option value="">— elegí una guardada —</option>
            {lista.map((r) => (
              <option key={r.nombre} value={r.nombre}>
                {r.nombre} ({r.pasos}){r.incorporada ? ' · incorporada' : r.validada ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={CLASE_BOTON} onClick={nueva} disabled={bloqueado}>
          <Icono nombre="add" /> Nueva
        </button>
        <label className="flex flex-col gap-1 font-body-sm text-body-sm text-on-surface-variant min-w-[11rem] flex-[2]">
          Nombre
          <input
            className={CLASE_CAMPO}
            value={nombre}
            maxLength={40}
            placeholder="por ejemplo: posición inicial"
            onChange={(e) => {
              setIncorporada(null); // con otro nombre es una rutina nueva (copia)
              setNombre(e.target.value);
              setSinGuardar(true);
            }}
          />
        </label>
        <span className={`font-body-sm text-body-sm pb-3 ${validada && !sinGuardar ? 'text-primary' : 'text-on-surface-variant'}`} aria-live="polite">
          {incorporada ? 'Incorporada · validada' : validada && !sinGuardar ? '✓ Validada (sirve para el brazo real)' : sinGuardar ? 'Sin guardar' : 'Sin validar'}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-space-md items-start">
        {/* 1 · Mover */}
        <div className="flex flex-col gap-space-sm min-w-0">
          <div className="relative rounded-xl overflow-hidden border border-outline-variant bg-surface-container aspect-[4/3] min-h-[300px] max-h-[520px] w-full" tabIndex={0} onKeyDown={alTeclado} aria-label="Canvas 3D del brazo: flechas para mover la articulación elegida">
            <EsqueletoBrazo3D angulos={pose} apertura={apertura} seleccionada={seleccionada} onSeleccionar={setSeleccionada} vista={vista} invalida={invalida} largoPinza={reglas.largoPinza} />
            <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
              {Object.entries(VISTAS_3D).map(([id, v]) => (
                <button key={id} type="button" aria-pressed={vista === id} onClick={() => setVista(id)} className={`${vista === id ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} !min-h-[36px] !px-2`}>
                  {v.etiqueta}
                </button>
              ))}
            </div>
            <p className="absolute bottom-2 left-2 right-2 m-0 font-body-sm text-body-sm text-on-surface-variant pointer-events-none">
              Arrastrá para girar · rueda para acercar · tocá un disco azul para elegir la articulación
            </p>
          </div>

          {invalida && (
            <p className={CLASE_AVISO} role="alert">
              ⚠ Pose imposible: {problemasActuales[0]}. No se puede grabar así.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-space-xs">
            {!enVivo ? (
              <button
                type="button"
                className={CLASE_BOTON}
                onClick={activarVivo}
                disabled={!conectado || !habilitado || moviendo || bloqueado}
                title={conectado && habilitado ? 'Los controles mueven el brazo conectado en tiempo real y el esqueleto lo refleja' : 'Conectá y habilitá el brazo (o el emulador) arriba'}
              >
                <Icono nombre="sensors" /> Mover el brazo en vivo
              </button>
            ) : (
              <>
                <span className="font-body-sm text-body-sm font-medium text-error" role="status">
                  ● EN VIVO: los controles mueven el brazo {estado?.emulador ? 'del emulador' : 'REAL'}
                </span>
                <button type="button" className={CLASE_BOTON} onClick={salirDeVivo}>
                  Salir del modo en vivo
                </button>
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={pararTodo}>
                  Parar el brazo
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className={`${CLASE_BOTON} self-start`}
            onClick={virtualAPosicionInicial}
            disabled={bloqueado || enVivo}
            title={enVivo ? 'En vivo moverías el brazo: salí del modo en vivo para poner solo el virtual' : 'Pone solo el brazo virtual en la posición inicial; no mueve el brazo conectado'}
          >
            <Icono nombre="home" /> Brazo virtual a la posición inicial
          </button>
          {enVivo && (
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant" aria-live="off">
              Brazo {estado?.emulador ? 'del emulador' : 'real'}: {(estado?.angulos ?? []).map((a) => `${Math.round(a)}°`).join(' ')}
              {estado?.pinza?.inicializada ? '' : ' · la pinza no está inicializada: no se mueve en vivo'}
            </p>
          )}
          <fieldset className="flex flex-col gap-space-xs border-0 p-0 m-0" disabled={animando}>
            <legend className="font-body-sm text-body-sm text-on-surface-variant mb-1">1 · Mové el brazo</legend>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
              {pose.map((valor, i) => (
                <button key={i} type="button" aria-pressed={seleccionada === i} onClick={() => setSeleccionada(i)} className={`${seleccionada === i ? CLASE_BOTON_PRIMARIO : CLASE_BOTON} flex flex-col items-center !px-1 !py-1`}>
                  <span className="font-bold">J{i + 1}</span>
                  <span className="tabular-nums text-xs">{Math.round(valor)}°</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[3rem_1fr_3rem_4.5rem] items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
              <BotonMantener etiqueta={`Bajar J${seleccionada + 1}`} onPaso={() => mover(seleccionada, -paso)}>−</BotonMantener>
              <input
                type="range"
                min={reglas.limites[seleccionada][0]}
                max={reglas.limites[seleccionada][1]}
                step="0.5"
                value={pose[seleccionada]}
                onChange={(e) => intentarPose(pose.map((a, k) => (k === seleccionada ? Number(e.target.value) : a)))}
                aria-label={`Ángulo de J${seleccionada + 1}`}
              />
              <BotonMantener etiqueta={`Subir J${seleccionada + 1}`} onPaso={() => mover(seleccionada, paso)}>+</BotonMantener>
              <span className="text-right tabular-nums">{pose[seleccionada].toFixed(1)}°</span>
            </div>
            <label className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
              Cada clic mueve
              <select className={CLASE_CAMPO} value={paso} onChange={(e) => setPaso(Number(e.target.value))}>
                {PASOS_JOG.map((g) => (
                  <option key={g} value={g}>
                    {g}°
                  </option>
                ))}
              </select>
              <span>(mantené apretado para seguir)</span>
            </label>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
              <button type="button" className={CLASE_BOTON} onClick={() => setApertura(0)}>Cerrar</button>
              <input type="range" min="0" max="1000" value={apertura} onChange={(e) => setApertura(Number(e.target.value))} aria-label="Apertura de la pinza" />
              <button type="button" className={CLASE_BOTON} onClick={() => setApertura(1000)}>Abrir</button>
            </div>
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Pinza: {textoApertura}</p>
          </fieldset>

          <details className="font-body-sm text-body-sm text-on-surface">
            <summary className="cursor-pointer text-on-surface-variant">Ajustes y brazo conectado</summary>
            <div className="flex flex-col gap-space-xs pt-space-xs">
              <label className="flex items-center gap-space-xs">
                Velocidad de las poses nuevas (de la configuración)
                <input type="number" className={`${CLASE_CAMPO} w-20`} min="1" max="100" value={velocidadPaso} onChange={(e) => setVelocidadPaso(Math.min(100, Math.max(1, Number(e.target.value))))} />%
              </label>
              <label className="flex items-center gap-space-xs">
                Fuerza de la pinza
                <input type="number" className={`${CLASE_CAMPO} w-20`} min="20" max="100" value={fuerza} onChange={(e) => setFuerza(Math.min(100, Math.max(20, Number(e.target.value))))} />%
              </label>
              <label className="flex items-center gap-space-xs">
                Velocidad de la pinza
                <input type="number" className={`${CLASE_CAMPO} w-20`} min="1" max="100" value={velocidadPinza} onChange={(e) => setVelocidadPinza(Math.min(100, Math.max(1, Number(e.target.value))))} />%
              </label>
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" className={CLASE_BOTON} onClick={deTelemetria} disabled={!estado?.angulos || animando}>Tomar la pose del brazo</button>
                <button type="button" className={CLASE_BOTON} onClick={irAPose} disabled={!habilitado || moviendo || bloqueado}>Mover el brazo a esta pose</button>
                <button type="button" className={CLASE_BOTON} onClick={() => correr(async () => setVerificacion(await verificarGeometriaBrazo()))} disabled={!conectado || Boolean(estado?.emulador) || bloqueado} title="Compara la pose que lee el controlador con la del esqueleto para los mismos ángulos (solo con el brazo real)">
                  Verificar el esqueleto con el brazo real
                </button>
              </div>
              {verificacion && (
                <p className={verificacion.coincide ? 'm-0 text-on-surface' : CLASE_AVISO} role="status">
                  {verificacion.conclusion} (error radio/altura: {JSON.stringify(verificacion.error_mm)})
                </p>
              )}
            </div>
          </details>
        </div>

        {/* 2 · Grabar, 3 · Probar, 4 · Guardar */}
        <div className="flex flex-col gap-space-sm min-w-0">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant w-full">2 · Grabá los pasos</span>
            <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={grabarPaso} disabled={bloqueado}>
              <Icono nombre="fiber_manual_record" /> Grabar paso
            </button>
            <span className="flex items-center gap-1">
              <button type="button" className={CLASE_BOTON} onClick={agregarEspera} disabled={bloqueado}>
                <Icono nombre="schedule" /> Espera
              </button>
              <input className={`${CLASE_CAMPO} w-16`} type="number" min="0" max="30" step="0.5" value={espera} onChange={(e) => setEspera(Number(e.target.value))} aria-label="Segundos de espera" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">s</span>
            </span>
            <span className="flex items-center gap-1">
              <select className={CLASE_CAMPO} value={subrutina} onChange={(e) => setSubrutina(e.target.value)} aria-label="Rutina a llamar" disabled={bloqueado}>
                <option value="">Llamar a otra rutina…</option>
                {lista.filter((r) => r.nombre !== nombre).map((r) => (
                  <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                ))}
              </select>
              <button type="button" className={CLASE_BOTON} onClick={agregarSubrutina} disabled={bloqueado || !subrutina} aria-label="Agregar la rutina elegida">
                <Icono nombre="add" />
              </button>
            </span>
          </div>

          {pasos.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant m-0 border border-dashed border-outline-variant rounded-lg p-space-sm">
              Todavía no hay pasos. Movés el brazo en el canvas y tocás «Grabar paso». Cada vez que lo toques se guarda lo que ves: la pose y, si la cambiaste, la pinza.
            </p>
          ) : (
            <ol className="list-none p-0 m-0 flex flex-col gap-1 max-h-[22rem] overflow-y-auto">
              {pasos.map((p, i) => (
                <li key={i} className={`flex items-center gap-1 border rounded-lg px-space-xs py-1 font-body-sm text-body-sm text-on-surface ${activo === i ? 'border-primary bg-surface-container-high' : elegido === i ? 'border-tertiary' : 'border-outline-variant'}`}>
                  <button type="button" className="flex-1 min-w-0 flex items-center gap-2 text-left bg-transparent border-0 p-0 min-h-[40px] text-on-surface cursor-pointer" onClick={() => elegirPaso(i)} disabled={bloqueado} aria-label={`Ver el paso ${i + 1}: ${describirPaso(p)}`}>
                    <span className="tabular-nums text-on-surface-variant w-5 shrink-0">{i + 1}</span>
                    <Icono nombre={ICONOS[p.tipo]} />
                    <span className="break-words min-w-0">{describirPaso(p)}</span>
                  </button>
                  {elegido === i && (p.tipo === 'articulaciones' || p.tipo === 'pinza') && (
                    <button type="button" className={`${CLASE_BOTON} !px-2`} onClick={() => actualizarPaso(i)} disabled={bloqueado} title="Reemplazar este paso con lo que ves en el canvas" aria-label={`Reemplazar el paso ${i + 1} con lo que ves en el canvas`}>
                      <Icono nombre="sync" />
                    </button>
                  )}
                  <button type="button" className={`${CLASE_BOTON} !px-2`} onClick={() => subir(i, -1)} aria-label={`Subir el paso ${i + 1}`} disabled={bloqueado || i === 0}><Icono nombre="arrow_upward" /></button>
                  <button type="button" className={`${CLASE_BOTON} !px-2`} onClick={() => subir(i, 1)} aria-label={`Bajar el paso ${i + 1}`} disabled={bloqueado || i === pasos.length - 1}><Icono nombre="arrow_downward" /></button>
                  <button type="button" className={`${CLASE_BOTON} !px-2`} onClick={() => quitar(i)} aria-label={`Quitar el paso ${i + 1}`} disabled={bloqueado}><Icono nombre="delete" /></button>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-col gap-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant">3 · Probala</span>
            <div className="flex flex-wrap items-center gap-space-xs">
              {animando ? (
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={detener}><Icono nombre="stop" /> Detener</button>
              ) : (
                <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={probar} disabled={ocupado || pasos.length === 0}><Icono nombre="play_arrow" /> Probar en pantalla</button>
              )}
              <label className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                Velocidad
                <select className={CLASE_CAMPO} value={factor} onChange={(e) => setFactor(Number(e.target.value))}>
                  {[0.5, 1, 1.5, 2].map((f) => (
                    <option key={f} value={f}>×{f}</option>
                  ))}
                </select>
              </label>
              <button type="button" className={CLASE_BOTON} onClick={ejecutar} disabled={!puedeEjecutar} title={estado?.emulador ? 'Corre la rutina en el emulador' : 'Corre la rutina en el brazo real (pide confirmación)'}>
                <Icono nombre="precision_manufacturing" /> {estado?.emulador ? 'Ejecutar en el emulador' : 'Ejecutar en el brazo real'}
              </button>
            </div>
            {!conectado && <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Para ejecutar, conectate (emulador o brazo) y habilitalo arriba. «Probar en pantalla» no lo necesita.</p>}
            {conectado && !habilitado && <p className="font-body-sm text-body-sm text-on-surface-variant m-0">Habilitá el brazo para poder ejecutar.</p>}
          </div>

          <div className="flex flex-col gap-space-xs">
            <span className="font-body-sm text-body-sm text-on-surface-variant">4 · Guardala</span>
            <div className="flex flex-wrap gap-space-xs">
              <button type="button" className={CLASE_BOTON_PRIMARIO} onClick={guardar} disabled={bloqueado || !!incorporada || !nombre.trim() || pasos.length === 0 || !sinGuardar}><Icono nombre="save" /> Guardar</button>
              <button type="button" className={CLASE_BOTON} onClick={borrar} disabled={bloqueado || !guardada || !!incorporada}><Icono nombre="delete" /> Borrar rutina</button>
            </div>
          </div>

          {moviendo && <p className="font-body-sm text-body-sm text-on-surface m-0" aria-live="polite">{estado.tarea.descripcion}: {estado.tarea.mensaje || 'en curso…'}</p>}
          {estado?.tarea?.estado === 'error' && <p className={CLASE_AVISO} role="alert">La última tarea falló: {estado.tarea.mensaje}</p>}
          {aviso && <p className="font-body-sm text-body-sm text-on-surface m-0" role="status">{aviso}</p>}
          {error && <p className={CLASE_AVISO} role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}
