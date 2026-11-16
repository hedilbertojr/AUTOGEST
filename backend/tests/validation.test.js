const { test } = require('node:test');
const assert = require('node:assert/strict');
const { integer, money } = require('../src/shared/validation');
const { loadConfig } = require('../src/config/env');
const { openDatabase } = require('../src/database/connection');

test('validação numérica rejeita coerções indevidas', () => {
  for (const invalid of [null, undefined, true, false, [], {}, '', ' ', NaN, Infinity]) {
    assert.throws(() => integer(invalid, 'Quantidade'));
    assert.throws(() => money(invalid));
  }
  assert.equal(integer('2', 'Quantidade'), 2);
  assert.equal(money('35.29'), 3529);
  assert.throws(() => integer(1.5, 'Quantidade'));
  assert.throws(() => money(-1));
});

test('configuração valida porta e suporta banco em memória', () => {
  assert.equal(loadConfig({ DB_PATH: ':memory:' }, false).databasePath, ':memory:');
  for (const port of ['-1', '0', '65536', 'abc'])
    assert.throws(() => loadConfig({ PORT: port }, false));
});

test('migrações e catálogo são aplicados em bancos isolados', () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n, 3);
    assert.equal(db.prepare('SELECT count(*) n FROM servicos').get().n, 21);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  } finally {
    db.close();
  }
});
