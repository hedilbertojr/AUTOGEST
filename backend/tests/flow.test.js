const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'autogest-test-'));
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { server, db } = createApp(loadConfig({ DB_PATH: path.join(temp, 'test.db') }, false));
let base;
const ready = new Promise((resolve) =>
  server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  }),
);
async function request(route, method = 'GET', body) {
  await ready;
  const r = await fetch(base + '/api/' + route, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(temp, { recursive: true, force: true });
});
test('fluxo completo, preços confiáveis e proteção contra baixas duplicadas', async () => {
  const services = (await request('servicos')).data;
  assert.equal(services.length, 21);
  const c = (
    await request('clientes', 'POST', {
      nome: 'João Teste',
      telefone: '11999998888',
      email: 'joao@teste.com',
    })
  ).data;
  const v = (
    await request('veiculos', 'POST', {
      cliente_id: c.id,
      placa: 'ABC1D23',
      marca: 'Fiat',
      modelo: 'Uno',
      ano: 2020,
    })
  ).data;
  const p = (
    await request('estoque', 'POST', {
      codigo: 'FLT-001',
      nome: 'Filtro de óleo',
      quantidade: 10,
      minimo: 2,
      custo: 15,
      venda: 35,
    })
  ).data;
  const payload = {
    cliente_id: c.id,
    veiculo_id: v.id,
    diagnostico: 'Troca de escape e recarga',
    itens: [
      { tipo: 'servico', referencia_id: services[0].id, quantidade: 1, preco: 0 },
      { tipo: 'peca', referencia_id: p.id, quantidade: 2 },
    ],
  };
  const o = (await request('orcamentos', 'POST', payload)).data;
  assert.equal(o.total, services[0].preco + 7000);
  assert.equal((await request(`orcamentos/${o.id}/gerar-os`, 'POST', {})).status, 409);
  await request(`orcamentos/${o.id}/aprovar`, 'POST', {});
  const order = (await request(`orcamentos/${o.id}/gerar-os`, 'POST', {})).data;
  assert.ok(order.id);
  assert.equal((await request('estoque/' + p.id)).data.quantidade, 8);
  assert.equal((await request(`orcamentos/${o.id}/gerar-os`, 'POST', {})).status, 409);
  assert.equal((await request('estoque/' + p.id)).data.quantidade, 8);
  assert.equal((await request(`ordens/${order.id}`, 'PATCH', { status: 'entregue' })).status, 409);
  assert.equal((await request(`ordens/${order.id}/nota`, 'POST', {})).status, 409);
  for (const status of ['em_andamento', 'finalizada', 'entregue'])
    assert.equal((await request(`ordens/${order.id}`, 'PATCH', { status })).status, 200);
  const note = await request(`ordens/${order.id}/nota`, 'POST', {});
  assert.equal(note.data.total, o.total);
  assert.equal((await request(`ordens/${order.id}/nota`, 'POST', {})).status, 409);
  const n = (await request(`ordens/${order.id}/whatsapp`, 'POST', {})).data;
  assert.match(n.link, /wa.me\/5511999998888/);
  assert.equal(n.status, 'link_gerado');
  assert.equal((await request('notificacoes')).data.length, 1);
});
test('estoque agregado e rollback integral em falha', async () => {
  const c = (await request('clientes', 'POST', { nome: 'Teste', telefone: '11988887777' })).data;
  const v = (
    await request('veiculos', 'POST', {
      cliente_id: c.id,
      placa: 'XYZ9Z99',
      marca: 'VW',
      modelo: 'Gol',
      ano: 2020,
    })
  ).data;
  const p = (
    await request('estoque', 'POST', {
      codigo: 'TEST',
      nome: 'Peça',
      quantidade: 3,
      minimo: 1,
      custo: 1,
      venda: 2,
    })
  ).data;
  const o = (
    await request('orcamentos', 'POST', {
      cliente_id: c.id,
      veiculo_id: v.id,
      diagnostico: 'Teste de estoque',
      itens: [1, 2].map(() => ({ tipo: 'peca', referencia_id: p.id, quantidade: 2 })),
    })
  ).data;
  await request(`orcamentos/${o.id}/aprovar`, 'POST', {});
  assert.equal((await request(`orcamentos/${o.id}/gerar-os`, 'POST', {})).status, 409);
  assert.equal((await request('estoque/' + p.id)).data.quantidade, 3);
  assert.equal(db.prepare('SELECT count(*) n FROM ordens WHERE orcamento_id=?').get(o.id).n, 0);
  assert.equal((await request('estoque/' + p.id, 'PATCH', { quantidade: -1 })).status, 400);
});
test('valida vínculo cliente/veículo e protege a API de origem externa', async () => {
  const c = (await request('clientes', 'POST', { nome: 'Outro', telefone: '11977776666' })).data;
  const v = (await request('veiculos')).data[0];
  assert.equal(
    (
      await request('orcamentos', 'POST', {
        cliente_id: c.id,
        veiculo_id: v.id,
        diagnostico: 'X',
        itens: [{ tipo: 'servico', referencia_id: 1, quantidade: 1 }],
      })
    ).status,
    400,
  );
  const r = await fetch(base + '/api/clientes', {
    method: 'POST',
    headers: { Origin: 'https://externo.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r.status, 403);
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /AutoGest/);
});

test('HTTP retorna erros JSON consistentes e serve módulos da interface', async () => {
  const health = await request('health');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');
  const invalid = await fetch(base + '/api/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).erro, 'JSON inválido.');
  const unsupported = await fetch(base + '/api/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(unsupported.status, 415);
  assert.equal((await unsupported.json()).erro, 'Use application/json.');
  const hidden = await fetch(base + '/.env');
  assert.equal(hidden.status, 403);
  const script = await fetch(base + '/js/features/budget-editor.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('Content-Type'), /javascript/);
  assert.match(await script.text(), /export function createBudgetEditor/);
  assert.equal((await request('clientes/999999')).status, 404);
});
