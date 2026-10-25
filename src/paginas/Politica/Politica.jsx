/**
 * Términos de uso y política de privacidad. Se abre en `/#politica` (sin iniciar sesión), así se puede enlazar desde el
 * registro, desde Mi Perfil y desde la app móvil.
 *
 * Lo que dice el texto tiene que ser lo que el sistema hace de verdad: si cambia qué datos se guardan o a quién se mandan,
 * se actualiza acá y se sube `VERSION`.
 */

const VERSION = '1 (piloto)';
const FECHA = '25 de octubre de 2026';
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
      'Tu cuenta: correo, nombre y contraseña (la contraseña se guarda cifrada, nadie puede leerla). Si entrás con Google, guardamos el identificador de tu cuenta de Google y su foto de perfil.',
      'Tu perfil, si lo completás: edad, descripción y foto.',
      'Tu juego: las partidas con todas sus jugadas, tu nivel estimado y su historial, y tus medallas.',
      'Tus conversaciones con Turing, el tutor.',
      'Tu lugar en la enseñanza: el curso en el que estás y la institución de tu docente.',
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
      'Tu docente: el progreso y las partidas de los alumnos de sus cursos.',
      'El administrador de tu institución: la lista de alumnos de sus docentes, con su curso y su nivel.',
      'Los administradores de la plataforma, para mantener el sistema, dar soporte y atender pedidos de baja.',
      'Otros jugadores: solo ven tu nombre abreviado (por ejemplo, «Ana P.») y tu nivel en el ranking de tu curso.',
    ],
  },
  {
    id: 'terceros',
    titulo: '5. Servicios de terceros',
    items: [
      'Google, si elegís entrar con tu cuenta de Google. Aplican sus propias políticas.',
      'Tu proveedor de correo, solo si el servidor tiene activada la verificación: se usa para mandarte el código de 6 dígitos al correo con el que te registraste.',
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
      'Si tenés menos de 18 años, para usar ChessIA necesitás la autorización de tu madre, padre o tutor, o entrar a través de un colegio o academia que cuente con esa autorización. Quien registra una cuenta de un menor se hace responsable de tenerla.',
      'Hoy el sistema no verifica la edad automáticamente, y no pedimos más datos de los necesarios. Tu madre, padre o tutor puede pedir ver, corregir o eliminar los datos de su hijo o hija, a través de la institución o de la plataforma.',
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
      'Las contraseñas se guardan cifradas, la conexión va cifrada (HTTPS), se limitan los intentos fallidos de ingreso y cada perfil (jugador, docente, administrador de institución, plataforma) solo accede a lo que le corresponde. Ningún sistema es perfecto: si encontrás un problema de seguridad, avisanos.',
    ],
  },
  {
    id: 'reglas',
    titulo: '10. Reglas de uso',
    items: [
      'Tratá con respeto a los demás y no compartas tu cuenta.',
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
