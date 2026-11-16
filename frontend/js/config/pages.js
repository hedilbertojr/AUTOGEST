export const pages = {
  clientes: [
    'Clientes',
    'Relacionamentos bem cuidados, desde o primeiro atendimento.',
    'users-round',
    'Novo cliente',
  ],
  veiculos: [
    'Veículos',
    'Histórico e identificação dos veículos da sua oficina.',
    'car-front',
    'Novo veículo',
  ],
  orcamentos: [
    'Orçamentos',
    'Transforme diagnósticos em propostas claras para o cliente.',
    'file-text',
    'Novo orçamento',
  ],
  ordens: [
    'Ordens de serviço',
    'Do início à entrega: cada serviço no seu lugar.',
    'clipboard-list',
  ],
  servicos: [
    'Serviços',
    'Um catálogo organizado para valorizar sua mão de obra.',
    'wrench',
    'Novo serviço',
  ],
  estoque: [
    'Estoque',
    'Peças e suprimentos disponíveis para o próximo atendimento.',
    'boxes',
    'Adicionar item',
  ],
  notas: ['Comprovantes', 'Consulte os registros dos serviços realizados.', 'receipt-text'],
  notificacoes: [
    'Comunicações',
    'Acompanhe as mensagens preparadas para seus clientes.',
    'messages-square',
  ],
  usuarios: [
    'Usuários',
    'Gerencie os acessos do dono e da equipe.',
    'shield-check',
    'Novo usuário',
  ],
  auditoria: ['Auditoria', 'Consulte os últimos eventos de acesso e administração.', 'history'],
};
export const navigationGroups = [
  { label: 'Atendimento', pages: ['clientes', 'veiculos', 'orcamentos', 'ordens'] },
  { label: 'Oficina', pages: ['servicos', 'estoque', 'notas', 'notificacoes'] },
  { label: 'Administração', pages: ['usuarios', 'auditoria'] },
];
