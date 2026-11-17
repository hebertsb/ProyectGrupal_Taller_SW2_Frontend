import assert from 'node:assert/strict';
import test from 'node:test';
import { demostracionInicialCompletada, puedeProbarPartida, videoDelCapitulo } from './caminoReglas.js';

test('un tema ya completado se practica directo; el paso en curso o bloqueado exige la demostración', () => {
  assert.equal(demostracionInicialCompletada({ estado: 'completado' }), true);
  assert.equal(demostracionInicialCompletada({ estado: 'actual' }), false);
  assert.equal(demostracionInicialCompletada({ estado: 'bloqueado' }), false);
  assert.equal(demostracionInicialCompletada(undefined), false);
});

test('candado pedagógico: «Probar una partida» solo se habilita al terminar la demostración', () => {
  assert.equal(puedeProbarPartida(false), false);
  assert.equal(puedeProbarPartida(undefined), false);
  assert.equal(puedeProbarPartida(true), true);
});

test('el video del tema que subió el docente gana sobre el de la pieza asociada', () => {
  const videos = { enroque: '/v/enroque.mp4', rey: '/v/rey.mp4' };
  const r = videoDelCapitulo(videos, { id: 'enroque', tipoPiezaVideo: 'rey' });
  assert.deepEqual(r, { url: '/v/enroque.mp4', esEspecificoDelModulo: true });
});

test('sin video del tema se usa el de la pieza y sin ninguno no hay video', () => {
  const videos = { rey: '/v/rey.mp4' };
  assert.deepEqual(videoDelCapitulo(videos, { id: 'enroque', tipoPiezaVideo: 'rey' }), { url: '/v/rey.mp4', esEspecificoDelModulo: false });
  assert.deepEqual(videoDelCapitulo(videos, { id: 'captura', tipoPiezaVideo: 'dama' }), { url: null, esEspecificoDelModulo: false });
  assert.deepEqual(videoDelCapitulo(videos, { id: 'jaque', tipoPiezaVideo: null }), { url: null, esEspecificoDelModulo: false });
  assert.deepEqual(videoDelCapitulo(undefined, { id: 'enroque', tipoPiezaVideo: 'rey' }), { url: null, esEspecificoDelModulo: false });
});
