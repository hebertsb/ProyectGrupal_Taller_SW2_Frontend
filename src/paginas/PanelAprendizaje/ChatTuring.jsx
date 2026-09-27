import { useEffect, useRef, useState } from 'react';
import { borrarHistorialTutor, enviarMensajeTutor, obtenerHistorialTutor } from '../../api/backend';

/**
 * Mismo patrón visual que el resto del Panel de Aprendizaje
 * (`PanelAprendizaje.jsx`/`ConfiguracionEnsenanza.jsx`). Se redefine acá en
 * vez de importarlo de `PanelAprendizaje.jsx` para no crear un import
 * circular: `PanelAprendizaje.jsx` es quien renderiza `ChatTuring`
 * (`ConfiguracionEnsenanza.jsx` hace lo mismo por la misma razón).
 */
function CargandoInline({ texto }) {
  return (
    <div className="flex items-center gap-2 py-2 text-on-surface-variant">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
      <span className="font-mono-micro text-mono-micro">{texto}</span>
    </div>
  );
}

function AvisoError({ mensaje }) {
  return (
    <div
      role="alert"
      className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center gap-2"
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
      <span>{mensaje}</span>
    </div>
  );
}

let contadorMensajeLocal = 0;
/** Id de React para cada burbuja — nunca se manda al backend, solo sirve de `key`. */
function idMensajeLocal() {
  contadorMensajeLocal += 1;
  return `turing-${contadorMensajeLocal}`;
}

function renderizarLineaConMarkdown(linea) {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const partes = linea.split(regex);

  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length >= 4) {
      return (
        <strong key={i} className="font-bold text-white tracking-wide">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length >= 2) {
      return (
        <em key={i} className="italic text-cyan-200">
          {parte.slice(1, -1)}
        </em>
      );
    }
    if (parte.startsWith('`') && parte.endsWith('`') && parte.length >= 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-black/40 text-cyan-300 font-mono text-xs border border-white/5">
          {parte.slice(1, -1)}
        </code>
      );
    }
    return parte;
  });
}

