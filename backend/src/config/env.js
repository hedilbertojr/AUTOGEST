const path = require('node:path');
const fs = require('node:fs');
const { fail } = require('../shared/errors');
const backendRoot = path.resolve(__dirname, '../..');
function loadConfig(env = process.env, loadFile = true) {
  if (loadFile && env === process.env) {
    try {
      process.loadEnvFile(path.join(backendRoot, '.env'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT deve estar entre 1 e 65535.');
  // Preserve databases from installations created before the folder reorganization.
  const legacyDatabase = path.join(backendRoot, 'autogest.db');
  const defaultDatabase = fs.existsSync(legacyDatabase) ? legacyDatabase : 'data/autogest.db';
  return Object.freeze({
    port,
    host: env.HOST || '127.0.0.1',
    databasePath:
      env.DB_PATH === ':memory:'
        ? ':memory:'
        : path.resolve(backendRoot, env.DB_PATH || defaultDatabase),
    frontendRoot: path.resolve(backendRoot, '../frontend'),
    bodyLimit: 1024 * 1024,
  });
}
module.exports = { loadConfig };
