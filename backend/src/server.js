const { loadConfig } = require('./config/env');
const { createApp } = require('./app');
const config = loadConfig();
const { server } = createApp(config);
server.on('error', (error) => {
  console.error('Falha ao iniciar AutoGest:', error.message);
  process.exitCode = 1;
  server.close();
});
server.listen(config.port, config.host, () =>
  console.log(`AutoGest: http://${config.host}:${config.port}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => server.closeAllConnections(), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
