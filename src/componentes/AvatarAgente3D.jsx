import { useMemo, useRef, useState } from 'react';
import AvatarMetaPerson3D from './AvatarMetaPerson3D';
import CerebroNeuronal from '../paginas/RazonamientoNeuronal/CerebroNeuronal';
import { useRazonamiento } from '../contexto/ContextoRazonamiento';
import { useEstadoModelo } from '../contexto/ContextoEstadoModelo';
import useTemaActual from '../useTemaActual';
import { colorDelTema } from '../apariencia';

/**
 * Motor de Facetas Emocionales Autónomo: calcula el estado psicológico y la expresión
 * del agente en base a la evaluación, posición, jaques y tiempo de cálculo.
 * `versionModelo` es la versión real del checkpoint activo (o `null` si todavía no se sabe):
 * sin número, el título dice "Cálculo Tensorial" a secas en vez de inventar uno.
 */
function calcularFacetaEmocional({
  pensando,
  evaluacionCp = 0,
  mateEn = null,
  terminada = false,
  resultado = null,
  cantidadJugadas = 0,
  ultimoMovimiento = null,
  versionModelo = null,
}) {
  // 1. Partida Terminada
  if (terminada) {
    if (resultado === '0-1') {
      return {
        id: 'VICTORIA_MAGISTRAL',
        titulo: 'Victoria Magistral',
        icono: '👑',
        color: '#10b981', // Esmeralda
        descripcion: 'La IA ha ganado la partida. Gesto XD triunfante.',
        emocion: 'victoria',
        sonrisa: 0.95,
        cejasUp: 0.35,
        cejasDown: 0.0,
        ojosSquint: 0.3,
        ojosWide: 0.1,
        bocaAbierta: 0.15,
      };
    }
    if (resultado === '1-0') {
      return {
        id: 'DERROTA_RESIGNADA',
        titulo: 'Derrota Reconocida',
        icono: '💔',
        color: '#f43f5e', // Rosa / Carmesí
        descripcion: 'El humano ha superado a la IA. Mirada gacha y resignación.',
        emocion: 'derrota',
        sonrisa: 0.0,
        cejasUp: 0.7,
        cejasDown: 0.4,
        ojosSquint: 0.2,
        ojosWide: 0.0,
        bocaAbierta: 0.0,
      };
    }
    return {
      id: 'TABLAS_EQUILIBRIO',
      titulo: 'Tablas Acordadas',
      icono: '🤝',
      color: '#00e5ff',
      descripcion: 'Partida concluida en empate técnico.',
      emocion: 'neutral',
      sonrisa: 0.2,
      cejasUp: 0.0,
      cejasDown: 0.0,
      ojosSquint: 0.0,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 2. IA pensando activamente en este instante (inferencia del modelo activo)
  if (pensando) {
    return {
      id: 'PENSAMIENTO_PROFUNDO',
      titulo: versionModelo ? `Cálculo Tensorial v${versionModelo}` : 'Cálculo Tensorial',
      icono: '🧠',
      color: '#00e5ff', // Cian de alta concentración
      descripcion: 'Explorando matrices SE-ResNet. Ceño concentrado y análisis de tablero.',
      emocion: 'pensando',
      sonrisa: 0.0,
      cejasUp: 0.1,
      cejasDown: 0.65, // Ceño fruncido
      ojosSquint: 0.55, // Ojos entrecerrados
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 3. Red de Mate Anunciada
  if (mateEn !== null && mateEn !== undefined) {
    if (mateEn < 0) {
      return {
        id: 'MATE_INMINENTE',
        titulo: `Mate en ${Math.abs(mateEn)} (Triunfo IA)`,
        icono: '🏆',
        color: '#f59e0b', // Dorado
        descripcion: 'Red de mate detectada sin escape. Gesto XD victorioso.',
        emocion: 'triunfo',
        sonrisa: 0.9,
        cejasUp: 0.4,
        cejasDown: 0.0,
        ojosSquint: 0.35,
        ojosWide: 0.2,
        bocaAbierta: 0.2,
      };
    } else {
      return {
        id: 'PELIGRO_EXTREMO',
        titulo: `Peligro Crítico: Mate en ${mateEn}`,
        icono: '🚨',
        color: '#ef4444', // Rojo peligro
        descripcion: 'Rey bajo asedio. Gesto Confused de alarma e incredulidad.',
        emocion: 'alarma',
        sonrisa: 0.0,
        cejasUp: 0.85,
        cejasDown: 0.2,
        ojosSquint: 0.0,
        ojosWide: 0.85,
        bocaAbierta: 0.4,
      };
    }
  }

  // 4. Detección de Jaque en la última jugada
  const ultimoSan = typeof ultimoMovimiento === 'string' ? ultimoMovimiento : ultimoMovimiento?.san;
  const esJaque = Boolean(ultimoSan && ultimoSan.includes('+'));

  if (esJaque) {
    const turnoBlancas = cantidadJugadas % 2 === 0;
    if (turnoBlancas) {
      return {
        id: 'JAQUE_ENTREGADO',
        titulo: '¡Jaque al Rey Rival!',
        icono: '⚔️',
        color: '#00e5ff',
        descripcion: 'Ataque frontal. Smirk Wicked desafiante.',
        emocion: 'confianza',
        sonrisa: 0.65,
        cejasUp: 0.35,
        cejasDown: 0.2,
        ojosSquint: 0.35,
        ojosWide: 0.1,
        bocaAbierta: 0.0,
      };
    } else {
      return {
        id: 'JAQUE_RECIBIDO',
        titulo: 'Rey Propio en Jaque',
        icono: '🛡️',
        color: '#f97316', // Naranja
        descripcion: 'Rey amenazado. Búsqueda urgente de casillas de escape.',
        emocion: 'tension',
        sonrisa: 0.0,
        cejasUp: 0.75,
        cejasDown: 0.3,
        ojosSquint: 0.2,
        ojosWide: 0.6,
        bocaAbierta: 0.2,
      };
    }
  }

  // 5. Según la evaluación en Centipawns (Perspectiva IA: Negativo = Ventaja Negras/IA)
  if (evaluacionCp <= -220) {
    return {
      id: 'GRAN_VENTAJA',
      titulo: `Gran Ventaja IA (${(evaluacionCp / -100).toFixed(1)})`,
      icono: '😎',
      color: '#10b981', // Verde
      descripcion: 'Posición dominante. Faceta XD con gran sonrisa y cabeza erguida.',
      emocion: 'confianza_alta',
      sonrisa: 0.85,
      cejasUp: 0.3,
      cejasDown: 0.0,
      ojosSquint: 0.4,
      ojosWide: 0.0,
      bocaAbierta: 0.1,
    };
  }
  if (evaluacionCp <= -60) {
    return {
      id: 'VENTAJA_TACTICA',
      titulo: `Ventaja Táctica (${(evaluacionCp / -100).toFixed(1)})`,
      icono: '😏',
      color: '#34d399',
      descripcion: 'Mejor estructura. Faceta Wicked con media sonrisa pícara.',
      emocion: 'confianza',
      sonrisa: 0.75,
      cejasUp: 0.2,
      cejasDown: 0.1,
      ojosSquint: 0.3,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }
  if (evaluacionCp >= 220) {
    return {
      id: 'DESVENTAJA_SEVERA',
      titulo: `Desventaja Severa (+${(evaluacionCp / 100).toFixed(1)})`,
      icono: '😰',
      color: '#ef4444',
      descripcion: 'Déficit de material. Faceta Confused de preocupación y alerta.',
      emocion: 'alarma',
      sonrisa: 0.0,
      cejasUp: 0.8,
      cejasDown: 0.3,
      ojosSquint: 0.1,
      ojosWide: 0.7,
      bocaAbierta: 0.3,
    };
  }
  if (evaluacionCp >= 60) {
    return {
      id: 'BAJO_PRESION',
      titulo: `Bajo Presión (+${(evaluacionCp / 100).toFixed(1)})`,
      icono: '😟',
      color: '#fb923c',
      descripcion: 'Posición incómoda. Faceta Suspicious con ojos entrecerrados.',
      emocion: 'preocupacion',
      sonrisa: 0.0,
      cejasUp: 0.3,
      cejasDown: 0.55,
      ojosSquint: 0.75,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 6. Apertura temprana
  if (cantidadJugadas <= 6) {
    return {
      id: 'APERTURA',
      titulo: 'Fase de Apertura',
      icono: '📚',
      color: '#38bdf8',
      descripcion: 'Desarrollando piezas según teoría magistral.',
      emocion: 'neutral_atenta',
      sonrisa: 0.1,
      cejasUp: 0.0,
      cejasDown: 0.1,
      ojosSquint: 0.1,
      ojosWide: 0.0,
      bocaAbierta: 0.0,
    };
  }

  // 7. Por defecto: Posición Equilibrada
  return {
    id: 'EQUILIBRIO',
    titulo: 'Posición Equilibrada',
    icono: '⚖️',
    color: '#00e5ff',
    descripcion: 'Partida pareja. Evaluación neutral de variantes.',
    emocion: 'neutral',
    sonrisa: 0.0,
    cejasUp: 0.0,
    cejasDown: 0.0,
    ojosSquint: 0.0,
    ojosWide: 0.0,
    bocaAbierta: 0.0,
  };
}

export default function AvatarAgente3D({
  pensando = false,
  tipoOponente = 'modelo',
  nivel = null, // nivel con el que juega el rival (opcional): se muestra en la etiqueta
  evaluacionCp = 0,
  mateEn = null,
  ultimoMovimiento = null,
  cantidadJugadas = 0,
  terminada = false,
  resultado = null,
}) {
  const [progresoCarga, setProgresoCarga] = useState(0);
  const [cargandoModelo, setCargandoModelo] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [vista, setVista] = useState('avatar'); // 'avatar' | 'cerebro'
  const resetCameraRef = useRef(null);
  const tema = useTemaActual();

  const { ultimaInferencia, estaAnalizando } = useRazonamiento() ?? {};
  // Versión real del checkpoint activo (la comparte toda la app, no se vuelve a pedir acá).
  const { version: versionModelo } = useEstadoModelo();
  const sufijoVersionModelo = versionModelo ? ` v${versionModelo}` : '';

  // Faceta Emocional calculada autónomamente a partir del juego — 100% autónomo,
  // sin ningún panel manual: las expresiones salen solas cuando pasa algo real
  // (jaque, ventaja, mate, fin de partida, etc.), nunca por un botón de prueba.
  const facetaActual = useMemo(() => {
    const faceta = calcularFacetaEmocional({
      pensando,
      evaluacionCp,
      mateEn,
      terminada,
      resultado,
      cantidadJugadas,
      ultimoMovimiento,
      versionModelo,
    });
    const token = {
      '#10b981': 'exito', '#34d399': 'exito', '#f43f5e': 'error', '#ef4444': 'error',
      '#f59e0b': 'aviso', '#f97316': 'tertiary', '#fb923c': 'tertiary',
      '#00e5ff': 'primary', '#38bdf8': 'informacion',
    }[faceta.color] || 'secondary';
    return { ...faceta, color: colorDelTema(token) };
  }, [pensando, evaluacionCp, mateEn, terminada, resultado, cantidadJugadas, ultimoMovimiento, versionModelo, tema]);

  // Datos reales de la última inferencia del modelo (mismo Context que Razonamiento
  // Neuronal) — alimentan la miniatura del cerebro cuando `vista === 'cerebro'`.
  const candidatasNeuronal = ultimaInferencia?.candidatas ?? [];
  const top1Neuronal = candidatasNeuronal[0] ?? null;

  function manejarProgreso(pct) {
    setProgresoCarga(pct);
    if (pct >= 100) setCargandoModelo(false);
  }

  function manejarError(mensaje) {
    setErrorCarga(mensaje);
    setCargandoModelo(false);
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-3.5 shadow-xl flex flex-col gap-2.5 border border-outline-variant/30 relative overflow-hidden">
      {/* CABECERA Y METADATOS DEL AGENTE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
              style={{ backgroundColor: facetaActual.color }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: facetaActual.color }}
            />
          </span>
          <span className="font-mono-micro text-[11px] font-bold text-on-surface-variant uppercase tracking-wide truncate">
            {vista === 'avatar' ? 'Avatar 3D' : 'Cerebro (en vivo)'}
          </span>
        </div>

        {/* TOGGLE AVATAR / CEREBRO — misma tarjeta, sin salir de Sala de Control */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 shrink-0">
          <button
            type="button"
            onClick={() => setVista('avatar')}
            title="Avatar del agente"
            aria-label="Ver el avatar del agente"
            aria-pressed={vista === 'avatar'}
            className={`p-1 max-sm:min-h-10 max-sm:min-w-10 rounded flex items-center justify-center transition-all ${
              vista === 'avatar' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">face</span>
          </button>
          <button
            type="button"
            onClick={() => setVista('cerebro')}
            title="Cerebro de partículas — razonamiento en vivo"
            aria-label="Ver el cerebro de partículas en vivo"
            aria-pressed={vista === 'cerebro'}
            className={`p-1 max-sm:min-h-10 max-sm:min-w-10 rounded flex items-center justify-center transition-all ${
              vista === 'cerebro' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">neurology</span>
          </button>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 font-semibold shrink-0">
          {tipoOponente === 'modelo' ? `IA${sufijoVersionModelo}` : 'STOCKFISH'}
          {nivel != null ? ` · NIVEL ${nivel}` : tipoOponente === 'modelo' ? ' AUTÓNOMA' : ' 16'}
        </span>
      </div>

      {/* ÁREA DE VISUALIZACIÓN THREE.JS VIEWPORT (ENCUADRE DE LA CINTURA PARA ARRIBA) */}
      <div className="relative w-full h-[290px] rounded-lg overflow-hidden bg-gradient-to-b from-surface-container-lowest to-surface border border-outline-variant/10 flex items-center justify-center group">
        {vista === 'avatar' ? (
          <AvatarMetaPerson3D
            pensando={pensando}
            facetaActual={facetaActual}
            onResetCamera={resetCameraRef}
            onProgresoCarga={manejarProgreso}
            onError={manejarError}
          />
        ) : (
          <CerebroNeuronal
            compacto
            saliencia={ultimaInferencia?.saliencia}
            atencionPorBloque={ultimaInferencia?.atencion_por_bloque}
            jugadaElegida={ultimaInferencia?.jugada_elegida ?? null}
            probabilidadTop1={top1Neuronal?.probabilidad ?? 0}
            diferenciaCp={ultimaInferencia?.comparacion_stockfish?.diferencia_cp ?? 0}
            analizando={Boolean(estaAnalizando)}
          />
        )}

        {/* SPINNER DE CARGA DEL MODELO GLTF (solo vista avatar) */}
        {vista === 'avatar' && cargandoModelo && !errorCarga && (
          <div className="absolute inset-0 bg-surface-container-lowest/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="font-mono text-[11px] text-primary tracking-wider animate-pulse">
              CARGANDO MODELO 3D ({progresoCarga}%)...
            </span>
          </div>
        )}

        {vista === 'avatar' && errorCarga && (
          <div className="absolute inset-0 bg-surface-container-lowest/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20 px-4 text-center">
            <span className="material-symbols-outlined text-error text-[24px]">error</span>
            <span className="font-mono text-[11px] text-error">{errorCarga}</span>
          </div>
        )}

        {vista === 'avatar' ? (
          <>
            {/* BADGE DE FACETA EMOCIONAL EN TIEMPO REAL (100% AUTÓNOMO) */}
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <div
                className="px-2.5 py-1 rounded-full bg-surface-container-lowest/85 border backdrop-blur-md flex items-center gap-1.5 text-[10px] font-mono shadow-lg transition-all duration-300"
                style={{ borderColor: `${facetaActual.color}88` }}
              >
                <span className="text-[12px]">{facetaActual.icono}</span>
                <span className="font-semibold tracking-wide text-[10px]" style={{ color: facetaActual.color }}>
                  {facetaActual.titulo}
                </span>
              </div>
            </div>

            {/* BOTÓN CENTRAR CÁMARA */}
            <button
              type="button"
              onClick={() => resetCameraRef.current?.()}
              className="absolute bottom-2 right-2 p-1.5 max-sm:min-h-10 rounded bg-surface-container-lowest/90 hover:bg-primary/20 border border-outline-variant/10 hover:border-primary/40 text-on-surface-variant hover:text-primary text-[10px] font-mono transition-all z-10 flex items-center gap-1"
              title="Centrar encuadre frontal de la cintura para arriba"
            >
              <span className="material-symbols-outlined text-[13px]">center_focus_strong</span>
              <span>Centrar</span>
            </button>

            {/* INDICADOR DE INTERACCIÓN 3D REAL */}
            <div className="absolute bottom-2 left-2 text-[9px] font-mono text-on-surface-variant pointer-events-none opacity-60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span>Rotación 360° Libre</span>
            </div>
          </>
        ) : (
          /* MINI INDICADOR DE ESTADO — analizando vs. jugada ya decidida (datos reales) */
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <div
              className={`px-2.5 py-1 rounded-full bg-surface-container-lowest/85 border backdrop-blur-md flex items-center gap-1.5 text-[10px] font-mono shadow-lg transition-all duration-300 ${
                estaAnalizando ? 'border-on-surface-variant/60' : 'border-neon-lime/60'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${estaAnalizando ? 'bg-on-surface-variant animate-pulse' : 'bg-neon-lime'}`}
              />
              <span className={`font-semibold tracking-wide text-[10px] ${estaAnalizando ? 'text-on-surface-variant' : 'text-neon-lime'}`}>
                {estaAnalizando
                  ? 'ANALIZANDO…'
                  : ultimaInferencia?.jugada_elegida
                    ? `DECIDIÓ ${ultimaInferencia.jugada_elegida}`
                    : 'SIN INFERENCIA AÚN'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE TELEMETRÍA AUTÓNOMA (CERO BOTONES MANUALES) */}
      <div className="flex flex-col gap-1.5 font-mono text-[10px]">
        <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-exito animate-pulse" />
            <span className="text-on-surface-variant font-semibold tracking-wide">SISTEMA AUTÓNOMO</span>
          </div>
          <span className="text-on-surface-variant text-[9px]">
            {pensando ? 'ANALIZANDO JUGADA...' : 'ESPERANDO MOVIMIENTO'}
          </span>
        </div>

        {/* DESCRIPCIÓN DE LA ESTRATEGIA Y GESTO */}
        {facetaActual.descripcion && (
          <div className="px-2 py-1 rounded bg-primary/5 border border-primary/15 flex items-center justify-between text-[9px] text-on-surface-variant">
            <span className="text-on-surface-variant truncate">{facetaActual.descripcion}</span>
            <span className="text-[10px] ml-2 shrink-0">{facetaActual.icono}</span>
          </div>
        )}

        {/* Reactivo a los blendshapes ARKit reales — sin ningún botón manual: las
            expresiones (Wicked, Suspicious, XD, Confused) las dispara el propio
            estado del juego a través de `calcularFacetaEmocional`. */}
      </div>
    </div>
  );
}
