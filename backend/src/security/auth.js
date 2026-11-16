const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { hashPassword, verifyPassword } = require('./passwords');
const { fail } = require('../shared/errors');
const { str, integer } = require('../shared/validation');
const { transaction } = require('../database/connection');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const publicUser = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  papel: u.papel,
  ativo: Boolean(u.ativo),
  trocar_senha: Boolean(u.trocar_senha),
});
function email(value) {
  const result = str(value, 'E-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('E-mail inválido.');
  return result;
}
function role(value) {
  if (!['admin', 'operador'].includes(value)) fail('Perfil inválido.');
  return value;
}
function createAuth(db, config) {
  const cookieName = config.secureCookies ? '__Host-autogest' : 'autogest_session';
  const absoluteDuration = 8 * 60 * 60 * 1000;
  const idleDuration = 30 * 60 * 1000;
  const audit = (actor, action, target = null) =>
    db
      .prepare('INSERT INTO auditoria(usuario_id,acao,alvo_id) VALUES(?,?,?)')
      .run(actor, action, target);
  const byId = (id) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id=?').get(integer(id, 'ID', 1));
    if (!u) fail('Usuário não encontrado.', 404);
    return u;
  };
  function setCookie(res, token, duration = absoluteDuration) {
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(duration / 1000)}${config.secureCookies ? '; Secure' : ''}`,
    );
  }
  function identify(req) {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + '='));
    if (!cookie) return null;
    const raw = cookie.slice(cookieName.length + 1);
    if (!/^[a-f0-9]{64}$/.test(raw)) return null;
    const tokenHash = digest(raw);
    const now = Date.now();
    const session = db
      .prepare(
        'SELECT s.*, u.nome,u.email,u.papel,u.ativo,u.trocar_senha FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=?',
      )
      .get(tokenHash);
    if (!session) return null;
    if (
      !session.ativo ||
      session.expira_em <= now ||
      session.ultima_atividade + idleDuration <= now
    ) {
      db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(tokenHash);
      return null;
    }
    db.prepare('UPDATE sessoes SET ultima_atividade=? WHERE token_hash=?').run(now, tokenHash);
    return {
      tokenHash,
      csrf: session.csrf,
      user: publicUser({ ...session, id: session.usuario_id }),
    };
  }
  function requireSession(req) {
    const session = identify(req);
    if (!session) fail('Faça login para continuar.', 401);
    return session;
  }
  function checkCsrf(req, session) {
    const supplied = req.headers['x-csrf-token'];
    if (
      typeof supplied !== 'string' ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrf))
    )
      fail('Sessão de formulário inválida. Recarregue a página.', 403);
  }
  function requireAdmin(session) {
    if (session.user.papel !== 'admin') fail('Acesso exclusivo do administrador.', 403);
  }
  function currentAdmin(actor) {
    const fresh = byId(actor.user.id);
    const stored = db.prepare('SELECT * FROM sessoes WHERE token_hash=?').get(actor.tokenHash);
    if (
      !fresh.ativo ||
      fresh.papel !== 'admin' ||
      !stored ||
      stored.expira_em <= Date.now() ||
      stored.ultima_atividade + idleDuration <= Date.now()
    )
      fail('Faça login novamente.', 401);
  }
  function ready(session) {
    if (session.user.trocar_senha)
      fail('Troque a senha temporária antes de acessar o sistema.', 403);
  }
  function throttle(ip, account) {
    const now = Date.now(),
      until = now + 15 * 60 * 1000;
    db.prepare('DELETE FROM tentativas_login WHERE expira_em<=?').run(now);
    for (const [key, limit] of [
      [digest('ip:' + ip), 40],
      [digest('account:' + account), 10],
    ]) {
      const current = db.prepare('SELECT * FROM tentativas_login WHERE chave=?').get(key);
      if (current?.quantidade >= limit)
        fail('Muitas tentativas. Tente novamente em 15 minutos.', 429);
      db.prepare(
        'INSERT INTO tentativas_login(chave,quantidade,expira_em) VALUES(?,1,?) ON CONFLICT(chave) DO UPDATE SET quantidade=quantidade+1',
      ).run(key, until);
    }
  }
  async function login(req, res, body) {
    const address =
      typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    throttle(req.socket.remoteAddress || 'local', address);
    const user = db.prepare('SELECT * FROM usuarios WHERE email=?').get(address);
    const valid = await verifyPassword(body.senha, user?.senha_hash);
    if (!user || !valid || !user.ativo) {
      audit(user?.id || null, 'login_falhou');
      fail('E-mail ou senha inválidos.', 401);
    }
    // Recheck after asynchronous hashing: an administrator may have revoked this account.
    const current = byId(user.id);
    if (!current.ativo || current.senha_hash !== user.senha_hash)
      fail('E-mail ou senha inválidos.', 401);
    const token = randomBytes(32).toString('hex'),
      csrf = randomBytes(32).toString('hex'),
      now = Date.now();
    transaction(db, () => {
      db.prepare('DELETE FROM sessoes WHERE expira_em<=? OR ultima_atividade<=?').run(
        now,
        now - idleDuration,
      );
      const old = identify(req);
      if (old) db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(old.tokenHash);
      db.prepare(
        'INSERT INTO sessoes(token_hash,usuario_id,csrf,expira_em,ultima_atividade) VALUES(?,?,?,?,?)',
      ).run(digest(token), user.id, csrf, now + absoluteDuration, now);
      db.prepare('DELETE FROM tentativas_login WHERE chave=?').run(digest('account:' + address));
      audit(user.id, 'login');
    });
    setCookie(res, token);
    return { usuario: publicUser(current), csrf };
  }
  function logout(req, res, session) {
    db.prepare('DELETE FROM sessoes WHERE token_hash=?').run(session.tokenHash);
    audit(session.user.id, 'logout');
    setCookie(res, '', 0);
    return { ok: true };
  }
  async function changePassword(req, res, session, body) {
    throttle(req.socket.remoteAddress || 'local', 'password:' + session.user.id);
    const before = byId(session.user.id);
    if (!(await verifyPassword(body.senha_atual, before.senha_hash)))
      fail('Senha atual incorreta.', 400);
    if (body.senha_atual === body.nova_senha) fail('Escolha uma senha diferente da atual.');
    const hash = await hashPassword(body.nova_senha);
    // Reject stale sessions and concurrent resets before writing.
    requireSession(req);
    if (byId(before.id).senha_hash !== before.senha_hash)
      fail('A senha foi alterada. Faça login novamente.', 401);
    transaction(db, () => {
      db.prepare('UPDATE usuarios SET senha_hash=?,trocar_senha=0 WHERE id=?').run(hash, before.id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id=?').run(before.id);
      audit(before.id, 'senha_alterada');
    });
    setCookie(res, '', 0);
    return { ok: true };
  }
  async function createUser(actor, body, first = false) {
    if (!first) requireAdmin(actor);
    const name = str(body.nome, 'Nome', 150),
      address = email(body.email),
      userRole = first ? 'admin' : role(body.papel);
    const hash = await hashPassword(body.senha);
    return transaction(db, () => {
      if (first && db.prepare('SELECT count(*) n FROM usuarios').get().n)
        fail('O administrador inicial já foi criado.', 409);
      if (!first) currentAdmin(actor);
      const r = db
        .prepare('INSERT INTO usuarios(nome,email,senha_hash,papel,trocar_senha) VALUES(?,?,?,?,?)')
        .run(name, address, hash, userRole, first ? 0 : 1);
      const id = Number(r.lastInsertRowid);
      audit(first ? id : actor.user.id, 'usuario_criado', id);
      return publicUser(byId(id));
    });
  }
  function updateUser(actor, id, body) {
    requireAdmin(actor);
    return transaction(db, () => {
      const u = byId(id),
        name = body.nome === undefined ? u.nome : str(body.nome, 'Nome', 150),
        address = body.email === undefined ? u.email : email(body.email),
        userRole = body.papel === undefined ? u.papel : role(body.papel);
      if (body.ativo !== undefined && typeof body.ativo !== 'boolean')
        fail('Estado da conta inválido.');
      const active = body.ativo === undefined ? u.ativo : Number(body.ativo);
      if (u.id === actor.user.id && (!active || userRole !== 'admin'))
        fail('Você não pode remover o próprio acesso administrativo.', 409);
      if (
        u.papel === 'admin' &&
        u.ativo &&
        (!active || userRole !== 'admin') &&
        db.prepare("SELECT count(*) n FROM usuarios WHERE papel='admin' AND ativo=1").get().n <= 1
      )
        fail('Mantenha pelo menos um administrador ativo.', 409);
      db.prepare('UPDATE usuarios SET nome=?,email=?,papel=?,ativo=? WHERE id=?').run(
        name,
        address,
        userRole,
        active,
        u.id,
      );
      db.prepare('DELETE FROM sessoes WHERE usuario_id=?').run(u.id);
      audit(actor.user.id, 'usuario_atualizado', u.id);
      return publicUser(byId(u.id));
    });
  }
  async function resetPassword(actor, id, body) {
    requireAdmin(actor);
    const target = byId(id);
    if (target.id === actor.user.id)
      fail('Use a opção Alterar minha senha para sua própria conta.');
    const hash = await hashPassword(body.senha);
    currentAdmin(actor);
    transaction(db, () => {
      db.prepare('UPDATE usuarios SET senha_hash=?,trocar_senha=1 WHERE id=?').run(hash, target.id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id=?').run(target.id);
      audit(actor.user.id, 'senha_redefinida', target.id);
    });
    return { ok: true };
  }
  function authorize(session, method, parts, body) {
    ready(session);
    if (session.user.papel === 'admin') return;
    const [resource, id, action] = parts;
    if (resource !== 'ordens' || action || parts.length > 2)
      fail('Você não tem permissão para esta operação.', 403);
    if (id) {
      const order = db
        .prepare('SELECT * FROM ordens WHERE id=? AND operador_id=?')
        .get(integer(id, 'ID', 1), session.user.id);
      if (!order) fail('Ordem de serviço não encontrada.', 404);
    }
    if (method === 'GET') return;
    if (method === 'PATCH' && id && ['em_andamento', 'finalizada'].includes(body.status)) return;
    fail('Você não tem permissão para esta operação.', 403);
  }
  function operatorOrders(user, id) {
    const rows = db
      .prepare(
        `SELECT os.id,os.status,os.orcamento_id,os.operador_id,v.placa,v.marca,v.modelo,o.diagnostico FROM ordens os JOIN orcamentos o ON o.id=os.orcamento_id JOIN veiculos v ON v.id=o.veiculo_id WHERE os.operador_id=? ORDER BY os.id DESC`,
      )
      .all(user.id);
    for (const order of rows)
      order.itens = db
        .prepare('SELECT nome,quantidade,tipo FROM itens WHERE orcamento_id=?')
        .all(order.orcamento_id);
    return id ? rows.find((r) => r.id === Number(id)) : rows;
  }
  function assign(actor, id, body) {
    requireAdmin(actor);
    ready(actor);
    const order = db.prepare('SELECT * FROM ordens WHERE id=?').get(integer(id, 'ID', 1));
    if (!order) fail('OS não encontrada.', 404);
    const operator = body.operador_id === null ? null : byId(body.operador_id);
    if (operator && (operator.papel !== 'operador' || !operator.ativo))
      fail('Selecione um mecânico ativo.');
    db.prepare('UPDATE ordens SET operador_id=? WHERE id=?').run(operator?.id || null, order.id);
    audit(actor.user.id, 'os_atribuida', order.id);
    return { ok: true };
  }
  return {
    identify,
    requireSession,
    checkCsrf,
    requireAdmin,
    ready,
    login,
    logout,
    changePassword,
    createUser,
    updateUser,
    resetPassword,
    authorize,
    operatorOrders,
    assign,
    firstAdmin: (body) => createUser(null, body, true),
    listUsers: () =>
      db
        .prepare(
          'SELECT id,nome,email,papel,ativo,trocar_senha,criado_em FROM usuarios ORDER BY nome',
        )
        .all()
        .map(publicUser),
    audit: () =>
      db
        .prepare(
          'SELECT a.id,a.acao,a.alvo_id,a.criado_em,u.nome AS usuario FROM auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.id DESC LIMIT 100',
        )
        .all(),
  };
}
module.exports = { createAuth };
