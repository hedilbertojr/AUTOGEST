const tables = [
  'financeiro_titulos',
  'financeiro_movimentos',
  'ordens',
  'orcamentos',
  'itens',
  'estoque',
  'estoque_movimentos',
  'servicos',
  'usuarios',
  'clientes',
];
function createFinanceRepository(db, atomic) {
  const check = (table) => {
    if (!tables.includes(table)) throw Error('Tabela financeira inválida.');
  };
  return {
    snapshot() {
      return Object.fromEntries(
        tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()]),
      );
    },
    find(table, id) {
      check(table);
      return db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
    },
    insert(table, data) {
      check(table);
      const keys = Object.keys(data);
      const r = db
        .prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`)
        .run(...Object.values(data));
      return this.find(table, Number(r.lastInsertRowid));
    },
    update(table, id, data) {
      check(table);
      const keys = Object.keys(data);
      db.prepare(`UPDATE ${table} SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).run(
        ...Object.values(data),
        id,
      );
      return this.find(table, id);
    },
    atomic,
    audit(actor, action, id) {
      db.prepare('INSERT INTO auditoria(usuario_id,acao,alvo_id) VALUES(?,?,?)').run(
        actor || null,
        action,
        id || null,
      );
    },
  };
}
module.exports = { createFinanceRepository };
