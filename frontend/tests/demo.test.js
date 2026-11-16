import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, STORAGE_KEY, initialData } from '../js/demo/runtime.js';
function storage() {
  const values = new Map();
  return { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
}

test('demo executa aprovação, OS, estoque, comunicação e comprovante com as regras do backend', async () => {
  const saved = storage();
  const { api } = createDemoApi(saved);
  assert.ok((await api('servicos')).some((s) => s.nome === 'Troca de óleo e filtro'));
  await api('orcamentos/1/aprovar', 'POST');
  const order = await api('orcamentos/1/gerar-os', 'POST');
  assert.equal((await api('estoque/1')).quantidade, 8);
  await assert.rejects(() => api('orcamentos/1/gerar-os', 'POST'));
  assert.equal((await api('estoque/1')).quantidade, 8);
  for (const status of ['em_andamento', 'finalizada', 'entregue'])
    await api(`ordens/${order.id}`, 'PATCH', { status });
  assert.equal((await api(`ordens/${order.id}/nota`, 'POST')).total, 32000);
  const notification = await api(`ordens/${order.id}/whatsapp`, 'POST');
  assert.equal(notification.link, '');
  assert.ok(saved.getItem(STORAGE_KEY));
  const reopened = createDemoApi(saved);
  assert.equal((await reopened.api('estoque/1')).quantidade, 8);
  reopened.reset();
  assert.equal((await reopened.api('estoque/1')).quantidade, 10);
  assert.equal((await reopened.api('ordens')).length, 0);
});

test('demo não grava alterações parciais se faltar estoque ou a persistência falhar', async () => {
  const saved = storage();
  const { api } = createDemoApi(saved);
  await api('estoque/1', 'PATCH', { quantidade: 1 });
  await api('orcamentos/1/aprovar', 'POST');
  await assert.rejects(() => api('orcamentos/1/gerar-os', 'POST'));
  assert.equal((await api('estoque/1')).quantidade, 1);
  assert.equal((await api('ordens')).length, 0);
  const full = createDemoApi({
    getItem: () => null,
    setItem: () => {
      throw Error('Sem espaço.');
    },
  });
  await assert.rejects(() => full.api('estoque/1', 'PATCH', { quantidade: 0 }));
  assert.equal((await full.api('estoque/1')).quantidade, 10);
});

test('demo atualiza catálogo salvo sem apagar saldos ou orçamentos anteriores', async () => {
  const saved = storage();
  const legacy = initialData();
  legacy.estoque = legacy.estoque.slice(0, 3);
  legacy.estoque[0].quantidade = 3;
  delete legacy.estoque[0].tipo;
  delete legacy.estoque[0].unidade;
  legacy.servicos = legacy.servicos.slice(0, 21);
  saved.setItem(STORAGE_KEY, JSON.stringify(legacy));
  const { api } = createDemoApi(saved);
  const items = await api('estoque');
  assert.equal(items.length, 32);
  assert.equal(items.find((i) => i.codigo === 'FLT-001').quantidade, 3);
  assert.equal((await api('orcamentos')).length, 1);
  assert.ok((await api('servicos')).some((i) => i.nome === 'Troca de óleo e filtro'));
  const oil = items.find((i) => i.codigo === 'SUP-001'),
    gloves = items.find((i) => i.codigo === 'SUP-013');
  const quote = await api('orcamentos', 'POST', {
    cliente_id: 1,
    veiculo_id: 1,
    diagnostico: 'Consumo de suprimentos',
    itens: [
      { tipo: 'suprimento', referencia_id: oil.id, quantidade: 4 },
      { tipo: 'suprimento', referencia_id: gloves.id, quantidade: 2 },
    ],
  });
  assert.equal(quote.total, 4 * oil.venda);
  await api(`orcamentos/${quote.id}/aprovar`, 'POST');
  await api(`orcamentos/${quote.id}/gerar-os`, 'POST');
  assert.equal((await api(`estoque/${oil.id}`)).quantidade, oil.quantidade - 4);
  assert.equal((await api(`estoque/${gloves.id}`)).quantidade, gloves.quantidade - 2);
});
