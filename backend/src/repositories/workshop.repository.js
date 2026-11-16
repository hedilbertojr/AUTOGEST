const { fail } = require('../shared/errors');
const { integer } = require('../shared/validation');
function createRepository(db) {
  function get(table, id) {
    checkTable(table);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(integer(id, 'ID', 1));
    if (!row) fail('Registro não encontrado.', 404);
    return row;
  }
  function insert(table, data) {
    checkTable(table);
    const keys = Object.keys(data);
    const r = db
      .prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`)
      .run(...Object.values(data));
    return get(table, Number(r.lastInsertRowid));
  }
  const summaries = {
    veiculos:
      'SELECT v.*, c.nome AS cliente FROM veiculos v JOIN clientes c ON c.id=v.cliente_id ORDER BY v.id DESC',
    orcamentos:
      'SELECT o.*, c.nome AS cliente, v.placa FROM orcamentos o JOIN clientes c ON c.id=o.cliente_id JOIN veiculos v ON v.id=o.veiculo_id ORDER BY o.id DESC',
    ordens:
      'SELECT os.*, o.total, o.cliente_id, c.nome AS cliente, v.placa FROM ordens os JOIN orcamentos o ON o.id=os.orcamento_id JOIN clientes c ON c.id=o.cliente_id JOIN veiculos v ON v.id=o.veiculo_id ORDER BY os.id DESC',
    notas:
      'SELECT n.*, c.nome AS cliente FROM notas n JOIN ordens os ON os.id=n.ordem_id JOIN orcamentos o ON o.id=os.orcamento_id JOIN clientes c ON c.id=o.cliente_id ORDER BY n.id DESC',
    notificacoes:
      'SELECT n.*, c.nome AS cliente FROM notificacoes n JOIN clientes c ON c.id=n.cliente_id ORDER BY n.id DESC',
  };
  const tables = [
    'clientes',
    'veiculos',
    'servicos',
    'estoque',
    'orcamentos',
    'ordens',
    'notas',
    'notificacoes',
  ];

  function checkTable(table) {
    if (![...tables, 'itens'].includes(table)) throw new Error('Tabela interna inválida.');
  }
  return {
    get,
    insert,
    tables,
    list(table) {
      checkTable(table);
      return db.prepare(summaries[table] || `SELECT * FROM ${table} ORDER BY id DESC`).all();
    },
    items(id) {
      return db.prepare('SELECT * FROM itens WHERE orcamento_id=?').all(id);
    },
    orderForQuote(id) {
      return db.prepare('SELECT id FROM ordens WHERE orcamento_id=?').get(id);
    },
    noteForOrder(id) {
      return db.prepare('SELECT id FROM notas WHERE ordem_id=?').get(id);
    },
    requiredParts(id) {
      return db
        .prepare(
          "SELECT referencia_id, SUM(quantidade) AS quantidade FROM itens WHERE orcamento_id=? AND tipo='peca' GROUP BY referencia_id",
        )
        .all(id);
    },
    setStock(id, quantity) {
      db.prepare('UPDATE estoque SET quantidade=? WHERE id=?').run(quantity, id);
      return get('estoque', id);
    },
    decreaseStock(id, quantity) {
      db.prepare('UPDATE estoque SET quantidade=quantidade-? WHERE id=?').run(quantity, id);
    },
    approveQuote(id) {
      db.prepare("UPDATE orcamentos SET status='aprovado' WHERE id=?").run(id);
      return get('orcamentos', id);
    },
    setOrderStatus(id, status) {
      db.prepare('UPDATE ordens SET status=? WHERE id=?').run(status, id);
      return get('ordens', id);
    },
  };
}
module.exports = { createRepository };
