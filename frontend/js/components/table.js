import { isAdmin } from '../core/session.js';
import { isDemo } from '../core/mode.js';
import { usersTable } from '../features/users.js';
import { $ } from '../core/dom.js';
import { escapeHtml, reais, labels, badge } from '../core/format.js';
import { pages } from '../config/pages.js';
const button = (action, id, label) =>
  `<button type="button" data-action="${action}" data-id="${id}">${label}</button>`;
export function renderTable(state, page, query) {
  const rows = state[page].filter((r) =>
    Object.values(r).some((v) => String(v).toLocaleLowerCase('pt-BR').includes(query)),
  );
  if (page === 'usuarios') {
    $('#content').innerHTML = usersTable(rows);
    return;
  }
  if (page === 'auditoria') {
    $('#content').innerHTML = rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>Data (UTC)</th><th>Usuário</th><th>Evento</th><th>Registro</th></tr></thead><tbody>' +
        rows
          .map(
            (r) =>
              '<tr><td>' +
              escapeHtml(r.criado_em) +
              '</td><td>' +
              escapeHtml(r.usuario || 'Acesso não identificado') +
              '</td><td>' +
              escapeHtml(r.acao) +
              '</td><td>' +
              escapeHtml(r.alvo_id || '—') +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table></div>'
      : '<div class="empty">Nenhum evento registrado.</div>';
    return;
  }
  if (!isAdmin() && page === 'ordens') {
    $('#content').innerHTML = rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>OS</th><th>Veículo</th><th>Trabalho</th><th>Status</th><th>Ações</th></tr></thead><tbody>' +
        rows
          .map(
            (r) =>
              '<tr><td>#' +
              r.id +
              '</td><td>' +
              escapeHtml([r.placa, r.marca, r.modelo].filter(Boolean).join(' · ')) +
              '</td><td>' +
              escapeHtml(r.diagnostico) +
              '<ul>' +
              (r.itens || [])
                .map((i) => '<li>' + i.quantidade + ' × ' + escapeHtml(i.nome) + '</li>')
                .join('') +
              '</ul></td><td>' +
              badge(r.status) +
              '</td><td>' +
              (['aberta', 'em_andamento'].includes(r.status)
                ? button(
                    'status',
                    r.id,
                    r.status === 'aberta' ? 'Iniciar serviço' : 'Finalizar serviço',
                  )
                : 'Aguardando o dono') +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table></div>'
      : '<div class="empty"><strong>Nenhum serviço atribuído</strong><p>O dono atribui suas ordens na seção Ordens de serviço.</p></div>';
    return;
  }
  const cols = {
    clientes: ['Cliente', 'Telefone', 'E-mail'],
    veiculos: ['Placa', 'Cliente', 'Veículo', 'Ano'],
    servicos: ['Serviço', 'Categoria', 'Preço'],
    estoque: [
      'Código / item',
      'Tipo',
      'Unidade',
      'Disponível',
      'Mínimo',
      'Custo',
      'Venda',
      'Ações',
    ],
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
    '<div class="table-wrap"><table' +
    (page === 'estoque' ? ' class="stock-table"' : '') +
    '><thead><tr>' +
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
            badge(r.tipo === 'suprimento' ? 'Suprimento' : 'Peça'),
            e(r.unidade || 'un'),
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
              (!isDemo ? button('assign', r.id, 'Atribuir mecânico') : '') +
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
