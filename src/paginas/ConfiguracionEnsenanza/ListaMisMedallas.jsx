import { useState } from 'react';
import { borrarMedallaPropia } from '../../api/backend';
import MedallaFigurita from '../../componentes/MedallaFigurita';
import { etiquetaNivel, etiquetaPieza, normalizarNivel } from '../../medallas';
import {
  AvisoError,
  AvisoListo,
  BOTON_PELIGRO,
  BOTON_SECUNDARIO,
  BotonReintentar,
  Cargando,
  CLASE_AYUDA,
  Giro,
} from './ComunesMedallas';
import EntregarMedalla from './EntregarMedalla';
import { REGLA_MANUAL, reglaEnPalabras, textoGanadaPor } from './medallasPropias';

/** Qué pasa con los jugadores que la ganaron si se borra la medalla (para la confirmación). */
function avisoDeBorrado(medalla) {
  const ganaron = Number.isFinite(medalla.ganada_por) ? medalla.ganada_por : 0;
  if (ganaron <= 0) return `Se borra la medalla «${medalla.nombre}». Todavía no la ganó nadie.`;
  if (ganaron === 1) return `Se borra la medalla «${medalla.nombre}» y la pierde el jugador que la ganó.`;
  return `Se borra la medalla «${medalla.nombre}» y la pierden los ${ganaron} jugadores que la ganaron.`;
}

function Insignia({ icono, texto }) {
  return (
    <span className="self-start flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant border border-outline-variant/40 font-mono-micro text-mono-micro uppercase tracking-wide">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {icono}
      </span>
      {texto}
    </span>
  );
}

/**
 * Una medalla propia: su figurita, qué dice, cómo se gana, quién la ve y cuántos la ganaron, con las acciones Editar,
 * Entregar (solo las manuales) y Borrar. El borrado pide confirmación en línea y el panel de entrega se abre debajo de los
 * botones. Editar lo resuelve el padre (carga la medalla en el formulario de arriba).
 */
