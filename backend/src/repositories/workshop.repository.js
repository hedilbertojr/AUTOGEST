const { businessDate } = require('../finance/dates');
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
    const row = get(table, Number(r.lastInsertRowid));
    if (table === 'estoque' && row.quantidade > 0)
      db.prepare(
        "INSERT INTO estoque_movimentos(estoque_id,tipo,quantidade,custo_unitario) VALUES(?,'saldo_inicial',?,?)",
      ).run(row.id, row.quantidade, row.custo);
    return row;
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
          "SELECT referencia_id, SUM(quantidade) AS quantidade FROM itens WHERE orcamento_id=? AND tipo IN ('peca','suprimento') GROUP BY referencia_id",
        )
        .all(id);
    },
    captureCosts(id) {
      for (const item of db.prepare('SELECT * FROM itens WHERE orcamento_id=?').all(id)) {
        const source = get(item.tipo === 'servico' ? 'servicos' : 'estoque', item.referencia_id);
        db.prepare('UPDATE itens SET custo_unitario=? WHERE id=?').run(
          source.custo ?? null,
          item.id,
        );
      }
    },
    receivable(order) {
      const quote = get('orcamentos', order.orcamento_id);
      if (quote.total > 0)
        db.prepare(
          "INSERT INTO financeiro_titulos(tipo,natureza,descricao,categoria,valor,competencia,vencimento,ordem_id) VALUES('receber','venda_os',?,'Serviços e materiais',?,?,?,?) ON CONFLICT(ordem_id) DO NOTHING",
        ).run(
          'OS #' + order.id,
          quote.total,
          businessDate(order.finalizada_em || order.criado_em),
          businessDate(),
          order.id,
        );
    },
    setStock(id, quantity) {
      const old = get('estoque', id);
      db.prepare(
        "INSERT INTO estoque_movimentos(estoque_id,tipo,quantidade,custo_unitario) VALUES(?,'ajuste',?,?)",
      ).run(old.id, quantity - old.quantidade, old.custo);
      db.prepare('UPDATE estoque SET quantidade=? WHERE id=?').run(quantity, id);
      return get('estoque', id);
    },
    decreaseStock(id, quantity, orderId) {
      const old = get('estoque', id);
      db.prepare(
        "INSERT INTO estoque_movimentos(estoque_id,ordem_id,tipo,quantidade,custo_unitario) VALUES(?,?,'consumo',?,?)",
      ).run(old.id, orderId, -quantity, old.custo);
      db.prepare('UPDATE estoque SET quantidade=quantidade-? WHERE id=?').run(quantity, id);
    },
    approveQuote(id) {
      db.prepare("UPDATE orcamentos SET status='aprovado' WHERE id=?").run(id);
      return get('orcamentos', id);
    },
    setOrderStatus(id, status) {
      db.prepare('UPDATE ordens SET status=? WHERE id=?').run(status, id);
      const column = {
        em_andamento: 'iniciada_em',
        finalizada: 'finalizada_em',
        entregue: 'entregue_em',
      }[status];
      if (column)
        db.prepare('UPDATE ordens SET ' + column + '=? WHERE id=?').run(
          new Date().toISOString(),
          id,
        );
      if (status === 'finalizada') {
        db.prepare('UPDATE ordens SET mecanico_conclusao_id=operador_id WHERE id=?').run(id);
        const order = get('ordens', id);
        this.receivable(order);
        db.prepare('UPDATE financeiro_titulos SET competencia=? WHERE ordem_id=?').run(
          businessDate(order.finalizada_em),
          id,
        );
      }
      return get('ordens', id);
    },
  };
}
module.exports = { createRepository };
