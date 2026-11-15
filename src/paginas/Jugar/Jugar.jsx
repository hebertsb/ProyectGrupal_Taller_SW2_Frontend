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
  obtenerMiElo,
  obtenerSalaActiva,
  quitarAmigo,
  retarJugador,
  rechazarSolicitudDeAmistad,
  aceptarSolicitudDeAmistad,
  unirseASala,
} from '../../api/backend';
import { enlaceDeAmigo, mensajeDeAmigo, textoDeReloj } from '../../enlaceJuego';
import { FILTROS_VACIOS, errorDeFiltros, filtrosParaEnviar, textoDeElo, textoDeFiltros, textoDePersona } from '../../elo';
import { enlaceDeWhatsApp } from '../../enlaceInvitacion';
import useModalAccesible from '../../useModalAccesible';
import FiltrosDeBusqueda from '../../componentes/FiltrosDeBusqueda';
import ModalDatosFamilia from '../../componentes/ModalDatosFamilia';
import ModalDenunciar from '../../componentes/ModalDenunciar';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT } from '../Suscripcion/comunes';

const INTERVALO_LISTA_MS = 6000;
const COLORES = [
  { valor: 'aleatorio', texto: 'Al azar', subtitulo: 'Blancas o negras', icono: 'shuffle' },
  { valor: 'blancas', texto: 'Blancas', subtitulo: 'Mueve primero', icono: 'radio_button_unchecked' },
  { valor: 'negras', texto: 'Negras', subtitulo: 'Responde segundo', icono: 'radio_button_checked' },
];
const RELACIONES = { compañero: 'Mi curso', amigo: 'Amigo', ambos: 'Curso y amigo' };

