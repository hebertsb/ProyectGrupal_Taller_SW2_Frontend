import assert from 'node:assert/strict';
import test from 'node:test';
import { BANDAS_POR_DEFECTO, describirCambioNivel, precisionAPorcentaje, rangoDeNivel } from './nivelJugador.js';

test('cada nivel cae en su rango y los límites de las bandas son exactos (CU08, CU12)', () => {
  assert.equal(rangoDeNivel(0), 'Principiante');
  assert.equal(rangoDeNivel(6), 'Principiante');
  assert.equal(rangoDeNivel(7), 'Intermedio');
  assert.equal(rangoDeNivel(13), 'Intermedio');
  assert.equal(rangoDeNivel(14), 'Avanzado');
  assert.equal(rangoDeNivel(20), 'Avanzado');
});

test('un nivel fuera de la escala o que no es número no tiene rango', () => {
  assert.equal(rangoDeNivel(21), null);
  assert.equal(rangoDeNivel(-1), null);
  assert.equal(rangoDeNivel('10'), null);
  assert.equal(rangoDeNivel(undefined), null);
});

test('se pueden usar las bandas que mande el servidor en vez de las de por defecto', () => {
  const bandas = { Bajo: [0, 9], Alto: [10, 20] };
  assert.equal(rangoDeNivel(9, bandas), 'Bajo');
  assert.equal(rangoDeNivel(10, bandas), 'Alto');
  assert.deepEqual(Object.keys(BANDAS_POR_DEFECTO), ['Principiante', 'Intermedio', 'Avanzado']);
});

test('la precisión se muestra como porcentaje redondeado entre 0 y 100, venga como porcentaje o como fracción', () => {
  assert.equal(precisionAPorcentaje(86.4), 86);
  assert.equal(precisionAPorcentaje(0.835), 84);
  assert.equal(precisionAPorcentaje(150), 100);
  assert.equal(precisionAPorcentaje(-5), 0);
  assert.equal(precisionAPorcentaje(NaN), null);
  assert.equal(precisionAPorcentaje('90'), null);
});

test('el cambio de nivel dice si se subió o se bajó y cuántos niveles', () => {
  const sube = describirCambioNivel({ cambio_de_nivel: 2 });
  assert.deepEqual(sube, { sube: true, principal: 'Subiste 2 niveles', detalle: '+2 niveles' });
  const baja = describirCambioNivel({ nivel: 9, nivel_anterior: 10 });
  assert.deepEqual(baja, { sube: false, principal: 'Bajaste 1 nivel', detalle: '-1 nivel' });
});

test('si el cambio cruza de rango se nombra el rango anterior y el nuevo', () => {
  const r = describirCambioNivel({ cambio_de_nivel: 1, cambio_de_rango: true, rango_anterior: 'Principiante', rango: 'Intermedio' });
  assert.equal(r.principal, 'Subiste de Principiante a Intermedio');
});

test('sin cambio, o en el diagnóstico inicial, no hay mensaje de cambio de nivel', () => {
  assert.equal(describirCambioNivel(null), null);
  assert.equal(describirCambioNivel({ cambio_de_nivel: 0 }), null);
  assert.equal(describirCambioNivel({ nivel: 8, nivel_anterior: 8 }), null);
  assert.equal(describirCambioNivel({ es_diagnostico: true, cambio_de_nivel: 4 }), null);
});
