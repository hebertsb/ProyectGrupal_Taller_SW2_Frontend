import { useState } from 'react';
import { crearInstitucion } from '../../api/backend';
import CodigoCompartible from '../../componentes/CodigoCompartible';
import { ESTADOS, NOMBRE_DEL_CICLO, bs, fechaCorta, plural } from '../Suscripcion/comunes';
import { BOTON_NEUTRO, BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_INPUT, TIPOS_INSTITUCION } from './tipos';

const DIAS_DE_PRUEBA = [7, 15, 30, 60, 90];
const VIGENCIAS_DEL_CODIGO = [
  { minutos: 1440, texto: '1 día' },
  { minutos: 4320, texto: '3 días' },
  { minutos: 10080, texto: '7 días' },
];

function Opcion({ nombre, valor, actual, alElegir, icono, titulo, detalle }) {
  const elegida = actual === valor;
  return (
    <label
      className={`flex items-start gap-space-xs p-space-sm rounded-xl border cursor-pointer min-h-11 focus-within:outline focus-within:outline-2 focus-within:outline-primary ${
        elegida ? 'border-primary bg-primary/10' : 'border-outline-variant/30 bg-surface-container hover:bg-surface-container-high'
      }`}
    >
      <input type="radio" name={nombre} value={valor} checked={elegida} onChange={() => alElegir(valor)} className="sr-only" />
      <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">{icono}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-body-sm text-body-sm font-medium text-on-surface">{titulo}</span>
        <span className="font-mono-micro text-mono-micro text-on-surface-variant">{detalle}</span>
      </span>
    </label>
  );
}

function Campo({ id, etiqueta, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <label htmlFor={id} className={CLASE_ETIQUETA}>{etiqueta}</label>
      {children}
    </div>
  );
}

/** Lo que pasó al crear: la institución con su suscripción y, si hubo invitación, el código listo para mandar por WhatsApp. */
function Resultado({ creada, alCerrar }) {
  const s = creada.suscripcion;
  const estado = s ? ESTADOS[s.estado] : null;
  return (
    <div className="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container border border-primary/30">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">check_circle</span>
          Creaste <strong className="break-words">«{creada.nombre}»</strong>
        </span>
        <button type="button" onClick={alCerrar} className={BOTON_NEUTRO}>Cerrar</button>
      </div>
      {s && estado && (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          {s.plan_nombre} ·{' '}
          <span className="font-medium text-on-surface">{estado.texto}</span>
          {s.estado === 'prueba' && <> · {plural(s.dias_restantes, 'día', 'días')} de prueba (hasta el {fechaCorta(s.prueba_hasta)})</>}
          {s.estado === 'activa' && <> · pagada hasta el {fechaCorta(s.vigente_hasta)}</>}
        </p>
      )}
      {creada.codigo_administrador ? (
        <CodigoCompartible
          codigo={creada.codigo_administrador}
          expiraEn={creada.codigo_expira_en}
          institucion={creada.nombre}
          esEvaluacion={creada.es_prueba}
          comoAdministrador
        />
      ) : (
        <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
          {creada.administrador_nombre ? `Su administrador es ${creada.administrador_nombre}.` : 'Todavía no tiene administrador: lo podés definir después desde su tarjeta.'}
        </p>
      )}
    </div>
  );
}

/**
 * Alta de una institución con todo de una vez. Hay dos caminos: invitar a probar (la persona evalúa el sistema como director y como
 * jugador antes de contratar) o dar de alta a un cliente (con prueba gratis o ya pagado). Termina mostrando el código para su director,
 * con el enlace listo para mandar por WhatsApp.
 */
