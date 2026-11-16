const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, transaction } = require('../src/database/connection');
const { createFinanceRepository } = require('../src/finance/repository');
const { createFinanceService } = require('../src/finance/service');
const { createRepository } = require('../src/repositories/workshop.repository');
const { createQuotesService } = require('../src/services/quotes.service');
const { createOrdersService } = require('../src/services/orders.service');
const { businessDate, addDays } = require('../src/finance/dates');
function setup() {
  const db = openDatabase(':memory:'),
    atomic = (fn) => transaction(db, fn),
    repo = createRepository(db),
    finance = createFinanceService(createFinanceRepository(db, atomic)),
    quotes = createQuotesService(repo, atomic),
    orders = createOrdersService(repo, atomic);
  repo.insert('clientes', { nome: 'Teste', telefone: '11999998888', email: '' });
  repo.insert('veiculos', {
    cliente_id: 1,
    placa: 'ABC1D23',
    marca: 'Fiat',
    modelo: 'Argo',
    ano: 2022,
  });
  db.prepare('UPDATE servicos SET preco=10000,custo=3000 WHERE id=1').run();
  const stock = repo.insert('estoque', {
    codigo: 'T1',
    nome: 'Peça teste',
    quantidade: 10,
    minimo: 2,
    custo: 2000,
    venda: 4000,
  });
  return { db, repo, finance, quotes, orders, stock };
}
const range = () => ({ inicio: addDays(businessDate(), -30), fim: businessDate() });
test('BI distingue orçamento, receita concluída, custo histórico, estoque e recebimento parcial', () => {
  const { db, repo, finance, quotes, orders, stock } = setup();
  try {
    const q = quotes.create({
      cliente_id: 1,
      veiculo_id: 1,
      diagnostico: 'Revisão',
      itens: [
        { tipo: 'servico', referencia_id: 1, quantidade: 1 },
        { tipo: 'peca', referencia_id: stock.id, quantidade: 2 },
      ],
    });
    quotes.approve(q.id);
    assert.equal(finance.report(range()).kpis.receita, 0);
    const os = quotes.generateOrder(q.id);
    let r = finance.report(range());
    assert.equal(r.kpis.receita, 0);
    assert.equal(r.caixa.a_receber, 18000);
    assert.equal(r.caixa.entradas, 0);
    assert.equal(r.consumos[0].custo, 4000);
    db.prepare('UPDATE estoque SET custo=99999 WHERE id=?').run(stock.id);
    db.prepare('UPDATE servicos SET custo=99999 WHERE id=1').run();
    orders.updateStatus(os.id, { status: 'em_andamento' });
    orders.updateStatus(os.id, { status: 'finalizada' });
    r = finance.report(range());
    assert.equal(r.kpis.receita, 18000);
    assert.equal(r.kpis.custos_diretos, 7000);
    assert.equal(r.kpis.margem_bruta, 11000);
    assert.equal(r.caixa.entradas, 0);
    const t = r.contas.find((t) => t.ordem_id === os.id);
    finance.settle(t.id, { valor: 50, data: businessDate(), meio: 'pix' });
    r = finance.report(range());
    assert.equal(r.caixa.entradas, 5000);
    assert.equal(r.caixa.a_receber, 13000);
    assert.equal(r.kpis.receita, 18000);
    assert.throws(() => finance.settle(t.id, { valor: 131, data: businessDate(), meio: 'pix' }));
    assert.equal(finance.report(range()).caixa.entradas, 5000);
    assert.equal(repo.items(q.id)[0].custo_unitario, 3000);
  } finally {
    db.close();
  }
});
test('despesas, aportes e compra de estoque não duplicam custos de resultado; estorno preserva caixa histórico', () => {
  const { db, finance } = setup();
  try {
    const today = businessDate(),
      yesterday = addDays(today, -1);
    const create = (natureza, valor) =>
      finance.create({
        natureza,
        valor,
        descricao: 'Teste financeiro',
        categoria: 'Teste',
        competencia: yesterday,
        vencimento: today,
      });
    const expense = create('despesa_operacional', 40),
      purchase = create('compra_estoque', 100),
      opening = create('aporte', 300);
    for (const t of [expense, purchase, opening])
      finance.settle(t.id, { valor: t.valor / 100, data: yesterday, meio: 'pix' });
    let r = finance.report(range());
    assert.equal(r.kpis.resultado_estimado, -4000);
    assert.equal(r.caixa.saldo_atual, 16000);
    const payment = r.movimentos.find((m) => m.titulo_id === expense.id);
    finance.reverse(payment.id, { data: today, observacao: 'Pagamento registrado em duplicidade' });
    assert.equal(finance.report({ inicio: yesterday, fim: yesterday }).caixa.saldo_final, 16000);
    r = finance.report(range());
    assert.equal(r.caixa.saldo_atual, 20000);
    assert.equal(r.caixa.a_pagar, 4000);
    assert.equal(r.kpis.resultado_estimado, -4000);
    assert.throws(() => finance.reverse(payment.id, { data: today, observacao: 'Duplicado' }));
    assert.throws(() => finance.cancel(purchase.id));
    assert.throws(() =>
      finance.settle(expense.id, { valor: 1, data: addDays(today, 1), meio: 'pix' }),
    );
    finance.cancel(expense.id);
    assert.equal(finance.report(range()).kpis.resultado_estimado, 0);
  } finally {
    db.close();
  }
});
test('histórico sem conclusão fica sinalizado e pode ser regularizado sem inventar datas ou custos', () => {
  const { db, repo, finance, quotes } = setup();
  try {
    db.prepare('UPDATE servicos SET custo=NULL WHERE id=1').run();
    const q = quotes.create({
      cliente_id: 1,
      veiculo_id: 1,
      diagnostico: 'Antiga',
      itens: [{ tipo: 'servico', referencia_id: 1, quantidade: 1 }],
    });
    quotes.approve(q.id);
    const os = quotes.generateOrder(q.id);
    db.prepare("UPDATE ordens SET status='finalizada' WHERE id=?").run(os.id);
    let r = finance.report(range());
    assert.equal(r.legado.length, 1);
    assert.equal(r.kpis.receita, 0);
    finance.regularize(os.id, {
      data_conclusao: businessDate(),
      custos: [{ item_id: repo.items(q.id)[0].id, custo: 25 }],
    });
    r = finance.report(range());
    assert.equal(r.legado.length, 0);
    assert.equal(r.kpis.receita, 10000);
    assert.equal(r.kpis.custos_diretos, 2500);
    assert.throws(() =>
      finance.regularize(os.id, { custos: [{ item_id: repo.items(q.id)[0].id, custo: 0 }] }),
    );
  } finally {
    db.close();
  }
});
test('datas SQLite UTC respeitam a virada do dia em Brasília e filtros inválidos falham', () => {
  assert.equal(businessDate('2026-11-16 01:00:00'), '2026-11-15');
  const { db, finance } = setup();
  try {
    assert.throws(() => finance.report({ inicio: '2026-02-30', fim: '2026-03-01' }));
    assert.throws(() => finance.report({ inicio: '2026-03-10', fim: '2026-03-01' }));
  } finally {
    db.close();
  }
});