function ContenidoMensajeTutor({ contenido, esUsuario }) {
  if (!contenido) return null;
  if (esUsuario) {
    return <p className="font-body-sm text-body-sm leading-relaxed whitespace-pre-wrap">{contenido}</p>;
  }

  const parrafos = contenido.split(/\n{2,}/);

  return (
    <div className="font-body-sm text-body-sm leading-relaxed space-y-2 text-on-surface">
      {parrafos.map((parrafo, idxParrafo) => {
        const lineas = parrafo.split('\n');
        return (
          <p key={idxParrafo} className="leading-relaxed">
            {lineas.map((linea, idxLinea) => (
              <span key={idxLinea}>
                {idxLinea > 0 && <br />}
                {renderizarLineaConMarkdown(linea)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Mensaje amigable para cualquier falla al cargar el historial — mismo criterio 404/405 que `ConfiguracionEnsenanza.jsx`. */
function mensajeErrorHistorial(error) {
  if (error?.status === 404 || error?.status === 405) {
    return 'El tutor Turing todavía no está disponible en este servidor. Probá de nuevo en un rato.';
  }
  return error?.message || 'No se pudo cargar tu conversación con Turing.';
}

/** Mensaje amigable al mandar un mensaje — 503 (tutor caído/sin API key) es el caso esperado, no un crash. */
function mensajeErrorEnvio(error) {
  if (error?.status === 503) {
    return 'Turing no está disponible en este momento, probá de nuevo en un rato.';
  }
  return error?.message || 'No se pudo mandar tu mensaje. Probá de nuevo en un rato.';
}

/**
 * Chat con el tutor conversacional "Turing" — Panel de Aprendizaje. Reusa la
 * narración por voz del componente padre (`{narrar, detener, narrando,
 * vozDisponible}`, ver `useNarracion()` en `PanelAprendizaje.jsx`) en vez de
 * instanciar la suya propia: dos componentes peleando por
 * `window.speechSynthesis` al mismo tiempo rompe la narración de ambos.
 */
export default function ChatTuring({ usuario, narrar, detener, narrando, vozDisponible }) {
  const [mensajes, setMensajes] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const finListaRef = useRef(null);
  const nombreCorto = usuario?.nombre?.trim().split(/\s+/)[0] || null;

  useEffect(() => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    obtenerHistorialTutor(50)
      .then((datos) => {
        const turnos = (datos?.turnos ?? []).map((t) => ({
          id: idMensajeLocal(),
          rol: t.rol,
          contenido: t.contenido,
        }));
        setMensajes(turnos);
      })
      .catch((err) => setErrorHistorial(err))
      .finally(() => setCargandoHistorial(false));
  }, []);

  useEffect(() => {
    finListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes.length, enviando]);

  function manejarEnvio(evento) {
    evento.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || enviando || cargandoHistorial) return;

    // El mensaje del usuario se agrega de forma optimista, antes de que
    // llegue la respuesta — si falla, se queda igual en la lista (no se
    // pierde), y el aviso de error se muestra aparte.
    setMensajes((actual) => [...actual, { id: idMensajeLocal(), rol: 'user', contenido: mensaje }]);
    setTexto('');
    setErrorEnvio(null);
    setEnviando(true);

    enviarMensajeTutor(mensaje)
      .then((respuesta) => {
        setMensajes((actual) => [
          ...actual,
          { id: idMensajeLocal(), rol: 'assistant', contenido: respuesta.respuesta },
        ]);
      })
      .catch((err) => setErrorEnvio(err))
      .finally(() => setEnviando(false));
  }

  function narrarMensaje(contenido) {
    if (narrando) {
      detener();
      return;
    }
    narrar(contenido);
  }

  function manejarBorrarHistorial() {
    if (borrando) return;
    setBorrando(true);
    setErrorEnvio(null);
    borrarHistorialTutor()
      .then(() => setMensajes([]))
      .catch((err) => setErrorEnvio(err))
      .finally(() => setBorrando(false));
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-sm flex-wrap">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Preguntale a Turing sobre reglas de ajedrez o tu última partida.
        </p>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={manejarBorrarHistorial}
            disabled={borrando}
            className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-mono-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reiniciar conversación
          </button>
        )}
      </div>

      {cargandoHistorial && <CargandoInline texto="Cargando tu conversación con Turing…" />}

      {!cargandoHistorial && errorHistorial && <AvisoError mensaje={mensajeErrorHistorial(errorHistorial)} />}

      {!cargandoHistorial && !errorHistorial && mensajes.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-space-xs">
          Todavía no le preguntaste nada a Turing{nombreCorto ? `, ${nombreCorto}` : ''}. Escribí una pregunta abajo — por
          ejemplo, "¿cómo se mueve el caballo?".
        </p>
      )}

      {mensajes.length > 0 && (
        <ul
          aria-label="Conversación con Turing"
          className="flex flex-col gap-space-xs max-h-[420px] overflow-y-auto p-space-xs rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10"
        >
          {mensajes.map((m) => (
            <li
              key={m.id}
              aria-label={m.rol === 'user' ? 'Tu mensaje' : 'Respuesta de Turing'}
              className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex flex-col gap-space-2xs max-w-[85%] p-space-sm rounded-xl ${
                  m.rol === 'user'
                    ? 'bg-primary text-on-primary rounded-br-sm'
                    : 'bg-surface-container-high text-on-surface rounded-bl-sm'
                }`}
              >
                {m.rol === 'assistant' && (
                  <span className="flex items-center gap-1 font-mono-micro text-mono-micro uppercase tracking-wide text-primary">
                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                    Turing
                  </span>
                )}
                <ContenidoMensajeTutor contenido={m.contenido} esUsuario={m.rol === 'user'} />
                {m.rol === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => narrarMensaje(m.contenido)}
                    disabled={!vozDisponible}
                    aria-label={narrando ? 'Detener la lectura en voz alta' : 'Escuchar esta respuesta de Turing'}
                    className="self-start flex items-center gap-space-2xs px-space-xs py-space-2xs rounded-lg bg-surface-container-lowest hover:bg-surface-bright text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed font-mono-label text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="material-symbols-outlined text-[14px]">{narrando ? 'stop_circle' : 'volume_up'}</span>
                    {narrando ? 'Detener' : 'Escuchar'}
                  </button>
                )}
              </div>
            </li>
          ))}
          <li ref={finListaRef} aria-hidden="true" />
        </ul>
      )}

      {enviando && <CargandoInline texto="Turing está pensando…" />}

      {!enviando && errorEnvio && <AvisoError mensaje={mensajeErrorEnvio(errorEnvio)} />}

      <form onSubmit={manejarEnvio} className="flex items-center gap-space-xs">
        <label htmlFor="chat-turing-input" className="sr-only">
          Escribile una pregunta a Turing
        </label>
        <input
          id="chat-turing-input"
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando || cargandoHistorial}
          placeholder="Escribí tu pregunta para Turing…"
          maxLength={2000}
          className="flex-1 px-space-sm py-space-xs rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button
          type="submit"
          disabled={enviando || cargandoHistorial || !texto.trim()}
          className="flex items-center gap-space-2xs px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          Enviar
        </button>
      </form>
    </div>
  );
}
