import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { claveApariencia, leerApariencia, normalizarModo, temaEfectivo } from './apariencia.js';

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
  for (const [tema, oscuro, esperado] of [['noche', false, 'noche'], ['dia', true, 'dia'], ['automatico', true, 'noche']]) {
    const documento = { documentElement: { dataset: {}, style: {} } };
    const contexto = {
      localStorage: { getItem: () => null },
      sessionStorage: { getItem: (clave) => clave === 'usuario' ? JSON.stringify({ id: 9, tema }) : null },
      window: { matchMedia: () => ({ matches: oscuro }) }, document: documento,
    };
    vm.runInNewContext(codigo, contexto);
    assert.equal(documento.documentElement.dataset.tema, esperado);
  }
});

function luminancia(hex) {
  const canales = hex.match(/[a-f\d]{2}/gi).map((c) => parseInt(c, 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722;
}

test('textos, botones y estados mantienen un contraste mínimo de 4,5 en día y noche', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
  const bloques = [css.match(/@theme\s*\{([\s\S]*?)\n\}/)[1], css.match(/:root\[data-tema="noche"\]\s*\{([\s\S]*?)\n\}/)[1]];
  const pares = [
    ['on-background', 'background'], ['on-primary', 'primary'], ['on-primary', 'primary-fixed'],
    ['on-primary-container', 'primary-container'], ['on-secondary', 'secondary'],
    ['on-secondary-container', 'secondary-container'], ['on-tertiary', 'tertiary'], ['on-tertiary-container', 'tertiary-container'],
    ['on-error', 'error'], ['on-error-container', 'error-container'], ['on-exito', 'exito'], ['on-aviso', 'aviso'],
    ...['surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest'].flatMap((fondo) => ['on-surface', 'on-surface-variant', 'outline', 'primary', 'secondary', 'tertiary', 'exito', 'aviso', 'neon-cyan', 'neon-blue', 'neon-purple', 'neon-orange', 'neon-lime'].map((texto) => [texto, fondo])),
  ];
  bloques.forEach((bloque, indice) => {
    const colores = Object.fromEntries([...bloque.matchAll(/--color-([a-z-]+):\s*(#[a-f\d]{6});/gi)].map((m) => [m[1], m[2]]));
    for (const [texto, fondo] of pares) {
      const a = luminancia(colores[texto]), b = luminancia(colores[fondo]);
      const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(contraste >= 4.5, `${indice === 0 ? 'Día' : 'Noche'}: ${texto}/${fondo} tiene contraste ${contraste.toFixed(2)}`);
    }
  });
});