/** Una fila de botones modernos tipo «radio»: se elige una sola opción con ícono y feedback visual didáctico. */
function Opciones({ etiqueta, valor, opciones, alCambiar }) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={etiqueta}>
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant tracking-wider font-bold">
        {etiqueta}
      </span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => {
          const activo = valor === opcion.valor;
          return (
            <button
              key={String(opcion.valor)}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => alCambiar(opcion.valor)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-body-sm text-body-sm transition-all duration-200 cursor-pointer border ${
                activo
                  ? 'bg-primary text-on-primary font-bold shadow-md shadow-primary/20 border-primary ring-2 ring-primary/40 scale-[1.02]'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30 hover:border-outline-variant/60'
              }`}
            >
              {opcion.icono && (
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform ${
                    activo ? 'text-on-primary scale-110' : 'text-primary'
                  }`}
                  aria-hidden="true"
                >
                  {opcion.icono}
                </span>
              )}
              <div className="flex flex-col text-left">
                <span className="leading-tight font-medium">{opcion.texto}</span>
                {opcion.subtitulo && (
                  <span
                    className={`font-mono-micro text-[10px] leading-tight ${
                      activo ? 'text-on-primary/80 font-normal' : 'text-on-surface-variant'
                    }`}
                  >
                    {opcion.subtitulo}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const OPCIONES_RELOJ = [
  { valor: 0, texto: 'Sin reloj', subtitulo: 'Libre y sin presión', icono: 'all_inclusive' },
  { valor: 180000, texto: '3 min', subtitulo: 'Partida Blitz', icono: 'bolt' },
  { valor: 300000, texto: '5 min', subtitulo: 'Partida Rápida', icono: 'timer' },
  { valor: 600000, texto: '10 min', subtitulo: 'Ritmo Clásico', icono: 'schedule' },
  { valor: 900000, texto: '15 min', subtitulo: 'Análisis profundo', icono: 'hourglass_top' },
];

/** Una partida puntuada mueve el Elo de los dos; una amistosa se juega igual pero no lo mueve (sirve para practicar sin miedo a perder puntos). */
const OPCIONES_PUNTUACION = [
  { valor: true, texto: 'Puntuada', subtitulo: 'Mueve el Elo de ambos', icono: 'military_tech' },
  { valor: false, texto: 'Amistosa', subtitulo: 'Práctica libre sin riesgo', icono: 'handshake' },
];

function NotaDePuntuacion({ puntuada }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/20 font-mono-micro text-mono-micro text-on-surface-variant">
      <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
        {puntuada ? 'insights' : 'verified_user'}
      </span>
      <span>
        {puntuada
          ? 'Puntuada: suma o resta Elo a ambos según el resultado de la partida.'
          : 'Amistosa: se juega exactamente igual, pero no modifica el Elo. Ideal para experimentar.'}
      </span>
    </div>
  );
}

function Tarjeta({ titulo, icono, badge, children, className = '' }) {
  return (
    <section
      aria-label={titulo}
      className={`flex flex-col gap-4 bg-surface-container-low/95 border border-outline-variant/25 rounded-3xl shadow-lg p-5 sm:p-6 min-w-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/15 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icono}</span>
          </div>
          <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface font-bold">{titulo}</h2>
        </div>
        {badge && (
          <span className="px-2.5 py-0.5 rounded-full font-mono-micro text-[11px] bg-primary/10 text-primary border border-primary/20">
            {badge}
          </span>
        )}
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
  const [puntuada, setPuntuada] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  useModalAccesible(dialogoRef, { alCerrar: enviando ? null : alCerrar });

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await alEnviar(persona, color, reloj, puntuada);
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
              {textoDePersona(persona)} · {persona.en_linea ? 'en línea' : 'sin conexión ahora'}
            </span>
          </div>
        </div>
        <Opciones etiqueta="Tu color" valor={color} opciones={COLORES} alCambiar={setColor} />
        <Opciones etiqueta="Reloj por lado" valor={reloj} opciones={OPCIONES_RELOJ} alCambiar={setReloj} />
        <Opciones etiqueta="Tipo de partida" valor={puntuada} opciones={OPCIONES_PUNTUACION} alCambiar={setPuntuada} />
        <NotaDePuntuacion puntuada={puntuada} />
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
  const [puntuadaBusqueda, setPuntuadaBusqueda] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [miElo, setMiElo] = useState(null);
  const [relojPartida, setRelojPartida] = useState(300000);
  const [puntuadaPartida, setPuntuadaPartida] = useState(true);
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

  // Mi Elo (para orientar los filtros): se vuelve a pedir al terminar una partida, que es cuando cambia.
  useEffect(() => {
    obtenerMiElo().then(setMiElo).catch(() => {});
  }, [salaActiva?.codigo]);

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

  const enviarReto = async (persona, color, reloj, puntuada) => {
    const reto = await retarJugador({ retadoId: persona.id, color, controlTiempoMs: reloj, puntuada });
    setRetando(null);
    setRetoLocal({ id: reto.id, nombre: persona.nombre });
    setAviso(null);
    alRefrescarAvisos?.();
  };

  const empezarBusqueda = () =>
    accion(async () => {
      inicioBusqueda.current = Date.now();
      setAviso(null);
      const respuesta = await buscarRival(relojBusqueda, filtrosParaEnviar(filtros), puntuadaBusqueda);
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
      const sala = await crearSala(colorPartida, relojPartida, puntuadaPartida);
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
          <Tarjeta titulo="Buscar un rival" icono="travel_explore" badge="Matchmaking">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              {usuario?.nivel_estimado != null
                ? `Tu nivel es ${usuario.nivel_estimado}${usuario.rango_estimado ? ` (${usuario.rango_estimado})` : ''}${miElo ? ` y tu Elo es ${textoDeElo(miElo.elo)}${miElo.provisional ? '?' : ''}` : ''}.`
                : 'Todavía no medimos tu nivel: jugá tus partidas de diagnóstico contra Turing para que te emparejemos mejor.'}{' '}
              Te buscamos a alguien de nivel parecido, así la partida es pareja, o elegí vos un rango de Elo o de nivel con las barras deslizantes.
            </p>
            <FiltrosDeBusqueda valor={filtros} alCambiar={setFiltros} miElo={miElo ? { elo: miElo.elo, elo_provisional: miElo.provisional } : null} miNivel={usuario?.nivel_estimado ?? null} deshabilitado={buscando} />
            <Opciones etiqueta="Reloj por lado" valor={relojBusqueda} opciones={OPCIONES_RELOJ} alCambiar={setRelojBusqueda} />
            <Opciones etiqueta="Tipo de partida" valor={puntuadaBusqueda} opciones={OPCIONES_PUNTUACION} alCambiar={setPuntuadaBusqueda} />
            <NotaDePuntuacion puntuada={puntuadaBusqueda} />
            {buscando ? (
              <div className="flex flex-wrap items-center justify-between gap-space-sm p-4 rounded-2xl bg-surface-container border border-primary/30">
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />
                  <span className="font-body-sm text-body-sm text-on-surface" role="status">
                    Buscando rival… {busqueda?.segundos ?? 0} s
                    {busqueda?.tolerancia != null ? ` · hasta ${busqueda.tolerancia} ${busqueda.tolerancia === 1 ? 'nivel' : 'niveles'} de diferencia` : ''}
                    {busqueda?.filtros ? ` · ${textoDeFiltros(busqueda.filtros)}` : ''}
                  </span>
                </div>
                <button type="button" onClick={dejarDeBuscar} className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm transition-colors cursor-pointer border border-outline-variant/30">
                  Dejar de buscar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={empezarBusqueda}
                disabled={Boolean(salaActiva) || errorDeFiltros(filtros) != null}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-neon-lime text-black font-bold font-body-sm shadow-lg shadow-neon-lime/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">travel_explore</span>
                Buscar rival
              </button>
            )}
            {salaActiva && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Terminá tu partida actual para buscar otra.</p>}
          </Tarjeta>

          <Tarjeta titulo="Crear una partida y mandar el enlace" icono="share" badge="Sala privada">
            <Opciones etiqueta="Tu color" valor={colorPartida} opciones={COLORES} alCambiar={setColorPartida} />
            <Opciones etiqueta="Reloj por lado" valor={relojPartida} opciones={OPCIONES_RELOJ} alCambiar={setRelojPartida} />
            <Opciones etiqueta="Tipo de partida" valor={puntuadaPartida} opciones={OPCIONES_PUNTUACION} alCambiar={setPuntuadaPartida} />
            <NotaDePuntuacion puntuada={puntuadaPartida} />
            <button
              type="button"
              onClick={crearPartida}
              disabled={creando || Boolean(salaActiva)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold font-body-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add_circle</span>
              {creando ? 'Creando…' : 'Crear partida'}
            </button>
            <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Te damos un código y un enlace para mandar por WhatsApp. Funciona con cualquier amigo, esté o no en tu curso.</p>
            <form onSubmit={entrarConCodigo} className="flex flex-col gap-space-xs pt-3 border-t border-outline-variant/30">
              <label htmlFor="codigo-sala" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant tracking-wider font-bold">¿Te mandaron un código?</label>
              <div className="flex gap-space-xs">
                <input
                  id="codigo-sala"
                  value={codigoSala}
                  onChange={(e) => setCodigoSala(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoComplete="off"
                  placeholder="K7QM4T"
                  className="px-4 py-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm min-w-0 flex-1 uppercase tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary font-mono text-center text-lg"
                />
                <button
                  type="submit"
                  disabled={!codigoSala.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm font-medium transition-colors cursor-pointer border border-outline-variant/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Entrar
                </button>
              </div>
            </form>
          </Tarjeta>
        </div>

        <div className="flex flex-col gap-space-lg min-w-0">
          <Tarjeta titulo="Mi curso y mis amigos" icono="groups" badge="Comunidad">
            {!datos ? (
              <span role="status" className="font-mono-micro text-mono-micro text-on-surface-variant">Cargando…</span>
            ) : datos.gente.length === 0 ? (
              <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
                Todavía no tenés compañeros de curso ni amigos para retar. Agregá a alguien con su código o su correo, o buscá un rival de tu nivel.
              </p>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {datos.gente.map((persona) => (
                  <li key={persona.id} className="flex flex-wrap items-center gap-x-space-sm gap-y-space-xs p-3.5 rounded-2xl bg-surface-container border border-outline-variant/20 hover:border-outline-variant/40 transition-colors min-w-0">
                    <Avatar persona={persona} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-body-sm text-body-sm font-bold text-on-surface truncate">
                        {persona.nombre}
                        <span className="sr-only">{persona.en_linea ? ', en línea' : ', sin conexión'}</span>
                      </span>
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">
                        {RELACIONES[persona.relacion] ?? ''}
                        {persona.nivel != null ? ` · Nivel ${persona.nivel}` : ' · Nivel sin medir'}
                        {persona.elo != null ? ` · Elo ${textoDeElo(persona)}` : ''}
                        {persona.en_linea ? ' · en línea' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRetando(persona)}
                        disabled={Boolean(salaActiva)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium hover:brightness-110 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">swords</span>
                        Retar
                      </button>
                      {persona.relacion === 'compañero' && (
                        enviadas.has(persona.id) ? (
                          <span className="min-h-9 px-space-sm flex items-center font-mono-micro text-mono-micro text-on-surface-variant">Solicitud enviada</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => accion(() => mandarSolicitudDeAmistad({ usuarioId: persona.id }), `Le mandamos tu solicitud a ${persona.nombre}.`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm text-body-sm cursor-pointer border border-outline-variant/30"
                          >
                            <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">person_add</span>
                            Agregar
                          </button>
                        )
                      )}
                      {persona.relacion !== 'compañero' && (
                        <button
                          type="button"
                          onClick={() => accion(() => quitarAmigo(persona.id), `Dejaste de ser amigo de ${persona.nombre}.`)}
                          className="px-2.5 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface cursor-pointer border border-outline-variant/30"
                          aria-label={`Quitar a ${persona.nombre} de mis amigos`}
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">person_remove</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDenunciando(persona)}
                        className="px-2.5 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface cursor-pointer border border-outline-variant/30"
                        aria-label={`Bloquear o denunciar a ${persona.nombre}`}
                        title="Bloquear o denunciar"
                      >
                        <span className="material-symbols-outlined text-[16px] text-error" aria-hidden="true">flag</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {salaActiva && <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">Terminá tu partida actual para retar a alguien.</p>}
          </Tarjeta>

          <Tarjeta titulo="Agregar un amigo" icono="person_add" badge="Conexión directa">
            <form onSubmit={agregarAmigo} className="flex flex-col gap-2">
              <label htmlFor="amigo-dato" className="font-mono-micro text-mono-micro uppercase text-on-surface-variant tracking-wider font-bold">Su correo o su código de amigo</label>
              <div className="flex gap-2">
                <input
                  id="amigo-dato"
                  value={textoAmigo}
                  onChange={(e) => setTextoAmigo(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="amigo@correo.com o AB3D-K7QM"
                  className="px-4 py-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />
                <button
                  type="submit"
                  disabled={enviandoAmistad || !textoAmigo.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-primary text-on-primary font-bold font-body-sm shadow-md shadow-primary/20 hover:brightness-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Enviar
                </button>
              </div>
            </form>
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-container border border-outline-variant/20">
              <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant tracking-wider font-bold">Mi código de amigo</span>
              <span className="font-mono text-[24px] tracking-[0.18em] text-primary font-bold select-all">{miCodigo || '…'}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copiarCodigo}
                  disabled={!miCodigo}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-sm cursor-pointer border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'content_copy'}</span>
                  {copiado ? 'Copiado' : 'Copiar código'}
                </button>
                {miCodigo && (
                  <a
                    href={enlaceDeWhatsApp(mensajeDeAmigo({ enlace: enlaceAmigo, codigo: miCodigo }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-body-sm cursor-pointer border border-[#25D366]/30 no-underline"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
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
