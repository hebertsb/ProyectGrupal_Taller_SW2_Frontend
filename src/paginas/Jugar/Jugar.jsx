import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONTROLES_DE_TIEMPO_SALA,
  buscarRival,
  cancelarReto,
  crearSala,
  dejarDeBuscarRival,
  desbloquearJugador,
  mandarSolicitudDeAmistad,
  obtenerAmigos,
  obtenerBloqueados,
  obtenerSalaActiva,
  quitarAmigo,
  retarJugador,
  rechazarSolicitudDeAmistad,
  aceptarSolicitudDeAmistad,
  unirseASala,
} from '../../api/backend';
import { enlaceDeAmigo, mensajeDeAmigo, textoDeReloj } from '../../enlaceJuego';
import { enlaceDeWhatsApp } from '../../enlaceInvitacion';
import useModalAccesible from '../../useModalAccesible';
import ModalDatosFamilia from '../../componentes/ModalDatosFamilia';
import ModalDenunciar from '../../componentes/ModalDenunciar';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT } from '../Suscripcion/comunes';

const INTERVALO_LISTA_MS = 6000;
const COLORES = [
  { valor: 'aleatorio', texto: 'Al azar' },
  { valor: 'blancas', texto: 'Blancas' },
  { valor: 'negras', texto: 'Negras' },
];
const RELACIONES = { compañero: 'Mi curso', amigo: 'Amigo', ambos: 'Curso y amigo' };

