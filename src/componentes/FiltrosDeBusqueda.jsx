import { useState, useId } from 'react';
import { ELO_MAXIMO_FILTRO, NIVEL_MAXIMO, errorDeFiltros, filtrosParaEnviar, textoDeElo } from '../elo';

const ELO_MIN_ABSOLUTO = 800;
const ELO_MAX_ABSOLUTO = 2600;
const ELO_PASO = 50;

/**
 * Componente didáctico de control de rango para Elo o Nivel.
 * Incluye barra visual deslizante, etiquetas de límites interactivos y botones de acceso rápido.
 */
function ControlRangoDidactico({
  idBase,
  titulo,
  icono,
  subtitulo,
  minVal,
  maxVal,
  minAbsoluto,
  maxAbsoluto,
  paso = 1,
  unidad = '',
  alCambiarMin,
  alCambiarMax,
  onSinLimite,
  presets = [],
  bandasInfo = null,
}) {
  const tieneFiltro = minVal !== '' || maxVal !== '';

  const valorMinNum = minVal === '' ? minAbsoluto : Number(minVal);
  const valorMaxNum = maxVal === '' ? maxAbsoluto : Number(maxVal);

  // Porcentajes para la barra visual
  const pctMin = Math.round(((valorMinNum - minAbsoluto) / (maxAbsoluto - minAbsoluto)) * 100);
  const pctMax = Math.round(((valorMaxNum - minAbsoluto) / (maxAbsoluto - minAbsoluto)) * 100);

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/30">
      {/* Cabecera del filtro */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">{icono}</span>
          <div className="flex flex-col">
            <span className="font-body-sm text-body-sm font-bold text-on-surface">{titulo}</span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">{subtitulo}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSinLimite}
          className={`px-2.5 py-1 rounded-lg font-mono-micro text-mono-micro transition-colors ${
            !tieneFiltro
              ? 'bg-neon-lime/20 text-neon-lime border border-neon-lime/40 font-bold'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30'
          }`}
        >
          {!tieneFiltro ? '✓ Sin límite (Cualquiera)' : 'Quitar límites'}
        </button>
      </div>

      {/* Indicador visual destacado del rango actual */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/20">
        <div className="flex flex-col">
          <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Mínimo</span>
          <span className="font-mono text-base font-bold text-primary">
            {minVal === '' ? 'Sin límite' : `${minVal} ${unidad}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-mono-micro text-mono-micro font-bold border border-primary/20">
          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          <span>
            {!tieneFiltro
              ? 'Cualquier rival'
              : `${minVal === '' ? minAbsoluto : minVal} ── ${maxVal === '' ? maxAbsoluto : maxVal} ${unidad}`}
          </span>
        </div>

        <div className="flex flex-col text-right">
          <span className="font-mono-micro text-mono-micro text-on-surface-variant uppercase">Máximo</span>
          <span className="font-mono text-base font-bold text-neon-lime">
            {maxVal === '' ? 'Sin límite' : `${maxVal} ${unidad}`}
          </span>
        </div>
      </div>

      {/* Barra de progreso visual que ilustra el rango activo */}
      <div className="relative w-full h-3 rounded-full bg-surface-container-highest overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-primary to-neon-lime transition-all duration-150"
          style={{
            left: `${tieneFiltro ? pctMin : 0}%`,
            width: `${tieneFiltro ? Math.max(2, pctMax - pctMin) : 100}%`,
            opacity: tieneFiltro ? 1 : 0.25,
          }}
        />
      </div>

      {/* Controles deslizantes para ajustar los dos extremos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono-micro text-mono-micro text-on-surface-variant">
            <span>Ajustar Desde</span>
            <span className="text-primary font-bold">{minVal === '' ? 'Sin límite' : `${minVal} ${unidad}`}</span>
          </div>
          <input
            id={`${idBase}-desde-slider`}
            type="range"
            min={minAbsoluto}
            max={valorMaxNum}
            step={paso}
            value={valorMinNum}
            onChange={(e) => alCambiarMin(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer h-2 bg-surface-container-highest rounded-lg"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono-micro text-mono-micro text-on-surface-variant">
            <span>Ajustar Hasta</span>
            <span className="text-neon-lime font-bold">{maxVal === '' ? 'Sin límite' : `${maxVal} ${unidad}`}</span>
          </div>
          <input
            id={`${idBase}-hasta-slider`}
            type="range"
            min={valorMinNum}
            max={maxAbsoluto}
            step={paso}
            value={valorMaxNum}
            onChange={(e) => alCambiarMax(Number(e.target.value))}
            className="w-full accent-neon-lime cursor-pointer h-2 bg-surface-container-highest rounded-lg"
          />
        </div>
      </div>

      {/* Bandas informativas didácticas (si aplica para nivel) */}
      {bandasInfo && (
        <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono-micro text-[10px]">
          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">Principiante (0-6)</span>
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">Intermedio (7-13)</span>
          <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary">Avanzado (14-20)</span>
        </div>
      )}

      {/* Botones de acceso rápido didácticos (Presets) */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-outline-variant/20">
          <span className="font-mono-micro text-[11px] text-on-surface-variant mr-1">Rápido:</span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.action}
              className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface hover:text-primary font-mono-micro text-[11px] transition-colors border border-outline-variant/30 cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Componente mejorado y didáctico de Filtros de Búsqueda de Rival.
 * Sustituye los selectores cuadrados básicos por una interfaz interactiva con barras
 * deslizantes dobles, visualización de rangos y presets rápidos para Elo y Nivel.
 */
export default function FiltrosDeBusqueda({
  valor,
  alCambiar,
  miElo = null,
  miNivel = null,
  deshabilitado = false,
}) {
  const cambiar = (campo) => (nuevo) => alCambiar({ ...valor, [campo]: nuevo });
  const error = errorDeFiltros(valor);
  const sinLimites = valor.modo === 'rango' && Object.keys(filtrosParaEnviar(valor)).length === 0;

  // Valor numérico estimado del jugador para calcular accesos rápidos
  const eloNumero = typeof miElo === 'object' ? miElo?.elo ?? 1000 : typeof miElo === 'number' ? miElo : 1000;
  const nivelNumero = typeof miNivel === 'number' ? miNivel : 10;

  // Presets didácticos para Elo
  const presetsElo = [
    {
      label: '±150 (Partida pareja)',
      action: () => {
        alCambiar({
          ...valor,
          eloMin: Math.max(ELO_MIN_ABSOLUTO, eloNumero - 150),
          eloMax: Math.min(ELO_MAX_ABSOLUTO, eloNumero + 150),
        });
      },
    },
    {
      label: 'Desafío (+200 a +400)',
      action: () => {
        alCambiar({
          ...valor,
          eloMin: eloNumero + 100,
          eloMax: Math.min(ELO_MAX_ABSOLUTO, eloNumero + 400),
        });
      },
    },
    {
      label: 'Accesible (-300 a 0)',
      action: () => {
        alCambiar({
          ...valor,
          eloMin: Math.max(ELO_MIN_ABSOLUTO, eloNumero - 300),
          eloMax: eloNumero,
        });
      },
    },
  ];

  // Presets didácticos para Nivel
  const presetsNivel = [
    {
      label: 'Principiantes (0-6)',
      action: () => {
        alCambiar({ ...valor, nivelMin: 0, nivelMax: 6 });
      },
    },
    {
      label: 'Intermedios (7-13)',
      action: () => {
        alCambiar({ ...valor, nivelMin: 7, nivelMax: 13 });
      },
    },
    {
      label: 'Avanzados (14-20)',
      action: () => {
        alCambiar({ ...valor, nivelMin: 14, nivelMax: 20 });
      },
    },
    {
      label: 'Mi nivel exacto (±1)',
      action: () => {
        alCambiar({
          ...valor,
          nivelMin: Math.max(0, nivelNumero - 1),
          nivelMax: Math.min(NIVEL_MAXIMO, nivelNumero + 1),
        });
      },
    },
  ];

  return (
    <fieldset className="m-0 p-0 border-0 flex flex-col gap-3 min-w-0" disabled={deshabilitado}>
      <legend className="font-mono-micro text-mono-micro uppercase text-on-surface-variant tracking-wider font-bold mb-1">
        A quién buscar
      </legend>

      {/* Selector elegante de Modo: Píldoras con íconos e indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="A quién buscar">
        <button
          type="button"
          role="radio"
          aria-checked={valor.modo === 'parecido'}
          onClick={() => cambiar('modo')('parecido')}
          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
            valor.modo === 'parecido'
              ? 'bg-primary-container/20 border-primary text-primary shadow-sm ring-1 ring-primary'
              : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              valor.modo === 'parecido' ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">target</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-sm text-body-sm font-bold truncate">Nivel parecido (Recomendado)</span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Emparejamiento automático por tu nivel actual
            </span>
          </div>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={valor.modo === 'rango'}
          onClick={() => cambiar('modo')('rango')}
          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
            valor.modo === 'rango'
              ? 'bg-primary-container/20 border-primary text-primary shadow-sm ring-1 ring-primary'
              : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              valor.modo === 'rango' ? 'bg-neon-lime text-black font-bold' : 'bg-surface-container-highest text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-sm text-body-sm font-bold truncate">Elegir Elo o Nivel</span>
            <span className="font-mono-micro text-mono-micro text-on-surface-variant">
              Ajusta los límites con barras deslizantes
            </span>
          </div>
        </button>
      </div>

      {/* Panel de configuración con Sliders Dobles e Interactivos */}
      {valor.modo === 'rango' && (
        <div className="flex flex-col gap-3 p-4 rounded-3xl bg-surface-container border border-primary/25 shadow-inner animate-in fade-in duration-300">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-outline-variant/20">
            <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
              Tu Elo actual es <strong className="text-primary">{miElo != null ? textoDeElo(miElo) : '1000'}</strong>
              {miNivel != null ? (
                <> y tu nivel es <strong className="text-neon-lime">{miNivel}</strong></>
              ) : (
                ' (nivel sin medir aún)'
              )}
              . Mueve las barras para establecer tu rango deseado.
            </p>
          </div>

          {/* Control deslizante de Elo */}
          <ControlRangoDidactico
            idBase="filtro-elo"
            titulo="Rango de Elo del rival"
            icono="military_tech"
            subtitulo="Ajusta la puntuación competitiva deseada"
            minVal={valor.eloMin}
            maxVal={valor.eloMax}
            minAbsoluto={ELO_MIN_ABSOLUTO}
            maxAbsoluto={ELO_MAX_ABSOLUTO}
            paso={ELO_PASO}
            unidad="Elo"
            alCambiarMin={cambiar('eloMin')}
            alCambiarMax={cambiar('eloMax')}
            onSinLimite={() => {
              alCambiar({ ...valor, eloMin: '', eloMax: '' });
            }}
            presets={presetsElo}
          />

          {/* Control deslizante de Nivel pedagógico */}
          <ControlRangoDidactico
            idBase="filtro-nivel"
            titulo="Rango de Nivel del rival"
            icono="stairs"
            subtitulo="Escalón de dificultad de 0 a 20"
            minVal={valor.nivelMin}
            maxVal={valor.nivelMax}
            minAbsoluto={0}
            maxAbsoluto={NIVEL_MAXIMO}
            paso={1}
            unidad=""
            alCambiarMin={cambiar('nivelMin')}
            alCambiarMax={cambiar('nivelMax')}
            onSinLimite={() => {
              alCambiar({ ...valor, nivelMin: '', nivelMax: '' });
            }}
            presets={presetsNivel}
            bandasInfo={true}
          />

          {error && (
            <p
              role={sinLimites ? 'status' : 'alert'}
              className={`m-0 p-2.5 rounded-xl font-body-sm text-body-sm border ${
                sinLimites
                  ? 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant'
                  : 'bg-error-container/20 border-error/30 text-error'
              }`}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
