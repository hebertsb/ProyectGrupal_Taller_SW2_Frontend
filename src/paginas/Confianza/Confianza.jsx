/**
 * «Confianza»: dos fichas para quien decide si usa ChessIA con sus alumnos o evalúa el proyecto.
 *
 * 1. El entorno cerrado: qué protege a los chicos. Cada punto describe algo que el sistema hace de verdad (cada uno tiene su prueba
 *    automática o su regla en el código); si cambia, se actualiza acá junto con la política de privacidad.
 * 2. Turing, medido: la fuerza del modelo propio con números reales, cómo se midió y lo que se probó y se descartó. Las cifras salen de
 *    `docs/turing_hoja_de_ruta.md` y `docs/marco_teorico_ia_entrenamiento.md`; no se redondean a favor.
 *
 * Se abre desde el menú o, sin iniciar sesión, en `/#confianza`.
 */

const ACTUALIZADO = '26 de octubre de 2026';

const PROTECCIONES = [
  {
    icono: 'key',
    titulo: 'Se entra con el código del curso',
    texto: 'Un alumno solo llega a su docente con el código (o el QR) del curso. El docente puede cerrar los ingresos y ponerle un cupo.',
  },
  {
    icono: 'lock_person',
    titulo: 'Cada institución ve solo lo suyo',
    texto: 'Un docente ve a los alumnos de sus cursos; el director, a los de su institución. Nadie puede mirar a los de otra: el servidor lo rechaza.',
  },
  {
    icono: 'forum',
    titulo: 'Sin chat ni mensajes entre alumnos',
    texto: 'El sistema no tiene mensajería entre usuarios. Los alumnos juegan y aprenden; no hablan con desconocidos.',
  },
  {
    icono: 'badge',
    titulo: 'Nombres abreviados en el ranking',
    texto: 'En el ranking de su curso, los compañeros ven «Ana P.» y su nivel; nada más. El ranking es solo del curso.',
  },
  {
    icono: 'swords',
    titulo: 'Solo se juega con gente conocida',
    texto: 'Un jugador solo puede retar a sus compañeros de curso o a amigos que aceptaron su solicitud. No se busca a nadie por nombre (hace falta su correo o su código de amigo) y quien rechaza una solicitud no le avisa a nadie. Los de una institución solo se emparejan con los de su institución. Los docentes pueden mirar cualquier partida de sus alumnos en vivo.',
  },
  {
    icono: 'school',
    titulo: 'Permisos y contacto de las familias',
    texto: 'La web pide la edad declarada. Los menores practican individualmente hasta que se declara el permiso familiar o el docente confirma que su curso ya tiene las autorizaciones. El contacto del tutor es privado y el docente puede usarlo para acompañar al alumno a distancia. La edad y el permiso son declaraciones; no se comprueban documentos.',
  },
  {
    icono: 'shield_person',
    titulo: 'Bloquear, denunciar y pausar retos',
    texto: 'Un alumno puede bloquear o denunciar a otro jugador. El docente revisa las denuncias de sus alumnos y puede pausar los nuevos retos del curso con el modo clase. Las partidas que ya empezaron continúan.',
  },
  {
    icono: 'school',
    titulo: 'Un tutor que solo habla de ajedrez',
    texto: 'Turing está instruido para responder únicamente sobre ajedrez, y las reglas las toma de textos escritos y revisados a mano, no las inventa. Como todo modelo de lenguaje puede equivocarse, y el servicio que redacta la respuesta es externo (lo decimos en la política).',
  },
  {
    icono: 'ad_off',
    titulo: 'Sin publicidad ni venta de datos',
    texto: 'No mostramos anuncios, no vendemos datos y no armamos perfiles comerciales. Para los menores pedimos la autorización de su familia o de su colegio.',
  },
  {
    icono: 'shield_lock',
    titulo: 'Cuentas protegidas',
    texto: 'Las contraseñas se guardan cifradas, se limitan los intentos fallidos y los docentes y directores pueden activar la verificación en dos pasos con una app de códigos (el servidor puede exigirla).',
  },
  {
    icono: 'history',
    titulo: 'Registro de acciones sensibles',
    texto: 'Cada baja, cambio de rol o de institución queda anotado sin datos personales (solo números de cuenta) y se conserva un año.',
  },
  {
    icono: 'delete_forever',
    titulo: 'Baja de la cuenta cuando se pida',
    texto: 'Alumnos y docentes eliminan su cuenta desde el perfil y se borra con todo lo que figura en la política. La familia puede pedirlo a través de la institución.',
  },
  {
    icono: 'model_training',
    titulo: 'El modelo no aprende en vivo',
    texto: 'Turing solo se reentrena en lotes controlados y versionados, nunca mientras un chico juega. Lo que juegue hoy no cambia al modelo de mañana sin que alguien lo revise.',
  },
  {
    icono: 'description',
    titulo: 'Informes sin enlace público',
    texto: 'El informe de progreso lleva el nombre completo de un menor, así que no tiene enlace: se ve con sesión y se entrega impreso o por mensaje.',
  },
];

