const { fail } = require('../shared/errors');
const { str, integer, money } = require('../shared/validation');
function createRegistrationsService(repository) {
  const { get, insert } = repository;
  return {
    create(table, b) {
      if (table === 'clientes') {
        const telefone = str(b.telefone, 'Telefone', 30).replace(/\D/g, '');
        if (!/^\d{10,13}$/.test(telefone)) fail('Telefone deve conter de 10 a 13 dígitos.');
        const email = String(b.email || '').trim();
        if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))
          fail('E-mail inválido.');
        return insert(table, { nome: str(b.nome, 'Nome', 150), telefone, email });
      }
      if (table === 'veiculos') {
        const c = get('clientes', b.cliente_id);
        const placa = str(b.placa, 'Placa', 10)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) fail('Placa inválida.');
        const ano = integer(b.ano, 'Ano', 1900);
        if (ano > new Date().getFullYear() + 1) fail('Ano inválido.');
        return insert(table, {
          cliente_id: c.id,
          placa,
          marca: str(b.marca, 'Marca', 80),
          modelo: str(b.modelo, 'Modelo', 80),
          ano,
        });
      }
      if (table === 'servicos')
        return insert(table, {
          nome: str(b.nome, 'Nome', 150),
          categoria: str(b.categoria, 'Categoria', 80),
          preco: money(b.preco),
        });
      if (table === 'estoque') {
        const tipo = b.tipo || 'peca';
        if (!['peca', 'suprimento'].includes(tipo)) fail('Tipo de estoque inválido.');
        return insert(table, {
          tipo,
          unidade: str(b.unidade || 'un', 'Unidade', 30),
          codigo: str(b.codigo, 'Código', 50),
          nome: str(b.nome, 'Nome', 150),
          quantidade: integer(b.quantidade, 'Quantidade'),
          minimo: integer(b.minimo, 'Mínimo'),
          custo: money(b.custo),
          venda: money(b.venda),
        });
      }

      fail('Cadastro não permitido.', 405);
    },
    setStock(id, b) {
      get('estoque', id);
      return repository.setStock(id, integer(b.quantidade, 'Quantidade'));
    },
  };
}
module.exports = { createRegistrationsService };
