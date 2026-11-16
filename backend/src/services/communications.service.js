function createCommunicationsService(repository) {
  const { get, insert } = repository;
  return {
    prepareWhatsApp(table, id) {
      const r = get(table, id),
        o = table === 'ordens' ? get('orcamentos', r.orcamento_id) : r,
        c = get('clientes', o.cliente_id);
      let telefone = c.telefone;
      if (telefone.length === 10 || telefone.length === 11) telefone = '55' + telefone;
      const valor = (o.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const mensagem =
        table === 'ordens'
          ? `Olá, ${c.nome}! Sua OS #${r.id} está com status: ${r.status}. AutoGest.`
          : `Olá, ${c.nome}! Orçamento #${o.id}: ${o.diagnostico}. Total: ${valor}. AutoGest.`;
      const link = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
      return insert('notificacoes', {
        cliente_id: c.id,
        canal: 'whatsapp',
        mensagem,
        link,
        status: 'link_gerado',
      });
    },
  };
}
module.exports = { createCommunicationsService };