/** Cada versión de Turing frente a la anterior, con el mismo conjunto de jugadas de maestros que no vio al entrenar. */
const EVOLUCION = [
  { version: 'v5', datos: '12.000 partidas de jugadores de 2000+', acierto: '43,15 %', graves: '6,0 %' },
  { version: 'v6', datos: '35.000 partidas de jugadores de 2200+', acierto: '48,99 %', graves: '3,3 %' },
];

const ELO = [
  { etiqueta: 'La red sola', valor: 1355, rango: '1284 a 1427', detalle: 'Elige la jugada que elegiría un maestro, sin calcular variantes.' },
  { etiqueta: 'Red + búsqueda de 3 jugadas', valor: 1808, rango: '1737 a 1878', detalle: 'La red propone y pondera; el cálculo evita errores tácticos.' },
];
const ELO_MINIMO = 1000;
const ELO_MAXIMO = 2000;

const DESCARTADO = [
  {
    titulo: 'Una red que evalúa posiciones',
    texto:
      'Entrenada con 1.000.000 de posiciones de Lichess, evalúa mejor que la regla manual (acierta quién gana el 92,2 % de las veces frente al 76,2 %). Pero dentro de la búsqueda es más lenta, llega a menos jugadas por segundo y perdió: +2 =12 −26 en 40 partidas. Se descartó.',
  },
  {
    titulo: 'La misma red solo opinando sobre cada candidata',
    texto: 'Sin restar profundidad de búsqueda: 46,2 % en 40 partidas, con un intervalo que incluye el empate. No es una mejora clara, así que no se acepta.',
  },
];

const LIMITES = [
  'La red sola imita a los maestros pero no calcula variantes: contra Stockfish pierde desde su nivel 5. La búsqueda es la que la lleva a 1808.',
  'El Elo es relativo a Stockfish con Elo calibrado y a 0,2 segundos por jugada; no es un Elo oficial. Sirve para comparar versiones y ubicar el orden de magnitud.',
  'Son 120 partidas por medición. Por eso se informa siempre el intervalo, no solo el número.',
  '«Maestro 18» es la etiqueta de la escala del sistema (el Elo de las partidas de entrenamiento), no una fuerza medida.',
];

function Seccion({ id, titulo, children }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-space-sm bg-surface-container-low p-space-md sm:p-space-lg rounded-xl shadow-md">
      <h2 id={id} className="m-0 font-headline-sm text-headline-sm text-on-surface">{titulo}</h2>
      {children}
    </section>
  );
}

function BarraElo({ fila }) {
  const ancho = Math.round(((fila.valor - ELO_MINIMO) / (ELO_MAXIMO - ELO_MINIMO)) * 100);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-space-sm font-body-sm text-body-sm">
        <span className="text-on-surface font-medium">{fila.etiqueta}</span>
        <span className="font-mono-metric text-mono-metric text-primary">
          Elo ≈ {fila.valor.toLocaleString('es-BO')} <span className="text-on-surface-variant">(intervalo {fila.rango})</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-surface-container-high overflow-hidden" role="img" aria-label={`${fila.etiqueta}: Elo aproximado ${fila.valor}`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${ancho}%` }} />
      </div>
      <span className="font-mono-micro text-mono-micro text-on-surface-variant">{fila.detalle}</span>
    </li>
  );
}

