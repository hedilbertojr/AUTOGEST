const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');
const { loadConfig } = require('../backend/src/config/env');
async function main() {
  const config = loadConfig();
  if (config.databasePath === ':memory:' || !fs.existsSync(config.databasePath)) {
    throw new Error('Banco não encontrado. Inicie a aplicação antes de gerar o backup.');
  }
  const directory = path.resolve(__dirname, '../backend/backups');
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destination = path.join(directory, `autogest-${timestamp}.db`);
  const db = new DatabaseSync(config.databasePath, { readOnly: true });
  try {
    await backup(db, destination);
    console.log(`Backup criado: ${destination}`);
  } finally {
    db.close();
  }
}
main().catch((error) => {
  console.error('Falha no backup:', error.message);
  process.exitCode = 1;
});
