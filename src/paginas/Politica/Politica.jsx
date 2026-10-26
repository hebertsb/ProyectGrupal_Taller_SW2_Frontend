/**
 * Términos de uso y política de privacidad. Se abre en `/#politica` (sin iniciar sesión), así se puede enlazar desde el
 * registro, desde Mi Perfil y desde la app móvil.
 *
 * Lo que dice el texto tiene que ser lo que el sistema hace de verdad: si cambia qué datos se guardan o a quién se mandan,
 * se actualiza acá y se sube `VERSION`.
 */

const VERSION = '2 (piloto)';
const FECHA = '26 de octubre de 2026';
// Correo de contacto para pedidos de datos o de baja. Vacío = el texto manda a pedirlo al docente o a la plataforma.
const CORREO_CONTACTO = '';

const SECCIONES = [
  {
    id: 'quienes',
    titulo: '1. Quiénes somos',
    parrafos: [
      'ChessIA (Sistema Tutor Inteligente de Ajedrez) es un proyecto académico de la Universidad Autónoma Gabriel René Moreno (UAGRM), Santa Cruz de la Sierra, Bolivia, desarrollado por Hebert Suárez Burgos y Luis Ángel Arze Kao. Hoy funciona como piloto: se usa para enseñar y aprender ajedrez con un tutor de inteligencia artificial y un brazo robótico.',
      'Al crear una cuenta o usar el sistema aceptás estos términos. Si no estás de acuerdo, no lo uses.',
    ],
  },
  {
    id: 'datos',
    titulo: '2. Qué datos guardamos',
    items: [
      'Tu cuenta: correo o usuario asignado por el docente, nombre y una huella de tu contraseña. Si entrás con Google, guardamos el identificador de tu cuenta de Google y su foto de perfil.',
      'Tu perfil: edad declarada, descripción y foto. Si se cargan, el nombre, el teléfono y el correo de tu madre, padre o tutor, y la fecha de la declaración de autorización familiar.',
      'Tu aula: avisos del docente, tareas y su avance, inscripciones a torneos, sus partidas y resultados. También tus amistades, bloqueos y las denuncias que hagas o recibas.',
      'Tu juego: las partidas con todas sus jugadas, tu nivel estimado y su historial, y tus medallas.',
      'Tus conversaciones con Turing, el tutor.',
      'Tu lugar en la enseñanza: el curso en el que estás y la institución de tu docente. Para las instituciones, además, su suscripción y los pagos que avisan (monto, fecha y el dato que escriban para identificarlos).',
      'Un registro de las acciones de los administradores (por ejemplo, quién eliminó una cuenta). Solo guarda números de cuenta, no tu correo ni tu nombre, y se conserva un año.',
      'Imágenes del tablero, cuando se juega con el tablero físico y la cámara. La cámara apunta al tablero y sirve para reconocer las piezas; la plataforma puede guardar algunas imágenes para mejorar ese reconocimiento.',
    ],
    parrafos: [
      'Para frenar los intentos de adivinar contraseñas, el servidor recuerda unos minutos la dirección de red desde la que se hicieron intentos fallidos. No se guarda en la base de datos.',
    ],
  },
  {
    id: 'uso',
    titulo: '3. Para qué los usamos',
    parrafos: [
      'Para que puedas jugar, medir tu nivel, recibir explicaciones adaptadas a vos, y para que tu docente vea tu progreso. No vendemos tus datos, no mostramos publicidad y no armamos perfiles con fines comerciales.',
    ],
  },
  {
    id: 'quien-ve',
    titulo: '4. Quién puede ver tus datos',
    items: [
      'Vos, siempre, en tu perfil y en tus partidas.',
      'Tu docente: el progreso, las partidas, las tareas y el contacto de la familia de los alumnos de sus cursos. El docente responsable puede revisar denuncias relacionadas con sus alumnos.',
      'El administrador de tu institución: la lista de alumnos de sus docentes, con su curso y su nivel.',
      'Los administradores de la plataforma, para mantener el sistema, dar soporte y atender pedidos de baja.',
      'Otros jugadores: ven tu nombre abreviado (por ejemplo, «Ana P.»), nivel, disponibilidad para jugar y resultados del torneo que comparten. No ven los contactos de tu familia ni tu edad.',
    ],
  },
  {
    id: 'terceros',
    titulo: '5. Servicios de terceros',
    items: [
      'Google, si elegís entrar con tu cuenta de Google. Aplican sus propias políticas.',
      'El servicio de correo configurado en el servidor: envía códigos de verificación y recuperación de contraseña a las cuentas personales.',
      'WhatsApp o la aplicación de correo que abra tu docente cuando decide contactar a tu familia o compartir el resumen de progreso. Se abre un borrador; el docente revisa el destinatario y decide si enviarlo.',
      'Groq, el servicio que genera las respuestas de Turing. Tu mensaje y, si preguntás por tu última partida, un resumen de ella se envían a ese servicio para armar la respuesta. No escribas en el chat datos personales como tu dirección o tu teléfono.',
    ],
    parrafos: [
      'El sistema corre en un servidor del propio equipo del proyecto. No compartimos tus datos con nadie más.',
    ],
  },
  {
    id: 'menores',
    titulo: '6. Menores de edad',
    parrafos: [
      'La web pide la edad declarada al registrar jugadores. Si sos menor de 18 años o todavía no cargaste tu edad, podés practicar de forma individual. Para jugar con otras personas hace falta la declaración de autorización familiar, con nombre y teléfono del responsable, o que el docente declare que su curso ya tiene los permisos de las familias. Estas declaraciones se guardan con su fecha; no comprobamos documentos de identidad ni verificamos que quien completa el formulario sea el tutor.',
      'En colegios, academias y asociaciones, el docente puede crear cuentas de alumnos sin correo personal y declarar los permisos de su curso. La institución puede exigir un correo de su dominio cuya propiedad se comprueba con Google o un código. Tener ese correo no sustituye la autorización de las familias.',
      'El contacto familiar es opcional cuando el curso ya tiene autorización. Se usa para acompañar el aprendizaje y comunicarse ante una dificultad. Podés corregir o borrar esos datos y retirar la declaración familiar desde tu perfil. Tu familia también puede pedir ayuda, corrección o baja a la institución o a la plataforma.',
    ],
  },
  {
    id: 'derechos',
    titulo: '7. Tus derechos',
    items: [
      'Ver y corregir tu nombre, edad, descripción y foto, en Mi Perfil.',
      'Darte de baja: en Mi Perfil, «Eliminar mi cuenta» borra tu cuenta y todo lo que figura en el punto 2.',
      'Pedir una copia de tus datos o ayuda con cualquiera de estos puntos, a tu docente, a tu institución o a la plataforma.',
    ],
  },
  {
    id: 'conservacion',
    titulo: '8. Cuánto tiempo los guardamos',
    parrafos: [
      'Mientras tengas la cuenta. Cuando la eliminás, se borra de la base de datos al instante. El servidor hace copias de seguridad automáticas y tus datos pueden quedar en esas copias hasta que se renueven.',
    ],
  },
  {
    id: 'seguridad',
    titulo: '9. Seguridad',
    parrafos: [
      'Las contraseñas se guardan cifradas, la conexión va cifrada (HTTPS), se limitan los intentos fallidos de ingreso, los docentes y administradores pueden activar una verificación en dos pasos con una app de códigos, y cada perfil (jugador, docente, administrador de institución, plataforma) solo accede a lo que le corresponde. Ningún sistema es perfecto: si encontrás un problema de seguridad, avisanos.',
    ],
  },
  {
    id: 'reglas',
    titulo: '10. Reglas de uso',
    items: [
      'Tratá con respeto a los demás y no compartas tu cuenta.',
      'Podés bloquear a otro jugador o denunciar un problema desde Jugar con otros o desde la partida. Los bloqueos no se notifican a la otra persona; las denuncias quedan disponibles para revisión del docente responsable o de la plataforma.',
      'No intentes dañar el sistema ni acceder a datos que no son tuyos.',
      'Turing explica ajedrez y puede equivocarse: es una ayuda para aprender, no un consejo profesional.',
      'Si jugás con el brazo robótico, seguí las indicaciones de tu docente y no toques el brazo ni el tablero mientras se mueve.',
      'Podemos suspender las cuentas que incumplan estas reglas.',
    ],
  },
  {
    id: 'cambios',
    titulo: '11. Cambios y contacto',
    parrafos: [
      'Si cambiamos estos términos, subimos la versión y la fecha de arriba, y avisamos dentro de la aplicación si el cambio es importante.',
      CORREO_CONTACTO
        ? `Para consultas o pedidos sobre tus datos, escribinos a ${CORREO_CONTACTO}.`
        : 'Para consultas o pedidos sobre tus datos, hablá con tu docente o con el administrador de tu institución, que los hace llegar a la plataforma.',
    ],
  },
];