export default function Confianza({ alVolver = null }) {
  return (
    <div className={alVolver ? 'min-h-dvh bg-surface-container-lowest text-on-surface font-body-lg' : 'w-full text-on-surface'}>
      <main className={`max-w-3xl mx-auto flex flex-col gap-space-lg ${alVolver ? 'px-4 sm:px-6 py-6 sm:py-10' : 'px-space-lg py-space-lg'}`}>
        <header className="flex flex-col gap-space-xs">
          {alVolver && (
            <button
              type="button"
              onClick={alVolver}
              className="self-start flex items-center gap-space-2xs min-h-10 px-space-sm rounded-lg text-primary hover:bg-surface-container font-mono-label text-mono-label focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              Volver
            </button>
          )}
          <h1 className="m-0 font-headline-lg text-headline-lg text-on-surface">Un entorno cerrado para los chicos y un motor con fuerza medida</h1>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Dos cosas que ChessIA puede mostrar con evidencia: cómo cuida a los alumnos y qué tan fuerte es Turing, el modelo propio que juega contra ellos.
            Todo lo que figura acá lo hace el sistema de verdad.
          </p>
          <nav aria-label="Secciones" className="flex flex-wrap gap-space-xs">
            <a href="#entorno-cerrado" onClick={(e) => { e.preventDefault(); document.getElementById('entorno-cerrado')?.scrollIntoView({ behavior: 'smooth' }); }} className="px-space-sm py-space-2xs min-h-10 flex items-center rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm no-underline">Entorno cerrado</a>
            <a href="#turing-medido" onClick={(e) => { e.preventDefault(); document.getElementById('turing-medido')?.scrollIntoView({ behavior: 'smooth' }); }} className="px-space-sm py-space-2xs min-h-10 flex items-center rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm no-underline">Turing, medido</a>
          </nav>
        </header>

        <Seccion id="entorno-cerrado" titulo="El entorno cerrado: qué protege a los alumnos">
          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
            {PROTECCIONES.map((p) => (
              <li key={p.titulo} className="flex items-start gap-space-xs p-space-sm rounded-xl bg-surface-container min-w-0">
                <span className="material-symbols-outlined text-[22px] text-primary shrink-0" aria-hidden="true">{p.icono}</span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h3 className="m-0 font-body-sm text-body-sm font-medium text-on-surface">{p.titulo}</h3>
                  <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed break-words">{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant">
            El detalle de qué datos se guardan y quién los ve está en los{' '}
            <a href="#politica" className="text-primary underline">términos y la política de privacidad</a>.
          </p>
        </Seccion>

        <Seccion id="turing-medido" titulo="Turing, medido">
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Turing es un modelo propio: una red neuronal entrenada con partidas de maestros que <strong className="text-on-surface">decide la jugada por sí sola</strong>, sin consultar a
            Stockfish. Stockfish se usa solo como regla para medirlo. No prometemos igualar a Stockfish: prometemos un número real y una curva de mejora que se pueda comprobar.
          </p>

          <h3 className="m-0 mt-space-xs font-body-sm text-body-sm font-medium text-on-surface">Cuánto se parece a un maestro, versión a versión</h3>
          <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Acierto de cada versión de Turing en 2.619 jugadas de maestros que no vio al entrenar</caption>
              <thead>
                <tr className="bg-surface-container">
                  <th scope="col" className="px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Versión</th>
                  <th scope="col" className="px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant">Entrenada con</th>
                  <th scope="col" className="px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant text-right">Elige la jugada del maestro</th>
                  <th scope="col" className="px-space-sm py-space-xs font-mono-micro text-mono-micro uppercase tracking-wider text-on-surface-variant text-right">Errores graves</th>
                </tr>
              </thead>
              <tbody>
                {EVOLUCION.map((fila) => (
                  <tr key={fila.version} className="border-t border-outline-variant/20">
                    <th scope="row" className="px-space-sm py-space-xs font-mono-metric text-mono-metric text-on-surface">{fila.version}</th>
                    <td className="px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface-variant">{fila.datos}</td>
                    <td className="px-space-sm py-space-xs font-mono-metric text-mono-metric text-primary text-right whitespace-nowrap">{fila.acierto}</td>
                    <td className="px-space-sm py-space-xs font-mono-metric text-mono-metric text-on-surface text-right whitespace-nowrap">{fila.graves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            En 40 partidas directas la v6 le ganó a la v5: 23 ganadas, 15 empatadas y 2 perdidas (76,2 %). La v6 se midió además con una validación honesta, por partida entera (47,64 % de acierto,
            75,58 % entre sus 3 mejores opciones).
          </p>

          <h3 className="m-0 mt-space-xs font-body-sm text-body-sm font-medium text-on-surface">Qué tan fuerte juega (Elo relativo a Stockfish)</h3>
          <ul className="m-0 p-0 list-none flex flex-col gap-space-sm">
            {ELO.map((fila) => (
              <BarraElo key={fila.etiqueta} fila={fila} />
            ))}
          </ul>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            La búsqueda suma unos 450 Elo: contra la red sola ganó 34, empató 6 y no perdió ninguna de 40 partidas (92,5 %). Escala de 1.000 a 2.000.
          </p>

          <h3 className="m-0 mt-space-xs font-body-sm text-body-sm font-medium text-on-surface">Lo que probamos y descartamos</h3>
          <p className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Una mejora solo entra si el puntaje sube de forma clara (que el intervalo no incluya el empate). Dos ideas no pasaron esa regla:
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-space-xs">
            {DESCARTADO.map((d) => (
              <li key={d.titulo} className="p-space-sm rounded-xl bg-surface-container flex flex-col gap-0.5">
                <span className="font-body-sm text-body-sm font-medium text-on-surface">{d.titulo}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{d.texto}</span>
              </li>
            ))}
          </ul>

          <h3 className="m-0 mt-space-xs font-body-sm text-body-sm font-medium text-on-surface">Límites que declaramos</h3>
          <ul className="m-0 pl-space-md list-disc flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
            {LIMITES.map((limite) => (
              <li key={limite} className="break-words">{limite}</li>
            ))}
          </ul>

          <h3 className="m-0 mt-space-xs font-body-sm text-body-sm font-medium text-on-surface">Cómo reproducirlo</h3>
          <pre className="m-0 p-space-sm rounded-xl bg-surface-container-lowest border border-outline-variant/30 overflow-x-auto font-mono-micro text-mono-micro text-on-surface-variant">
{`python -m training.medir_elo --checkpoint <modelo.pt> --elos 1320 1500 1700 --aperturas 20 --tiempo 0.2
python -m training.enfrentar_modelos --a <anterior.pt> --b <nueva.pt>`}
          </pre>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            Mediciones del 13 al 16 de octubre de 2026; ficha actualizada al {ACTUALIZADO}. Fuente: <code>docs/turing_hoja_de_ruta.md</code>.
          </p>
        </Seccion>
      </main>
    </div>
  );
}
