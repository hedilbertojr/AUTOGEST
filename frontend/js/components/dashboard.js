import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/format.js';
import { $ } from '../core/dom.js';
import { pages } from '../config/pages.js';
import { renderTable } from './table.js';
import { isAdmin } from '../core/session.js';
export function renderView(state, page, query) {
  const p = pages[page];
  $('#title').textContent = p[0];
  $('#breadcrumb').textContent = p[0];
  $('#subtitle').textContent = p[1];
  $('#new').hidden = !p[3];
  $('#new').innerHTML = icon('plus') + '<span>' + escapeHtml(p[3] || '') + '</span>';
  $('#page-icon').innerHTML = icon(p[2]);
  const listTitles = {
    clientes: 'Clientes cadastrados',
    veiculos: 'Veículos da oficina',
    servicos: 'Catálogo de serviços',
    estoque: 'Itens do estoque',
    orcamentos: 'Orçamentos recentes',
    ordens: 'Ordens de serviço',
    notas: 'Comprovantes internos',
    notificacoes: 'Histórico de comunicações',
    usuarios: 'Usuários da oficina',
    auditoria: 'Eventos de auditoria',
  };
  $('#list-title').textContent = listTitles[page];
  document.querySelectorAll('[data-page]').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === page);
    b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false');
  });
  const low = state.estoque.filter((i) => i.quantidade <= i.minimo).length;
  const open = state.ordens.filter((o) => !['finalizada', 'entregue'].includes(o.status)).length;
  const metrics = isAdmin()
    ? [
        [state[page].length, 'Registros nesta seção', 'Sua operação organizada'],
        [open, 'Ordens em execução', 'Abertas ou em andamento'],
        [low, 'Itens para reposição', 'Quantidade no mínimo ou abaixo'],
      ]
    : [
        [state.ordens.length, 'Serviços atribuídos', 'Ordens da sua conta'],
        [
          state.ordens.filter((o) => o.status === 'em_andamento').length,
          'Em andamento',
          'Serviços iniciados',
        ],
        [
          state.ordens.filter((o) => o.status === 'finalizada').length,
          'Finalizados',
          'Aguardando entrega pelo dono',
        ],
      ];
  $('#metrics').innerHTML = metrics
    .map(
      ([n, t, d], index) =>
        `<article class="metric metric-${index}"><div class="metric-top"><span>${t}</span><span class="metric-icon">${icon(index === 0 ? p[2] : index === 1 ? 'clipboard-list' : isAdmin() ? 'package-search' : 'circle-check')}</span></div><strong>${n}</strong><small>${d}</small></article>`,
    )
    .join('');
  renderTable(state, page, query);
}
