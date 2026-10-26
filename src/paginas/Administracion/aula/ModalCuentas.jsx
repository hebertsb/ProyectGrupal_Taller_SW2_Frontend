import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { crearCuentasDeAlumnos } from '../../../api/backend';
import useModalAccesible from '../../../useModalAccesible';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA } from '../../Suscripcion/comunes';

const MAXIMO_POR_VEZ = 60;

/**
 * Lee la lista que escribió el docente: un alumno por línea, `Nombre, edad, Nombre de la familia, teléfono, correo del familiar` (solo el nombre es obligatorio).
 * Devuelve `{ alumnos, errores }`; las líneas vacías se ignoran.
 */
export function leerListaDeAlumnos(texto) {
  const alumnos = [];
  const errores = [];
  texto.split(/\r?\n/).forEach((linea, indice) => {
    if (!linea.trim()) return;
    const [nombre, edad, tutorNombre, tutorTelefono, tutorEmail] = linea.split(',').map((parte) => parte.trim());
    if (!nombre || nombre.length < 2) {
      errores.push(`Línea ${indice + 1}: falta el nombre.`);
      return;
    }
    const alumno = { nombre };
    if (edad) {
      const numero = Number(edad);
      if (!Number.isInteger(numero) || numero < 3 || numero > 120) {
        errores.push(`Línea ${indice + 1} («${nombre}»): la edad «${edad}» no sirve.`);
        return;
      }
      alumno.edad = numero;
    }
    if (tutorNombre) alumno.tutor_nombre = tutorNombre;
    if (tutorTelefono) alumno.tutor_telefono = tutorTelefono;
    if (tutorEmail) alumno.tutor_email = tutorEmail;
    alumnos.push(alumno);
  });
  return { alumnos, errores };
}

