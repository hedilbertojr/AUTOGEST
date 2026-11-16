import { $ } from '../core/dom.js';
import { pages } from '../config/pages.js';
import { renderTable } from './table.js';
export function renderView(state, page, query) {
  const p = pages[page];
  $('#title').textContent = p[0];
  $('#breadcrumb').textContent = p[0].toUpperCase();
  $('#subtitle').textContent = p[1];
  $('#new').hidden = !p[3];
  $('#new').textContent = '+ ' + (p[3] || '');
  $('#list-title').textContent = page === 'notas' ? 'Comprovantes internos' : p[0] + ' cadastrados';
  document.querySelectorAll('[data-page]').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === page);
    b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false');
  });
  const low = state.estoque.filter((i) => i.quantidade <= i.minimo).length;
  const open = state.ordens.filter((o) => !['finalizada', 'entregue'].includes(o.status)).length;
  $('#metrics').innerHTML = [
    [state[page].length, 'Registros nesta seção', 'Sua operação organizada'],
    [open, 'Ordens em execução', 'Abertas ou em andamento'],
    [low, 'Itens para reposição', 'Quantidade no mínimo ou abaixo'],
  ]
    .map(
      ([n, t, d]) =>
        `<article class="metric"><span>${t}</span><strong>${n}</strong><small>${d}</small></article>`,
    )
    .join('');
  renderTable(state, page, query);
}
