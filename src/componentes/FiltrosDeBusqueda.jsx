import { ELO_MAXIMO_FILTRO, NIVEL_MAXIMO, errorDeFiltros, filtrosParaEnviar, textoDeElo } from '../elo';
import { CLASE_ETIQUETA, CLASE_INPUT } from '../paginas/Suscripcion/comunes';

const OPCIONES_ELO = Array.from({ length: ELO_MAXIMO_FILTRO / 100 + 1 }, (_, i) => i * 100);
const OPCIONES_NIVEL = Array.from({ length: NIVEL_MAXIMO + 1 }, (_, i) => i);

function Rango({ idBase, etiqueta, minimo, maximo, opciones, alCambiarMinimo, alCambiarMaximo }) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      <div className="grid grid-cols-2 gap-space-xs">
        <label className="flex flex-col gap-space-2xs font-mono-micro text-mono-micro text-on-surface-variant" htmlFor={`${idBase}-desde`}>
          Desde
          <select id={`${idBase}-desde`} value={minimo} onChange={(e) => alCambiarMinimo(e.target.value)} className={CLASE_INPUT}>
            <option value="">Sin límite</option>
            {opciones.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-space-2xs font-mono-micro text-mono-micro text-on-surface-variant" htmlFor={`${idBase}-hasta`}>
          Hasta
          <select id={`${idBase}-hasta`} value={maximo} onChange={(e) => alCambiarMaximo(e.target.value)} className={CLASE_INPUT}>
            <option value="">Sin límite</option>
            {opciones.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/**
 * Cómo elegir a quién buscar: «Nivel parecido» (como siempre) o un rango propio de **Elo** y/o de **nivel** — por ejemplo, un jugador de nivel 10 que quiere probar contra niveles 12 a 15, o
 * uno de 1000 de Elo contra 1500 a 2000. El otro jugador también tiene que aceptarlo. `valor` y `alCambiar` llevan el estado (ver `FILTROS_VACIOS` en `elo.js`); `miElo` y `miNivel` son
 * solo para orientar.
 */
export default function FiltrosDeBusqueda({ valor, alCambiar, miElo = null, miNivel = null, deshabilitado = false }) {
  const cambiar = (campo) => (nuevo) => alCambiar({ ...valor, [campo]: nuevo });
  const error = errorDeFiltros(valor);
  const sinLimites = valor.modo === 'rango' && Object.keys(filtrosParaEnviar(valor)).length === 0; // todavía no eligió nada: es una pista, no un error
  return (
    <fieldset className="m-0 p-0 border-0 flex flex-col gap-space-xs min-w-0" disabled={deshabilitado}>
      <legend className={`${CLASE_ETIQUETA} mb-space-2xs`}>A quién buscar</legend>
      <div className="flex flex-wrap gap-space-xs" role="radiogroup" aria-label="A quién buscar">
        {[
          ['parecido', 'Nivel parecido'],
          ['rango', 'Elegir Elo o nivel'],
        ].map(([modo, texto]) => (
          <button
            key={modo}
            type="button"
            role="radio"
            aria-checked={valor.modo === modo}
            onClick={() => cambiar('modo')(modo)}
            className={`min-h-11 px-space-md rounded-lg font-body-sm text-body-sm transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              valor.modo === modo ? 'bg-primary text-on-primary font-medium' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
      {valor.modo === 'rango' && (
        <div className="flex flex-col gap-space-sm p-space-sm rounded-xl bg-surface-container">
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant leading-relaxed">
            Tu Elo es <strong className="text-on-surface">{miElo != null ? textoDeElo(miElo) : '1000'}</strong>
            {miNivel != null ? <> y tu nivel es <strong className="text-on-surface">{miNivel}</strong></> : ' y todavía no mediste tu nivel'}. Dejá «Sin límite» donde no quieras filtrar: por ejemplo, Elo de 1500 a 2000
            y cualquier nivel. Tu rival también tiene que aceptarte.
          </p>
          <Rango idBase="filtro-elo" etiqueta="Elo del rival" minimo={valor.eloMin} maximo={valor.eloMax} opciones={OPCIONES_ELO} alCambiarMinimo={cambiar('eloMin')} alCambiarMaximo={cambiar('eloMax')} />
          <Rango idBase="filtro-nivel" etiqueta="Nivel del rival" minimo={valor.nivelMin} maximo={valor.nivelMax} opciones={OPCIONES_NIVEL} alCambiarMinimo={cambiar('nivelMin')} alCambiarMaximo={cambiar('nivelMax')} />
          {error && (
            <p role={sinLimites ? 'status' : 'alert'} className={`m-0 font-body-sm text-body-sm ${sinLimites ? 'text-on-surface-variant' : 'text-error'}`}>{error}</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
