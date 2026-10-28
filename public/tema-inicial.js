// Se ejecuta antes de cargar la interfaz para respetar el tema guardado desde el primer dibujo.
(() => {
  let modo = 'dia';
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario') || sessionStorage.getItem('usuario') || 'null');
    const guardado = usuario?.tema || localStorage.getItem(`chessia_apariencia_${usuario?.id ?? 'visitante'}`);
    if (['dia', 'noche', 'automatico'].includes(guardado)) modo = guardado;
  } catch { /* Sin almacenamiento, el modo inicial es día. */ }
  const oscuro = modo === 'noche' || (modo === 'automatico' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = oscuro ? 'noche' : 'dia';
  document.documentElement.dataset.modoApariencia = modo;
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
})();
