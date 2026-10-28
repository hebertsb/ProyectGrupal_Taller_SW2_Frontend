import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { aplicarApariencia, claveApariencia, clavePaleta, guardarAparienciaLocal, leerApariencia, leerPaleta, normalizarModo, normalizarPaleta, PALETAS_APARIENCIA, temaEfectivo } from './apariencia.js';

test('automático sigue el sistema y las elecciones explícitas lo respetan', () => {
  assert.equal(temaEfectivo('automatico', true), 'noche');
  assert.equal(temaEfectivo('automatico', false), 'dia');
  assert.equal(temaEfectivo('dia', true), 'dia');
  assert.equal(temaEfectivo('noche', false), 'noche');
  assert.equal(normalizarModo('desconocido'), 'dia');
});

test('la preferencia de una cuenta no se mezcla con la de otra en un equipo compartido', () => {
  const anterior = globalThis.localStorage;
  globalThis.localStorage = { getItem: (clave) => clave === claveApariencia(7) ? 'noche' : null };
  try {
    assert.equal(leerApariencia({ id: 7 }), 'noche');
    assert.equal(leerApariencia({ id: 8 }), 'dia');
    assert.equal(leerApariencia({ id: 7, tema: 'automatico' }), 'automatico');
    assert.equal(leerApariencia(null), 'dia');
    globalThis.localStorage.getItem = () => { throw Error('Sin permiso'); };
    assert.equal(leerApariencia({ id: 7 }), 'dia');
  } finally {
    globalThis.localStorage = anterior;
  }
});

test('el primer dibujo usa la cuenta y el modo automático incluso con sesión sin recordar', () => {
  const codigo = readFileSync(new URL('../public/tema-inicial.js', import.meta.url), 'utf8');
  for (const { id: paleta } of PALETAS_APARIENCIA) for (const [tema, oscuro, esperado] of [['noche', false, 'noche'], ['dia', true, 'dia'], ['automatico', true, 'noche']]) {
    const documento = { documentElement: { dataset: {}, style: {} } };
    const contexto = {
      localStorage: { getItem: () => null },
      sessionStorage: { getItem: (clave) => clave === 'usuario' ? JSON.stringify({ id: 9, tema, paleta }) : null },
      window: { matchMedia: () => ({ matches: oscuro }) }, document: documento,
    };
    vm.runInNewContext(codigo, contexto);
    assert.equal(documento.documentElement.dataset.tema, esperado);
    assert.equal(documento.documentElement.dataset.paleta, paleta);
  }
});

test('modo y paleta se guardan por separado, sin compartir colores entre cuentas o visitante', () => {
  const anterior = globalThis.localStorage;
  const almacen = new Map();
  globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k,v) => almacen.set(k,v) };
  try {
    guardarAparienciaLocal(7, 'noche', 'uva');
    guardarAparienciaLocal(8, 'dia', 'bosque');
    assert.equal(almacen.get(claveApariencia(7)), 'noche');
    assert.equal(almacen.get(clavePaleta(7)), 'uva');
    assert.equal(leerPaleta({id:7}), 'uva');
    assert.equal(leerPaleta({id:7,paleta:'oceano'}), 'oceano');
    assert.equal(leerPaleta({id:8}), 'bosque');
    assert.equal(leerPaleta({id:9}), 'clasico');
    assert.equal(leerPaleta(null), 'clasico');
    assert.equal(normalizarPaleta('color-inexistente'), 'clasico');
    globalThis.localStorage.getItem = () => { throw Error('Sin permiso'); };
    assert.equal(leerPaleta({id:7}), 'clasico');
  } finally { globalThis.localStorage = anterior; }
});

test('el cambio de modo conserva la paleta elegida y actualiza los atributos globales', () => {
  const anterior = globalThis.document;
  globalThis.document = {documentElement:{dataset:{},style:{}}};
  try {
    aplicarApariencia('automatico',false,'bosque');
    assert.equal(document.documentElement.dataset.tema,'dia');
    aplicarApariencia('automatico',true,'bosque');
    assert.equal(document.documentElement.dataset.tema,'noche');
    assert.equal(document.documentElement.dataset.paleta,'bosque');
    assert.equal(document.documentElement.style.colorScheme,'dark');
  } finally { globalThis.document = anterior; }
});

function luminancia(hex) {
  const canales = hex.match(/[a-f\d]{2}/gi).map((c) => parseInt(c, 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722;
}

test('textos, botones y estados mantienen un contraste mínimo de 4,5 en las cinco paletas de día y noche', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
  const paletas = readFileSync(new URL('./paletas.css', import.meta.url), 'utf8');
  const bloques = [css.match(/@theme\s*\{([\s\S]*?)\n\}/)[1], css.match(/:root\[data-tema="noche"\]\s*\{([\s\S]*?)\n\}/)[1]];
  const pares = [
    ['on-background', 'background'], ['on-primary', 'primary'], ['on-primary', 'primary-fixed'],
    ['on-primary-container', 'primary-container'], ['on-secondary', 'secondary'],
    ['on-secondary-container', 'secondary-container'], ['on-tertiary', 'tertiary'], ['on-tertiary-container', 'tertiary-container'],
    ['on-error', 'error'], ['on-error-container', 'error-container'], ['on-exito', 'exito'], ['on-aviso', 'aviso'],
    ['on-primary-fixed', 'primary-fixed'], ['on-primary-fixed-variant', 'primary-fixed-dim'],
    ['on-secondary-fixed', 'secondary-fixed'], ['on-secondary-fixed-variant', 'secondary-fixed'],
    ...['surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface-dim', 'surface-variant', 'surface-bright'].flatMap((fondo) => ['on-surface', 'on-surface-variant', 'outline', 'primary', 'secondary', 'tertiary', 'exito', 'aviso', 'neon-cyan', 'neon-blue', 'neon-purple', 'neon-orange', 'neon-lime'].map((texto) => [texto, fondo])),
  ];
  const extraer = (bloque) => Object.fromEntries([...bloque.matchAll(/--color-([a-z-]+):\s*(#[a-f\d]{6});/gi)].map((m) => [m[1], m[2]]));
  for (const {id} of PALETAS_APARIENCIA) bloques.forEach((bloque, indice) => {
    const modo = indice === 0 ? 'dia' : 'noche';
    const variantes = [...paletas.matchAll(/:root\[data-paleta="([a-z]+)"\]\[data-tema="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g)];
    const variante = variantes.find(m => m[1] === id && m[2] === modo);
    if (id !== 'clasico') assert.ok(variante, `${id}/${modo} debe tener colores definidos`);
    const colores = {...extraer(bloques[0]),...extraer(bloque),...extraer(variante?.[3] || '')};
    for (const [texto, fondo] of pares) {
      const a = luminancia(colores[texto]), b = luminancia(colores[fondo]);
      const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(contraste >= 4.5, `${id}/${modo}: ${texto}/${fondo} tiene contraste ${contraste.toFixed(2)}`);
    }
  });
});
