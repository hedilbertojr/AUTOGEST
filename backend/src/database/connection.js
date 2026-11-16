const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { seedServices } = require('./seeds/services');
function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    const directory = path.join(__dirname, 'migrations');
    for (const name of fs
      .readdirSync(directory)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      if (db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) continue;
      transaction(db, () => {
        db.exec(fs.readFileSync(path.join(directory, name), 'utf8'));
        db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
      });
    }
    transaction(db, () => seedServices(db));
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
function transaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
module.exports = { openDatabase, transaction };
