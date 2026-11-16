import { $ } from '../core/dom.js';
import { escapeHtml, reais, labels, badge } from '../core/format.js';
import { pages } from '../config/pages.js';
const button = (action, id, label) =>
  `<button type="button" data-action="${action}" data-id="${id}">${label}</button>`;
export function renderTable(state, page, query) {
  const rows = state[page].filter((r) =>
    Object.values(r).some((v) => String(v).toLocaleLowerCase('pt-BR').includes(query)),
  );
  const cols = {
    clientes: ['Cliente', 'Telefone', 'E-mail'],
    veiculos: ['Placa', 'Cliente', 'Veículo', 'Ano'],
    servicos: ['Serviço', 'Categoria', 'Preço'],
    estoque: ['Código / peça', 'Disponível', 'Mínimo', 'Custo', 'Venda', 'Ações'],
    orcamentos: ['Orçamento', 'Cliente / placa', 'Total', 'Status', 'Ações'],
    ordens: ['OS', 'Cliente / placa', 'Total', 'Status', 'Ações'],
    notas: ['Número', 'OS', 'Cliente', 'Total', 'Tipo'],
    notificacoes: ['Cliente', 'Mensagem preparada', 'Canal', 'Status', 'Ações'],
  };
  if (!rows.length) {
    $('#content').innerHTML =
      `<div class="empty"><strong>${query ? 'Nenhum resultado encontrado' : 'Tudo pronto para começar'}</strong><p>${query ? 'Tente outro termo de busca.' : pages[page][3] ? 'Use o botão acima para adicionar o primeiro registro.' : 'Os registros aparecerão aqui conforme você avança no atendimento.'}</p></div>`;
    return;
  }
  $('#content').innerHTML =
    '<div class="table-wrap"><table><thead><tr>' +
    cols[page].map((c) => `<th scope="col">${c}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows
      .map((r) => {
        let c;
        const e = escapeHtml;
        if (page === 'clientes') c = [e(r.nome), e(r.telefone), e(r.email || '—')];
        if (page === 'veiculos') c = [e(r.placa), e(r.cliente), e(r.marca + ' ' + r.modelo), r.ano];
        if (page === 'servicos') c = [e(r.nome), badge(r.categoria), reais(r.preco)];
        if (page === 'estoque')
          c = [
            e(r.codigo) + ' · ' + e(r.nome),
            r.quantidade <= r.minimo
              ? `<span class="badge amber">${r.quantidade} · Repor</span>`
              : r.quantidade,
            r.minimo,
            reais(r.custo),
            reais(r.venda),
            button('stock', r.id, 'Ajustar saldo'),
          ];
        if (page === 'orcamentos')
          c = [
            '#' + r.id,
            e(r.cliente) + ' / ' + e(r.placa),
            reais(r.total),
            badge(r.status),
            '<div class="actions">' +
              button('detail', r.id, 'Detalhes') +
              button('whatsapp', r.id, 'WhatsApp') +
              (r.status === 'pendente' ? button('approve', r.id, 'Aprovar') : '') +
              (r.status === 'aprovado' && !state.ordens.some((o) => o.orcamento_id === r.id)
                ? button('order', r.id, 'Gerar OS')
                : '') +
              '</div>',
          ];
        if (page === 'ordens') {
          const next = {
            aberta: 'em_andamento',
            em_andamento: 'finalizada',
            finalizada: 'entregue',
          };
          c = [
            '#' + r.id,
            e(r.cliente) + ' / ' + e(r.placa),
            reais(r.total),
            badge(r.status),
            '<div class="actions">' +
              (next[r.status] ? button('status', r.id, labels[next[r.status]]) : '') +
              button('whatsapp', r.id, 'Notificar') +
              (['finalizada', 'entregue'].includes(r.status) &&
              !state.notas.some((n) => n.ordem_id === r.id)
                ? button('note', r.id, 'Gerar comprovante')
                : '') +
              '</div>',
          ];
        }
        if (page === 'notas')
          c = [
            'REC-' + String(r.id).padStart(5, '0'),
            '#' + r.ordem_id,
            e(r.cliente),
            reais(r.total),
            '<span class="badge">Sem valor fiscal</span>',
          ];
        if (page === 'notificacoes')
          c = [
            e(r.cliente),
            e(r.mensagem),
            'WhatsApp',
            badge(r.status),
            button('reopen', r.id, 'Abrir link'),
          ];
        return (
          '<tr>' +
          c.map((x, i) => `<td${i === 0 ? ' class="primary-cell"' : ''}>${x}</td>`).join('') +
          '</tr>'
        );
      })
      .join('') +
    '</tbody></table></div>';
}
