const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, transaction } = require('../src/database/connection');
const { seedExamples } = require('../src/database/seeds/examples');
const { createRepository } = require('../src/repositories/workshop.repository');
const { createQuotesService } = require('../src/services/quotes.service');

test('catálogo fictício é idempotente e preserva preços e saldos existentes', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare(
      'INSERT INTO estoque(codigo,nome,quantidade,minimo,custo,venda) VALUES(?,?,?,?,?,?)',
    ).run('FLT-001', 'Meu filtro', 4, 1, 1000, 4000);
    const first = seedExamples(db);
    assert.equal(first.stock, 31);
    assert.equal(first.services, 8);
    const original = db.prepare("SELECT * FROM estoque WHERE codigo='FLT-001'").get();
    assert.equal(original.nome, 'Meu filtro');
    assert.equal(original.quantidade, 4);
    assert.equal(original.venda, 4000);
    const again = seedExamples(db);
    assert.deepEqual(again, { stock: 0, services: 0 });
    assert.equal(db.prepare('SELECT count(*) n FROM estoque').get().n, 32);
    assert.equal(db.prepare('SELECT count(*) n FROM servicos').get().n, 29);
  } finally {
    db.close();
  }
});

test('OS consome peças e suprimentos, inclusive consumo interno sem cobrança', () => {
  const db = openDatabase(':memory:');
  try {
    seedExamples(db);
    const repo = createRepository(db);
    const quotes = createQuotesService(repo, (fn) => transaction(db, fn));
    const customer = repo.insert('clientes', {
      nome: 'Exemplo',
      telefone: '11000000000',
      email: '',
    });
    const vehicle = repo.insert('veiculos', {
      cliente_id: customer.id,
      placa: 'ABC1D23',
      marca: 'Fiat',
      modelo: 'Argo',
      ano: 2022,
    });
    const stock = (code) => db.prepare('SELECT * FROM estoque WHERE codigo=?').get(code);
    const oil = stock('SUP-001'),
      gloves = stock('SUP-013'),
      filter = stock('FLT-001');
    const service = db.prepare("SELECT * FROM servicos WHERE nome='Troca de óleo e filtro'").get();
    const quote = quotes.create({
      cliente_id: customer.id,
      veiculo_id: vehicle.id,
      diagnostico: 'Revisão de exemplo',
      itens: [
        { tipo: 'servico', referencia_id: service.id, quantidade: 1 },
        { tipo: 'peca', referencia_id: filter.id, quantidade: 1 },
        { tipo: 'suprimento', referencia_id: oil.id, quantidade: 4 },
        { tipo: 'suprimento', referencia_id: gloves.id, quantidade: 2 },
      ],
    });
    assert.equal(quote.total, service.preco + filter.venda + 4 * oil.venda);
    assert.equal(
      quote.itens.find((i) => i.referencia_id === gloves.id && i.tipo === 'suprimento').preco,
      0,
    );
    quotes.approve(quote.id);
    quotes.generateOrder(quote.id);
    assert.equal(stock('SUP-001').quantidade, oil.quantidade - 4);
    assert.equal(stock('SUP-013').quantidade, gloves.quantidade - 2);
    assert.equal(stock('FLT-001').quantidade, filter.quantidade - 1);
    assert.throws(() => quotes.generateOrder(quote.id));
    assert.equal(stock('SUP-001').quantidade, oil.quantidade - 4);
  } finally {
    db.close();
  }
});
