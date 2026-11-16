const { fail } = require('../shared/errors');
const { str, integer } = require('../shared/validation');
function createQuotesService(repository, transaction) {
  const { get, insert } = repository;
  return {
    create(b) {
      return transaction(() => {
        const c = get('clientes', b.cliente_id),
          v = get('veiculos', b.veiculo_id);
        if (v.cliente_id !== c.id) fail('O veículo não pertence ao cliente.');
        if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 100)
          fail('Adicione de 1 a 100 itens.');
        const itens = b.itens.map((i) => {
          if (!i || typeof i !== 'object' || !['servico', 'peca'].includes(i.tipo))
            fail('Tipo de item inválido.');
          const r = get(i.tipo === 'peca' ? 'estoque' : 'servicos', i.referencia_id);
          return {
            tipo: i.tipo,
            referencia_id: r.id,
            nome: r.nome,
            quantidade: integer(i.quantidade, 'Quantidade', 1),
            preco: i.tipo === 'peca' ? r.venda : r.preco,
          };
        });
        const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
        if (!Number.isSafeInteger(total) || total > 1e12) fail('Total excede o limite permitido.');
        const o = insert('orcamentos', {
          cliente_id: c.id,
          veiculo_id: v.id,
          diagnostico: str(b.diagnostico, 'Diagnóstico', 3000),
          total,
        });
        for (const i of itens) insert('itens', { orcamento_id: o.id, ...i });
        return { ...o, itens };
      });
    },
    approve(id) {
      const quote = get('orcamentos', id);
      if (quote.status !== 'pendente')
        fail('Somente orçamentos pendentes podem ser aprovados.', 409);
      return repository.approveQuote(quote.id);
    },
    generateOrder(id) {
      return transaction(() => {
        const o = get('orcamentos', id);
        if (repository.orderForQuote(o.id)) fail('Este orçamento já possui uma OS.', 409);
        if (o.status !== 'aprovado') fail('Aprove o orçamento antes de gerar a OS.', 409);
        const pecas = repository.requiredParts(o.id);
        for (const p of pecas) {
          const r = get('estoque', p.referencia_id);
          if (r.quantidade < p.quantidade) fail(`Estoque insuficiente: ${r.nome}.`, 409);
        }
        for (const p of pecas) repository.decreaseStock(p.referencia_id, p.quantidade);
        return insert('ordens', { orcamento_id: o.id });
      });
    },
  };
}
module.exports = { createQuotesService };