export default function FormularioAlta({ facilitadores, alCrear, alError }) {
  const [camino, setCamino] = useState('prueba'); // 'prueba' | 'cliente'
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState(TIPOS_INSTITUCION[0].valor);
  const [plan, setPlan] = useState('plan_60');
  const [dias, setDias] = useState(30);
  const [condicion, setCondicion] = useState('prueba'); // cliente: 'prueba' | 'pago'
  const [ciclo, setCiclo] = useState('mensual');
  const [director, setDirector] = useState('invitar'); // cliente: 'invitar' | 'existente' | 'despues'
  const [administradorId, setAdministradorId] = useState('');
  const [vigencia, setVigencia] = useState(4320);
  const [creando, setCreando] = useState(false);
  const [creada, setCreada] = useState(null);

  function elegirCamino(nuevo) {
    setCamino(nuevo);
  }

  async function crear(evento) {
    evento.preventDefault();
    if (nombre.trim().length < 3) {
      alError('El nombre tiene que tener al menos 3 caracteres.');
      return;
    }
    if (camino === 'cliente' && director === 'existente' && administradorId === '') {
      alError('Elegí quién va a ser el administrador, o cambiá la opción.');
      return;
    }
    setCreando(true);
    alError(null);
    try {
      const esPrueba = camino === 'prueba';
      const resultado = await crearInstitucion({
        nombre,
        tipo,
        plan,
        esPrueba,
        diasDePrueba: dias,
        pagoInicialCiclo: !esPrueba && condicion === 'pago' ? ciclo : null,
        invitarAdministrador: !esPrueba && director === 'invitar',
        administradorId: !esPrueba && director === 'existente' ? Number(administradorId) : null,
        minutosDelCodigo: vigencia,
      });
      setCreada(resultado);
      setNombre('');
      setAdministradorId('');
      await alCrear();
    } catch (err) {
      alError(err.message || 'No se pudo crear la institución.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <section aria-label="Nueva institución" className="flex flex-col gap-space-md bg-surface-container-low p-space-md rounded-xl shadow-md">
      <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">Nueva institución</h2>

      {creada && <Resultado creada={creada} alCerrar={() => setCreada(null)} />}

      <form onSubmit={crear} noValidate className="flex flex-col gap-space-md">
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs">
          <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>¿Cómo la das de alta?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
            <Opcion
              nombre="camino" valor="prueba" actual={camino} alElegir={elegirCamino} icono="science"
              titulo="Invitar a probar"
              detalle="Su director prueba el sistema como director y como jugador, sin cambiar de cuenta, antes de contratar."
            />
            <Opcion
              nombre="camino" valor="cliente" actual={camino} alElegir={elegirCamino} icono="handshake"
              titulo="Cliente"
              detalle="Ya acordaron: arranca su suscripción, con prueba gratis o ya pagada."
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-xs">
          <Campo id="alta-nombre" etiqueta="Nombre" className="sm:col-span-2 xl:col-span-1">
            <input id="alta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder={camino === 'prueba' ? 'Ej.: Prueba · Colegio San Martín' : 'Ej.: Asociación de Ajedrez de Santa Cruz'} className={CLASE_INPUT} />
          </Campo>
          <Campo id="alta-tipo" etiqueta="Tipo">
            <select id="alta-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CLASE_INPUT}>
              {TIPOS_INSTITUCION.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </Campo>
          <Campo id="alta-plan" etiqueta="Plan">
            <select id="alta-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={CLASE_INPUT}>
              <option value="plan_60">Hasta 60 alumnos · {bs(350)} al mes</option>
              <option value="plan_120">Hasta 120 alumnos · {bs(500)} al mes</option>
            </select>
          </Campo>
        </div>

        {camino === 'prueba' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
            <Campo id="alta-dias" etiqueta="Cuánto dura la prueba gratis">
              <select id="alta-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={CLASE_INPUT}>
                {DIAS_DE_PRUEBA.map((d) => (
                  <option key={d} value={d}>{d} días{d === 60 ? ' (2 meses)' : ''}</option>
                ))}
              </select>
            </Campo>
            <Campo id="alta-vigencia" etiqueta="El enlace de invitación vale">
              <select id="alta-vigencia" value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))} className={CLASE_INPUT}>
                {VIGENCIAS_DEL_CODIGO.map((v) => (
                  <option key={v.minutos} value={v.minutos}>{v.texto}</option>
                ))}
              </select>
            </Campo>
            <p className="m-0 sm:col-span-2 font-mono-micro text-mono-micro text-on-surface-variant">
              Los días de prueba corren desde hoy. Cuando cierren el trato, la convertís en cliente y se queda con todo lo que armó.
            </p>
          </div>
        ) : (
          <>
            <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs">
              <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>Cómo arranca</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
                <Opcion nombre="condicion" valor="prueba" actual={condicion} alElegir={setCondicion} icono="hourglass_top" titulo="Prueba gratis" detalle="Paga después, cuando termine la prueba." />
                <Opcion nombre="condicion" valor="pago" actual={condicion} alElegir={setCondicion} icono="paid" titulo="Ya pagó" detalle="Se registra su pago ahora y queda activa." />
              </div>
              {condicion === 'prueba' ? (
                <Campo id="alta-dias-cliente" etiqueta="Días de prueba" className="sm:w-56">
                  <select id="alta-dias-cliente" value={dias} onChange={(e) => setDias(Number(e.target.value))} className={CLASE_INPUT}>
                    {DIAS_DE_PRUEBA.map((d) => (
                      <option key={d} value={d}>{d} días{d === 60 ? ' (2 meses)' : ''}</option>
                    ))}
                  </select>
                </Campo>
              ) : (
                <Campo id="alta-ciclo" etiqueta="Pagó por" className="sm:w-72">
                  <select id="alta-ciclo" value={ciclo} onChange={(e) => setCiclo(e.target.value)} className={CLASE_INPUT}>
                    {Object.entries(NOMBRE_DEL_CICLO).map(([valor, texto]) => (
                      <option key={valor} value={valor}>{texto}</option>
                    ))}
                  </select>
                </Campo>
              )}
            </fieldset>

            <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs">
              <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>Su director</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                <Opcion nombre="director" valor="invitar" actual={director} alElegir={setDirector} icono="mail" titulo="Invitarlo" detalle="Le mandás un enlace y se registra." />
                <Opcion nombre="director" valor="existente" actual={director} alElegir={setDirector} icono="person_check" titulo="Ya tiene cuenta" detalle="Elegís una cuenta de facilitador." />
                <Opcion nombre="director" valor="despues" actual={director} alElegir={setDirector} icono="schedule" titulo="Lo defino después" detalle="Lo asignás desde su tarjeta." />
              </div>
              {director === 'existente' && (
                <Campo id="alta-admin" etiqueta="Cuenta del director" className="sm:w-96">
                  <select id="alta-admin" value={administradorId} onChange={(e) => setAdministradorId(e.target.value)} className={CLASE_INPUT}>
                    <option value="">Elegí una cuenta…</option>
                    {facilitadores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre} · {f.email}</option>
                    ))}
                  </select>
                </Campo>
              )}
              {director === 'invitar' && (
                <Campo id="alta-vigencia-cliente" etiqueta="El enlace de invitación vale" className="sm:w-56">
                  <select id="alta-vigencia-cliente" value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))} className={CLASE_INPUT}>
                    {VIGENCIAS_DEL_CODIGO.map((v) => (
                      <option key={v.minutos} value={v.minutos}>{v.texto}</option>
                    ))}
                  </select>
                </Campo>
              )}
            </fieldset>
          </>
        )}

        <button type="submit" disabled={creando} className={`${BOTON_PRINCIPAL} self-start`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{camino === 'prueba' ? 'mail' : 'add'}</span>
          {creando ? 'Creando…' : camino === 'prueba' ? 'Crear y generar la invitación' : 'Crear institución'}
        </button>
      </form>
    </section>
  );
}