test('filtro de mecânico preserva caixa geral e sinaliza custo desconhecido', () => {
  const { db, finance, quotes, orders } = setup();
  try {
    db.prepare(
      "INSERT INTO usuarios(nome,email,senha_hash,papel) VALUES('Ana','ana@example.com','hash-apenas-fixture','operador')",
    ).run();
    db.prepare('UPDATE servicos SET custo=NULL WHERE id=1').run();
    const q = quotes.create({
      cliente_id: 1,
      veiculo_id: 1,
      diagnostico: 'Teste por equipe',
      itens: [{ tipo: 'servico', referencia_id: 1, quantidade: 1 }],
    });
    quotes.approve(q.id);
    const os = quotes.generateOrder(q.id);
    db.prepare('UPDATE ordens SET operador_id=1 WHERE id=?').run(os.id);
    orders.updateStatus(os.id, { status: 'em_andamento' });
    orders.updateStatus(os.id, { status: 'finalizada' });
    const expense = finance.create({
      natureza: 'despesa_operacional',
      valor: 20,
      descricao: 'Despesa geral',
      categoria: 'Geral',
      competencia: businessDate(),
      vencimento: businessDate(),
    });
    finance.settle(expense.id, { valor: 20, data: businessDate(), meio: 'pix' });
    const r = finance.report({ ...range(), mecanico_id: 1 });
    assert.equal(r.kpis.receita, 10000);
    assert.equal(r.kpis.custos_pendentes, 1);
    assert.equal(r.kpis.resultado_tipo, 'contribuicao');
    assert.equal(r.kpis.resultado_estimado, 10000);
    assert.equal(r.caixa.saidas, 2000);
    assert.ok(r.avisos.length >= 2);
    const other = finance.report({ ...range(), mecanico_id: 2 });
    assert.equal(other.kpis.receita, 0);
    assert.equal(other.caixa.saidas, 2000);
    db.prepare('DELETE FROM financeiro_titulos WHERE ordem_id=?').run(os.id);
    assert.equal(finance.report(range()).ordens_sem_conta.length, 1);
    finance.orderAccount(os.id);
    assert.equal(finance.report(range()).ordens_sem_conta.length, 0);
  } finally {
    db.close();
  }
});
