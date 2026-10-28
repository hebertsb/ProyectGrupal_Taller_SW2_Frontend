import { useCallback, useEffect, useState } from 'react';
import { actualizarDatosDeFamilia, listarEstudiantesCurso, restablecerClaveDeAlumno } from '../../../api/backend';
import AvatarUsuario from '../../../componentes/AvatarUsuario';
import { enlaceWhatsApp } from '../../../whatsapp';
import { enlaceCorreoFamilia } from '../../../contactoFamilia';
import { BOTON_NEUTRO, BOTON_PELIGRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT } from '../../Suscripcion/comunes';
import ModalCuentas, { ModalClaveNueva } from './ModalCuentas';

function Chip({ children, tono = 'neutro', titulo }) {
  const clases = {
    neutro: 'bg-surface-container-high text-on-surface-variant',
    bien: 'bg-primary-container text-on-primary-container',
    atencion: 'bg-tertiary/10 text-tertiary border border-tertiary/40',
  };
  return (
    <span title={titulo} className={`font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full ${clases[tono]}`}>
      {children}
    </span>
  );
}

/** Edad y contacto de la familia de un alumno, editables en línea. */
function FormularioFamilia({ alumno, alGuardar, alCancelar }) {
  const [edad, setEdad] = useState(alumno.edad != null ? String(alumno.edad) : '');
  const [nombre, setNombre] = useState(alumno.tutor_nombre ?? '');
  const [telefono, setTelefono] = useState(alumno.tutor_telefono ?? '');
  const [correo, setCorreo] = useState(alumno.tutor_email ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    const campos = { edad: edad === '' ? null : Number(edad), tutor_nombre: nombre.trim() || null, tutor_telefono: telefono.trim() || null, tutor_email: correo.trim() || null };
    try {
      alGuardar(await actualizarDatosDeFamilia(alumno.cursoId, alumno.id, campos));
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los datos.');
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30">
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`edad-${alumno.id}`} className={CLASE_ETIQUETA}>Edad</label>
        <input id={`edad-${alumno.id}`} type="number" inputMode="numeric" min={3} max={120} value={edad} onChange={(e) => setEdad(e.target.value)} className={CLASE_INPUT} />
      </div>
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`tutor-${alumno.id}`} className={CLASE_ETIQUETA}>Madre, padre o tutor</label>
        <input id={`tutor-${alumno.id}`} type="text" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CLASE_INPUT} />
      </div>
      <div className="flex flex-col gap-space-2xs">
        <label htmlFor={`tel-${alumno.id}`} className={CLASE_ETIQUETA}>Teléfono (WhatsApp)</label>
        <input id={`tel-${alumno.id}`} type="tel" inputMode="tel" maxLength={30} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="71234567" className={CLASE_INPUT} />
      </div>
      <div className="sm:col-span-3 flex flex-col gap-space-2xs">
        <label htmlFor={`correo-tutor-${alumno.id}`} className={CLASE_ETIQUETA}>Correo de la familia (opcional)</label>
        <input id={`correo-tutor-${alumno.id}`} type="email" maxLength={254} value={correo} onChange={(e) => setCorreo(e.target.value)} className={CLASE_INPUT} />
      </div>
      {error && <div role="alert" className="sm:col-span-3 px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}
      <div className="sm:col-span-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
        <button type="button" onClick={alCancelar} disabled={ocupado} className={BOTON_NEUTRO}>Cancelar</button>
        <button type="submit" disabled={ocupado} className={BOTON_PRINCIPAL}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

/**
 * Los alumnos del curso con lo que el docente necesita para acompañarlos sin verlos en persona: si pueden jugar con otros (autorización), el contacto de su familia
 * con un botón de WhatsApp, restablecer la clave de quien la olvidó y crear las cuentas de los que no tienen correo.
 */
export default function PestanaAlumnos({ curso }) {
  const [alumnos, setAlumnos] = useState(null);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [ocupadoId, setOcupadoId] = useState(null);
  const [claveNueva, setClaveNueva] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setAlumnos(await listarEstudiantesCurso(curso.id));
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista.');
    }
  }, [curso.id]);

  useEffect(() => {
    cargar();
  }, [cargar, curso.autorizacion_familias]);

  async function restablecer(alumno) {
    setOcupadoId(alumno.id);
    setError(null);
    try {
      const respuesta = await restablecerClaveDeAlumno(curso.id, alumno.id);
      setClaveNueva({ alumno: alumno.nombre, ...respuesta });
      setConfirmandoId(null);
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la clave.');
    } finally {
      setOcupadoId(null);
    }
  }

  const sinAutorizar = (alumnos ?? []).filter((a) => !a.autorizado).length;
  const mensajeFamilia = (alumno) =>
    `Hola${alumno.tutor_nombre ? ` ${alumno.tutor_nombre}` : ''}, le escribe ${curso.facilitador_nombre}, docente de ajedrez de ${alumno.nombre} en ChessIA (curso ${curso.nombre}). `;

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          {alumnos == null ? 'Cargando alumnos…' : `${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'}${sinAutorizar > 0 ? ` · ${sinAutorizar} sin autorización para jugar con otros` : ''}`}
        </p>
        <button type="button" onClick={() => setCreando(true)} className={BOTON_PRINCIPAL}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">group_add</span>
          Crear cuentas
        </button>
      </div>

      {sinAutorizar > 0 && !curso.autorizacion_familias && (
        <p className="m-0 flex items-start gap-space-xs p-space-sm rounded-lg bg-tertiary/10 border border-tertiary/30 font-body-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5" aria-hidden="true">info</span>
          <span>
            Los menores sin autorización solo juegan contra Turing y Stockfish. Si tu colegio o academia ya tiene la autorización de las familias, activala en la pestaña <strong>Ajustes de clase</strong> y quedan todos habilitados.
          </span>
        </p>
      )}

      {error && <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}

      {alumnos && alumnos.length === 0 && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">Todavía no hay alumnos. Pasales el código del curso o creales la cuenta con «Crear cuentas».</p>
      )}

      {alumnos && alumnos.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {alumnos.map((alumno) => {
            const enlace = enlaceWhatsApp(alumno.tutor_telefono, mensajeFamilia(alumno));
            return (
              <li key={alumno.id} className="flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container-low min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-space-xs">
                  <div className="flex items-start gap-space-sm min-w-0">
                    <AvatarUsuario url={alumno.avatar_url} clase="w-9 h-9" />
                    <div className="flex flex-col gap-space-2xs min-w-0">
                      <span className="font-body-sm text-body-sm font-medium text-on-surface break-words">{alumno.nombre}</span>
                      <span className="font-mono-micro text-mono-micro text-on-surface-variant break-words">
                        {alumno.cuenta_gestionada ? 'Cuenta del docente' : <span className="break-all">{alumno.email}</span>}
                        {alumno.edad != null ? ` · ${alumno.edad} años` : ' · edad sin cargar'}
                      </span>
                      <div className="flex flex-wrap gap-space-2xs">
                        {alumno.autorizado ? (
                          <Chip tono="bien" titulo="Puede jugar con compañeros y amigos">Autorizado</Chip>
                        ) : (
                          <Chip tono="atencion" titulo="Solo juega contra Turing y Stockfish">Sin autorización</Chip>
                        )}
                        {alumno.es_menor === true && <Chip>Menor</Chip>}
                        {alumno.es_menor == null && <Chip tono="atencion">Falta la edad</Chip>}
                        {!alumno.activo && <Chip tono="atencion">Inactivo</Chip>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-space-xs lg:justify-end">
                    {alumno.tutor_email && <a href={enlaceCorreoFamilia(alumno.tutor_email, mensajeFamilia(alumno))} className={`${BOTON_NEUTRO} no-underline`} aria-label={`Escribir por correo a la familia de ${alumno.nombre}`}>
                      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">mail</span>Correo
                    </a>}
                    {enlace && (
                      <a href={enlace} target="_blank" rel="noopener noreferrer" className={`${BOTON_NEUTRO} no-underline`} aria-label={`Escribirle por WhatsApp a la familia de ${alumno.nombre}`}>
                        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">chat</span>
                        WhatsApp
                      </a>
                    )}
                    <button type="button" onClick={() => setEditandoId(editandoId === alumno.id ? null : alumno.id)} className={BOTON_NEUTRO}>
                      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">family_restroom</span>
                      Familia y edad
                    </button>
                    {alumno.cuenta_gestionada && <button type="button" onClick={() => setConfirmandoId(alumno.id)} disabled={ocupadoId != null} className={BOTON_NEUTRO}>
                      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">lock_reset</span>
                      Restablecer clave
                    </button>}
                  </div>
                </div>

                {alumno.tutor_nombre || alumno.tutor_telefono || alumno.tutor_email ? (
                  <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant break-words">
                    Familia: {alumno.tutor_nombre ?? 'sin nombre'}{alumno.tutor_telefono ? ` · ${alumno.tutor_telefono}` : ''}{alumno.tutor_email ? ` · ${alumno.tutor_email}` : ''}
                  </p>
                ) : (
                  <p className="m-0 font-mono-micro text-mono-micro text-outline">Sin contacto de la familia cargado.</p>
                )}

                {editandoId === alumno.id && (
                  <FormularioFamilia
                    alumno={{ ...alumno, cursoId: curso.id }}
                    alCancelar={() => setEditandoId(null)}
                    alGuardar={(actualizado) => {
                      setAlumnos((previos) => (previos ?? []).map((a) => (a.id === actualizado.id ? actualizado : a)));
                      setEditandoId(null);
                    }}
                  />
                )}

                {confirmandoId === alumno.id && (
                  <div role="alert" className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-error/10 border border-error/40">
                    <p className="m-0 font-body-sm text-body-sm text-on-surface break-words">
                      ¿Restablecer la clave de {alumno.nombre}? La clave anterior deja de servir y vas a ver la nueva una sola vez.
                    </p>
                    <div className="flex flex-wrap gap-space-xs">
                      <button type="button" onClick={() => restablecer(alumno)} disabled={ocupadoId != null} className={BOTON_PELIGRO}>
                        {ocupadoId === alumno.id ? 'Un momento…' : 'Sí, restablecer'}
                      </button>
                      <button type="button" onClick={() => setConfirmandoId(null)} disabled={ocupadoId != null} className={BOTON_NEUTRO}>Cancelar</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creando && <ModalCuentas curso={curso} alCerrar={() => setCreando(false)} alCreadas={cargar} />}
      {claveNueva && <ModalClaveNueva alumno={claveNueva.alumno} usuario={claveNueva.usuario} password={claveNueva.password} alCerrar={() => setClaveNueva(null)} />}
    </div>
  );
}
