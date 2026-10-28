import { useEffect, useState } from 'react';
import { observarApariencia } from './apariencia';

/** Permite que etiquetas y materiales calculados en JavaScript sigan la apariencia global. */
export default function useTemaActual() {
  const actual = () => `${document.documentElement.dataset.tema || 'dia'}:${document.documentElement.dataset.paleta || 'clasico'}`;
  const [tema, setTema] = useState(actual);
  useEffect(() => observarApariencia(() => setTema(actual())), []);
  return tema;
}
