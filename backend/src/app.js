const http = require('node:http');
const { openDatabase, transaction } = require('./database/connection');
const { createRepository } = require('./repositories/workshop.repository');
const { createRegistrationsService } = require('./services/registrations.service');
const { createQuotesService } = require('./services/quotes.service');
const { createOrdersService } = require('./services/orders.service');
const { createCommunicationsService } = require('./services/communications.service');
const { createRouter } = require('./routes/api.routes');
const { json, sendError } = require('./http/response');
const { readJson } = require('./http/request');
const { serveStatic } = require('./http/static');
const { fail } = require('./shared/errors');
function createApp(config, logger = console) {
  const db = openDatabase(config.databasePath);
  const repository = createRepository(db);
  const atomic = (callback) => transaction(db, callback);
  const dispatch = createRouter(repository, {
    registrations: createRegistrationsService(repository),
    quotes: createQuotesService(repository, atomic),
    orders: createOrdersService(repository, atomic),
    communications: createCommunicationsService(repository),
  });
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (origin && origin !== 'http://' + req.headers.host) fail('Origem não permitida.', 403);
        if (url.pathname === '/api/health' && req.method === 'GET')
          return json(res, 200, { status: 'ok' });
        const body = ['POST', 'PATCH'].includes(req.method)
          ? await readJson(req, config.bodyLimit)
          : {};
        const result = dispatch(req.method, url.pathname.slice(5).split('/').filter(Boolean), body);
        return json(res, req.method === 'POST' ? 201 : 200, result);
      }
      await serveStatic(req, res, url.pathname, config.frontendRoot);
    } catch (error) {
      sendError(res, error, logger);
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on('close', () => db.close());
  return { server, db };
}
module.exports = { createApp };
