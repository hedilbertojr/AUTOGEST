const { fail } = require('../shared/errors');
function createOrdersService(repository, transaction) {
  const { get, insert } = repository;
  return {
    updateStatus(id, body) {
      const order = get('ordens', id);
      const next = { aberta: 'em_andamento', em_andamento: 'finalizada', finalizada: 'entregue' };
      if (next[order.status] !== body.status) fail('Transição de status inválida.', 409);
      return transaction(() => repository.setOrderStatus(order.id, body.status));
    },
    createNote(id) {
      return transaction(() => {
        const order = get('ordens', id);
        if (!['finalizada', 'entregue'].includes(order.status))
          fail('Finalize a OS antes de gerar o comprovante.', 409);
        if (repository.noteForOrder(order.id)) fail('A OS já possui comprovante.', 409);
        return insert('notas', {
          ordem_id: order.id,
          total: get('orcamentos', order.orcamento_id).total,
        });
      });
    },
  };
}
module.exports = { createOrdersService };
