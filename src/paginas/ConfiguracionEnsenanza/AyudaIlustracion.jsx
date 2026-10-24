import { useEffect, useRef, useState } from 'react';
import { AvisoError, BOTON_SECUNDARIO, CLASE_ETIQUETA, CLASE_INPUT } from './ComunesMedallas';
import { armarPrompt } from './medallasPropias';

const CAJA = 'flex flex-col gap-space-xs p-space-sm rounded-xl bg-surface-container border border-outline-variant/30 min-w-0';

/**
 * Copia el texto al portapapeles. Usa `navigator.clipboard` y, en páginas que no son seguras (HTTP en la red local, donde
 * ese objeto no existe), cae en el viejo `execCommand('copy')`. Lanza un error si no logra copiar.
 */
async function copiarAlPortapapeles(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    if (!document.execCommand('copy')) throw new Error('El navegador no dejó copiar.');
  } finally {
    document.body.removeChild(area);
  }
}

/**
 * Ayuda del campo "Ilustración": las especificaciones para hacerla y un prompt para generarla con una IA de imágenes. El
 * campo "¿Qué querés dibujar?" reemplaza al instante el sujeto del prompt; "Copiar prompt" lo manda al portapapeles y
 * avisa "Copiado" (o, si el navegador no deja, cómo copiarlo a mano).
 */
export default function AyudaIlustracion() {
  const [sujeto, setSujeto] = useState('');
  const [estadoCopia, setEstadoCopia] = useState(null); // 'ok' | 'error' | null
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const prompt = armarPrompt(sujeto);

  async function copiar() {
    clearTimeout(temporizador.current);
    try {
      await copiarAlPortapapeles(prompt);
      setEstadoCopia('ok');
      temporizador.current = setTimeout(() => setEstadoCopia(null), 3000);
    } catch {
      setEstadoCopia('error');
    }
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <div className={CAJA}>
        <h4 className={`m-0 ${CLASE_ETIQUETA}`}>Cómo hacer la ilustración</h4>
        <ul className="m-0 pl-space-md list-disc space-y-1 font-body-sm text-body-sm text-on-surface-variant">
          <li>PNG con fondo transparente, de 512×512 px (cuadrada).</li>
          <li>
            Un solo dibujo, centrado dentro de un círculo imaginario que ocupe el 85 % del cuadrado: las esquinas quedan
            vacías.
          </li>
          <li>Sin marco, sin escudo y sin texto: el escudo lo pone el sistema.</li>
          <li>
            Estilo realista (render 3D o foto de un objeto), con buena luz y contraste: el escudo de fondo es oscuro y de color. Un
            solo objeto y sin detalles diminutos, para que se lea incluso a 28 px.
          </li>
          <li>
            Pesa hasta 2 MB: una imagen realista de 2048 px suele pasarse, así que achicala a 512 o 1024 px. También sirven JPG y
            WEBP, pero con PNG o WEBP el fondo transparente deja ver el escudo.
          </li>
          <li>
            Si tu IA no da fondo transparente, pedile fondo verde sólido y quitalo con remove.bg o Photopea (varita mágica).
          </li>
        </ul>
      </div>

      <div className={CAJA}>
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
            auto_awesome
          </span>
          <h4 className={`m-0 ${CLASE_ETIQUETA}`}>Prompt para una IA de imágenes</h4>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="medalla-sujeto" className={CLASE_ETIQUETA}>
            ¿Qué querés dibujar?
          </label>
          <input
            id="medalla-sujeto"
            value={sujeto}
            onChange={(evento) => setSujeto(evento.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder="Ej.: un caballo con casco de gladiador"
            className={CLASE_INPUT}
          />
        </div>

        <p
          id="medalla-prompt"
          className="m-0 p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/30 font-mono-label text-mono-label text-on-surface break-words select-all"
        >
          {prompt}
        </p>

        <div className="flex flex-wrap items-center gap-space-xs">
          <button type="button" onClick={copiar} className={BOTON_SECUNDARIO}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              content_copy
            </span>
            Copiar prompt
          </button>
          <span role="status" className="flex items-center gap-1 font-body-sm text-body-sm text-primary">
            {estadoCopia === 'ok' && (
              <>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  check_circle
                </span>
                Copiado
              </>
            )}
          </span>
        </div>

        {estadoCopia === 'error' && (
          <AvisoError mensaje="No se pudo copiar solo. Tocá el texto del prompt para seleccionarlo y copialo a mano." />
        )}
      </div>
    </div>
  );
}
