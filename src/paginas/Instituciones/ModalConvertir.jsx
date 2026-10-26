import { useRef, useState } from 'react';
import { convertirInstitucion } from '../../api/backend';
import useModalAccesible from '../../useModalAccesible';
import { NOMBRE_DEL_CICLO } from '../Suscripcion/comunes';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT, TIPOS_INSTITUCION } from './tipos';

/** Quita «Prueba · » o «Prueba - » del comienzo: el nombre de una institución de prueba suele llevarlo y el real no. */
function nombreSugerido(nombre) {
  return nombre.replace(/^\s*prueba\s*[·\-–:]\s*/i, '').trim();
}

/**
 * El trato se cerró: la institución de prueba pasa a ser cliente. Se corrige su nombre y su plan, se indica si ya pagó, y se borra el
 * jugador de prueba (con el botón «Ver como jugador»). Su director conserva todo lo que armó.
 */
export default function ModalConvertir({ institucion, alCerrar, alConvertida }) {
  const dialogoRef = useRef(null);
  const campoRef = useRef(null);
  const [nombre, setNombre] = useState(nombreSugerido(institucion.nombre));
  const [tipo, setTipo] = useState(institucion.tipo);
  const [plan, setPlan] = useState('');
  const [pago, setPago] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useModalAccesible(dialogoRef, { alCerrar: enviando ? null : alCerrar, focoInicialRef: campoRef });

  async function convertir(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await convertirInstitucion(institucion.id, {
        nombre: nombre.trim() !== institucion.nombre ? nombre.trim() : null,
        tipo: tipo !== institucion.tipo ? tipo : null,
        plan: plan || null,
        pagoInicialCiclo: pago || null,
      });
      alConvertida(nombre.trim() || institucion.nombre);
    } catch (err) {
      setError(err.message || 'No se pudo convertir la institución.');
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-space-md bg-surface-container-lowest/80 backdrop-blur-sm"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !enviando) alCerrar();
      }}
    >
      <form
        ref={dialogoRef}
        onSubmit={convertir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-convertir"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-low border border-outline-variant/40 rounded-2xl shadow-2xl p-space-lg flex flex-col gap-space-md"
      >
        <div className="flex flex-col gap-1">
          <h2 id="titulo-convertir" className="m-0 font-headline-sm text-headline-sm text-on-surface">Convertir en cliente</h2>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
            Cuando se confirma, la institución deja de ser de prueba y su director conserva todo lo que armó. Se borra su jugador de prueba y el
            botón «Ver como jugador» desaparece.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="conv-nombre" className={CLASE_ETIQUETA}>Nombre real de la institución</label>
          <input id="conv-nombre" ref={campoRef} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className={CLASE_INPUT} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="conv-tipo" className={CLASE_ETIQUETA}>Tipo</label>
            <select id="conv-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CLASE_INPUT}>
              {TIPOS_INSTITUCION.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="conv-plan" className={CLASE_ETIQUETA}>Plan</label>
            <select id="conv-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={CLASE_INPUT}>
              <option value="">Mantener el actual</option>
              <option value="plan_60">Hasta 60 alumnos</option>
              <option value="plan_120">Hasta 120 alumnos</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="conv-pago" className={CLASE_ETIQUETA}>¿Ya pagó?</label>
          <select id="conv-pago" value={pago} onChange={(e) => setPago(e.target.value)} className={CLASE_INPUT}>
            <option value="">No, sigue con la prueba gratis</option>
            {Object.entries(NOMBRE_DEL_CICLO).map(([valor, texto]) => (
              <option key={valor} value={valor}>Sí, pagó {texto.toLowerCase()}</option>
            ))}
          </select>
        </div>

        {error && <div role="alert" className="p-space-sm rounded-lg bg-error-container text-error font-body-sm text-body-sm break-words">{error}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-space-xs">
          <button type="button" onClick={alCerrar} disabled={enviando} className={BOTON_NEUTRO}>Cancelar</button>
          <button type="submit" disabled={enviando || nombre.trim().length < 3} className={BOTON_PRINCIPAL}>{enviando ? 'Convirtiendo…' : 'Convertir en cliente'}</button>
        </div>
      </form>
    </div>
  );
}
