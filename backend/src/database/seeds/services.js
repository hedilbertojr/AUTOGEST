const catalogo = {
  Escape: [
    ['Troca de escapamento', 250],
    ['Solda de escapamento', 90],
    ['Troca de silencioso', 180],
    ['Troca de catalisador', 450],
    ['Inspeção do sistema de escape', 60],
  ],
  'Ar-Condicionado': [
    ['Recarga de gás', 220],
    ['Higienização do ar-condicionado', 100],
    ['Troca de filtro de cabine', 60],
    ['Diagnóstico de vazamento', 120],
    ['Manutenção do compressor', 380],
  ],
  'Pneus e Rodas': [
    ['Alinhamento', 100],
    ['Balanceamento', 80],
    ['Rodízio de pneus', 50],
    ['Montagem de pneu', 35],
    ['Reparo de pneu', 40],
    ['Desempeno de roda', 120],
  ],
  Estética: [
    ['Lavagem completa', 80],
    ['Polimento', 350],
    ['Enceramento', 120],
    ['Higienização interna', 280],
    ['Restauração de faróis', 160],
  ],
};

function seedServices(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM servicos').get().n) return;
  const insert = db.prepare('INSERT INTO servicos(nome,categoria,preco) VALUES(?,?,?)');
  for (const [categoria, itens] of Object.entries(catalogo)) {
    for (const [nome, preco] of itens) insert.run(nome, categoria, preco * 100);
  }
}
module.exports = { seedServices, catalogo };
