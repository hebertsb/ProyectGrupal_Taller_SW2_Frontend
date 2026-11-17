import assert from 'node:assert/strict';
import test from 'node:test';
import { FILTROS_VACIOS, errorDeFiltros, filtrosParaEnviar, textoDeCambio, textoDeElo, textoDeFiltros, textoDePersona } from './elo.js';

test('el Elo provisional lleva un signo de pregunta y sin Elo no se muestra nada (CU29)', () => {
  assert.equal(textoDeElo({ elo: 1020, elo_provisional: false }), '1020');
  assert.equal(textoDeElo({ elo: 1000, elo_provisional: true }), '1000?');
  assert.equal(textoDeElo(1250), '1250');
  assert.equal(textoDeElo({}), '');
  assert.equal(textoDeElo(null), '');
});

test('la persona se describe con lo que se sepa de su nivel y su Elo', () => {
  assert.equal(textoDePersona({ nivel: 10, rango: 'Intermedio', elo: 1020 }), 'Nivel 10 · Intermedio · Elo 1020');
  assert.equal(textoDePersona({ nivel: 3 }), 'Nivel 3');
  assert.equal(textoDePersona({ elo: 1000, elo_provisional: true }), 'Nivel sin medir · Elo 1000?');
  assert.equal(textoDePersona(null), '');
});

test('el cambio de Elo usa el signo más y el signo menos de verdad', () => {
  assert.equal(textoDeCambio(18), '+18');
  assert.equal(textoDeCambio(-12), '−12');
  assert.equal(textoDeCambio(0), '0');
});

test('con «nivel parecido» no se envía ningún filtro', () => {
  assert.deepEqual(filtrosParaEnviar(FILTROS_VACIOS), {});
});

test('con rango solo se envían los límites elegidos, como números', () => {
  const filtros = { modo: 'rango', eloMin: '1000', eloMax: '', nivelMin: '', nivelMax: '12' };
  assert.deepEqual(filtrosParaEnviar(filtros), { elo_min: 1000, nivel_max: 12 });
});

test('el rango se rechaza si no se eligió ningún límite o si el mínimo supera al máximo', () => {
  assert.match(errorDeFiltros({ ...FILTROS_VACIOS, modo: 'rango' }), /al menos un límite/);
  assert.match(errorDeFiltros({ modo: 'rango', eloMin: '1500', eloMax: '1000', nivelMin: '', nivelMax: '' }), /Elo/);
  assert.match(errorDeFiltros({ modo: 'rango', eloMin: '', eloMax: '', nivelMin: '12', nivelMax: '10' }), /nivel/);
  assert.equal(errorDeFiltros({ modo: 'rango', eloMin: '1000', eloMax: '1500', nivelMin: '', nivelMax: '' }), null);
  assert.equal(errorDeFiltros(FILTROS_VACIOS), null);
});

test('el texto de los filtros dice qué se está buscando', () => {
  assert.equal(textoDeFiltros({ elo_min: 1000, elo_max: 1500, nivel_min: 10, nivel_max: 12 }), 'Elo 1000 a 1500 · nivel 10 a 12');
  assert.equal(textoDeFiltros({ elo_min: 1500 }), 'Elo desde 1500');
  assert.equal(textoDeFiltros({ nivel_max: 12 }), 'nivel hasta 12');
  assert.equal(textoDeFiltros(null), '');
});
