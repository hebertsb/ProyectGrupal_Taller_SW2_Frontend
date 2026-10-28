import { useEffect, useState } from 'react';
import { observarApariencia } from './apariencia';

/** Permite que etiquetas y materiales calculados en JavaScript sigan la apariencia global. */
export default function useTemaActual() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema || 'dia');
  useEffect(() => observarApariencia(() => setTema(document.documentElement.dataset.tema || 'dia')), []);
  return tema;
}