export default function Politica({ alVolver }) {
  return (
    <div className="min-h-dvh bg-surface-container-lowest text-on-surface font-body-lg">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-space-lg">
        <header className="flex flex-col gap-space-xs">
          <button
            type="button"
            onClick={alVolver}
            className="self-start flex items-center gap-space-2xs min-h-10 px-space-sm rounded-lg text-primary hover:bg-surface-container font-mono-label text-mono-label focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            Volver
          </button>
          <h1 className="m-0 font-headline-md text-headline-md text-on-surface">Términos de uso y política de privacidad</h1>
          <p className="m-0 font-mono-micro text-mono-micro text-on-surface-variant">
            ChessIA · Versión {VERSION} · {FECHA}
          </p>
        </header>

        {SECCIONES.map((seccion) => (
          <section
            key={seccion.id}
            aria-labelledby={`pol-${seccion.id}`}
            className="flex flex-col gap-space-xs bg-surface-container-low p-space-md sm:p-space-lg rounded-xl shadow-md"
          >
            <h2 id={`pol-${seccion.id}`} className="m-0 font-headline-sm text-headline-sm text-on-surface">
              {seccion.titulo}
            </h2>
            {seccion.items && (
              <ul className="m-0 pl-space-md list-disc flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
                {seccion.items.map((item) => (
                  <li key={item} className="break-words">{item}</li>
                ))}
              </ul>
            )}
            {seccion.parrafos?.map((texto) => (
              <p key={texto} className="m-0 font-body-sm text-body-sm text-on-surface-variant leading-relaxed break-words">
                {texto}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
