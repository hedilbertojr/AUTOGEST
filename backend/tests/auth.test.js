const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createHash } = require('node:crypto');
const { server, db, auth } = createApp(loadConfig({ DB_PATH: ':memory:' }, false));
const firstPassword = 'Uma senha inicial longa!2026';
const nextPassword = 'Minha frase pessoal para oficina!';
let base;
const ready = new Promise((resolve) =>
  server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  }),
);
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
async function request(route, method = 'GET', body, session, extra = {}) {
  await ready;
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}),
    ...extra,
  };
  const response = await fetch(base + '/api/' + route, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get('set-cookie'),
  };
}
async function login(email, senha = firstPassword) {
  const response = await request('auth/login', 'POST', { email, senha });
  assert.equal(response.status, 200);
  return {
    cookie: response.cookie.split(';')[0],
    csrf: response.data.csrf,
    user: response.data.usuario,
    header: response.cookie,
  };
}

test('autenticação e permissões completas do dono e do mecânico', async (t) => {
  assert.equal((await request('clientes')).status, 401);
  assert.equal((await request('auth/status')).data.inicializado, false);
  const owner = await auth.firstAdmin({
    nome: 'Dono',
    email: 'dono@example.com',
    senha: firstPassword,
  });
  await assert.rejects(() =>
    auth.firstAdmin({ nome: 'Outro', email: 'outro@example.com', senha: firstPassword }),
  );
  const admin = await login('dono@example.com');
  let mechanic, secondOrder, order;

  await t.test('senha com hash scrypt, cookie protegido, tokens opacos e CSRF', async () => {
    const stored = db.prepare('SELECT * FROM usuarios WHERE id=?').get(owner.id);
    assert.match(stored.senha_hash, /^scrypt\$131072\$8\$1\$/);
    assert.notEqual(stored.senha_hash, firstPassword);
    assert.match(admin.header, /HttpOnly/);
    assert.match(admin.header, /SameSite=Strict/);
    const raw = admin.cookie.split('=')[1];
    assert.ok(
      db
        .prepare('SELECT token_hash FROM sessoes WHERE token_hash=?')
        .get(createHash('sha256').update(raw).digest('hex')),
    );
    assert.equal(
      (
        await request(
          'clientes',
          'POST',
          { nome: 'X', telefone: '11999998888' },
          { cookie: admin.cookie, csrf: 'errado' },
        )
      ).status,
      403,
    );
    assert.equal(
      (await request('clientes', 'POST', {}, admin, { Origin: 'https://externo.example' })).status,
      403,
    );
    const users = await request('usuarios', 'GET', undefined, admin);
    assert.equal(users.status, 200);
    assert.equal(users.data[0].senha_hash, undefined);
    assert.equal(
      (await request('usuarios/' + owner.id, 'PATCH', { ativo: false }, admin)).status,
      409,
    );
    assert.equal(
      (await request('usuarios/' + owner.id, 'PATCH', { papel: 'operador' }, admin)).status,
      409,
    );
  });

  await t.test('dono cria mecânico e senha temporária precisa ser trocada', async () => {
    const created = await request(
      'usuarios',
      'POST',
      { nome: 'Mecânico', email: 'mecanico@example.com', papel: 'operador', senha: firstPassword },
      admin,
    );
    assert.equal(created.status, 201);
    assert.equal(created.data.trocar_senha, true);
    assert.equal(created.data.senha_hash, undefined);
    mechanic = await login('mecanico@example.com');
    assert.equal((await request('ordens', 'GET', undefined, mechanic)).status, 403);
    assert.equal(
      (
        await request(
          'auth/password',
          'POST',
          { senha_atual: 'incorreta', nova_senha: nextPassword },
          mechanic,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          'auth/password',
          'POST',
          { senha_atual: firstPassword, nova_senha: 'curta' },
          mechanic,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          'auth/password',
          'POST',
          { senha_atual: firstPassword, nova_senha: nextPassword },
          mechanic,
        )
      ).status,
      200,
    );
    assert.equal((await request('auth/session', 'GET', undefined, mechanic)).status, 401);
    mechanic = await login('mecanico@example.com', nextPassword);
    assert.equal(mechanic.user.trocar_senha, false);
  });

  await t.test('mecânico só vê sua OS, sem preços e sem privilégios administrativos', async () => {
    const c = (
      await request('clientes', 'POST', { nome: 'Cliente', telefone: '11999998888' }, admin)
    ).data;
    const v = (
      await request(
        'veiculos',
        'POST',
        { cliente_id: c.id, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Uno', ano: 2020 },
        admin,
      )
    ).data;
    for (let i = 0; i < 2; i++) {
      const quote = (
        await request(
          'orcamentos',
          'POST',
          {
            cliente_id: c.id,
            veiculo_id: v.id,
            diagnostico: 'Revisar escapamento',
            itens: [{ tipo: 'servico', referencia_id: 1, quantidade: 1 }],
          },
          admin,
        )
      ).data;
      await request(`orcamentos/${quote.id}/aprovar`, 'POST', {}, admin);
      const os = (await request(`orcamentos/${quote.id}/gerar-os`, 'POST', {}, admin)).data;
      if (i === 0) order = os;
      else secondOrder = os;
    }
    assert.equal(
      (
        await request(
          `ordens/${order.id}/responsavel`,
          'PATCH',
          { operador_id: mechanic.user.id },
          admin,
        )
      ).status,
      200,
    );
    const list = (await request('ordens', 'GET', undefined, mechanic)).data;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, order.id);
    assert.equal(list[0].total, undefined);
    assert.equal(list[0].itens[0].preco, undefined);
    assert.equal((await request('clientes', 'GET', undefined, mechanic)).status, 403);
    assert.equal((await request('usuarios', 'GET', undefined, mechanic)).status, 403);
    assert.equal((await request('usuarios', 'POST', {}, mechanic)).status, 403);
    assert.equal(
      (await request(`ordens/${secondOrder.id}`, 'GET', undefined, mechanic)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `ordens/${order.id}/responsavel`,
          'PATCH',
          { operador_id: mechanic.user.id },
          mechanic,
        )
      ).status,
      403,
    );
    assert.equal(
      (await request(`ordens/${order.id}`, 'PATCH', { status: 'em_andamento' }, mechanic)).status,
      200,
    );
    assert.equal(
      (await request(`ordens/${order.id}`, 'PATCH', { status: 'finalizada' }, mechanic)).status,
      200,
    );
    assert.equal(
      (await request(`ordens/${order.id}`, 'PATCH', { status: 'entregue' }, mechanic)).status,
      403,
    );
    assert.equal((await request(`ordens/${order.id}/nota`, 'POST', {}, mechanic)).status, 403);
  });

  await t.test(
    'financeiro e BI são exclusivos do administrador e protegidos por CSRF',
    async () => {
      assert.equal((await request('bi', 'GET', undefined, mechanic)).status, 403);
      assert.equal((await request('financeiro/titulos', 'POST', {}, mechanic)).status, 403);
      assert.equal((await request('bi', 'GET', undefined, admin)).status, 200);
      assert.equal(
        (
          await request(
            'financeiro/titulos',
            'POST',
            {},
            { cookie: admin.cookie, csrf: 'invalido' },
          )
        ).status,
        403,
      );
      const created = await request(
        'financeiro/titulos',
        'POST',
        {
          natureza: 'despesa_operacional',
          descricao: 'Despesa via API',
          categoria: 'Teste',
          valor: 10,
          competencia: '2026-01-01',
          vencimento: '2026-01-01',
        },
        admin,
      );
      assert.equal(created.status, 201);
      assert.equal(created.data.valor, 1000);
    },
  );
  await t.test('redefinição e desativação encerram sessões imediatamente', async () => {
    assert.equal(
      (await request(`usuarios/${mechanic.user.id}/senha`, 'POST', { senha: firstPassword }, admin))
        .status,
      200,
    );
    assert.equal((await request('auth/session', 'GET', undefined, mechanic)).status, 401);
    mechanic = await login('mecanico@example.com');
    assert.equal(mechanic.user.trocar_senha, true);
    assert.equal(
      (await request('usuarios/' + mechanic.user.id, 'PATCH', { ativo: false }, admin)).status,
      200,
    );
    assert.equal((await request('auth/session', 'GET', undefined, mechanic)).status, 401);
    assert.equal(
      (await request('auth/login', 'POST', { email: 'mecanico@example.com', senha: firstPassword }))
        .status,
      401,
    );
    assert.equal(
      (await request('usuarios/' + mechanic.user.id, 'PATCH', { ativo: true }, admin)).status,
      200,
    );
  });

  await t.test('limite de tentativas, expiração, logout e auditoria', async () => {
    const key = createHash('sha256').update('account:naoexiste@example.com').digest('hex');
    db.prepare('INSERT INTO tentativas_login(chave,quantidade,expira_em) VALUES(?,10,?)').run(
      key,
      Date.now() + 900000,
    );
    assert.equal(
      (
        await request('auth/login', 'POST', {
          email: 'naoexiste@example.com',
          senha: firstPassword,
        })
      ).status,
      429,
    );
    const other = await login('dono@example.com');
    const token = other.cookie.split('=')[1];
    const hash = createHash('sha256').update(token).digest('hex');
    db.prepare('UPDATE sessoes SET ultima_atividade=? WHERE token_hash=?').run(
      Date.now() - 31 * 60000,
      hash,
    );
    assert.equal((await request('auth/session', 'GET', undefined, other)).status, 401);
    const events = (await request('auditoria', 'GET', undefined, admin)).data;
    assert.ok(events.some((e) => e.acao === 'senha_redefinida'));
    assert.ok(events.every((e) => !JSON.stringify(e).includes(firstPassword)));
    assert.equal((await request('auth/logout', 'POST', {}, admin)).status, 200);
    assert.equal((await request('clientes', 'GET', undefined, admin)).status, 401);
  });
});
