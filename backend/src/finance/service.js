const { fail } = require('../shared/errors');
const { integer, str, money } = require('../shared/validation');
const { businessDate, dateOnly } = require('./dates');
const { report, signed } = require('./analytics');
const directions = {
  outra_receita: 'receber',
  despesa_operacional: 'pagar',
  compra_estoque: 'pagar',
  retirada: 'pagar',
  aporte: 'receber',
};
const methods = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'transferencia',
  'outro',
];
function createFinanceService(repo) {
  function find(table, id) {
    const row = repo.find(table, integer(id, 'ID', 1));
    if (!row) fail('Registro não encontrado.', 404);
    return row;
  }
  function remaining(title, snapshot = repo.snapshot()) {
    return (
      title.valor -
      snapshot.financeiro_movimentos
        .filter((m) => m.titulo_id === title.id)
        .reduce((s, m) => s + signed(m), 0)
    );
  }
  const positive = (value) => {
    const n = money(value);
    if (n <= 0) fail('Informe um valor maior que zero.');
    return n;
  };
  function automatic(order, actor = null) {
    const data = repo.snapshot();
    const existing = data.financeiro_titulos.find((t) => t.ordem_id === order.id);
    if (existing) return existing;
    const quote = find('orcamentos', order.orcamento_id);
    if (quote.total <= 0) fail('Esta OS não possui valor a receber.');
    return repo.insert('financeiro_titulos', {
      tipo: 'receber',
      natureza: 'venda_os',
      descricao: `OS #${order.id}`,
      categoria: 'Serviços e materiais',
      valor: quote.total,
      competencia: businessDate(order.finalizada_em || order.criado_em),
      vencimento: businessDate(),
      ordem_id: order.id,
      cancelado: 0,
      criado_por: actor,
    });
  }
  return {
    report: (params) => report(repo.snapshot(), params),
    create(body, actor) {
      const type = directions[body.natureza];
      if (!type) fail('Natureza financeira inválida.');
      const title = {
        tipo: type,
        natureza: body.natureza,
        descricao: str(body.descricao, 'Descrição', 180),
        categoria: str(body.categoria, 'Categoria', 80),
        valor: positive(body.valor),
        competencia: dateOnly(body.competencia, 'Competência'),
        vencimento: dateOnly(body.vencimento, 'Vencimento'),
        ordem_id: null,
        cancelado: 0,
        criado_por: actor || null,
      };
      return repo.atomic(() => {
        const created = repo.insert('financeiro_titulos', title);
        repo.audit(actor, 'financeiro_titulo_criado', created.id);
        return created;
      });
    },
    update(id, body, actor) {
      return repo.atomic(() => {
        const title = find('financeiro_titulos', id);
        if (title.cancelado) fail('O lançamento está cancelado.', 409);
        const change = {};
        if (body.vencimento !== undefined)
          change.vencimento = dateOnly(body.vencimento, 'Vencimento');
        if (body.descricao !== undefined) change.descricao = str(body.descricao, 'Descrição', 180);
        if (body.categoria !== undefined) change.categoria = str(body.categoria, 'Categoria', 80);
        if (body.valor !== undefined) {
          if (title.ordem_id) fail('O valor da OS é definido pelo orçamento.', 409);
          change.valor = positive(body.valor);
          if (change.valor < title.valor - remaining(title))
            fail('O novo valor é menor que o valor já liquidado.', 409);
        }
        if (!Object.keys(change).length) fail('Nenhuma alteração informada.');
        const result = repo.update('financeiro_titulos', title.id, change);
        repo.audit(actor, 'financeiro_titulo_editado', title.id);
        return result;
      });
    },
    cancel(id, actor) {
      return repo.atomic(() => {
        const title = find('financeiro_titulos', id);
        if (title.ordem_id) fail('Uma venda de OS não pode ser apagada pelo financeiro.', 409);
        if (title.cancelado) fail('O lançamento já está cancelado.', 409);
        if (remaining(title) !== title.valor)
          fail('Estorne as baixas antes de cancelar o lançamento.', 409);
        repo.update('financeiro_titulos', title.id, { cancelado: 1 });
        repo.audit(actor, 'financeiro_titulo_cancelado', title.id);
        return { ok: true };
      });
    },
    settle(id, body, actor) {
      return repo.atomic(() => {
        const title = find('financeiro_titulos', id);
        if (title.cancelado) fail('Lançamento cancelado.', 409);
        const value = positive(body.valor),
          date = dateOnly(body.data, 'Data da baixa');
        if (date > businessDate()) fail('Uma baixa realizada não pode ter data futura.');
        if (value > remaining(title)) fail('O valor excede o saldo em aberto.', 409);
        if (!methods.includes(body.meio)) fail('Forma de pagamento inválida.');
        const created = repo.insert('financeiro_movimentos', {
          titulo_id: title.id,
          tipo: 'baixa',
          valor: value,
          data: date,
          meio: body.meio,
          estorno_de: null,
          observacao:
            typeof body.observacao === 'string' ? body.observacao.trim().slice(0, 500) : '',
          criado_por: actor || null,
        });
        repo.audit(actor, 'financeiro_baixa_registrada', created.id);
        return created;
      });
    },
    reverse(id, body, actor) {
      return repo.atomic(() => {
        const movement = find('financeiro_movimentos', id);
        if (movement.tipo !== 'baixa') fail('Somente uma baixa pode ser estornada.', 409);
        if (repo.snapshot().financeiro_movimentos.some((m) => m.estorno_de === movement.id))
          fail('Esta baixa já foi estornada.', 409);
        const date = dateOnly(body.data, 'Data do estorno');
        if (date < movement.data || date > businessDate())
          fail('A data deve estar entre a baixa original e hoje.');
        const reason = str(body.observacao, 'Motivo do estorno', 500);
        if (reason.length < 5) fail('Descreva o motivo do estorno.');
        const created = repo.insert('financeiro_movimentos', {
          titulo_id: movement.titulo_id,
          tipo: 'estorno',
          valor: movement.valor,
          data: date,
          meio: movement.meio,
          estorno_de: movement.id,
          observacao: reason,
          criado_por: actor || null,
        });
        repo.audit(actor, 'financeiro_estorno_registrado', created.id);
        return created;
      });
    },
    orderAccount(id, actor) {
      return repo.atomic(() => {
        const order = find('ordens', id);
        const title = automatic(order, actor);
        repo.audit(actor, 'financeiro_conta_os', order.id);
        return title;
      });
    },
    orderDetail(id) {
      const order = find('ordens', id);
      return {
        ...order,
        itens: repo.snapshot().itens.filter((i) => i.orcamento_id === order.orcamento_id),
      };
    },
    regularize(id, body, actor) {
      return repo.atomic(() => {
        const order = find('ordens', id);
        const updates = {};
        if (!order.finalizada_em && ['finalizada', 'entregue'].includes(order.status)) {
          const date = dateOnly(body.data_conclusao, 'Conclusão');
          if (date > businessDate()) fail('A conclusão não pode estar no futuro.');
          updates.finalizada_em = date;
          const mechanicId = body.mecanico_id ? integer(body.mecanico_id, 'Mecânico', 1) : null;
          if (mechanicId && find('usuarios', mechanicId).papel !== 'operador')
            fail('Selecione um mecânico.');
          updates.mecanico_conclusao_id = mechanicId;
        }
        if (body.custos !== undefined) {
          if (!Array.isArray(body.custos)) fail('Custos inválidos.');
          const seen = new Set();
          for (const item of body.custos) {
            if (!item || typeof item !== 'object') fail('Custo inválido.');
            const record = find('itens', item.item_id);
            if (record.orcamento_id !== order.orcamento_id || seen.has(record.id))
              fail('Item não pertence à OS ou está duplicado.');
            seen.add(record.id);
            if (record.custo_unitario != null) fail('O custo histórico já foi registrado.', 409);
            repo.update('itens', record.id, { custo_unitario: money(item.custo) });
          }
        }
        if (Object.keys(updates).length) repo.update('ordens', order.id, updates);
        const updated = find('ordens', order.id);
        if (updated.finalizada_em && find('orcamentos', updated.orcamento_id).total > 0) {
          const title = automatic(updated, actor);
          repo.update('financeiro_titulos', title.id, {
            competencia: businessDate(updated.finalizada_em),
          });
        }
        repo.audit(actor, 'financeiro_os_regularizada', order.id);
        return { ok: true };
      });
    },
    setServiceCost(id, body, actor) {
      return repo.atomic(() => {
        const service = find('servicos', id);
        const cost = body.custo === null ? null : money(body.custo);
        repo.update('servicos', service.id, { custo: cost });
        repo.audit(actor, 'financeiro_custo_servico', service.id);
        return { ok: true };
      });
    },
  };
}
module.exports = { createFinanceService };
