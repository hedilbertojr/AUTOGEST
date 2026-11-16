const { fail } = require('../shared/errors');
function createRouter(repository, services) {
  return function dispatch(method, parts, body) {
    const [resource, id, action] = parts;
    if (!repository.tables.includes(resource) || parts.length > 3)
      fail('Rota não encontrada.', 404);
    if (method === 'GET' && !id) return repository.list(resource);
    if (method === 'GET' && id && !action) {
      const record = repository.get(resource, id);
      if (resource === 'orcamentos') record.itens = repository.items(record.id);
      return record;
    }
    if (method === 'POST' && !id) {
      if (resource === 'orcamentos') return services.quotes.create(body);
      return services.registrations.create(resource, body);
    }
    if (method === 'PATCH' && id && !action) {
      if (resource === 'estoque') return services.registrations.setStock(id, body);
      if (resource === 'ordens') return services.orders.updateStatus(id, body);
    }
    if (method === 'POST' && id) {
      if (resource === 'orcamentos' && action === 'aprovar') return services.quotes.approve(id);
      if (resource === 'orcamentos' && action === 'gerar-os')
        return services.quotes.generateOrder(id);
      if (resource === 'ordens' && action === 'nota') return services.orders.createNote(id);
      if (['ordens', 'orcamentos'].includes(resource) && action === 'whatsapp')
        return services.communications.prepareWhatsApp(resource, id);
    }
    fail('Rota não encontrada.', 404);
  };
}
module.exports = { createRouter };
