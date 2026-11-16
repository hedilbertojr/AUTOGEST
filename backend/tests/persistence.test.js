const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase } = require('../src/database/connection');

test('atualiza banco legado, preserva cadastros e reaplica inicialização sem duplicar seed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'autogest-migration-'));
  const filename = path.join(directory, 'legacy.db');
  let db;
  try {
    db = new DatabaseSync(filename);
    db.exec(
      fs.readFileSync(path.join(__dirname, '../src/database/migrations/001-initial.sql'), 'utf8'),
    );
    db.prepare('INSERT INTO clientes(nome, telefone, email) VALUES(?,?,?)').run(
      'Cliente preservado',
      '11999998888',
      '',
    );
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT nome FROM clientes').get().nome, 'Cliente preservado');
    db.prepare('UPDATE servicos SET preco=12345 WHERE id=1').run();
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n, 5);
    assert.equal(db.prepare('SELECT count(*) n FROM servicos').get().n, 21);
    assert.equal(db.prepare('SELECT preco FROM servicos WHERE id=1').get().preco, 12345);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (db && db.isOpen) db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
