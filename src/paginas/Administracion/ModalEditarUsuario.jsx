import { useEffect, useRef, useState } from 'react';
import { editarUsuario } from '../../api/backend';

const CLASE_CAMPO =
  'w-full px-space-sm py-space-xs rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed';

function Campo({ id, etiqueta, ayuda, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
        {etiqueta}
      </label>
      {children}
      {ayuda && <span className="font-mono-micro text-[10px] text-outline">{ayuda}</span>}
    </div>
  );
}

/**
 * Diálogo para editar a un usuario (solo facilitadores). Manda al servidor únicamente lo que cambió.
 * Si es el propio facilitador, el rol y el estado quedan bloqueados: no puede quitarse a sí mismo el acceso.
 */
export default function ModalEditarUsuario({ usuario, esPropio, alCerrar, alGuardar }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre ?? '',
    email: usuario.email ?? '',
    rol: usuario.rol ?? 'jugador',
    activo: usuario.activo !== false,
    edad: usuario.edad ?? '',
    descripcion: usuario.descripcion ?? '',
    nivel_estimado: usuario.nivel_estimado ?? '',
    rango_estimado: usuario.rango_estimado ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const primerCampoRef = useRef(null);

  useEffect(() => {
    primerCampoRef.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && !guardando) alCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar, guardando]);

  const cambiar = (campo) => (evento) => setForm((actual) => ({ ...actual, [campo]: evento.target.value }));

  function camposModificados() {
    const cambios = {};
    if (form.nombre.trim() !== usuario.nombre) cambios.nombre = form.nombre.trim();
    if (form.email.trim().toLowerCase() !== usuario.email) cambios.email = form.email.trim();
    if (form.rol !== usuario.rol) cambios.rol = form.rol;
    if (form.activo !== (usuario.activo !== false)) cambios.activo = form.activo;
    if (String(form.edad) !== String(usuario.edad ?? '')) cambios.edad = form.edad === '' ? null : Number(form.edad);
    if (form.descripcion !== (usuario.descripcion ?? '')) cambios.descripcion = form.descripcion;
    if (String(form.nivel_estimado) !== String(usuario.nivel_estimado ?? '') && form.nivel_estimado !== '') {
      cambios.nivel_estimado = Number(form.nivel_estimado);
    }
    if (form.rango_estimado !== (usuario.rango_estimado ?? '') && form.rango_estimado !== '') {
      cambios.rango_estimado = form.rango_estimado;
    }
    return cambios;
  }

  async function enviar(evento) {
    evento.preventDefault();
    const cambios = camposModificados();
    if (Object.keys(cambios).length === 0) {
      alCerrar();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await editarUsuario(usuario.id, cambios);
      alGuardar(actualizado);
    } catch (err) {
      setError(err.message || 'No se pudo guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !guardando) alCerrar();
      }}
    >
      <form
        onSubmit={enviar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editar-usuario"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container-low border border-outline-variant/30 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">edit</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-micro text-mono-micro uppercase tracking-widest text-primary">Editar usuario</span>
            <h2 id="titulo-editar-usuario" className="font-headline-sm text-headline-sm text-on-surface truncate">
              {usuario.nombre}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <Campo id="editar-nombre" etiqueta="Nombre">
            <input id="editar-nombre" ref={primerCampoRef} className={CLASE_CAMPO} value={form.nombre} onChange={cambiar('nombre')} minLength={2} maxLength={100} required />
          </Campo>
          <Campo id="editar-email" etiqueta="Correo">
            <input id="editar-email" type="email" className={CLASE_CAMPO} value={form.email} onChange={cambiar('email')} required />
          </Campo>
          <Campo id="editar-rol" etiqueta="Rol" ayuda={esPropio ? 'No podés cambiar tu propio rol.' : undefined}>
            <select id="editar-rol" className={CLASE_CAMPO} value={form.rol} onChange={cambiar('rol')} disabled={esPropio}>
              <option value="jugador">Jugador</option>
              <option value="facilitador">Facilitador</option>
            </select>
          </Campo>
          <Campo
            id="editar-estado"
            etiqueta="Estado"
            ayuda={esPropio ? 'No podés desactivar tu propia cuenta.' : 'Inactivo: no puede iniciar sesión, pero conserva sus datos.'}
          >
            <select
              id="editar-estado"
              className={CLASE_CAMPO}
              value={form.activo ? 'activo' : 'inactivo'}
              onChange={(evento) => setForm((actual) => ({ ...actual, activo: evento.target.value === 'activo' }))}
              disabled={esPropio}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Campo>
          <Campo id="editar-edad" etiqueta="Edad">
            <input id="editar-edad" type="number" min={0} max={120} className={CLASE_CAMPO} value={form.edad} onChange={cambiar('edad')} />
          </Campo>
          <div className="grid grid-cols-2 gap-space-xs">
            <Campo id="editar-nivel" etiqueta="Nivel (0-20)">
              <input id="editar-nivel" type="number" min={0} max={20} className={CLASE_CAMPO} value={form.nivel_estimado} onChange={cambiar('nivel_estimado')} />
            </Campo>
            <Campo id="editar-rango" etiqueta="Rango">
              <select id="editar-rango" className={CLASE_CAMPO} value={form.rango_estimado} onChange={cambiar('rango_estimado')}>
                <option value="">Sin medir</option>
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </Campo>
          </div>
        </div>
        <Campo id="editar-descripcion" etiqueta="Descripción">
          <textarea id="editar-descripcion" rows={3} maxLength={1000} className={CLASE_CAMPO} value={form.descripcion} onChange={cambiar('descripcion')} />
        </Campo>

        {error && (
          <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            className="px-space-md py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface font-body-sm text-body-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-medium transition-colors hover:bg-primary-fixed disabled:opacity-50 flex items-center justify-center gap-space-xs"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">save</span>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
