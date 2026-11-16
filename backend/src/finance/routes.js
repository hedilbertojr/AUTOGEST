const { fail } = require('../shared/errors');
function financeRoute(service, method, parts, body = {}, params = {}, actor = null) {
  const route = parts.join('/'),
    id = parts[2];
  if (route === 'bi' && method === 'GET') return service.report(params);
  if (route === 'financeiro/titulos' && method === 'POST') return service.create(body, actor);
  if (parts[0] === 'financeiro') {
    if (parts[1] === 'titulos' && parts.length === 3 && method === 'PATCH')
      return service.update(id, body, actor);
    if (parts[1] === 'titulos' && parts.length === 4 && method === 'POST') {
      if (parts[3] === 'baixas') return service.settle(id, body, actor);
      if (parts[3] === 'cancelar') return service.cancel(id, actor);
    }
    if (
      parts[1] === 'movimentos' &&
      parts[3] === 'estornar' &&
      parts.length === 4 &&
      method === 'POST'
    )
      return service.reverse(id, body, actor);
    if (parts[1] === 'ordens') {
      if (parts.length === 3 && method === 'GET') return service.orderDetail(id);
      if (parts[3] === 'conta' && method === 'POST') return service.orderAccount(id, actor);
      if (parts[3] === 'regularizar' && method === 'POST')
        return service.regularize(id, body, actor);
    }
    if (parts[1] === 'servicos' && parts[3] === 'custo' && method === 'PATCH')
      return service.setServiceCost(id, body, actor);
  }
  fail('Rota financeira não encontrada.', 404);
}
module.exports = { financeRoute };
