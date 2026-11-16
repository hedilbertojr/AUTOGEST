const { exampleStock, exampleServices } = require('./example-catalog');
const { transaction } = require('../connection');
function seedExamples(db) {
  return transaction(db, () => {
    let stock = 0,
      services = 0;
    const item = db.prepare(
      'INSERT INTO estoque(codigo,nome,tipo,unidade,quantidade,minimo,custo,venda) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(codigo) DO NOTHING',
    );
    const service = db.prepare(
      'INSERT INTO servicos(nome,categoria,preco) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM servicos WHERE nome=? COLLATE NOCASE)',
    );
    for (const r of exampleStock)
      stock += Number(
        item.run(r.codigo, r.nome, r.tipo, r.unidade, r.quantidade, r.minimo, r.custo, r.venda)
          .changes,
      );
    for (const r of exampleServices)
      services += Number(service.run(r.nome, r.categoria, r.preco, r.nome).changes);
    return { stock, services };
  });
}
module.exports = { seedExamples };