/** La hoja con el usuario y la clave de cada alumno. Se imprime sola (el resto de la pantalla se oculta) o se copia como texto. */
function HojaDeCuentas({ curso, cuentas, alCerrar }) {
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(null);
  const [copiado, setCopiado] = useState(false);
  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: cerrarRef });
  const direccion = window.location.origin;

  async function copiar() {
    const texto = [
      `Curso ${curso.nombre} — ${direccion}`,
      ...cuentas.map((c) => `${c.nombre}\tusuario: ${c.usuario}\tclave: ${c.password}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return createPortal(
    <div id="informe-impreso" className="fixed inset-0 z-[90] flex items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/85 backdrop-blur-sm">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-hoja-cuentas"
        className="hoja-informe w-full max-w-2xl max-h-[94dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md sm:p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary">ChessIA · Cuentas de alumnos</span>
          <h2 id="titulo-hoja-cuentas" className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">{curso.nombre}</h2>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
            Entran en <strong className="text-on-surface break-all">{direccion}</strong> escribiendo su <strong>usuario</strong> (sin @) y la <strong>clave</strong>.
            Después pueden cambiar la clave desde Mi perfil.
          </p>
        </div>

        <div role="alert" className="no-imprimir flex items-start gap-space-xs p-space-sm rounded-lg bg-tertiary/10 border border-tertiary/30 font-body-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5" aria-hidden="true">warning</span>
          <span>Las claves se ven <strong>solo esta vez</strong>. Imprimí o copiá la hoja antes de cerrar. Si un alumno la pierde, la restablecés desde la lista de alumnos.</span>
        </div>

        <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
          {cuentas.map((cuenta) => (
            <li key={cuenta.id} className="grid grid-cols-1 sm:grid-cols-3 gap-x-space-sm gap-y-space-2xs p-space-sm rounded-lg border border-outline-variant/30 break-inside-avoid">
              <span className="font-body-sm text-body-sm font-medium text-on-surface break-words min-w-0">{cuenta.nombre}</span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant min-w-0">
                Usuario: <span className="font-mono-metric text-body-sm text-on-surface select-all break-all">{cuenta.usuario}</span>
              </span>
              <span className="font-mono-micro text-mono-micro text-on-surface-variant min-w-0">
                Clave: <span className="font-mono-metric text-body-sm tracking-wider text-on-surface select-all">{cuenta.password}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="no-imprimir flex flex-col sm:flex-row flex-wrap gap-space-xs">
          <button type="button" onClick={() => window.print()} className={BOTON_PRINCIPAL}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">print</span>
            Imprimir hoja
          </button>
          <button type="button" onClick={copiar} className={BOTON_NEUTRO}>
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{copiado ? 'check' : 'content_copy'}</span>
            {copiado ? 'Copiada' : 'Copiar lista'}
          </button>
          <button ref={cerrarRef} type="button" onClick={alCerrar} className={BOTON_NEUTRO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            Ya las guardé, cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Crea las cuentas de los alumnos que no tienen correo (la mayoría de los más chicos): el docente escribe la lista y el sistema les arma un usuario corto y una
 * clave temporal, ya dentro del curso y cubiertos por la autorización de las familias si el curso la declara. Todo o nada.
 */
export default function ModalCuentas({ curso, alCerrar, alCreadas }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [cuentas, setCuentas] = useState(null);
  useModalAccesible(dialogoRef, { alCerrar: ocupado || cuentas ? null : alCerrar, focoInicialRef: campoRef });

  const { alumnos, errores } = leerListaDeAlumnos(texto);

  async function crear(evento) {
    evento.preventDefault();
    if (errores.length > 0 || alumnos.length === 0) return;
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await crearCuentasDeAlumnos(curso.id, alumnos);
      setCuentas(respuesta.cuentas);
      alCreadas?.();
    } catch (err) {
      setError(err.message || 'No se pudieron crear las cuentas.');
    } finally {
      setOcupado(false);
    }
  }

  if (cuentas) return <HojaDeCuentas curso={curso} cuentas={cuentas} alCerrar={alCerrar} />;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={crear}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-crear-cuentas"
        className="w-full max-w-xl max-h-[94dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-md sm:p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <h2 id="titulo-crear-cuentas" className="m-0 font-headline-sm text-headline-sm text-on-surface">Crear cuentas para «{curso.nombre}»</h2>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Para alumnos sin correo. Escribí uno por línea; el sistema les da un usuario y una clave temporal, y ya quedan dentro del curso.
          </p>
        </div>

        <div className="flex flex-col gap-space-2xs">
          <label htmlFor="lista-alumnos" className={CLASE_ETIQUETA}>Alumnos (hasta {MAXIMO_POR_VEZ})</label>
          <textarea
            id="lista-alumnos"
            ref={campoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            disabled={ocupado}
            placeholder={'Ana Pérez\nLuis Gómez, 11\nMaría Rojas, 9, Carla Rojas, 71234567'}
            className="w-full px-space-sm py-space-xs bg-surface-container-lowest border border-outline-variant/40 rounded-lg font-mono-metric text-body-sm text-on-surface resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          <span className="font-mono-micro text-mono-micro text-on-surface-variant">
            Formato: <code>Nombre</code> — o <code>Nombre, edad</code> — o <code>Nombre, edad, familiar, teléfono, correo del familiar</code>. Los datos de la familia son opcionales.
          </span>
        </div>

        {errores.length > 0 && (
          <ul role="alert" className="m-0 pl-space-md list-disc font-body-sm text-body-sm text-error">
            {errores.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        {alumnos.length > MAXIMO_POR_VEZ && (
          <p role="alert" className="m-0 font-body-sm text-body-sm text-error">Son {alumnos.length} alumnos: se crean hasta {MAXIMO_POR_VEZ} por vez.</p>
        )}
        {error && <div role="alert" className="px-space-sm py-space-xs rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm break-words">{error}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button type="button" onClick={alCerrar} disabled={ocupado} className={BOTON_NEUTRO}>Cancelar</button>
          <button type="submit" disabled={ocupado || alumnos.length === 0 || errores.length > 0 || alumnos.length > MAXIMO_POR_VEZ} className={BOTON_PRINCIPAL}>
            {ocupado ? 'Creando…' : `Crear ${alumnos.length} cuenta${alumnos.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </div>
  );
}

/** La clave nueva de un alumno al que se le restableció: se ve solo esta vez. */
export function ModalClaveNueva({ alumno, usuario, password, alCerrar }) {
  const dialogoRef = useRef(null);
  const cerrarRef = useRef(null);
  useModalAccesible(dialogoRef, { alCerrar, focoInicialRef: cerrarRef });
  return createPortal(
    <div id="informe-impreso" className="fixed inset-0 z-[90] flex items-center justify-center p-space-sm sm:p-space-md bg-surface-container-lowest/85 backdrop-blur-sm">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-clave-nueva"
        className="hoja-informe w-full max-w-md bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <h2 id="titulo-clave-nueva" className="m-0 font-headline-sm text-headline-sm text-on-surface break-words">Clave nueva de {alumno}</h2>
        <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container">
          <span className={CLASE_ETIQUETA}>Usuario</span>
          <span className="font-mono-metric text-[20px] text-on-surface select-all break-all">{usuario}</span>
          <span className={CLASE_ETIQUETA}>Clave</span>
          <span className="font-mono-metric text-[24px] tracking-[0.12em] text-on-surface select-all">{password}</span>
        </div>
        <p className="no-imprimir m-0 font-body-sm text-body-sm text-on-surface-variant">
          Se ve solo esta vez y la anterior ya no sirve. Pasásela al alumno: puede cambiarla desde Mi perfil.
        </p>
        <div className="no-imprimir flex flex-col sm:flex-row gap-space-xs">
          <button type="button" onClick={() => window.print()} className={BOTON_NEUTRO}>
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">print</span>
            Imprimir
          </button>
          <button ref={cerrarRef} type="button" onClick={alCerrar} className={BOTON_PRINCIPAL}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
