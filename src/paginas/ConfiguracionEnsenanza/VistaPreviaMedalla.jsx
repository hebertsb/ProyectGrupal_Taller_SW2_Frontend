import MedallaFigurita from '../../componentes/MedallaFigurita';
import { etiquetaNivel, etiquetaPieza } from '../../medallas';
import { limpiarTexto, reglaEnPalabras, tipoDeRegla } from './medallasPropias';

/**
 * Vista previa en vivo: la figurita tal como la verá el jugador (nivel, pieza y, si hay, la ilustración elegida) y debajo
 * su nombre, su descripción, cómo se gana y quién la ve. Se actualiza en cada tecla porque todo sale del formulario.
 *
 * `imagenUrl` es la URL local del archivo elegido (o la de la imagen ya guardada, al editar): va en `imagen_url` de la
 * medalla que recibe `MedallaFigurita`, con `vistaPrevia` para que se dibuje como ganada. Mientras no haya nombre o
 * descripción se muestran textos de ejemplo en gris.
 *
 * El tamaño sigue el ancho del contenedor (`@container` en CrearMedallas.jsx): `lg` centrada cuando hay dos columnas,
 * `md` al lado del texto cuando la vista previa va arriba del formulario (celular o ancho justo).
 */
export default function VistaPreviaMedalla({ formulario, opciones, imagenUrl, textoAlcance }) {
  const nombre = limpiarTexto(formulario.nombre);
  const descripcion = limpiarTexto(formulario.descripcion);
  const medalla = {
    codigo: 'vista-previa',
    nombre: nombre || 'Nombre de la medalla',
    nivel: formulario.nivel,
    pieza: formulario.pieza,
    meta: 1,
    imagen_url: imagenUrl,
  };

  const tipo = tipoDeRegla(opciones.reglas, formulario.regla);
  const reglaTexto = reglaEnPalabras(opciones.reglas, formulario.regla, formulario.meta);
  let lineaSeGana = null;
  if (tipo === 'manual') lineaSeGana = 'La entrego yo';
  else if (reglaTexto) lineaSeGana = `Se gana: ${reglaTexto}`;

  const etiquetaFigurita = imagenUrl
    ? etiquetaNivel(formulario.nivel)
    : `${etiquetaNivel(formulario.nivel)} · ${etiquetaPieza(formulario.pieza)}`;

  return (
    <section
      aria-labelledby="titulo-vista-previa-medalla"
      className="flex flex-col gap-space-sm p-space-sm @4xl:p-space-md rounded-xl bg-surface-container border border-outline-variant/30 min-w-0"
    >
      <div className="flex items-center gap-space-xs">
        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
          visibility
        </span>
        <h3
          id="titulo-vista-previa-medalla"
          className="m-0 font-mono-label text-mono-label uppercase tracking-wider text-on-surface-variant"
        >
          Así la ve el jugador
        </h3>
      </div>

      <div className="flex items-center gap-space-md @4xl:flex-col @4xl:text-center">
        <div className="shrink-0 @4xl:hidden">
          <MedallaFigurita medalla={medalla} tamano="md" vistaPrevia />
        </div>
        <div className="hidden shrink-0 @4xl:flex @4xl:justify-center">
          <MedallaFigurita medalla={medalla} tamano="lg" vistaPrevia />
        </div>

        <div className="flex flex-col gap-space-2xs min-w-0 flex-1 @4xl:w-full">
          <span className="font-mono-micro text-mono-micro uppercase tracking-wide text-on-surface-variant">
            {etiquetaFigurita}
          </span>
          <h4
            className={`m-0 font-headline-sm text-headline-sm break-words ${nombre ? 'text-on-surface' : 'text-outline'}`}
          >
            {nombre || 'Nombre de la medalla'}
          </h4>
          <p
            className={`m-0 font-body-sm text-body-sm break-words ${descripcion ? 'text-on-surface-variant' : 'text-outline'}`}
          >
            {descripcion || 'Cómo se gana'}
          </p>
        </div>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-space-2xs @4xl:items-center">
        {lineaSeGana && (
          <li className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
              {tipo === 'manual' ? 'back_hand' : 'flag'}
            </span>
            <span className="min-w-0 break-words">{lineaSeGana}</span>
          </li>
        )}
        <li className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5" aria-hidden="true">
            groups
          </span>
          <span className="min-w-0 break-words">{textoAlcance}</span>
        </li>
      </ul>
    </section>
  );
}
