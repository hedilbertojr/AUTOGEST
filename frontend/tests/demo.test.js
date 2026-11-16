import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, STORAGE_KEY } from '../js/demo/runtime.js';
function storage() {
  const values = new Map();
  return { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
}

test('demo executa aprovação, OS, estoque, comunicação e comprovante com as regras do backend', async () => {
  const saved = storage();
  const { api } = createDemoApi(saved);
  assert.equal((await api('servicos')).length, 21);
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
