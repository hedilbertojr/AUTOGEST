export const session = { user: null, csrf: null };
export const isAdmin = () => session.user?.papel === 'admin';
export const resources = () =>
  isAdmin()
    ? [
        'clientes',
        'veiculos',
        'servicos',
        'estoque',
        'orcamentos',
        'ordens',
        'notas',
        'notificacoes',
        'usuarios',
        'auditoria',
      ]
    : ['ordens'];
