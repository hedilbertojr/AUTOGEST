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
const { createAuth } = require('./security/auth');
function createApp(config, logger = console) {
  const db = openDatabase(config.databasePath);
  const auth = createAuth(db, config);
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
        const expectedOrigin = config.appOrigin || 'http://' + req.headers.host;
        if (config.appOrigin && req.headers.host !== new URL(config.appOrigin).host)
          fail('Host não permitido.', 403);
        const origin = req.headers.origin;
        if ((origin && origin !== expectedOrigin) || req.headers['sec-fetch-site'] === 'cross-site')
          fail('Origem não permitida.', 403);
        if (url.pathname === '/api/health' && req.method === 'GET')
          return json(res, 200, { status: 'ok' });
        const body = ['POST', 'PATCH'].includes(req.method)
          ? await readJson(req, config.bodyLimit)
          : {};
        const parts = url.pathname.slice(5).split('/').filter(Boolean);
        const route = parts.join('/');
        if (route === 'auth/status' && req.method === 'GET')
          return json(res, 200, {
            inicializado: Boolean(db.prepare('SELECT id FROM usuarios LIMIT 1').get()),
          });
        if (route === 'auth/login' && req.method === 'POST')
          return json(res, 200, await auth.login(req, res, body));
        const session = auth.requireSession(req);
        if (!['GET', 'HEAD'].includes(req.method)) auth.checkCsrf(req, session);
        if (route === 'auth/session' && req.method === 'GET')
          return json(res, 200, { usuario: session.user, csrf: session.csrf });
        if (route === 'auth/logout' && req.method === 'POST')
          return json(res, 200, auth.logout(req, res, session));
        if (route === 'auth/password' && req.method === 'POST')
          return json(res, 200, await auth.changePassword(req, res, session, body));
        if (parts[0] === 'usuarios') {
          auth.requireAdmin(session);
          auth.ready(session);
          if (parts.length === 1 && req.method === 'GET') return json(res, 200, auth.listUsers());
          if (parts.length === 1 && req.method === 'POST')
            return json(res, 201, await auth.createUser(session, body));
          if (parts.length === 2 && req.method === 'PATCH')
            return json(res, 200, auth.updateUser(session, parts[1], body));
          if (parts.length === 3 && parts[2] === 'senha' && req.method === 'POST')
            return json(res, 200, await auth.resetPassword(session, parts[1], body));
          fail('Rota não encontrada.', 404);
        }
        if (route === 'auditoria' && req.method === 'GET') {
          auth.requireAdmin(session);
          auth.ready(session);
          return json(res, 200, auth.audit());
        }
        if (
          parts[0] === 'ordens' &&
          parts[1] &&
          parts[2] === 'responsavel' &&
          parts.length === 3 &&
          req.method === 'PATCH'
        )
          return json(res, 200, auth.assign(session, parts[1], body));
        auth.authorize(session, req.method, parts, body);
        let result;
        if (session.user.papel === 'operador' && req.method === 'GET')
          result = auth.operatorOrders(session.user, parts[1]);
        else result = dispatch(req.method, parts, body);
        if (session.user.papel === 'operador' && req.method === 'PATCH')
          result = auth.operatorOrders(session.user, parts[1]);
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
  return { server, db, auth };
}
module.exports = { createApp };
