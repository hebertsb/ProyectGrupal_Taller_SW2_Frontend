import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASILLA_INICIAL_TORRE,
  DESTINOS_TORRE,
  claveCompletado,
  daJaque,
  esDestinoTorre,
  marcarOnboardingCompletado,
  mismaCasilla,
  onboardingCompletado,
  porcentajeAvance,
} from './onboardingReglas.js';

/** Almacenamiento en memoria para probar sin navegador. */
function conAlmacenamiento(valor, prueba) {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: valor, configurable: true, writable: true });
  try {
    prueba();
  } finally {
    if (anterior) Object.defineProperty(globalThis, 'localStorage', anterior);
    else delete globalThis.localStorage;
  }
}

const memoria = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)) };
};

test('la marca de «ya visto» es por usuario y sin usuario usa la clave anónima', () => {
  assert.equal(claveCompletado(7), 'onboarding_completado_7');
  assert.equal(claveCompletado(null), 'onboarding_completado_anon');
  assert.equal(claveCompletado(undefined), 'onboarding_completado_anon');
});

test('el onboarding aparece hasta que el usuario lo ve o lo salta, y solo para ese usuario', () => {
  conAlmacenamiento(memoria(), () => {
    assert.equal(onboardingCompletado(1), false);
    marcarOnboardingCompletado(1);
    assert.equal(onboardingCompletado(1), true);
    assert.equal(onboardingCompletado(2), false);
  });
});

test('si el navegador no deja leer ni guardar, no falla: el tutorial simplemente puede volver a aparecer', () => {
  const roto = {
    getItem: () => { throw new Error('modo privado'); },
    setItem: () => { throw new Error('cuota llena'); },
  };
  conAlmacenamiento(roto, () => {
    assert.equal(onboardingCompletado(1), false);
    assert.doesNotThrow(() => marcarOnboardingCompletado(1));
  });
});

test('la torre de a1 llega a 14 casillas: su fila y su columna, sin quedarse en a1', () => {
  assert.equal(DESTINOS_TORRE.length, 14);
  assert.ok(DESTINOS_TORRE.every(([f, c]) => f === 7 || c === 0));
  assert.equal(esDestinoTorre(CASILLA_INICIAL_TORRE), false);
  assert.equal(esDestinoTorre([7, 5]), true);
  assert.equal(esDestinoTorre([3, 0]), true);
  assert.equal(esDestinoTorre([3, 3]), false);
});

test('de las 14 jugadas de la torre solo dos dan jaque: a8 (fila del rey) y e1 (columna del rey)', () => {
  const conJaque = DESTINOS_TORRE.filter(daJaque);
  assert.equal(conJaque.length, 2);
  assert.ok(conJaque.some((d) => mismaCasilla(d, [0, 0])));
  assert.ok(conJaque.some((d) => mismaCasilla(d, [7, 4])));
  assert.equal(daJaque([7, 1]), false);
  assert.equal(daJaque([3, 0]), false);
});

test('la barra de progreso sube por tarjeta y llega al 100 % en la última', () => {
  assert.equal(porcentajeAvance(0, 4), 25);
  assert.equal(porcentajeAvance(1, 4), 50);
  assert.equal(porcentajeAvance(3, 4), 100);
});