function TarjetaMiMedalla({ medalla, reglas, editando, esPrincipal, alEditar, alBorrada, alEntregada }) {
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState(null);
  const [entregando, setEntregando] = useState(false);

  const esManual = medalla.regla === REGLA_MANUAL;
  const reglaTexto = esManual
    ? 'Manual: la entrego yo'
    : reglaEnPalabras(reglas, medalla.regla, medalla.meta, medalla.regla_nombre);

  async function borrar() {
    setBorrando(true);
    setErrorBorrar(null);
    try {
      await borrarMedallaPropia(medalla.codigo);
      alBorrada(medalla);
    } catch (err) {
      if (err?.status === 404) {
        alBorrada(medalla); // ya no existía: se pone la lista al día igual
        return;
      }
      setErrorBorrar(err?.message || 'No se pudo borrar la medalla.');
      setBorrando(false);
    }
  }

  return (
    <li
      className={`flex flex-col gap-space-sm p-space-sm rounded-xl bg-surface-container border min-w-0 ${
        editando ? 'border-primary' : 'border-outline-variant/30'
      }`}
    >
      <div className="flex items-start gap-space-sm min-w-0">
        <MedallaFigurita medalla={medalla} tamano="sm" vistaPrevia decorativa />
        <div className="flex flex-col gap-space-2xs min-w-0 flex-1">
          <h4 className="m-0 font-body-sm text-body-sm font-semibold text-on-surface break-words">{medalla.nombre}</h4>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant break-words">{medalla.descripcion}</p>
          <span className="font-mono-micro text-mono-micro uppercase tracking-wide text-on-surface-variant">
            {etiquetaNivel(normalizarNivel(medalla.nivel))} · {etiquetaPieza(medalla.pieza)}
          </span>
          <div className="flex flex-wrap gap-space-2xs">
            {medalla.general ? (
              <Insignia icono="public" texto="General" />
            ) : (
              <Insignia icono="groups" texto={medalla.es_mia ? 'De mis cursos' : 'De sus cursos'} />
            )}
            {editando && <Insignia icono="edit" texto="Editando" />}
          </div>
        </div>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
        {reglaTexto && (
          <li className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
              {esManual ? 'back_hand' : 'flag'}
            </span>
            <span className="min-w-0 break-words">{esManual ? reglaTexto : `Se gana: ${reglaTexto}`}</span>
          </li>
        )}
        <li className="flex items-start gap-space-xs">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            emoji_events
          </span>
          <span className="min-w-0 break-words">{textoGanadaPor(medalla.ganada_por)}</span>
        </li>
        {!medalla.es_mia && medalla.creador_nombre && (
          <li className="flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
              person
            </span>
            <span className="min-w-0 break-words">Creada por {medalla.creador_nombre}</span>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-space-xs">
        <button
          type="button"
          onClick={() => {
            setConfirmandoBorrar(false);
            alEditar(medalla);
          }}
          disabled={editando || borrando}
          className={BOTON_SECUNDARIO}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            edit
          </span>
          {editando ? 'Editando' : 'Editar'}
        </button>
        {esManual && (
          <button
            type="button"
            onClick={() => setEntregando((actual) => !actual)}
            aria-expanded={entregando}
            disabled={borrando}
            className={BOTON_SECUNDARIO}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              card_giftcard
            </span>
            Entregar
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmandoBorrar((actual) => !actual)}
          aria-expanded={confirmandoBorrar}
          disabled={borrando}
          className={BOTON_PELIGRO}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            delete
          </span>
          Borrar
        </button>
      </div>

      {confirmandoBorrar && (
        <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
          <p className="m-0 font-body-sm text-body-sm text-on-surface break-words">{avisoDeBorrado(medalla)}</p>
          {errorBorrar && <AvisoError mensaje={errorBorrar} />}
          <div className="flex flex-wrap gap-space-xs">
            <button type="button" onClick={borrar} disabled={borrando} className={BOTON_PELIGRO}>
              {borrando && <Giro colores="border-error/30 border-t-error" />}
              {borrando ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoBorrar(false)}
              disabled={borrando}
              className={BOTON_SECUNDARIO}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {esManual && entregando && (
        <EntregarMedalla
          medalla={medalla}
          esPrincipal={esPrincipal}
          alEntregada={alEntregada}
          alCerrar={() => setEntregando(false)}
        />
      )}
    </li>
  );
}

/**
 * "Mis medallas": las medallas propias que el facilitador puede gestionar (el principal ve las de todos). Estados:
 * cargando, error con "Reintentar" y vacío. Usa el ancho del contenedor (`@container` en CrearMedallas.jsx) para pasar a
 * dos columnas.
 */
export default function ListaMisMedallas({
  medallas,
  cargando,
  error,
  aviso = null,
  alReintentar,
  reglas,
  esPrincipal,
  codigoEditando,
  alEditar,
  alBorrada,
  alEntregada,
}) {
  return (
    <section aria-labelledby="titulo-mis-medallas" className="flex flex-col gap-space-sm min-w-0">
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
          military_tech
        </span>
        <h3 id="titulo-mis-medallas" className="m-0 font-headline-sm text-headline-sm text-on-surface">
          Mis medallas
        </h3>
      </div>
      {esPrincipal && (
        <p className={CLASE_AYUDA}>Sos facilitador principal: acá ves las medallas propias de todos los facilitadores.</p>
      )}

      {aviso && <AvisoListo mensaje={aviso} />}

      {cargando && medallas === null && <Cargando texto="Buscando tus medallas…" />}

      {error && (
        <div className="flex flex-col gap-space-xs">
          <AvisoError mensaje={error} />
          <BotonReintentar alTocar={alReintentar} deshabilitado={cargando} />
        </div>
      )}

      {medallas !== null && medallas.length === 0 && !error && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          Todavía no creaste medallas. Probá con una de las ideas de arriba.
        </p>
      )}

      {medallas !== null && medallas.length > 0 && (
        <ul className="m-0 p-0 list-none grid grid-cols-1 @4xl:grid-cols-2 items-start gap-space-sm">
          {medallas.map((medalla) => (
            <TarjetaMiMedalla
              key={medalla.codigo}
              medalla={medalla}
              reglas={reglas}
              editando={codigoEditando === medalla.codigo}
              esPrincipal={esPrincipal}
              alEditar={alEditar}
              alBorrada={alBorrada}
              alEntregada={alEntregada}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
