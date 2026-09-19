import { useState, useEffect } from 'react';
import { listarUsuarios, historialPartidasUsuario } from '../../api/backend';

function roleBadge(rol) {
  return rol === 'facilitador'
    ? 'bg-tertiary-container text-tertiary font-medium'
    : 'bg-secondary-container text-secondary font-medium';
}

function estadoBadge(activo) {
  return activo
    ? { texto: 'ACTIVO', clase: 'bg-primary-container text-primary font-medium' }
    : { texto: 'INACTIVO', clase: 'bg-error-container text-error font-medium' };
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [partidasUsuario, setPartidasUsuario] = useState({ total: 0, partidas: [] });
  const [cargandoPartidas, setCargandoPartidas] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const PARTIDAS_POR_PAGINA = 10;

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const data = await listarUsuarios();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  };

  const cargarPartidasUsuario = async (usuarioId) => {
    try {
      setCargandoPartidas(true);
      const data = await historialPartidasUsuario(usuarioId, PARTIDAS_POR_PAGINA, paginaActual * PARTIDAS_POR_PAGINA);
      setPartidasUsuario(data);
    } catch (err) {
      console.error('Error al cargar partidas:', err);
      setPartidasUsuario({ total: 0, partidas: [] });
    } finally {
      setCargandoPartidas(false);
    }
  };

  const seleccionarUsuario = async (usuario) => {
    setUsuarioSeleccionado(usuario);
    setPaginaActual(0);
    await cargarPartidasUsuario(usuario.id);
  };

  const cerrarDetalle = () => {
    setUsuarioSeleccionado(null);
    setPartidasUsuario({ total: 0, partidas: [] });
  };

  const paginaSiguiente = () => {
    if ((paginaActual + 1) * PARTIDAS_POR_PAGINA < partidasUsuario.total) {
      setPaginaActual(p => p + 1);
      cargarPartidasUsuario(usuarioSeleccionado.id);
    }
  };

  const paginaAnterior = () => {
    if (paginaActual > 0) {
      setPaginaActual(p => p - 1);
      cargarPartidasUsuario(usuarioSeleccionado.id);
    }
  };

  function resultadoLegible(resultado) {
    if (resultado === null) return { texto: 'JUGANDO', clase: 'bg-surface-bright text-primary' };
    if (resultado === '1-0') return { texto: 'GANASTE', clase: 'bg-surface-bright text-primary' };
    if (resultado === '0-1') return { texto: 'GANÓ EL MOTOR', clase: 'bg-surface-bright text-secondary' };
    return { texto: 'TABLAS', clase: 'bg-surface-bright text-outline' };
  }

  return (
    <div className="w-full px-space-lg py-space-lg flex flex-col gap-space-lg animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[24px] text-primary">manage_accounts</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">Gestión de Usuarios</span>
        </div>
        <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-primary-fixed-dim">
          {usuarios.length} USUARIOS
        </span>
      </div>

      {error && (
        <div className="p-space-md rounded-xl bg-error-container text-error font-body-sm text-body-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
        {/* Lista de usuarios */}
        <section className="lg:col-span-1 flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
          <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
            <span className="font-headline-sm text-headline-sm text-on-surface">Usuarios</span>
            <button
              onClick={cargarUsuarios}
              disabled={cargando}
              className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">refresh</span>
              <span>Actualizar</span>
            </button>
          </div>

          {cargando ? (
            <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="font-mono-micro text-mono-micro">Cargando...</span>
            </div>
          ) : usuarios.length === 0 ? (
            <span className="font-mono-micro text-mono-micro text-outline px-space-xs py-space-lg">
              No hay usuarios registrados.
            </span>
          ) : (
            <div className="flex flex-col gap-space-2xs overflow-y-auto max-h-[60vh]">
              {usuarios.map((usuario) => {
                const activo = estadoBadge(usuario.activo !== false);
                return (
                  <button
                    key={usuario.id}
                    onClick={() => seleccionarUsuario(usuario)}
                    className={`group flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-all ${
                      usuarioSeleccionado?.id === usuario.id
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low'
                        : ''
                    }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-sm flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-surface-bright flex items-center justify-center text-primary flex-shrink-0">
                          <span className="material-symbols-outlined text-[20px]">{usuario.rol === 'facilitador' ? 'admin_panel_settings' : 'person'}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">{usuario.nombre}</span>
                          <span className="font-mono-micro text-mono-micro text-on-surface-variant truncate">{usuario.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-space-xs flex-shrink-0">
                        <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${activo.clase}`}>
                          {activo.texto}
                        </span>
                        <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full ${roleBadge(usuario.rol)}`}>
                          {usuario.rol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-space-2xs font-mono-micro text-mono-micro text-on-surface-variant">
                      <span>Creado: {new Date(usuario.creado_en).toLocaleDateString('es-ES')}</span>
                      {usuario.nivel_estimado && (
                        <span className="flex items-center gap-space-2xs text-primary">
                          <span className="material-symbols-outlined text-[14px]">stars</span>
                          Nivel ~{usuario.nivel_estimado} ({usuario.rango_estimado})
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detalle de partidas del usuario seleccionado */}
        <section className="lg:col-span-2 flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl shadow-md">
          {usuarioSeleccionado ? (
            <>
              <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
                <div className="flex items-center gap-space-sm">
                  <button
                    onClick={cerrarDetalle}
                    className="p-space-xs rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-surface-bright flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[24px]">{usuarioSeleccionado.rol === 'facilitador' ? 'admin_panel_settings' : 'person'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-on-surface">{usuarioSeleccionado.nombre}</span>
                    <span className="font-mono-micro text-mono-micro text-on-surface-variant">{usuarioSeleccionado.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${roleBadge(usuarioSeleccionado.rol)}`}>
                    {usuarioSeleccionado.rol.toUpperCase()}
                  </span>
                  <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${estadoBadge(usuarioSeleccionado.activo !== false).clase}`}>
                    {estadoBadge(usuarioSeleccionado.activo !== false).texto}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-space-md flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Historial de Partidas</span>
                  <span className="font-mono-micro text-mono-micro uppercase px-space-xs py-space-2xs rounded-full bg-surface-container-high text-primary-fixed-dim">
                    {partidasUsuario.total} PARTIDAS
                  </span>
                </div>

                {cargandoPartidas ? (
                  <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant flex-1">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="font-mono-micro text-mono-micro">Cargando partidas...</span>
                  </div>
                ) : partidasUsuario.partidas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant flex-1">
                    <span className="material-symbols-outlined text-[48px] mb-2">history_edu</span>
                    <span className="font-body-sm text-body-sm">Este usuario no ha jugado ninguna partida aún.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-space-2xs flex-1 overflow-y-auto">
                    {partidasUsuario.partidas.map((partida) => {
                      const estado = resultadoLegible(partida.resultado);
                      return (
                        <div key={partida.id} className="group flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container hover:bg-surface-container-high transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-9 h-9 rounded-full bg-surface-bright flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-[20px]">sports_esports</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-body-sm text-body-sm font-medium text-on-surface">#{partida.id.slice(0, 8)}</span>
                                <span className="font-mono-micro text-mono-micro text-on-surface-variant">{partida.tipo_oponente} · nivel {partida.nivel} · {partida.cantidad_jugadas} jugadas</span>
                              </div>
                            </div>
                            <span className={`font-mono-micro text-mono-micro tracking-wide uppercase px-space-xs py-space-2xs rounded-full font-medium ${estado.clase}`}>
                              {estado.texto}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-space-2xs font-mono-micro text-mono-micro text-on-surface-variant">
                            <span>{new Date(partida.fecha).toLocaleString('es-ES')}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Paginación */}
                    {partidasUsuario.total > PARTIDAS_POR_PAGINA && (
                      <div className="flex items-center justify-center gap-space-sm pt-space-md border-t border-outline-variant/20">
                        <button
                          onClick={paginaAnterior}
                          disabled={paginaActual === 0}
                          className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                          <span>Anterior</span>
                        </button>
                        <span className="font-mono-micro text-mono-micro text-on-surface-variant px-space-sm">
                          Página {paginaActual + 1} de {Math.ceil(partidasUsuario.total / PARTIDAS_POR_PAGINA)}
                        </span>
                        <button
                          onClick={paginaSiguiente}
                          disabled={(paginaActual + 1) * PARTIDAS_POR_PAGINA >= partidasUsuario.total}
                          className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-high hover:bg-surface-bright text-on-surface rounded-lg transition-colors font-mono-label text-mono-label disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                        >
                          <span>Siguiente</span>
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-space-xl text-on-surface-variant flex-1">
              <span className="material-symbols-outlined text-[48px] mb-2">touch_app</span>
              <span className="font-body-sm text-body-sm">Selecciona un usuario de la lista para ver su historial de partidas.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
