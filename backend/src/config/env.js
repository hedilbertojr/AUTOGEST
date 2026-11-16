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
  const secureCookies = env.NODE_ENV === 'production' || env.SESSION_SECURE === 'true';
  const appOrigin = env.APP_ORIGIN || null;
  if (appOrigin) {
    let parsed;
    try {
      parsed = new URL(appOrigin);
    } catch {
      fail('APP_ORIGIN inválida.');
    }
    if (parsed.origin !== appOrigin || !['http:', 'https:'].includes(parsed.protocol))
      fail('APP_ORIGIN deve conter somente protocolo e domínio, sem barra final.');
    if (secureCookies && parsed.protocol !== 'https:') fail('Use HTTPS com cookies seguros.');
  }
  if (env.NODE_ENV === 'production' && !appOrigin)
    fail('Configure APP_ORIGIN com o endereço HTTPS em produção.');
  return Object.freeze({
    port,
    host: env.HOST || '127.0.0.1',
    databasePath:
      env.DB_PATH === ':memory:'
        ? ':memory:'
        : path.resolve(backendRoot, env.DB_PATH || defaultDatabase),
    frontendRoot: path.resolve(backendRoot, '../frontend'),
    bodyLimit: 1024 * 1024,
    secureCookies,
    appOrigin,
  });
}
module.exports = { loadConfig };