/** Una fila de botones tipo «radio»: se elige una sola opción (sin reloj / minutos por lado, o el color). */
function Opciones({ etiqueta, valor, opciones, alCambiar }) {
  return (
    <div className="flex flex-col gap-space-2xs" role="radiogroup" aria-label={etiqueta}>
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      <div className="flex flex-wrap gap-space-xs">
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={valor === opcion.valor}
            onClick={() => alCambiar(opcion.valor)}
            className={`min-h-11 px-space-md rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              valor === opcion.valor ? 'bg-primary text-on-primary font-medium' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

const OPCIONES_RELOJ = CONTROLES_DE_TIEMPO_SALA.map((ms) => ({ valor: ms, texto: textoDeReloj(ms) }));

function Tarjeta({ titulo, icono, children, className = '' }) {
  return (
    <section aria-label={titulo} className={`flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md min-w-0 ${className}`}>
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">{icono}</span>
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Mensaje({ tipo = 'error', children, alCerrar = null }) {
  const clase = tipo === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-on-surface border border-primary/30';
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-space-sm p-space-sm rounded-xl font-body-sm text-body-sm ${clase}`}>
      <span className="min-w-0 break-words">{children}</span>
      {alCerrar && (
        <button type="button" onClick={alCerrar} aria-label="Cerrar el aviso" className="shrink-0 min-w-8 min-h-8 flex items-center justify-center">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  );
}

function Avatar({ persona }) {
  return (
    <span className="relative w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
      <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
        {persona.avatar_url ? (
          <img src={persona.avatar_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">person</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-container ${persona.en_linea ? 'bg-primary' : 'bg-outline'}`}
      />
    </span>
  );
}

/** El diálogo para elegir color y reloj antes de retar a alguien. */
function ModalRetar({ persona, alEnviar, alCerrar }) {
  const dialogoRef = useRef(null);
  const [color, setColor] = useState('aleatorio');
  const [reloj, setReloj] = useState(300000);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  useModalAccesible(dialogoRef, { alCerrar: enviando ? null : alCerrar });

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await alEnviar(persona, color, reloj);
    } catch (err) {
      setError(err.message || 'No se pudo mandar el reto.');
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !enviando) alCerrar();
      }}
    >
      <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby="titulo-retar" className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <Avatar persona={persona} />
          <div className="flex flex-col min-w-0">
            <h2 id="titulo-retar" className="m-0 font-headline-sm text-headline-sm text-on-surface truncate">Retar a {persona.nombre}</h2>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              {persona.nivel != null ? `Nivel ${persona.nivel}${persona.rango ? ` · ${persona.rango}` : ''}` : 'Nivel sin medir'} · {persona.en_linea ? 'en línea' : 'sin conexión ahora'}
            </span>
          </div>
        </div>
        <Opciones etiqueta="Tu color" valor={color} opciones={COLORES} alCambiar={setColor} />
        <Opciones etiqueta="Reloj por lado" valor={reloj} opciones={OPCIONES_RELOJ} alCambiar={setReloj} />
        {reloj > 0 && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Con reloj no se puede dejar la partida: quien se va más de 20 segundos, pierde.</p>}
        {!persona.en_linea && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Ahora no está conectado: el reto le llega si abre ChessIA en los próximos 90 segundos.</p>}
        {error && <Mensaje>{error}</Mensaje>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button type="button" onClick={alCerrar} disabled={enviando} className={BOTON_NEUTRO}>Cancelar</button>
          <button type="button" onClick={enviar} disabled={enviando} className={BOTON_PRINCIPAL}>{enviando ? 'Enviando…' : 'Enviar reto'}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * «Jugar con otros»: encontrar con quién jugar. Retar a un compañero de curso o a un amigo (se le avisa en su pantalla), buscar un rival de
 * nivel parecido, agregar amigos con su correo o su código, o crear una partida y mandar el enlace por WhatsApp. No hay chat ni búsqueda por
 * nombre: a quien no es de tu curso lo encontrás solo si sabés su correo o su código de amigo.
 */
export default function Jugar({ usuario, avisos, alRefrescarAvisos, alIrASala, alActualizarUsuario }) {
  const [datos, setDatos] = useState(null);
  const [salaActiva, setSalaActiva] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [retando, setRetando] = useState(null);
  const [retoLocal, setRetoLocal] = useState(null); // { id, nombre } mientras todavía no llegó el aviso del servidor
  const [buscando, setBuscando] = useState(false);
  const inicioBusqueda = useRef(0);
  const [relojBusqueda, setRelojBusqueda] = useState(300000);
  const [relojPartida, setRelojPartida] = useState(300000);
  const [colorPartida, setColorPartida] = useState('aleatorio');
  const [creando, setCreando] = useState(false);
  const [codigoSala, setCodigoSala] = useState('');
  const [textoAmigo, setTextoAmigo] = useState('');
  const [enviandoAmistad, setEnviandoAmistad] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [denunciando, setDenunciando] = useState(null);
  const [bloqueados, setBloqueados] = useState([]);
  const [editandoFamilia, setEditandoFamilia] = useState(false);
  const restriccion = avisos?.restriccion ?? null;

  const cargar = useCallback(async () => {
    try {
      const [amigos, sala, losBloqueados] = await Promise.all([obtenerAmigos(), obtenerSalaActiva(), obtenerBloqueados().catch(() => [])]);
      setDatos(amigos);
      setSalaActiva(sala);
      setBloqueados(losBloqueados);
    } catch (err) {
      setError((anterior) => anterior ?? (err.message || 'No se pudo cargar tu lista.'));
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, INTERVALO_LISTA_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Una solicitud nueva (o una que se resolvió) aparece al instante, sin esperar al refresco de la lista.
  useEffect(() => {
    cargar();
  }, [avisos?.solicitudes_amistad, cargar]);

  // La búsqueda de rival: el servidor informa cómo va en los avisos; si deja de informar `buscando` sin haber encontrado rival, terminó.
  const busqueda = avisos?.busqueda ?? null;
  useEffect(() => {
    if (!buscando) return;
    if (busqueda?.estado === 'sin_rival') {
      setBuscando(false);
      setAviso('No encontramos a nadie de tu nivel ahora. Probá de nuevo en un rato o retá a alguien de tu lista.');
    } else if (!busqueda && Date.now() - inicioBusqueda.current > 8000) {
      setBuscando(false);
    }
  }, [busqueda, buscando]);

  const miReto = avisos?.mi_reto?.estado === 'pendiente' ? avisos.mi_reto : null;
  const personaDeReto = (id) => datos?.gente.find((p) => p.id === id);
  const nombreDelRetado = miReto ? personaDeReto(miReto.retado_id)?.nombre : retoLocal?.nombre;
  const retoVisible = miReto ?? (retoLocal ? { id: retoLocal.id, segundos_restantes: null } : null);
  useEffect(() => {
    if (avisos?.mi_reto && avisos.mi_reto.estado !== 'pendiente') setRetoLocal(null);
  }, [avisos?.mi_reto]);

  const accion = async (funcion, mensajeOk = null) => {
    setError(null);
    try {
      const resultado = await funcion();
      if (mensajeOk) setAviso(mensajeOk);
      return resultado;
    } catch (err) {
      setError(err.message || 'No se pudo completar la acción.');
      return undefined;
    } finally {
      cargar();
    }
  };

  const enviarReto = async (persona, color, reloj) => {
    const reto = await retarJugador({ retadoId: persona.id, color, controlTiempoMs: reloj });
    setRetando(null);
    setRetoLocal({ id: reto.id, nombre: persona.nombre });
    setAviso(null);
    alRefrescarAvisos?.();
  };

  const empezarBusqueda = () =>
    accion(async () => {
      inicioBusqueda.current = Date.now();
      setAviso(null);
      const respuesta = await buscarRival(relojBusqueda);
      if (respuesta.estado === 'encontrado') return alIrASala(respuesta.codigo);
      setBuscando(true);
      alRefrescarAvisos?.();
      return undefined;
    });

  const dejarDeBuscar = () =>
    accion(async () => {
      await dejarDeBuscarRival();
      setBuscando(false);
    });

  const crearPartida = async () => {
    setCreando(true);
    setError(null);
    try {
      const sala = await crearSala(colorPartida, relojPartida);
      alIrASala(sala.codigo);
    } catch (err) {
      setError(err.message || 'No se pudo crear la partida.');
      setCreando(false);
    }
  };

  const entrarConCodigo = async (evento) => {
    evento.preventDefault();
    const codigo = codigoSala.trim().toUpperCase();
    if (!codigo) return;
    setError(null);
    try {
      const sala = await unirseASala(codigo);
      alIrASala(sala.codigo);
    } catch (err) {
      setError(err.status === 404 ? 'No existe una partida con ese código.' : err.message || 'No se pudo entrar a la partida.');
    }
  };

  const agregarAmigo = async (evento) => {
    evento.preventDefault();
    const texto = textoAmigo.trim();
    if (!texto) return;
    setEnviandoAmistad(true);
    const respuesta = await accion(() => mandarSolicitudDeAmistad(texto.includes('@') ? { email: texto } : { codigo: texto }));
    setEnviandoAmistad(false);
    if (respuesta) {
      setAviso(respuesta.mensaje);
      setTextoAmigo('');
    }
  };

  const miCodigo = datos?.mi_codigo ?? '';
  const enlaceAmigo = miCodigo ? enlaceDeAmigo(miCodigo.replace('-', '')) : '';
  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(miCodigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const rivalDeLaSala = salaActiva ? (salaActiva.rol === 'blancas' ? salaActiva.negras : salaActiva.blancas) : null;
  const enviadas = new Set((datos?.solicitudes_enviadas ?? []).map((s) => s.para.id));

  // Un menor sin autorización de su familia, o un curso en «modo clase»: se explica por qué no puede jugar con otros ahora y cómo seguir.
  if (restriccion) {
    const porAutorizacion = restriccion.motivo === 'autorizacion';
    return (
      <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">swords</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Jugar con otros</h1>
        </div>
        <section
          aria-label={porAutorizacion ? 'Falta tu autorización' : 'Modo clase'}
          className="max-w-2xl flex flex-col gap-space-sm p-space-md rounded-xl bg-tertiary/10 border border-tertiary/30"
        >
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[24px] text-tertiary" aria-hidden="true">{porAutorizacion ? 'family_restroom' : 'school'}</span>
            <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">
              {porAutorizacion ? 'Falta la autorización de tu familia' : 'Tu docente pausó las partidas entre compañeros'}
            </h2>
          </div>
          <p className="m-0 font-body-sm text-body-sm text-on-surface leading-relaxed">{restriccion.mensaje}</p>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Mientras tanto podés seguir jugando contra Turing y Stockfish, mirar tu progreso y aprender en el panel de aprendizaje.
          </p>
          {porAutorizacion && (
            <button type="button" onClick={() => setEditandoFamilia(true)} className={`${BOTON_PRINCIPAL} self-start`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
              Completar mis datos
            </button>
          )}
        </section>
        {editandoFamilia && (
          <ModalDatosFamilia
            usuario={usuario}
            falta={restriccion.falta ?? []}
            alCerrar={() => setEditandoFamilia(false)}
            alGuardar={(actualizado) => {
              setEditandoFamilia(false);
              alActualizarUsuario?.(actualizado);
              alRefrescarAvisos?.();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">swords</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Jugar con otros</h1>
        </div>
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Retá a un compañero o a un amigo, buscá un rival de tu nivel o mandá un enlace. Son partidas amistosas: no cambian tu nivel.
        </p>
      </div>

      {error && <Mensaje alCerrar={() => setError(null)}>{error}</Mensaje>}
      {aviso && <Mensaje tipo="info" alCerrar={() => setAviso(null)}>{aviso}</Mensaje>}

      {salaActiva && (
        <section aria-label="Tu partida" className="flex flex-wrap items-center justify-between gap-space-sm p-space-md rounded-xl bg-primary/10 border border-primary/40">
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">
              {salaActiva.estado === 'esperando' ? 'Tu sala espera rival' : 'Partida en curso'}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface break-words">
              {salaActiva.estado === 'esperando' ? `Código ${salaActiva.codigo}` : `Estás jugando contra ${rivalDeLaSala?.nombre_publico ?? 'tu rival'}`}
              {salaActiva.control_tiempo_ms ? ` · ${textoDeReloj(salaActiva.control_tiempo_ms)} por lado` : ''}
            </span>
          </div>
          <button type="button" onClick={() => alIrASala(salaActiva.codigo)} className={BOTON_PRINCIPAL}>Volver a la partida</button>
        </section>
      )}

      {retoVisible && (
        <section aria-label="Reto enviado" className="flex flex-wrap items-center justify-between gap-space-sm p-space-md rounded-xl bg-tertiary/10 border border-tertiary/30">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-5 h-5 border-2 border-tertiary border-t-transparent rounded-full animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />
            <span className="font-body-sm text-body-sm text-on-surface break-words" role="status">
              Esperando que {nombreDelRetado ?? 'tu rival'} acepte tu reto
              {retoVisible.segundos_restantes != null ? ` (${retoVisible.segundos_restantes} s)` : ''}…
            </span>
          </div>
          <button
            type="button"
            onClick={() => accion(async () => { await cancelarReto(retoVisible.id); setRetoLocal(null); alRefrescarAvisos?.(); })}
            className={BOTON_NEUTRO}
          >
            Cancelar reto
          </button>
        </section>
      )}

      {datos?.solicitudes_recibidas.length > 0 && (
        <Tarjeta titulo="Solicitudes de amistad" icono="person_add">
          <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
            {datos.solicitudes_recibidas.map((solicitud) => (
              <li key={solicitud.id} className="flex flex-wrap items-center gap-x-space-sm gap-y-space-xs p-space-sm rounded-xl bg-surface-container">
                <Avatar persona={solicitud.de} />
                <span className="font-body-sm text-body-sm text-on-surface min-w-0 flex-1 break-words">
                  <strong>{solicitud.de.nombre}</strong> quiere ser tu amigo
                </span>
                <div className="flex gap-space-xs">
                  <button type="button" onClick={() => accion(() => aceptarSolicitudDeAmistad(solicitud.id), `Ahora sos amigo de ${solicitud.de.nombre}.`)} className={BOTON_PRINCIPAL}>Aceptar</button>
                  <button type="button" onClick={() => accion(() => rechazarSolicitudDeAmistad(solicitud.id))} className={BOTON_NEUTRO}>Rechazar</button>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg items-start">
        <div className="flex flex-col gap-space-lg min-w-0">
          <Tarjeta titulo="Buscar un rival de mi nivel" icono="travel_explore">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              {usuario?.nivel_estimado != null
                ? `Tu nivel es ${usuario.nivel_estimado}${usuario.rango_estimado ? ` (${usuario.rango_estimado})` : ''}. Te buscamos a alguien parecido, así la partida es pareja.`
                : 'Todavía no medimos tu nivel: jugá tus partidas de diagnóstico contra Turing para que te emparejemos mejor. Mientras tanto te buscamos un rival de nivel medio.'}
            </p>
            <Opciones etiqueta="Reloj por lado" valor={relojBusqueda} opciones={OPCIONES_RELOJ} alCambiar={setRelojBusqueda} />
            {buscando ? (
              <div className="flex flex-wrap items-center justify-between gap-space-sm p-space-sm rounded-xl bg-surface-container">
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />
                  <span className="font-body-sm text-body-sm text-on-surface" role="status">
                    Buscando rival… {busqueda?.segundos ?? 0} s
                    {busqueda?.tolerancia != null ? ` · hasta ${busqueda.tolerancia} ${busqueda.tolerancia === 1 ? 'nivel' : 'niveles'} de diferencia` : ''}
                  </span>
                </div>
                <button type="button" onClick={dejarDeBuscar} className={BOTON_NEUTRO}>Dejar de buscar</button>
              </div>
            ) : (
              <button type="button" onClick={empezarBusqueda} disabled={Boolean(salaActiva)} className={`${BOTON_PRINCIPAL} self-start`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">search</span>
                Buscar rival
              </button>
            )}
            {salaActiva && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Terminá tu partida actual para buscar otra.</p>}
          </Tarjeta>

          <Tarjeta titulo="Crear una partida y mandar el enlace" icono="share">
            <Opciones etiqueta="Tu color" valor={colorPartida} opciones={COLORES} alCambiar={setColorPartida} />
            <Opciones etiqueta="Reloj por lado" valor={relojPartida} opciones={OPCIONES_RELOJ} alCambiar={setRelojPartida} />
            <button type="button" onClick={crearPartida} disabled={creando || Boolean(salaActiva)} className={`${BOTON_PRINCIPAL} self-start`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              {creando ? 'Creando…' : 'Crear partida'}
            </button>
            <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Te damos un código y un enlace para mandar por WhatsApp. Funciona con cualquier amigo, esté o no en tu curso.</p>
            <form onSubmit={entrarConCodigo} className="flex flex-col gap-space-xs pt-space-xs border-t border-outline-variant/30">
              <label htmlFor="codigo-sala" className={CLASE_ETIQUETA}>¿Te mandaron un código?</label>
              <div className="flex gap-space-xs">
                <input
                  id="codigo-sala"
                  value={codigoSala}
                  onChange={(e) => setCodigoSala(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoComplete="off"
                  placeholder="K7QM4T"
                  className={`${CLASE_INPUT} flex-1 uppercase tracking-widest`}
                />
                <button type="submit" disabled={!codigoSala.trim()} className={BOTON_NEUTRO}>Entrar</button>
              </div>
            </form>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-space-lg min-w-0">
          <Tarjeta titulo="Mi curso y mis amigos" icono="groups">
            {!datos ? (
              <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando…</span>
            ) : datos.gente.length === 0 ? (
              <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
                Todavía no tenés compañeros de curso ni amigos para retar. Agregá a alguien con su código o su correo, o buscá un rival de tu nivel.
              </p>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
                {datos.gente.map((persona) => (
                  <li key={persona.id} className="flex flex-wrap items-center gap-x-space-sm gap-y-space-xs p-space-sm rounded-xl bg-surface-container min-w-0">
                    <Avatar persona={persona} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">
                        {persona.nombre}
                        <span className="sr-only">{persona.en_linea ? ', en línea' : ', sin conexión'}</span>
                      </span>
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">
                        {RELACIONES[persona.relacion] ?? ''}
                        {persona.nivel != null ? ` · Nivel ${persona.nivel}` : ' · Nivel sin medir'}
                        {persona.en_linea ? ' · en línea' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-space-xs">
                      <button type="button" onClick={() => setRetando(persona)} disabled={Boolean(salaActiva)} className={BOTON_PRINCIPAL}>
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swords</span>
                        Retar
                      </button>
                      {persona.relacion === 'compañero' && (
                        enviadas.has(persona.id) ? (
                          <span className="min-h-10 px-space-sm flex items-center font-mono-micro text-mono-micro text-on-surface-variant">Solicitud enviada</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => accion(() => mandarSolicitudDeAmistad({ usuarioId: persona.id }), `Le mandamos tu solicitud a ${persona.nombre}.`)}
                            className={BOTON_NEUTRO}
                          >
                            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">person_add</span>
                            Agregar
                          </button>
                        )
                      )}
                      {persona.relacion !== 'compañero' && (
                        <button type="button" onClick={() => accion(() => quitarAmigo(persona.id), `Dejaste de ser amigo de ${persona.nombre}.`)} className={BOTON_NEUTRO} aria-label={`Quitar a ${persona.nombre} de mis amigos`}>
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_remove</span>
                        </button>
                      )}
                      <button type="button" onClick={() => setDenunciando(persona)} className={BOTON_NEUTRO} aria-label={`Bloquear o denunciar a ${persona.nombre}`} title="Bloquear o denunciar">
                        <span className="material-symbols-outlined text-[18px] text-error" aria-hidden="true">flag</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {salaActiva && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Terminá tu partida actual para retar a alguien.</p>}
          </Tarjeta>

          <Tarjeta titulo="Agregar un amigo" icono="person_add">
            <form onSubmit={agregarAmigo} className="flex flex-col gap-space-xs">
              <label htmlFor="amigo-dato" className={CLASE_ETIQUETA}>Su correo o su código de amigo</label>
              <div className="flex gap-space-xs">
                <input
                  id="amigo-dato"
                  value={textoAmigo}
                  onChange={(e) => setTextoAmigo(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="amigo@correo.com o AB3D-K7QM"
                  className={`${CLASE_INPUT} flex-1`}
                />
                <button type="submit" disabled={enviandoAmistad || !textoAmigo.trim()} className={BOTON_PRINCIPAL}>Enviar</button>
              </div>
            </form>
            <div className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container">
              <span className={CLASE_ETIQUETA}>Mi código de amigo</span>
              <span className="font-mono-metric text-[24px] tracking-[0.18em] text-on-surface select-all">{miCodigo || '…'}</span>
              <div className="flex flex-wrap gap-space-xs">
                <button type="button" onClick={copiarCodigo} disabled={!miCodigo} className={BOTON_NEUTRO}>
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'content_copy'}</span>
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
                {miCodigo && (
                  <a
                    href={enlaceDeWhatsApp(mensajeDeAmigo({ enlace: enlaceAmigo, codigo: miCodigo }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BOTON_NEUTRO} no-underline`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">send</span>
                    Mandar por WhatsApp
                  </a>
                )}
              </div>
              <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
                Quien lo reciba te manda una solicitud y vos la aceptás. Nadie puede buscarte por nombre.
              </p>
            </div>
          </Tarjeta>
        </div>
      </div>

      {bloqueados.length > 0 && (
        <Tarjeta titulo="Personas que bloqueé" icono="block">
          <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
            {bloqueados.map((persona) => (
              <li key={persona.id} className="flex flex-wrap items-center justify-between gap-space-xs p-space-sm rounded-xl bg-surface-container">
                <span className="font-body-sm text-body-sm text-on-surface break-words min-w-0">{persona.nombre}</span>
                <button type="button" onClick={() => accion(() => desbloquearJugador(persona.id), `Desbloqueaste a ${persona.nombre}.`)} className={BOTON_NEUTRO}>
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {retando && <ModalRetar persona={retando} alEnviar={enviarReto} alCerrar={() => setRetando(null)} />}
      {denunciando && (
        <ModalDenunciar
          persona={denunciando}
          alCerrar={() => setDenunciando(null)}
          alListo={(mensaje) => {
            setDenunciando(null);
            setAviso(mensaje);
            cargar();
          }}
        />
      )}
    </div>
  );
}
