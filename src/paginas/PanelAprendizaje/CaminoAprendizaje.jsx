import { useEffect, useId, useMemo, useState } from 'react';
import { animate, motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { historialPartidasPropio, obtenerPartida } from '../../api/backend';
import { rutaImagenPieza } from '../../ajedrez';
import { avisoDeModuloBloqueado, demostracionInicialCompletada, puedeAbrirLeccion, puedeProbarPartida, videoDelCapitulo } from '../../caminoReglas';

/** Cuántas partidas recientes se revisan para los capítulos basados en historial. */
const PARTIDAS_A_REVISAR = 20;
/** Cuántas partidas se piden juntas al buscar jugadas (de la más reciente a la más vieja). */
const LOTE_DE_PARTIDAS = 4;

/**
 * Etapas del Camino de Aprendizaje basadas en la metodología pedagógica
 * de la FIDE (Stappenmethode de Brunia & Van Wijgerden) y Práctica Deliberada de Ericsson.
 */
export const ETAPAS_APRENDIZAJE = {
  principiante: {
    id: 'principiante',
    nombre: 'Paso 1 · Fundamentos',
    nivelRecomendado: 'Principiante',
    icono: 'school',
    lema: 'Reglas esenciales, tablero y movimientos básicos (Stappenmethode)',
    capitulos: [
      {
        id: 'tablero',
        titulo: 'El tablero y coordenadas',
        descripcion: 'Comprender la cuadrícula de 64 casillas, columnas (a-h) y filas (1-8). Se completa al jugar tu primera partida.',
        accion: 'sala',
        icono: 'grid_view',
        tipoPiezaVideo: null,
      },
      {
        id: 'piezas',
        titulo: 'Las 6 piezas del ajedrez',
        descripcion: 'Conocé el valor y la función de cada pieza. Se completa al revisarlas en "Aprendé cada pieza".',
        accion: 'piezas',
        pieza: 'Q',
        tipoPiezaVideo: 'dama',
      },
      {
        id: 'posicion',
        titulo: 'Posición inicial del combate',
        descripcion: 'Ubicación reglamentaria de las 32 piezas en el tablero antes de la batalla. Marcala como vista cuando la domines.',
        marcable: true,
        pieza: 'R',
        tipoPiezaVideo: 'torre',
      },
      {
        id: 'movimientos',
        titulo: 'Movimiento de las piezas',
        descripcion: 'Patrones de desplazamiento de peón, caballo, alfil, torre, dama y rey. Marcala como vista cuando la practiques.',
        marcable: true,
        pieza: 'N',
        tipoPiezaVideo: 'caballo',
      },
      {
        id: 'enroque',
        titulo: 'Enroque corto y largo',
        descripcion: 'La maniobra especial para poner a salvo al rey y activar la torre en un solo turno. Tocá la esfera para ver la demostración.',
        marcable: true,
        accion: 'sala',
        pieza: 'K',
        tipoPiezaVideo: 'rey',
      },
      {
        id: 'captura',
        titulo: 'Captura y peón al paso',
        descripcion: 'Mecánica de captura tradicional y la regla histórica del "en passant". Se completa al realizar una captura en partida.',
        accion: 'sala',
        pieza: 'P',
        tipoPiezaVideo: 'peon',
      },
      {
        id: 'jaque',
        titulo: 'Jaque, jaque mate y tablas',
        descripcion: 'Cómo amenazar al rey rival, defenderse del jaque y rematar la partida con mate. Se completa al dar jaque o mate.',
        accion: 'sala',
        pieza: 'K',
        tipoPiezaVideo: 'rey',
      },
    ],
  },
  intermedio: {
    id: 'intermedio',
    nombre: 'Pasos 2-3 · Aperturas y Táctica',
    nivelRecomendado: 'Intermedio',
    icono: 'psychology',
    lema: 'Principios de apertura, defensas activas, combinaciones tácticas y práctica deliberada',
    capitulos: [
      {
        id: 'mandamientos_apertura',
        titulo: 'Los 3 principios de apertura',
        descripcion: 'Controlar el centro (d4/e4/d5/e5), desarrollar caballos y alfiles activamente, y proteger al rey en las primeras 10 jugadas.',
        marcable: true,
        icono: 'flag',
        tipoPiezaVideo: 'rey',
      },
      {
        id: 'aperturas_clasicas',
        titulo: 'Apertura Italiana y Española',
        descripcion: 'Sistemas abiertos con 1.e4 e5: rápido desarrollo del alfil para presionar el punto f7 o clavar el caballo defensor.',
        marcable: true,
        pieza: 'B',
        tipoPiezaVideo: 'alfil',
      },
      {
        id: 'defensas_activas',
        titulo: 'Defensa Siciliana (1.e4 c5)',
        descripcion: 'La respuesta asimétrica y combativa más popular contra el peón de rey para disputar la iniciativa desde la jugada 1.',
        marcable: true,
        pieza: 'N',
        tipoPiezaVideo: 'caballo',
      },
      {
        id: 'gambito_dama',
        titulo: 'Juego cerrado: Gambito de Dama',
        descripcion: 'Batalla posicional tras 1.d4 d5 2.c4: lucha estratégica por el dominio central, estructuras sólidas y cadenas de peones.',
        marcable: true,
        pieza: 'Q',
        tipoPiezaVideo: 'dama',
      },
      {
        id: 'tactica_doble',
        titulo: 'Táctica: Ataque doble y horquilla',
        descripcion: 'El recurso táctico más letal: una sola pieza amenaza dos objetivos simultáneamente, ganando material decisivo.',
        marcable: true,
        pieza: 'N',
        tipoPiezaVideo: 'caballo',
      },
      {
        id: 'tactica_clavada',
        titulo: 'Táctica: Clavada y enfilada',
        descripcion: 'Inmovilizar una pieza enemiga porque detrás se encuentra el rey o una pieza de mayor valor que caería indefensa.',
        marcable: true,
        pieza: 'B',
        tipoPiezaVideo: 'alfil',
      },
      {
        id: 'erradicar_blunders',
        titulo: 'Auditoría de colgadas (Blunders)',
        descripcion: 'Práctica deliberada: usar la retroalimentación de Turing para erradicar piezas colgadas e imprecisiones tácticas graves.',
        accion: 'repaso',
        icono: 'verified_user',
        tipoPiezaVideo: null,
      },
    ],
  },
  avanzado: {
    id: 'avanzado',
    nombre: 'Paso 4+ · Estrategia y Maestría',
    nivelRecomendado: 'Avanzado',
    icono: 'military_tech',
    lema: 'Estructuras de peones, finales teóricos, sparring con Turing (~1808 Elo) y ranking',
    capitulos: [
      {
        id: 'estructuras_peones',
        titulo: 'Estructuras e islas de peones',
        descripcion: 'Comprender debilidades a largo plazo: peones doblados, peones aislados, mayorías en el flanco y peones pasados candidatos.',
        marcable: true,
        pieza: 'P',
        tipoPiezaVideo: 'peon',
      },
      {
        id: 'finales_torre',
        titulo: 'Finales teóricos de torre y peón',
        descripcion: 'Dominio de las posiciones clave de finales: la técnica de construcción del puente de Lucena y la defensa activa de Filidor.',
        marcable: true,
        pieza: 'R',
        tipoPiezaVideo: 'torre',
      },
      {
        id: 'sparring_turing',
        titulo: 'Sparring contra Turing (~1808 Elo)',
        descripcion: 'Partidas de alta exigencia contra la red neuronal profunda SE-ResNet-8 con búsqueda táctica de 2-3 plies.',
        accion: 'sala',
        icono: 'neurology',
        tipoPiezaVideo: null,
      },
      {
        id: 'analisis_centipeones',
        titulo: 'Evaluación de centipeones y precisión',
        descripcion: 'Auditar la pérdida promedio de centipeones (ACPL) en cada partida para afinar la toma de decisiones milimétrica.',
        accion: 'repaso',
        icono: 'analytics',
        tipoPiezaVideo: null,
      },
      {
        id: 'maestria_torneos',
        titulo: 'Torneos y consolidación de Elo',
        descripcion: 'Competir en el ranking global, sostener rachas ganadoras y consolidar tu maestría ajedrecística.',
        accion: 'ranking',
        icono: 'trophy',
        tipoPiezaVideo: null,
      },
    ],
  },
};

/**
 * Contenido pedagógico detallado para la ventana flotante (Modal) de cada módulo.
 */
const CONTENIDO_LECCIONES = {
  enroque: {
    subtitulo: 'La maniobra para poner a salvo al Rey y activar la Torre en una sola jugada',
    pasos: [
      {
        num: 1,
        titulo: 'El Rey se desplaza dos casillas laterales',
        desc: 'En el enroque corto (hacia el flanco de rey), el Rey avanza 2 casillas de e1 a g1. En el enroque largo (flanco de dama), avanza 2 casillas de e1 a c1.',
      },
      {
        num: 2,
        titulo: 'La Torre salta por encima y se coloca a su lado',
        desc: 'La torre involucrada salta sobre el rey y se sitúa en la casilla inmediata contigua: la torre de h1 pasa a f1 (corto), o la de a1 pasa a d1 (largo).',
      },
      {
        num: 3,
        titulo: '¡Regla FIDE: Mover primero el Rey!',
        desc: 'En una partida reglamentaria o de torneo presencial, siempre debes tocar y desplazar primero el rey dos casillas, y luego trasladar la torre. Si tocas primero la torre, se considerará una jugada ordinaria de torre.',
      },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Ni el rey ni la torre deben haberse movido antes en toda la partida.' },
      { tipo: 'ok', texto: 'Todas las casillas intermedias entre el rey y la torre deben estar completamente vacías.' },
      { tipo: 'prohibido', texto: 'El rey NO puede enrocar si se encuentra actualmente en JAQUE.' },
      { tipo: 'prohibido', texto: 'El rey NO puede pasar por casillas controladas por piezas rivales ni quedar en jaque al finalizar.' },
    ],
    tipoDiagrama: 'enroque',
    consejo: 'Procura enrocar en las primeras 10 jugadas. Un rey que permanece en el centro es el objetivo más fácil para los ataques tácticos del rival.',
  },
  mandamientos_apertura: {
    subtitulo: 'Los 3 principios de oro en las primeras 10 jugadas',
    pasos: [
      { num: 1, titulo: '1. Ocupar y controlar el centro', desc: 'Avanza los peones centrales (e4, d4) para disputar las casillas clave y abrir diagonales a tus alfiles.' },
      { num: 2, titulo: '2. Desarrollar piezas menores activamente', desc: 'Saca los caballos (Cf3, Cc3) antes que los alfiles (Ac4, Ab5). No muevas la misma pieza dos veces en la apertura.' },
      { num: 3, titulo: '3. Enrocar y asegurar el Rey', desc: 'Pon a salvo tu rey antes de lanzar operaciones ofensivas o abrir el centro.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Desarrolla caballos antes que alfiles para controlar el centro rápidamente.' },
      { tipo: 'prohibido', texto: 'No saques la Dama demasiado temprano: será atacada por peones y piezas menores rivales con pérdida de tiempos.' },
    ],
    tipoDiagrama: 'mandamientos',
    consejo: 'Si sigues estos 3 mandamientos, llegarás al medio juego con una posición sólida, coordinada y sin piezas colgadas.',
  },
  tablero: {
    subtitulo: 'Geometría del tablero de 64 casillas, columnas y filas',
    pasos: [
      { num: 1, titulo: 'Casilla blanca a la derecha', desc: 'La esquina inferior derecha de cada jugador (h1 para blancas, a8 para negras) siempre debe ser una casilla clara.' },
      { num: 2, titulo: 'Columnas y Filas', desc: 'Las columnas se identifican con letras minúsculas (a-h) de izquierda a derecha. Las filas se numeran del 1 al 8.' },
      { num: 3, titulo: 'El Centro del tablero', desc: 'Las 4 casillas d4, e4, d5 y e5 forman el centro grande. Dominar estas casillas otorga ventaja posicional.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Cada casilla tiene una coordenada única (ejemplo: e4, f7, c3).' },
      { tipo: 'ok', texto: 'El tablero se divide en flanco de Rey (columnas e-h) y flanco de Dama (columnas a-d).' },
    ],
    tipoDiagrama: 'tablero',
    consejo: 'Aprender las coordenadas te permitirá registrar tus partidas y comprender los análisis de Turing con facilidad.',
  },
  piezas: {
    subtitulo: 'Jerarquía de poder, naturalezas y valores relativos',
    pasos: [
      { num: 1, titulo: 'Peón (1 punto)', desc: 'Es la unidad básica. Aunque tiene poco valor individual, su estructura define el carácter de la partida y puede coronar una Dama.' },
      { num: 2, titulo: 'Caballo y Alfil (3 puntos c/u)', desc: 'Son las piezas menores. El caballo salta en L y destaca en posiciones cerradas; el alfil domina diagonales largas abiertas.' },
      { num: 3, titulo: 'Torre (5 puntos)', desc: 'Pieza mayor o pesada. Domina columnas y filas abiertas, y es decisiva en los finales.' },
      { num: 4, titulo: 'Dama (9 puntos)', desc: 'La pieza más poderosa del tablero. Combina la movilidad recta de la torre con las diagonales del alfil.' },
      { num: 5, titulo: 'Rey (Valor Infinito)', desc: 'Es el objetivo supremo. No puede ser capturado; si no puede escapar de una amenaza, sobreviene el Jaque Mate.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'No entregues piezas de mayor valor por otras de menor valor sin una ganancia táctica concreta.' },
    ],
    tipoDiagrama: 'piezas',
    consejo: 'Visita la sección "Aprendé cada pieza" en este panel para interactuar con los modelos 3D y ver los videos explicativos del docente.',
  },
  posicion: {
    subtitulo: 'Colocación reglamentaria antes del primer movimiento',
    pasos: [
      { num: 1, titulo: 'Fila 1 (Blancas): Torres y Caballos', desc: 'Las torres van en las esquinas (a1, h1). A su lado los caballos (b1, g1).' },
      { num: 2, titulo: 'Fila 1 (Blancas): Alfiles, Dama y Rey', desc: 'Los alfiles van junto a los caballos (c1, f1). La Dama en su color: Dama blanca en casilla blanca (d1) y Rey en e1.' },
      { num: 3, titulo: 'Fila 2 (Blancas): Muralla de Peones', desc: 'Los 8 peones blancos se colocan en la fila 2 (a2 a h2), cubriendo a las piezas mayores.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Regla de oro: Dama blanca en casilla blanca (d1); Dama negra en casilla negra (d8).' },
      { tipo: 'ok', texto: 'Las negras se colocan en espejo exacto en las filas 7 y 8.' },
    ],
    tipoDiagrama: 'posicion',
    consejo: 'Verifica siempre la posición de las damas antes de encender el brazo robótico o iniciar una partida física.',
  },
  movimientos: {
    subtitulo: 'Patrones geométricos de desplazamiento legal',
    pasos: [
      { num: 1, titulo: 'Torre', desc: 'Se mueve en línea recta tantas casillas libres como desee por filas (horizontal) o columnas (vertical).' },
      { num: 2, titulo: 'Alfil', desc: 'Se mueve en diagonal tantas casillas libres como desee, manteniéndose siempre en casillas de su color de inicio.' },
      { num: 3, titulo: 'Dama', desc: 'Combina el poder de la Torre y el Alfil: puede moverse en rectas y diagonales a cualquier distancia.' },
      { num: 4, titulo: 'Caballo', desc: 'Desplazamiento único en "L": dos casillas en una dirección recta y una perpendicular. Es la única pieza capaz de saltar por encima de otras.' },
      { num: 5, titulo: 'Peón', desc: 'Avanza 1 casilla hacia adelante (o 2 en su primer movimiento). Corona en la última fila transformándose en Dama, Torre, Alfil o Caballo.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Ninguna pieza (salvo el caballo) puede saltar sobre piezas amigas o enemigas.' },
    ],
    tipoDiagrama: 'movimientos',
    consejo: 'El caballo en el centro del tablero controla hasta 8 casillas; en una esquina solo controla 2.',
  },
  captura: {
    subtitulo: 'Mecánica de eliminación y la regla histórica del Peón al Paso',
    pasos: [
      { num: 1, titulo: 'Captura ordinaria', desc: 'Una pieza se mueve a una casilla ocupada por una pieza rival, la elimina del tablero y ocupa su lugar.' },
      { num: 2, titulo: 'El Peón captura diferente a como camina', desc: 'El peón camina hacia adelante en línea recta, pero captura en diagonal 1 casilla hacia adelante.' },
      { num: 3, titulo: 'Peón al paso (En Passant)', desc: 'Si un peón rival avanza dos casillas en su salida y queda justo al lado del tuyo, puedes capturarlo en diagonal como si solo hubiera avanzado una casilla (¡únicamente en el turno inmediato!).' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'El en passant debe ejecutarse obligatoriamente en la jugada inmediata posterior al avance doble rival.' },
    ],
    tipoDiagrama: 'captura',
    consejo: 'No ignores la captura al paso cuando el rival intenta esquivar tu peón avanzado.',
  },
  jaque: {
    subtitulo: 'Ataque al Rey, defensas obligadas, Jaque Mate y Tablas',
    pasos: [
      { num: 1, titulo: 'Jaque: El Rey amenazado', desc: 'Una pieza enemiga ataca la casilla del rey. Es obligatorio librarse del jaque en el siguiente movimiento.' },
      { num: 2, titulo: 'Las 3 formas de defender un jaque (Regla C-P-R)', desc: 'C: Capturar la pieza agresora. P: Parapetar (interponer una pieza en la línea de ataque). R: Retirar el rey a una casilla segura no atacada.' },
      { num: 3, titulo: 'Jaque Mate', desc: 'El rey está bajo ataque y NO existe ninguna de las 3 defensas posibles (CPR). La partida termina con victoria para quien dio el mate.' },
      { num: 4, titulo: 'Rey Ahogado (Tablas/Empate)', desc: 'El jugador al que le toca mover no está en jaque, pero no tiene ninguna jugada legal disponible. La partida termina empatada.' },
    ],
    reglas: [
      { tipo: 'prohibido', texto: 'Nunca puedes realizar una jugada que deje o exponga a tu propio rey en jaque.' },
    ],
    tipoDiagrama: 'jaque',
    consejo: 'Antes de realizar una jugada cuando tienes gran ventaja, verifica que el rey enemigo tenga al menos una casilla libre para evitar el empate por ahogado.',
  },
  aperturas_clasicas: {
    subtitulo: 'Apertura Italiana (1.e4 e5 2.Cf3 Cc6 3.Ac4) y Española (3.Ab5)',
    pasos: [
      { num: 1, titulo: 'Apertura Italiana (Giuoco Piano)', desc: 'Tras 1.e4 e5 2.Cf3 Cc6 3.Ac4, el alfil presiona la casilla débil f7 de las negras, buscando un juego activo y abierto.' },
      { num: 2, titulo: 'Apertura Española (Ruy López)', desc: 'Con 3.Ab5, las blancas clavan o presionan el caballo defensor de e5, preparando el control central a largo plazo.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'En ambas aperturas el enroque corto blanco se prepara casi de inmediato tras mover el alfil.' },
    ],
    tipoDiagrama: 'apertura',
    consejo: 'La Italiana es ideal para principiantes e intermedios porque enseña a coordinar el alfil y el caballo en el ataque sobre el rey enemigo.',
  },
  defensas_activas: {
    subtitulo: 'Defensa Siciliana (1.e4 c5): La respuesta asimétrica y combativa',
    pasos: [
      { num: 1, titulo: 'Desequilibrio desde la jugada 1', desc: 'Las negras no replican con e5, sino que disputan el centro desde el flanco con c5, buscando crear una columna semiabierta c.' },
      { num: 2, titulo: 'Mayoría de peones centrales', desc: 'Si las blancas juegan d4 y las negras cambian cxd4, las negras conservan dos peones centrales (d y e) contra solo uno de las blancas.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Requiere cálculo táctico agudo y juego combativo en ambos flancos.' },
    ],
    tipoDiagrama: 'apertura',
    consejo: 'La Siciliana es la defensa más jugada a nivel de Grandes Maestros contra el peón de rey.',
  },
  gambito_dama: {
    subtitulo: '1.d4 d5 2.c4: Lucha posicional por la dominación del centro',
    pasos: [
      { num: 1, titulo: 'El sacrificio aparente', desc: 'Las blancas ofrecen su peón de c4 para desviar el peón negro de d5. Si las negras aceptan (dxc4), las blancas recuperan el peón fácilmente y dominan el centro con e4.' },
      { num: 2, titulo: 'Gambito de Dama Declinado', desc: 'Las negras sostienen su centro jugando 2...e6 o c6, originando una batalla de maniobras estratégicas.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'El peón de c4 no es un regalo: las negras no pueden retenerlo sin arruinar su posición.' },
    ],
    tipoDiagrama: 'apertura',
    consejo: 'Aprender el Gambito de Dama te enseñará a dominar estructuras de peones y juegos cerrados de largo plazo.',
  },
  tactica_doble: {
    subtitulo: 'Ataque doble y horquilla: Golpear dos objetivos en un solo golpe',
    pasos: [
      { num: 1, titulo: 'Definición táctica', desc: 'Una sola pieza tuya ataca simultáneamente a dos piezas enemigas no defendidas o de mayor valor.' },
      { num: 2, titulo: 'La horquilla de caballo', desc: 'El caballo salta a una casilla (como c7 o f7) dando jaque al Rey y amenazando a la Torre a la vez. El rival solo puede mover el Rey, perdiendo la Torre gratis.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Los peones también hacen ataques dobles letales avanzando una casilla entre dos piezas enemigas.' },
    ],
    tipoDiagrama: 'tactica',
    consejo: 'Antes de mover, busca siempre si el rival dejó dos piezas alineadas a tiro de caballo o de peón.',
  },
  tactica_clavada: {
    subtitulo: 'Clavada y enfilada: Inmovilizar las defensas rivales',
    pasos: [
      { num: 1, titulo: 'Clavada absoluta', desc: 'Una pieza no puede moverse porque expondría directamente a su Rey al jaque (sería una jugada ilegal).' },
      { num: 2, titulo: 'Clavada relativa', desc: 'La pieza puede moverse legalmente, pero al hacerlo perdería una pieza de mayor valor que se encuentra detrás (como la Dama o una Torre).' },
      { num: 3, titulo: 'Enfilada (rayos X)', desc: 'La pieza de mayor valor está delante y obligada a retirarse, dejando indefensa a la pieza menor que está detrás.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Solo las piezas de largo alcance pueden clavar: Dama, Torre y Alfil.' },
    ],
    tipoDiagrama: 'tactica',
    consejo: 'Una pieza clavada deja de defender las casillas a su alrededor: ¡aprovéchalo para atacar a su defensor!',
  },
  erradicar_blunders: {
    subtitulo: 'Práctica deliberada auditada por Turing para evitar colgadas graves',
    pasos: [
      { num: 1, titulo: '¿Qué es un Blunder?', desc: 'Un error táctico grave donde regalas una pieza limpia o pasas de una posición ganada a una perdida en una sola jugada.' },
      { num: 2, titulo: 'El protocolo de verificación mental', desc: 'Antes de soltar la pieza en el tablero físico o hacer clic en la pantalla, pregúntate siempre: 1. ¿A qué casilla voy? 2. ¿Está defendida? 3. ¿Qué dejó de defender la pieza que acabo de mover?' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Usa la sección "Repaso de tu partida" para que Turing te señale exactamente en qué jugada ocurrió el blunder.' },
    ],
    tipoDiagrama: 'tactica',
    consejo: 'El 80% de las partidas en niveles principiante e intermedio se deciden por colgadas directas de pieza, no por planes estratégicos complejos.',
  },
  estructuras_peones: {
    subtitulo: 'El esqueleto del ajedrez: peones doblados, aislados y pasados',
    pasos: [
      { num: 1, titulo: 'Peón Aislado', desc: 'Un peón que no tiene peones amigos en las columnas adyacentes. Requiere piezas mayores para defenderlo y la casilla delante suyo es una base para el rival.' },
      { num: 2, titulo: 'Peones Doblados', desc: 'Dos peones del mismo bando en la misma columna tras una captura. Pierden movilidad y no se defienden entre sí.' },
      { num: 3, titulo: 'Peón Pasado', desc: 'Un peón que no tiene peones contrarios en su columna ni en las adyacentes que puedan frenar su marcha hacia la coronación. ¡Es un arma letal en el final!' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Los peones nunca pueden retroceder: cada avance debilita casillas tras de sí.' },
    ],
    tipoDiagrama: 'posicion',
    consejo: 'Crea peones pasados en el final y apóyalos con tu rey por detrás.',
  },
  finales_torre: {
    subtitulo: 'Posición de Lucena y técnica del puente para coronar',
    pasos: [
      { num: 1, titulo: 'La posición de Lucena', desc: 'Tu peón está en séptima fila con tu rey delante, y la torre rival te corta el paso. La técnica consiste en usar tu propia torre como "puente" defensivo.' },
      { num: 2, titulo: 'Construcción del Puente', desc: 'Llevas tu torre a la cuarta fila (ejemplo: Te4). Luego sacas tu rey dando paso al peón; cuando la torre enemiga te dé jaques continuos, interpones tu torre en e4 neutralizando los jaques y coronando la Dama.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Conocer Lucena garantiza convertir en victoria cualquier final de torre y peón con ventaja.' },
    ],
    tipoDiagrama: 'posicion',
    consejo: 'Los finales de torre son los más frecuentes en ajedrez competitivo: dominar Lucena y Filidor te sumará decenas de puntos de Elo.',
  },
  sparring_turing: {
    subtitulo: 'Entrenamiento táctico contra la red neuronal profunda SE-ResNet-8',
    pasos: [
      { num: 1, titulo: 'Inferencia neuronal pura', desc: 'El modelo Turing evalúa el tablero con tensores de 8x8x12 y 4096 logits, decidiendo jugadas basadas en su entrenamiento sobre partidas maestras.' },
      { num: 2, titulo: 'Búsqueda táctica de 2 a 3 plies', desc: 'Turing profundiza en las respuestas inmediatas (~1808 Elo), penalizando cualquier imprecisión que cometas.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'Juega con calma. Turing castigará jugadas impulsivas sin cálculo.' },
    ],
    tipoDiagrama: 'tactica',
    consejo: 'Observa cómo Turing coordina sus piezas menores hacia el centro antes de abrir la posición.',
  },
  analisis_centipeones: {
    subtitulo: 'Auditoría de precisión y pérdida media de centipeones (ACPL)',
    pasos: [
      { num: 1, titulo: '¿Qué es un centipeón (cp)?', desc: 'Es la unidad de medida objetiva del motor: 100 centipeones equivalen aproximadamente al valor de un peón.' },
      { num: 2, titulo: 'Pérdida Media de Centipeones (ACPL)', desc: 'Mide cuánta ventaja dejas escapar en promedio por jugada. Un jugador de club suele rondar 40-60 ACPL; un Gran Maestro menos de 20 ACPL.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'El análisis de Stockfish actúa como oráculo comparativo para auditar la precisión de tus decisiones.' },
    ],
    tipoDiagrama: 'tactica',
    consejo: 'Tu meta en cada entrenamiento debe ser reducir tu ACPL partida tras partida.',
  },
  maestria_torneos: {
    subtitulo: 'Consolidación de Elo y competencia clasificatoria',
    pasos: [
      { num: 1, titulo: 'Mantener rachas victoriosas', desc: 'Encadenar victorias consecutivas desbloquea las insignias de maestría en tu perfil de jugador.' },
      { num: 2, titulo: 'Escalar en el Ranking institucional', desc: 'Compite contra compañeros y facilitadores para ingresar al podio de honor de ChessIA.' },
    ],
    reglas: [
      { tipo: 'ok', texto: 'El sistema recalcula tu Elo estimado según el rendimiento frente a Turing y rivales.' },
    ],
    tipoDiagrama: 'posicion',
    consejo: 'La constancia diaria en partidas analizadas es el único camino comprobado hacia la maestría.',
  },
};

/**
 * Diagrama interactivo específico para la maniobra del Enroque.
 * Al ver el movimiento enrocado, notifica a la lección que la demostración fue completada.
 */
function DiagramaEnroque({ onCompletar }) {
  const [tipo, setTipo] = useState('corto'); // 'corto' | 'largo'
  const [estado, setEstado] = useState('inicial'); // Inicia en posición inicial

  const casillas = ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'];

  function piezaEnCasilla(c) {
    if (tipo === 'corto') {
      if (estado === 'inicial') {
        if (c === 'e1') return 'K';
        if (c === 'h1') return 'R';
        return null;
      } else {
        if (c === 'g1') return 'K';
        if (c === 'f1') return 'R';
        return null;
      }
    } else {
      if (estado === 'inicial') {
        if (c === 'e1') return 'K';
        if (c === 'a1') return 'R';
        return null;
      } else {
        if (c === 'c1') return 'K';
        if (c === 'd1') return 'R';
        return null;
      }
    }
  }

  function ejecutarEnroque() {
    setEstado('enrocado');
    if (onCompletar) onCompletar();
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTipo('corto');
              setEstado('inicial');
            }}
            className={`px-3 py-1 rounded-lg font-mono-micro text-mono-micro transition-colors ${
              tipo === 'corto'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Enroque Corto (O-O)
          </button>
          <button
            type="button"
            onClick={() => {
              setTipo('largo');
              setEstado('inicial');
            }}
            className={`px-3 py-1 rounded-lg font-mono-micro text-mono-micro transition-colors ${
              tipo === 'largo'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Enroque Largo (O-O-O)
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setEstado('inicial')}
            className={`px-2.5 py-1 rounded-lg font-mono-micro text-mono-micro transition-colors ${
              estado === 'inicial'
                ? 'bg-tertiary-container text-on-tertiary-container font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            1. Posición inicial
          </button>
          <button
            type="button"
            onClick={ejecutarEnroque}
            className={`px-2.5 py-1 rounded-lg font-mono-micro text-mono-micro transition-colors flex items-center gap-1 ${
              estado === 'enrocado'
                ? 'bg-neon-lime text-black font-extrabold shadow-sm'
                : 'bg-primary/20 text-primary font-bold hover:bg-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">play_arrow</span>
            2. ¡Ejecutar Enroque!
          </button>
        </div>
      </div>

      {/* Tablero estilizado de la fila 1 */}
      <div className="flex flex-col gap-1 items-center">
        <span className="font-mono-micro text-mono-micro text-on-surface-variant text-center">
          {tipo === 'corto'
            ? estado === 'inicial'
              ? 'Posición previa: Rey en e1 y Torre en h1 con casillas f1 y g1 libres. ¡Toca "2. Ejecutar Enroque"!'
              : 'Resultado: El Rey saltó a g1 (2 casillas) y la Torre saltó a f1.'
            : estado === 'inicial'
              ? 'Posición previa: Rey en e1 y Torre en a1 con casillas b1, c1, d1 libres. ¡Toca "2. Ejecutar Enroque"!'
              : 'Resultado: El Rey saltó a c1 (2 casillas) y la Torre saltó a d1.'}
        </span>

        <div className="grid grid-cols-8 w-full max-w-md border-2 border-outline-variant/60 rounded-xl overflow-hidden shadow-inner">
          {casillas.map((coord, idx) => {
            const pieza = piezaEnCasilla(coord);
            const esClara = (idx % 2) === 1;
            const esCasillaClave =
              tipo === 'corto'
                ? ['e1', 'f1', 'g1', 'h1'].includes(coord)
                : ['a1', 'c1', 'd1', 'e1'].includes(coord);

            return (
              <div
                key={coord}
                className={`relative aspect-square flex flex-col items-center justify-center p-1 transition-all ${
                  esClara ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'
                } ${esCasillaClave && estado === 'enrocado' ? 'ring-2 ring-neon-lime/80 ring-inset' : ''}`}
              >
                <span
                  className={`absolute top-0.5 left-1 text-[9px] font-mono font-bold select-none ${
                    esClara ? 'text-[#f0d9b5]' : 'text-[#b58863]'
                  }`}
                >
                  {coord}
                </span>

                {pieza && (
                  <motion.img
                    key={`${coord}-${pieza}-${estado}`}
                    initial={{ scale: 0.5, y: -4 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                    src={rutaImagenPieza(pieza)}
                    alt={pieza === 'K' ? 'Rey' : 'Torre'}
                    className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md select-none pointer-events-none"
                  />
                )}

                {!pieza && estado === 'inicial' && (
                  <>
                    {tipo === 'corto' && coord === 'g1' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-neon-lime/90 animate-ping" />
                    )}
                    {tipo === 'largo' && coord === 'c1' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-neon-lime/90 animate-ping" />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between w-full max-w-md px-1 pt-1 font-mono-micro text-mono-micro text-on-surface-variant">
          <span>Flanco de Dama (a-d)</span>
          <span className="text-primary font-bold">Fila 1 (Blancas)</span>
          <span>Flanco de Rey (e-h)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Diagrama interactivo específico para Los 3 Principios de Apertura.
 * Permite explorar los 3 mandamientos y desbloquear la práctica en Sala de Control.
 */
function DiagramaMandamientosApertura({ onCompletar }) {
  const [paso, setPaso] = useState(1);

  function verPaso(num) {
    setPaso(num);
    if (num === 3 && onCompletar) {
      onCompletar();
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30">
      <div className="grid grid-cols-3 gap-1.5 bg-surface-container p-1 rounded-xl">
        <button
          type="button"
          onClick={() => verPaso(1)}
          className={`px-2 py-1.5 rounded-lg font-mono-micro text-mono-micro transition-colors flex items-center justify-center gap-1 ${
            paso === 1 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>1. Centro</span>
        </button>
        <button
          type="button"
          onClick={() => verPaso(2)}
          className={`px-2 py-1.5 rounded-lg font-mono-micro text-mono-micro transition-colors flex items-center justify-center gap-1 ${
            paso === 2 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>2. Desarrollo</span>
        </button>
        <button
          type="button"
          onClick={() => verPaso(3)}
          className={`px-2 py-1.5 rounded-lg font-mono-micro text-mono-micro transition-colors flex items-center justify-center gap-1 ${
            paso === 3 ? 'bg-neon-lime text-black font-extrabold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>3. Enroque</span>
        </button>
      </div>

      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-mono text-base font-bold shrink-0">
          {paso}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="font-body-sm text-body-sm font-bold text-on-surface">
            {paso === 1 && 'Dominar las casillas centrales (d4, e4, d5, e5)'}
            {paso === 2 && 'Desarrollar Caballos y Alfiles hacia casillas activas'}
            {paso === 3 && 'Asegurar al Rey mediante el enroque rápido'}
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {paso === 1 && 'Avanza e4 o d4 en las dos primeras jugadas. Un peón en el centro frena el avance enemigo y abre paso a tus alfiles y dama.'}
            {paso === 2 && 'Mueve los caballos a f3 y c3, y los alfiles a c4 o b5. No muevas la misma pieza dos veces en la apertura.'}
            {paso === 3 && 'El rey en el centro es vulnerable a sacrificios y ataques en la columna e. ¡Enroca antes de la jugada 10!'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            verPaso(3);
            if (onCompletar) onCompletar();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-highest hover:bg-surface-bright text-primary font-mono-micro text-mono-micro font-bold border border-primary/30 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">verified</span>
          He revisado los 3 principios de apertura
        </button>
      </div>
    </div>
  );
}

/**
 * Ventana Flotante / Modal que muestra la lección completa, video y demostración.
 * REGLA PEDAGÓGICA: El botón "Probar una partida (Ir a Sala de Control)" SOLO aparece
 * una vez que el estudiante haya finalizado el video o interactuado con la demostración.
 */
function ModalLeccionCapitulo({
  capitulo,
  videosPorPieza,
  onCerrar,
  alMarcarVisto,
  alIrASalaControl,
  reducir,
}) {
  const contenido = CONTENIDO_LECCIONES[capitulo.id] ?? {
    subtitulo: capitulo.descripcion,
    pasos: [
      { num: 1, titulo: 'Objetivo del módulo', desc: capitulo.descripcion },
    ],
    reglas: [],
    tipoDiagrama: 'generico',
    consejo: 'Practica este concepto en tus partidas contra Turing para dominarlo.',
  };

  // Prioridad 1: Video específico del tema/módulo subido por el facilitador (ej: 'enroque', 'mandamientos_apertura', 'defensas_activas')
  // Prioridad 2: Fallback al video de la pieza asociada (ej: 'rey', 'alfil', etc.)
  const { url: urlVideoFacilitador, esEspecificoDelModulo: esVideoEspecificoDelModulo } = videoDelCapitulo(videosPorPieza, capitulo);

  // Si el módulo ya estaba completado previamente, puede ingresar a probar directo;
  // si es el paso en curso, debe completar la visualización/demostración.
  const [demostracionCompletada, setDemostracionCompletada] = useState(demostracionInicialCompletada(capitulo));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-leccion"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <motion.div
        initial={reducir ? false : { opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-surface-container border border-primary/35 shadow-2xl overflow-hidden"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-outline-variant/30 bg-surface-container-high/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-container-highest border border-primary/40 shrink-0">
              {capitulo.pieza ? (
                <img src={rutaImagenPieza(capitulo.pieza)} alt="" className="w-8 h-8" />
              ) : (
                <span className="material-symbols-outlined text-[26px] text-primary">
                  {capitulo.icono ?? 'school'}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-mono-micro text-mono-micro uppercase text-primary font-bold tracking-wider">
                Lección interactiva · {capitulo.id.toUpperCase()}
              </span>
              <h2 id="titulo-modal-leccion" className="font-headline-sm text-headline-sm text-on-surface truncate">
                {capitulo.titulo}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Cerrar ventana de lección"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Cuerpo de la lección con scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {contenido.subtitulo}
          </p>

          {/* Sección de Video Demostrativo (del Facilitador o Cartilla) */}
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-lowest p-3 sm:p-4 border border-outline-variant/30">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 font-mono-micro text-mono-micro text-primary font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">smart_display</span>
                {esVideoEspecificoDelModulo
                  ? `Video de la Lección (${capitulo.titulo})`
                  : 'Video Demostrativo del Docente'}
              </span>
              {urlVideoFacilitador ? (
                <span className="px-2 py-0.5 rounded bg-neon-lime/15 text-neon-lime text-[10px] font-mono uppercase font-bold">
                  {demostracionCompletada ? '✓ Video Visto' : 'Reproduciendo'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-mono uppercase">
                  Guía interactiva activa
                </span>
              )}
            </div>

            {urlVideoFacilitador ? (
              <div className="flex flex-col gap-2">
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-md">
                  <video
                    src={urlVideoFacilitador}
                    controls
                    playsInline
                    onEnded={() => setDemostracionCompletada(true)}
                    className="w-full h-full object-contain"
                    aria-label={`Video explicativo para ${capitulo.titulo}`}
                  />
                </div>
                {!demostracionCompletada && (
                  <button
                    type="button"
                    onClick={() => setDemostracionCompletada(true)}
                    className="self-end px-3 py-1 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-mono-micro font-bold transition-colors"
                  >
                    ✓ Ya terminé de ver el video
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-high/40 text-center">
                <span className="material-symbols-outlined text-[30px] text-on-surface-variant opacity-70">
                  videocam
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                  El docente o facilitador puede subir videos demostrativos desde su panel de gestión para enriquecer este módulo.
                </p>
                <span className="font-mono-micro text-mono-micro text-primary font-semibold">
                  Aprende e interactúa con la demostración a continuación para desbloquear tu partida:
                </span>
              </div>
            )}
          </div>

          {/* Demostraciones interactivas específicas */}
          {contenido.tipoDiagrama === 'enroque' && (
            <DiagramaEnroque onCompletar={() => setDemostracionCompletada(true)} />
          )}

          {contenido.tipoDiagrama === 'mandamientos' && (
            <DiagramaMandamientosApertura onCompletar={() => setDemostracionCompletada(true)} />
          )}

          {/* Pasos pedagógicos explicativos */}
          <div className="flex flex-col gap-3">
            <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-bold">
              Paso a paso: Cómo se realiza
            </span>
            <div className="flex flex-col gap-2.5">
              {contenido.pasos.map((p) => (
                <div
                  key={p.num}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container-high/50 border border-outline-variant/20"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-mono text-xs font-bold shrink-0 mt-0.5">
                    {p.num}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">
                      {p.titulo}
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botón explícito para validar la demostración en lecciones generales */}
          {contenido.tipoDiagrama !== 'enroque' && contenido.tipoDiagrama !== 'mandamientos' && !demostracionCompletada && (
            <div className="flex justify-center p-3 rounded-2xl bg-surface-container-high/60 border border-primary/30">
              <button
                type="button"
                onClick={() => setDemostracionCompletada(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-body-sm text-body-sm font-bold shadow-md hover:brightness-110 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                He completado la lectura y demostración de esta lección
              </button>
            </div>
          )}

          {/* Reglas y Condiciones Obligatorias */}
          {contenido.reglas.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant font-bold">
                Reglas y Condiciones Obligatorias
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {contenido.reglas.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-3 rounded-xl border text-body-sm ${
                      r.tipo === 'ok'
                        ? 'bg-neon-lime/5 border-neon-lime/30 text-on-surface'
                        : 'bg-error/5 border-error/30 text-on-surface'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                        r.tipo === 'ok' ? 'text-neon-lime' : 'text-error'
                      }`}
                    >
                      {r.tipo === 'ok' ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="leading-snug">{r.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consejo del Tutor / Gran Maestro */}
          {contenido.consejo && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-tertiary-container/15 border border-tertiary/30">
              <span className="material-symbols-outlined text-[22px] text-tertiary shrink-0 mt-0.5">
                lightbulb
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono-micro text-mono-micro text-tertiary font-bold uppercase tracking-wider">
                  Consejo de Turing
                </span>
                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                  {contenido.consejo}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pie de acciones del Modal con condición de finalización de demostración */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-t border-outline-variant/30 bg-surface-container-high/70 shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface font-body-sm text-body-sm font-medium hover:bg-surface-container transition-colors"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Si NO ha terminado la demostración o video: se muestra el candado pedagógico */}
            {!puedeProbarPartida(demostracionCompletada) && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant font-mono-micro text-mono-micro">
                <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">lock</span>
                <span>Termina la demostración para desbloquear tu partida</span>
              </div>
            )}

            {/* Si YA terminó la demostración o video: APARECE EL BOTÓN DESTACADO "PROBAR UNA PARTIDA" */}
            <AnimatePresence>
              {puedeProbarPartida(demostracionCompletada) && (
                <motion.button
                  key="btn-probar-partida"
                  type="button"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    alMarcarVisto(capitulo.id);
                    onCerrar();
                    if (alIrASalaControl) alIrASalaControl();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neon-lime text-black font-body-sm text-body-sm font-black shadow-[0_0_24px_rgba(204,255,0,0.55)] hover:brightness-110 transition-all animate-pulse"
                >
                  <span className="material-symbols-outlined text-[20px] font-black">sports_esports</span>
                  Probar una partida (Ir a Sala de Control)
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** En pantallas anchas el camino zigzaguea entre estas posiciones (en % del ancho). */
const POSICIONES_ZIGZAG = [30, 70];

const RADIO_ANILLO = 34;
const LONGITUD_ANILLO = 2 * Math.PI * RADIO_ANILLO;

const ETIQUETA_ESTADO = {
  completado: '¡Listo!',
  en_curso: 'Vas por aquí',
  bloqueado: 'Se abre al terminar el anterior',
  proximo: 'Próximamente',
};

function claveCapitulosVistos(usuarioId) {
  return `camino_capitulos_vistos_${usuarioId ?? 'anon'}`;
}

function cargarCapitulosVistos(usuarioId) {
  try {
    const crudo = localStorage.getItem(claveCapitulosVistos(usuarioId));
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardarCapitulosVistos(usuarioId, ids) {
  try {
    localStorage.setItem(claveCapitulosVistos(usuarioId), JSON.stringify(ids));
  } catch {
    // Modo privado o cuota llena: el capítulo queda marcado solo en esta sesión.
  }
}

/** El jugador lleva blancas, así que sus jugadas son las de índice par de `jugadas_san`. */
function jugadasDelJugador(jugadasSan) {
  return jugadasSan.filter((_, indice) => indice % 2 === 0);
}

function hizoCaptura(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('x'));
}

function dioJaque(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('+') || san.includes('#'));
}

function hizoEnroque(jugadasSan) {
  return jugadasDelJugador(jugadasSan).some((san) => san.includes('O-O') || san.includes('0-0'));
}

/** Días seguidos con al menos una partida, contando hoy (o ayer, si hoy todavía no jugó). */
function rachaDeDias(fechas, ahora = new Date()) {
  const clave = (fecha) => `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
  const dias = new Set(
    fechas.map((f) => new Date(f)).filter((d) => !Number.isNaN(d.getTime())).map(clave),
  );
  const cursor = new Date(ahora);
  if (!dias.has(clave(cursor))) cursor.setDate(cursor.getDate() - 1);
  let racha = 0;
  while (dias.has(clave(cursor))) {
    racha += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

/** Anillo que se llena hasta el porcentaje y cuenta el número en paralelo. */
function AnilloProgreso({ porcentaje, reducir }) {
  const [valor, setValor] = useState(reducir ? porcentaje : 0);

  useEffect(() => {
    if (reducir) {
      setValor(porcentaje);
      return undefined;
    }
    const control = animate(0, porcentaje, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setValor(Math.round(v)),
    });
    return () => control.stop();
  }, [porcentaje, reducir]);

  const desplazamiento = LONGITUD_ANILLO * (1 - valor / 100);

  return (
    <div className="relative w-[88px] h-[88px] shrink-0" role="img" aria-label={`${valor}% del camino completado`}>
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="gradiente-anillo-camino" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-tertiary)" />
            <stop offset="1" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={RADIO_ANILLO} fill="none" stroke="var(--color-outline-variant)" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={RADIO_ANILLO}
          fill="none"
          stroke="url(#gradiente-anillo-camino)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={LONGITUD_ANILLO}
          strokeDashoffset={desplazamiento}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono-metric text-mono-metric font-bold text-on-surface">
        {valor}%
      </span>
    </div>
  );
}

/** Nodo interactivo del camino: al hacer clic, abre la ventana flotante de demostración/video. */
function Nodo({ estado, pieza, icono, reducir, indice = 0, onClick, titulo }) {
  if (estado === 'completado') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        title={`Ver demostración y lección de: ${titulo}`}
        aria-label={`Ver lección de ${titulo} (Completado)`}
        initial={reducir ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={reducir ? undefined : { scale: 1.1 }}
        whileTap={reducir ? undefined : { scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className="relative flex items-center justify-center w-16 h-16 rounded-full text-on-tertiary-fixed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{
          background: 'linear-gradient(135deg, #ffdcc1, #ffb778)',
          boxShadow: '0 0 24px rgba(255, 183, 120, 0.45)',
        }}
      >
        {!reducir && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,183,120,0.55), transparent 70%)' }}
            animate={{ scale: [1, 1.7], opacity: [0.8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: indice * 0.35 }}
          />
        )}
        <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          star
        </span>
      </motion.button>
    );
  }

  if (estado === 'en_curso') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        title={`Paso actual: Clic para ver cómo se hace (${titulo})`}
        aria-label={`Ver lección de ${titulo} (Paso actual)`}
        whileHover={reducir ? undefined : { scale: 1.1 }}
        whileTap={reducir ? undefined : { scale: 0.95 }}
        className="relative flex items-center justify-center w-16 h-16 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full"
      >
        {!reducir && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-primary-container"
            animate={{ scale: [1, 1.5], opacity: [0.9, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <div
          className="relative flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-lowest border-[3px] border-primary-container text-primary shadow-lg"
          style={{ boxShadow: '0 0 28px color-mix(in srgb, var(--color-primary-container) 50%, transparent)' }}
        >
          {pieza ? (
            <motion.img
              src={rutaImagenPieza(pieza)}
              alt=""
              className="w-10 h-10 select-none pointer-events-none"
              animate={reducir ? undefined : { y: [0, -4, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <span className="material-symbols-outlined text-[30px]">{icono ?? 'school'}</span>
          )}
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={`Clic para ver la lección de: ${titulo}`}
      aria-label={`Ver lección de ${titulo}`}
      whileHover={reducir ? undefined : { scale: 1.05 }}
      whileTap={reducir ? undefined : { scale: 0.95 }}
      className={`flex items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-outline-variant text-outline cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        estado === 'proximo' ? 'opacity-50' : 'bg-surface-container hover:bg-surface-container-high'
      }`}
    >
      <span className="material-symbols-outlined text-[26px]">lock</span>
    </motion.button>
  );
}

/** Trazo de una línea entre dos nodos: se dibuja al entrar, el activo fluye y el completado tiene una luz que viaja. */
function TrazoConector({ d, estadoOrigen, estadoDestino, indice, reducir }) {
  const idBase = useId();
  const hecho = estadoOrigen === 'completado' && estadoDestino === 'completado';
  const activo = estadoOrigen === 'completado' && estadoDestino === 'en_curso';

  const color = hecho
    ? 'var(--color-tertiary)'
    : activo
      ? 'var(--color-primary-container)'
      : 'var(--color-outline-variant)';

  const idRecorte = `${idBase}-recorte-camino`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <clipPath id={idRecorte} clipPathUnits="userSpaceOnUse">
          <rect x="-200" y="32" width="500" height="36" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idRecorte})`}>
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={hecho || activo ? 5 : 4}
          strokeLinecap="round"
          strokeDasharray={hecho ? undefined : '6 8'}
          vectorEffect="non-scaling-stroke"
          animate={{ strokeDashoffset: activo && !reducir ? [0, -28] : 0 }}
          transition={{ strokeDashoffset: { duration: 1.2, repeat: Infinity, ease: 'linear' } }}
        />
        {hecho && !reducir && (
          <motion.path
            d={d}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="4 60"
            vectorEffect="non-scaling-stroke"
            animate={{ strokeDashoffset: [0, -64] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: indice * 0.25 }}
          />
        )}
      </g>
    </svg>
  );
}

/**
 * Línea que une un nodo con el siguiente. En teléfono y tableta va recta por la
 * columna de los nodos; en pantallas anchas sigue el zigzag entre las posiciones.
 */
function Conector({ xDesde, xHasta, estadoOrigen, estadoDestino, indice, reducir }) {
  return (
    <>
      <div className="absolute left-0 w-16 pointer-events-none xl:hidden" style={{ top: 32, bottom: -32 }} aria-hidden="true">
        <TrazoConector
          d="M 50 0 L 50 100"
          estadoOrigen={estadoOrigen}
          estadoDestino={estadoDestino}
          indice={indice}
          reducir={reducir}
        />
      </div>
      <div className="absolute inset-x-0 hidden pointer-events-none xl:block" style={{ top: 32, bottom: -32 }} aria-hidden="true">
        <TrazoConector
          d={`M ${xDesde} 0 C ${xDesde} 50, ${xHasta} 50, ${xHasta} 100`}
          estadoOrigen={estadoOrigen}
          estadoDestino={estadoDestino}
          indice={indice}
          reducir={reducir}
        />
      </div>
    </>
  );
}

/** Tarjeta del paso actual: contiene el botón para abrir la lección y video interactivo. */
function TarjetaPasoActual({
  capitulo,
  claseTextoContenido,
  alMarcarVisto,
  alAbrirLeccion,
  alIrASeccion,
  alIrASalaControl,
  reducir,
}) {
  const claseBoton =
    'px-space-md py-space-xs rounded-full bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all hover:brightness-110 flex items-center gap-1.5';

  return (
    <motion.section
      aria-label="Paso actual"
      initial={reducir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="p-space-md rounded-2xl border border-primary/40 bg-surface-container-lowest/80 flex flex-col gap-space-xs shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
        <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-primary font-bold">
          Paso actual sugerido · {capitulo.titulo}
        </span>
      </div>
      <p className={`${claseTextoContenido} text-on-surface leading-relaxed`}>{capitulo.descripcion}</p>
      <div className="flex flex-wrap items-center gap-space-xs pt-1">
        {/* Botón principal para abrir la ventana flotante de demostración/video con flecha y llamada a la acción */}
        <motion.button
          type="button"
          onClick={() => alAbrirLeccion(capitulo)}
          whileHover={reducir ? undefined : { scale: 1.04 }}
          whileTap={reducir ? undefined : { scale: 0.96 }}
          className="px-space-md py-space-xs rounded-full bg-neon-lime text-black font-body-sm text-body-sm font-bold shadow-md flex items-center gap-1.5 hover:brightness-110 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]">play_circle</span>
          Ver cómo se hace (Demostración y Video)
        </motion.button>

        {capitulo.marcable && (
          <motion.button
            type="button"
            onClick={() => alMarcarVisto(capitulo.id)}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            ¡Ya lo comprendí! (Marcar listo)
          </motion.button>
        )}
        {capitulo.accion === 'piezas' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('piezas')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            <span className="material-symbols-outlined text-[16px]">extension</span>
            Ir a Aprendé cada pieza
          </motion.button>
        )}
        {capitulo.accion === 'repaso' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('repaso')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            <span className="material-symbols-outlined text-[16px]">history_edu</span>
            Ir a Repaso de tu partida
          </motion.button>
        )}
        {capitulo.accion === 'ranking' && alIrASeccion && (
          <motion.button
            type="button"
            onClick={() => alIrASeccion('ranking')}
            whileHover={reducir ? undefined : { scale: 1.04 }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
            className={claseBoton}
          >
            <span className="material-symbols-outlined text-[16px]">leaderboard</span>
            Ver Ranking de Maestría
          </motion.button>
        )}
      </div>
    </motion.section>
  );
}

/**
 * Camino de Aprendizaje multinivel adaptativo.
 * Implementa la fundamentación pedagógica formal (FIDE Stappenmethode y Práctica Deliberada).
 * Ventana flotante con verificación de demostración/video antes de permitir probar partida.
 */
export default function CaminoAprendizaje({
  usuarioId,
  rango,
  piezasVistas,
  videosPorPieza,
  alIrASeccion,
  alIrASalaControl,
  claseTextoContenido,
}) {
  const reducir = useReducedMotion();
  const [partidas, setPartidas] = useState([]);
  const [jugadasPorPartida, setJugadasPorPartida] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vistos, setVistos] = useState(() => cargarCapitulosVistos(usuarioId));

  // Estado para la ventana flotante (Modal) de lección
  const [capituloSeleccionado, setCapituloSeleccionado] = useState(null);
  const [avisoBloqueo, setAvisoBloqueo] = useState(null);

  // el aviso de «módulo bloqueado» se quita solo
  useEffect(() => {
    if (!avisoBloqueo) return undefined;
    const temporizador = setTimeout(() => setAvisoBloqueo(null), 5000);
    return () => clearTimeout(temporizador);
  }, [avisoBloqueo]);

  // Determinar etapa inicial sugerida según el rango estimado del jugador
  const etapaSugerida = useMemo(() => {
    if (rango === 'Avanzado') return 'avanzado';
    if (rango === 'Intermedio') return 'intermedio';
    return 'principiante';
  }, [rango]);

  const [etapaActiva, setEtapaActiva] = useState(etapaSugerida);

  useEffect(() => {
    if (rango === 'Avanzado') setEtapaActiva('avanzado');
    else if (rango === 'Intermedio') setEtapaActiva('intermedio');
    else setEtapaActiva('principiante');
  }, [rango]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    historialPartidasPropio(PARTIDAS_A_REVISAR, 0)
      .then(async (historial) => {
        const jugadas = (historial?.partidas ?? []).filter((p) => p.cantidad_jugadas > 0);
        if (cancelado) return;
        setPartidas(jugadas);
        if (jugadas.length === 0) {
          setCargando(false);
          return;
        }

        const acumuladas = [];
        for (let desde = 0; desde < jugadas.length; desde += LOTE_DE_PARTIDAS) {
          const lote = jugadas.slice(desde, desde + LOTE_DE_PARTIDAS);
          const detalles = await Promise.allSettled(lote.map((p) => obtenerPartida(p.id)));
          if (cancelado) return;
          detalles.forEach((d) => {
            if (d.status === 'fulfilled') acumuladas.push(d.value?.jugadas ?? []);
          });
          setJugadasPorPartida([...acumuladas]);
          setCargando(false);
        }
      })
      .catch((err) => {
        if (!cancelado) setError(err);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  function marcarVisto(id) {
    setVistos((actual) => {
      if (actual.includes(id)) return actual;
      const nuevo = [...actual, id];
      guardarCapitulosVistos(usuarioId, nuevo);
      return nuevo;
    });
  }

  // Evaluar estado de los capítulos para la etapa activa
  const capitulosConfig = ETAPAS_APRENDIZAJE[etapaActiva]?.capitulos ?? ETAPAS_APRENDIZAJE.principiante.capitulos;

  const capitulos = useMemo(() => {
    const verificaciones = {
      // Etapa Principiante
      tablero: partidas.length > 0 || vistos.includes('tablero'),
      piezas: (piezasVistas?.length ?? 0) >= 6 || vistos.includes('piezas'),
      posicion: vistos.includes('posicion'),
      movimientos: vistos.includes('movimientos'),
      enroque: vistos.includes('enroque') || jugadasPorPartida.some(hizoEnroque),
      captura: vistos.includes('captura') || jugadasPorPartida.some(hizoCaptura),
      jaque: vistos.includes('jaque') || jugadasPorPartida.some(dioJaque),

      // Etapa Intermedia
      mandamientos_apertura: vistos.includes('mandamientos_apertura'),
      aperturas_clasicas: vistos.includes('aperturas_clasicas'),
      defensas_activas: vistos.includes('defensas_activas'),
      gambito_dama: vistos.includes('gambito_dama'),
      tactica_doble: vistos.includes('tactica_doble'),
      tactica_clavada: vistos.includes('tactica_clavada'),
      erradicar_blunders: vistos.includes('erradicar_blunders') || partidas.length >= 3,

      // Etapa Avanzada
      estructuras_peones: vistos.includes('estructuras_peones'),
      finales_torre: vistos.includes('finales_torre'),
      sparring_turing: vistos.includes('sparring_turing') || partidas.some((p) => p.tipo_oponente === 'modelo'),
      analisis_centipeones: vistos.includes('analisis_centipeones') || partidas.length >= 5,
      maestria_torneos: vistos.includes('maestria_torneos') || rango === 'Avanzado',
    };

    let hayEnCurso = false;
    return capitulosConfig.map((c) => {
      const estaHecho = Boolean(verificaciones[c.id]);
      if (estaHecho) return { ...c, estado: 'completado' };
      if (!hayEnCurso) {
        hayEnCurso = true;
        return { ...c, estado: 'en_curso' };
      }
      return { ...c, estado: 'bloqueado' };
    });
  }, [capitulosConfig, partidas, jugadasPorPartida, piezasVistas, vistos, rango]);

  const completados = capitulos.filter((c) => c.estado === 'completado').length;
  const porcentaje = Math.round((completados / capitulosConfig.length) * 100);
  const racha = useMemo(() => rachaDeDias(partidas.map((p) => p.fecha)), [partidas]);
  const enCurso = capitulos.find((c) => c.estado === 'en_curso');

  /** Abre la lección de un módulo; si está bloqueado no se abre y se avisa qué módulo falta terminar. */
  function abrirLeccion(fila) {
    if (!puedeAbrirLeccion(fila)) {
      setAvisoBloqueo(avisoDeModuloBloqueado(capitulos));
      return;
    }
    setAvisoBloqueo(null);
    setCapituloSeleccionado(fila);
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-space-sm" aria-busy="true" aria-label="Armando tu camino pedagógico">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          <span className="font-mono-micro text-mono-micro">Sincronizando plan pedagógico según tu nivel…</span>
        </div>
        <div className="h-28 rounded-3xl border border-outline-variant/10 bg-on-surface/[0.04] backdrop-blur-md animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-body-sm text-body-sm text-error py-space-xs">
        No pudimos cargar tu progreso en este momento. {error.message || ''}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Selector de Etapa Pedagógica (Tabs multinivel interactivos) */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">
            Metodología FIDE · Currículo adaptativo
          </span>
          <span className="font-mono-micro text-mono-micro px-2 py-0.5 rounded bg-surface-container text-primary font-medium">
            Rango actual: {rango ?? 'Principiante'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30">
          {Object.values(ETAPAS_APRENDIZAJE).map((etapa) => {
            const esActiva = etapaActiva === etapa.id;
            const esSugerida = etapaSugerida === etapa.id;

            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => setEtapaActiva(etapa.id)}
                className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-body-sm text-body-sm transition-all text-left ${
                  esActiva
                    ? 'bg-surface-container-high text-primary font-semibold shadow-sm border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{etapa.icono}</span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{etapa.nombre}</span>
                  {esSugerida && (
                    <span className="text-[10px] font-mono-micro text-neon-lime uppercase tracking-wider">
                      ★ Recomendado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cabecera de progreso de la etapa activa */}
      <motion.header
        key={etapaActiva}
        initial={reducir ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl p-space-md border border-outline-variant/30"
        style={{
          background:
            'radial-gradient(circle at 15% 0%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 55%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--color-tertiary) 12%, transparent), transparent 50%), var(--color-surface-container-low)',
        }}
      >
        <div className="flex flex-wrap items-center gap-space-md">
          <AnilloProgreso porcentaje={porcentaje} reducir={reducir} />

          <div className="flex-1 min-w-[12rem] flex flex-col gap-space-2xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="px-space-sm py-[2px] rounded-full bg-primary/15 text-primary font-mono-micro text-mono-micro uppercase tracking-wider font-semibold">
                {ETAPAS_APRENDIZAJE[etapaActiva]?.nombre}
              </span>
              <span className="flex items-center gap-1 px-space-sm py-[2px] rounded-full bg-tertiary/10 text-tertiary font-mono-micro text-mono-micro">
                <motion.span
                  className="material-symbols-outlined text-[16px]"
                  animate={reducir || racha === 0 ? undefined : { scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  local_fire_department
                </motion.span>
                {racha > 0 ? `${racha} ${racha === 1 ? 'día' : 'días'} de práctica` : 'Jugá hoy para iniciar racha'}
              </span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {completados} de {capitulosConfig.length} módulos completados
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
              {ETAPAS_APRENDIZAJE[etapaActiva]?.lema}
            </p>
            {enCurso ? (
              <p className="font-body-sm text-body-sm text-primary font-medium mt-1">
                Siguiente objetivo: {enCurso.titulo} · <button type="button" onClick={() => setCapituloSeleccionado(enCurso)} className="underline hover:text-primary-fixed-dim">Ver lección y video</button>
              </p>
            ) : (
              <p className="font-body-sm text-body-sm text-neon-lime font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                ¡Felicitaciones! Has completado todos los módulos de esta etapa.
              </p>
            )}
          </div>
        </div>
      </motion.header>

      {/* Tarjeta de acción inmediata para el módulo actual */}
      {enCurso && (
        <TarjetaPasoActual
          capitulo={enCurso}
          claseTextoContenido={claseTextoContenido}
          alMarcarVisto={marcarVisto}
          alAbrirLeccion={(c) => setCapituloSeleccionado(c)}
          alIrASeccion={alIrASeccion}
          alIrASalaControl={alIrASalaControl}
          reducir={reducir}
        />
      )}

      {avisoBloqueo && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-outline-variant/40 bg-surface-container px-3.5 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">lock</span>
          <span>{avisoBloqueo}</span>
        </p>
      )}

      {/* Lista del camino en zigzag con nodos y conectores */}
      <ol className="flex flex-col pt-8" aria-label={`Capítulos de ${ETAPAS_APRENDIZAJE[etapaActiva]?.nombre}`}>
        {capitulos.map((fila, indice) => {
          const siguiente = capitulos[indice + 1];
          const x = POSICIONES_ZIGZAG[indice % POSICIONES_ZIGZAG.length];
          const xSiguiente = POSICIONES_ZIGZAG[(indice + 1) % POSICIONES_ZIGZAG.length];
          const etiquetaIzquierda = siguiente ? xSiguiente > x : x > 50;
          const esPasoActual = fila.estado === 'en_curso';

          return (
            <motion.li
              key={fila.id}
              className={`relative ${siguiente ? 'pb-12' : ''}`}
              style={{ '--x': `${x}%` }}
              initial={reducir ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + indice * 0.05, duration: 0.35 }}
            >
              {siguiente && (
                <Conector
                  xDesde={x}
                  xHasta={xSiguiente}
                  estadoOrigen={fila.estado}
                  estadoDestino={siguiente.estado}
                  indice={indice}
                  reducir={reducir}
                />
              )}

              <div className="h-16" aria-hidden="true" />

              {/* Esfera / Nodo interactivo con flecha indicadora */}
              <div className="absolute top-0 left-0 w-16 h-16 xl:left-[calc(var(--x)_-_2rem)] z-10">
                {/* Flecha indicadora animada que apunta directamente a la esfera del paso actual (e.g. la bandera o el rey) */}
                {esPasoActual && (
                  <motion.button
                    type="button"
                    onClick={() => setCapituloSeleccionado(fila)}
                    initial={reducir ? false : { opacity: 0, y: -8 }}
                    animate={reducir ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 py-1 rounded-full bg-neon-lime text-black font-mono-micro text-[11px] font-black shadow-[0_4px_18px_rgba(204,255,0,0.5)] whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title={`Clic aquí para ver cómo se hace (${fila.titulo})`}
                  >
                    <span>¡Clic aquí!</span>
                    <span className="material-symbols-outlined text-[16px] font-black animate-bounce">
                      arrow_downward
                    </span>
                  </motion.button>
                )}

                <Nodo
                  estado={fila.estado}
                  pieza={fila.pieza}
                  icono={fila.icono}
                  reducir={reducir}
                  indice={indice}
                  titulo={fila.titulo}
                  onClick={() => abrirLeccion(fila)}
                />

                {/* Distintivo en la esquina de la esfera: solo en los módulos que se pueden abrir (el bloqueado ya muestra su candado) */}
                {fila.estado !== 'bloqueado' && (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-surface-container-lowest border-2 border-primary text-primary shadow-sm pointer-events-none">
                  <span className="material-symbols-outlined text-[13px] font-bold">
                    {fila.estado === 'completado' ? 'visibility' : esPasoActual ? 'play_arrow' : 'info'}
                  </span>
                </span>
                )}
              </div>

              {/* Etiqueta del módulo (también cliqueable para abrir ventana flotante) */}
              <button
                type="button"
                onClick={() => abrirLeccion(fila)}
                className={`absolute top-0 left-[4.5rem] right-0 h-16 flex flex-col justify-center xl:w-52 text-left cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-lg ${
                  etiquetaIzquierda
                    ? 'xl:left-auto xl:right-[calc(100%_-_var(--x)_+_2.75rem)] xl:text-right'
                    : 'xl:left-[calc(var(--x)_+_2.75rem)] xl:right-auto xl:text-left'
                }`}
                title={fila.estado === 'bloqueado' ? 'Bloqueado: terminá primero el módulo en curso' : `Clic para ver la lección y demostración de: ${fila.titulo}`}
              >
                <p className="font-body-sm text-body-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors flex items-center gap-1">
                  <span>{fila.titulo}</span>
                  <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                    open_in_new
                  </span>
                </p>
                <p
                  className={`font-mono-micro text-mono-micro ${
                    fila.estado === 'completado'
                      ? 'text-tertiary-fixed-dim'
                      : esPasoActual
                        ? 'text-primary font-bold'
                        : 'text-outline'
                  }`}
                >
                  Módulo {indice + 1} · {ETIQUETA_ESTADO[fila.estado]}
                </p>
              </button>
            </motion.li>
          );
        })}
      </ol>

      {/* Ventana Flotante / Modal de Lección (animada) */}
      <AnimatePresence>
        {capituloSeleccionado && (
          <ModalLeccionCapitulo
            capitulo={capituloSeleccionado}
            videosPorPieza={videosPorPieza}
            onCerrar={() => setCapituloSeleccionado(null)}
            alMarcarVisto={marcarVisto}
            alIrASalaControl={alIrASalaControl}
            reducir={reducir}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
