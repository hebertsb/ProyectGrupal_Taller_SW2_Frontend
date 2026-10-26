import { useCallback, useEffect, useState } from 'react';
import {
  asignarDocenteAInstitucion,
  editarInstitucion,
  listarInstituciones,
  listarUsuarios,
  quitarDocenteDeInstitucion,
} from '../../api/backend';
import {
  BOTON_NEUTRO,
  BOTON_PELIGRO,
  BOTON_PRINCIPAL,
  CLASE_ETIQUETA,
  CLASE_INPUT,
  TIPOS_INSTITUCION,
  datosDelTipo,
  plural,
} from './tipos';
import FormularioAlta from './FormularioAlta';
import ModalConvertir from './ModalConvertir';

function Numero({ valor, etiqueta }) {
  return (
    <div className="flex flex-col items-center p-space-xs rounded-lg bg-surface-container min-w-0">
      <span className="font-mono-metric text-mono-metric text-on-surface">{valor}</span>
      <span className="font-mono-micro text-mono-micro uppercase text-on-surface-variant truncate max-w-full">{etiqueta}</span>
    </div>
  );
}

/** Una institución con sus números, su administrador y sus docentes. Todo cambio vuelve a pedir la lista (`alCambiar`). */
function TarjetaInstitucion({ institucion, facilitadores, alCambiar, alAviso, alError }) {
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(institucion.nombre);
  const [tipo, setTipo] = useState(institucion.tipo);
  const [docenteNuevo, setDocenteNuevo] = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [dominio, setDominio] = useState(institucion.dominio_correo ?? '');
  const docentes = institucion.docentes ?? [];
  const disponibles = facilitadores.filter((f) => f.institucion?.id !== institucion.id);
  const tipoDatos = datosDelTipo(institucion.tipo);

  async function ejecutar(accion, mensajeOk) {
    setOcupado(true);
    alError(null);
    try {
      await accion();
      alAviso(mensajeOk);
      await alCambiar();
      return true;
    } catch (err) {
      alError(err.message || 'No se pudo completar la acción.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    const ok = await ejecutar(
      () => editarInstitucion(institucion.id, { nombre, tipo }),
      `Se guardaron los cambios de «${nombre.trim()}».`
    );
    if (ok) setEditando(false);
  }

  async function agregarDocente() {
    if (!docenteNuevo) return;
    const elegido = facilitadores.find((f) => String(f.id) === docenteNuevo);
    const ok = await ejecutar(
      () => asignarDocenteAInstitucion(institucion.id, Number(docenteNuevo)),
      `${elegido?.nombre ?? 'El docente'} ahora es parte de «${institucion.nombre}».`
    );
    if (ok) setDocenteNuevo('');
  }

  return (
    <article className="flex flex-col gap-space-md bg-surface-container-low p-space-md rounded-xl shadow-md min-w-0">
      <header className="flex items-start justify-between gap-space-sm">
        <div className="flex items-start gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[22px] text-primary shrink-0" aria-hidden="true">
            {tipoDatos.icono}
          </span>
          <div className="flex flex-col min-w-0">
            <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{institucion.nombre}</h2>
            {institucion.es_prueba && (
              <span className="self-start font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">En prueba</span>
            )}
            {institucion.es_demostracion && (
              <span className="self-start font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">Demostración</span>
            )}
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">{tipoDatos.etiqueta}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setNombre(institucion.nombre);
            setTipo(institucion.tipo);
            setEditando((v) => !v);
          }}
          disabled={ocupado}
          className={`${BOTON_NEUTRO} shrink-0`}
        >
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">edit</span>
          <span>{editando ? 'Cerrar' : 'Editar'}</span>
        </button>
      </header>

      {institucion.es_prueba && (
        <div className="flex flex-wrap items-center justify-between gap-space-xs p-space-sm rounded-xl bg-tertiary/10 border border-tertiary/30">
          <span className="font-body-sm text-body-sm text-on-surface min-w-0">
            Está evaluando el sistema. Cuando cierren el trato, convertila en cliente.
          </span>
          <button type="button" disabled={ocupado} onClick={() => setConvirtiendo(true)} className={BOTON_PRINCIPAL}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">handshake</span>
            Convertir en cliente
          </button>
        </div>
      )}

      {editando && (
        <form onSubmit={guardarEdicion} noValidate className="flex flex-col sm:flex-row sm:items-end gap-space-xs">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <label htmlFor={`inst-nombre-${institucion.id}`} className={CLASE_ETIQUETA}>Nombre</label>
            <input
              id={`inst-nombre-${institucion.id}`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              className={CLASE_INPUT}
            />
          </div>
          <div className="flex flex-col gap-1 sm:w-56 min-w-0">
            <label htmlFor={`inst-tipo-${institucion.id}`} className={CLASE_ETIQUETA}>Tipo</label>
            <select id={`inst-tipo-${institucion.id}`} value={tipo} onChange={(e) => setTipo(e.target.value)} className={CLASE_INPUT}>
              {TIPOS_INSTITUCION.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>
            {ocupado ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-space-xs">
        <Numero valor={institucion.cantidad_docentes} etiqueta="Docentes" />
        <Numero valor={institucion.cursos} etiqueta="Cursos" />
        <Numero valor={institucion.alumnos} etiqueta="Alumnos" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`inst-admin-${institucion.id}`} className={CLASE_ETIQUETA}>Administrador de la institución</label>
        <select
          id={`inst-admin-${institucion.id}`}
          value={institucion.administrador_id ?? ''}
          disabled={ocupado || docentes.length === 0}
          onChange={(e) =>
            ejecutar(
              () => editarInstitucion(institucion.id, { administrador_id: e.target.value === '' ? null : Number(e.target.value) }),
              'Se cambió el administrador.'
            )
          }
          className={CLASE_INPUT}
        >
          <option value="">Sin administrador</option>
          {docentes.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
        {docentes.length === 0 && (
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            Primero sumá un docente para poder elegir al administrador.
          </span>
        )}
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          ejecutar(
            () => editarInstitucion(institucion.id, { dominio_correo: dominio.trim() }),
            dominio.trim() ? `Solo entran con correo @${dominio.trim().replace(/^@/, '')}.` : 'Se quitó la restricción de correo institucional.'
          );
        }}
        className="flex flex-col gap-1"
      >
        <label htmlFor={`inst-dominio-${institucion.id}`} className={CLASE_ETIQUETA}>Correo institucional (opcional)</label>
        <div className="flex flex-col sm:flex-row gap-space-xs">
          <input
            id={`inst-dominio-${institucion.id}`}
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            maxLength={100}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="colegio.edu.bo"
            className={`${CLASE_INPUT} flex-1`}
          />
          <button type="submit" disabled={ocupado || dominio.trim() === (institucion.dominio_correo ?? '')} className={BOTON_NEUTRO}>
            Guardar dominio
          </button>
        </div>
        <span className="font-mono-micro text-mono-micro text-on-surface-variant leading-relaxed">
          Si lo definís, a los cursos de esta institución solo entran jugadores que comprobaron la propiedad de un correo de ese dominio, mediante Google o un código enviado por correo.
          Vacío = entra cualquiera con el código. Las cuentas que el docente crea desde el curso no dependen del dominio. Esto no declara la autorización de las familias: esa se configura en el curso.
        </span>
      </form>

      <section aria-label={`Docentes de ${institucion.nombre}`} className="flex flex-col gap-space-xs">
        <span className={CLASE_ETIQUETA}>{plural(docentes.length, 'docente', 'docentes')}</span>
        {docentes.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs">
            {docentes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-space-xs p-space-xs rounded-lg bg-surface-container">
                <div className="flex flex-col min-w-0">
                  <span className="font-body-sm text-body-sm text-on-surface truncate">
                    {d.nombre}
                    {d.es_administrador && (
                      <span className="ml-space-xs font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-tertiary-container text-tertiary">
                        Admin
                      </span>
                    )}
                  </span>
                  <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">{d.email}</span>
                </div>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    ejecutar(() => quitarDocenteDeInstitucion(institucion.id, d.id), `${d.nombre} ya no es parte de la institución.`)
                  }
                  aria-label={`Quitar a ${d.nombre} de ${institucion.nombre}`}
                  className={`${BOTON_PELIGRO} shrink-0`}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">person_remove</span>
                  <span className="hidden sm:inline">Quitar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col sm:flex-row gap-space-xs">
          <label htmlFor={`inst-docente-${institucion.id}`} className="sr-only">Sumar un docente</label>
          <select
            id={`inst-docente-${institucion.id}`}
            value={docenteNuevo}
            onChange={(e) => setDocenteNuevo(e.target.value)}
            disabled={ocupado || disponibles.length === 0}
            className={`${CLASE_INPUT} flex-1`}
          >
            <option value="">{disponibles.length === 0 ? 'No hay más facilitadores para sumar' : 'Sumar un docente…'}</option>
            {disponibles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre} · {f.email}
                {f.institucion ? ` (hoy en ${f.institucion.nombre})` : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={agregarDocente} disabled={ocupado || !docenteNuevo} className={BOTON_PRINCIPAL}>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">person_add</span>
            <span>Agregar</span>
          </button>
        </div>
      </section>
      {convirtiendo && (
        <ModalConvertir
          institucion={institucion}
          alCerrar={() => setConvirtiendo(false)}
          alConvertida={async (nombreFinal) => {
            setConvirtiendo(false);
            alAviso(`«${nombreFinal}» ahora es cliente. Su director conserva todo lo que armó.`);
            await alCambiar();
          }}
        />
      )}
    </article>
  );
}

/** Instituciones clientes (solo la plataforma): crearlas, editarlas y armar su equipo de docentes. */
export default function Instituciones() {
  const [instituciones, setInstituciones] = useState(null); // null = todavía no se cargó
  const [facilitadores, setFacilitadores] = useState([]);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [lista, usuarios] = await Promise.all([listarInstituciones(), listarUsuarios()]);
      setInstituciones(lista);
      setFacilitadores(usuarios.filter((u) => u.rol === 'facilitador' && u.activo !== false && !u.es_principal));
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las instituciones.');
      setInstituciones((previas) => previas ?? []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs min-w-0">
          <span className="material-symbols-outlined text-[24px] text-primary shrink-0" aria-hidden="true">apartment</span>
          <h1 className="m-0 font-headline-sm text-headline-sm text-on-surface">Instituciones</h1>
        </div>
        <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-primary-fixed-dim shrink-0">
          {instituciones ? plural(instituciones.length, 'institución', 'instituciones') : '…'}
        </span>
      </div>

      {error && (
        <div role="alert" className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm break-words">
          {error}
        </div>
      )}
      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-space-sm px-space-md py-space-sm rounded-xl bg-primary/10 border border-primary/30 text-on-surface font-body-sm text-body-sm"
        >
          <span className="min-w-0 break-words">{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <FormularioAlta facilitadores={facilitadores} alCrear={cargar} alError={setError} />

      {instituciones === null ? (
        <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-2"></div>
          <span className="font-mono-micro text-mono-micro">Cargando instituciones…</span>
        </div>
      ) : instituciones.length === 0 ? (
        <p className="m-0 p-space-lg rounded-xl bg-surface-container-low text-center font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay instituciones. Creá la primera con el formulario de arriba.
        </p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
          {instituciones.map((institucion) => (
            <TarjetaInstitucion
              key={institucion.id}
              institucion={institucion}
              facilitadores={facilitadores}
              alCambiar={cargar}
              alAviso={setAviso}
              alError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
