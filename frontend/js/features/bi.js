import { api } from '../core/api.js';
import { escapeHtml as esc, reais } from '../core/format.js';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
let filters = { inicio: today().slice(0, 8) + '01', fim: today(), mecanico_id: '' },
  tab = 'overview',
  report,
  host,
  sequence = 0,
  normalHandler;
const tabs = {
  overview: 'Visão geral',
  cash: 'Caixa e contas',
  team: 'Equipe e serviços',
  stock: 'Consumos e estoque',
  sales: 'Vendas e clientes',
};
const number = (n) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n ?? 0);
const date = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
const money = (n) => reais(n ?? 0);
const button = (label, action, id = '', secondary = true) =>
  `<button type="button" class="${secondary ? 'secondary' : ''}" data-bi="${action}" data-id="${id}">${esc(label)}</button>`;
const card = (label, value, detail = '') =>
  `<article class="bi-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
const box = (title, content, subtitle = '') =>
  `<section class="bi-box"><h2>${esc(title)}</h2>${subtitle ? `<p class="note">${esc(subtitle)}</p>` : ''}${content}</section>`;
function table(headers, rows) {
  return rows.length
    ? `<div class="bi-table"><table><thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '<p class="bi-empty">Nenhum registro para este recorte.</p>';
}
function chart(rows, keys, labels) {
  if (!rows.length) return '<p class="bi-empty">Sem dados.</p>';
  const width = 700,
    height = 210,
    pad = 35,
    max = Math.max(1, ...rows.flatMap((r) => keys.map((k) => r[k]))),
    min = Math.min(0, ...rows.flatMap((r) => keys.map((k) => r[k])));
  const points = (k) =>
    rows
      .map(
        (r, i) =>
          `${pad + (i * (width - 2 * pad)) / Math.max(1, rows.length - 1)},${height - pad - ((r[k] - min) / (max - min)) * (height - 2 * pad)}`,
      )
      .join(' ');
  return `<div class="bi-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(labels.join(' e '))}"><line x1="35" y1="${height - pad - ((0 - min) / (max - min)) * (height - 2 * pad)}" x2="665" y2="${height - pad - ((0 - min) / (max - min)) * (height - 2 * pad)}" class="bi-axis"/>${keys.map((k, i) => `<polyline points="${points(k)}" class="bi-line bi-line-${i}"/>`).join('')}<text x="35" y="205">${esc(date(rows[0].periodo))}</text><text x="665" y="205" text-anchor="end">${esc(date(rows.at(-1).periodo))}</text><text x="35" y="20">Máx. ${esc(money(max))}${min < 0 ? ' · Mín. ' + esc(money(min)) : ''}</text></svg><div class="bi-legend">${labels.map((l, i) => `<span class="bi-key-${i}">● ${esc(l)}</span>`).join('')}</div></div>`;
}
export function leaveBI() {
  sequence++;
  if (host && normalHandler) host.onclick = normalHandler;
}
export async function mountBI(element) {
  normalHandler ??= element.onclick;
  host = element;
  const token = ++sequence;
  host.innerHTML = '<p class="bi-empty" role="status">Preparando indicadores…</p>';
  try {
    const result = await api('bi?' + new URLSearchParams(filters));
    if (token !== sequence || !host.isConnected) return;
    report = result;
    render();
  } catch (e) {
    if (token === sequence) host.innerHTML = `<p role="alert">${esc(e.message)}</p>`;
  }
}
function render() {
  const r = report,
    k = r.kpis,
    c = r.caixa,
    partial = k.custos_pendentes
      ? 'Custos incompletos · resultado parcial'
      : 'Custos diretos cadastrados';
  host.innerHTML = `<div class="bi-top"><div><span class="bi-eyebrow">INTELIGÊNCIA DO NEGÓCIO</span><h2>Sua oficina em números</h2><p>Competência, caixa e produtividade em uma visão integrada.</p></div><div class="bi-actions">${button('Exportar CSV', 'export')}${button('Imprimir relatório', 'print')}${button('Novo lançamento', 'new', '', false)}</div></div>
 <form id="bi-filters" class="bi-filters"><label>De<input type="date" name="inicio" required value="${filters.inicio}"></label><label>Até<input type="date" name="fim" required value="${filters.fim}"></label><label>Mecânico<select name="mecanico_id"><option value="">Toda a equipe</option>${r.opcoes_mecanicos.map((u) => `<option value="${u.id}" ${String(u.id) === filters.mecanico_id ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></label><button>Aplicar filtros</button><div class="bi-presets">${button('Este mês', 'month')}${button('Últimos 30 dias', '30')}${button('Mês anterior', 'previous')}</div></form>
 <p class="note">${date(r.periodo.inicio)} a ${date(r.periodo.fim)} · Comparação: ${date(r.periodo.anterior_inicio)} a ${date(r.periodo.anterior_fim)} · Contas e estoque: posição atual em ${date(r.periodo.hoje)} · Horário de Brasília</p>
 ${r.avisos.map((w) => `<p class="bi-warning">${esc(w)}</p>`).join('')}
 <nav class="bi-tabs" aria-label="Relatórios">${Object.entries(tabs)
   .map(
     ([key, label]) =>
       `<button type="button" data-bi="tab" data-id="${key}" aria-current="${tab === key ? 'page' : 'false'}" class="${tab === key ? 'selected' : ''}">${label}</button>`,
   )
   .join('')}</nav>
 <div id="bi-report">${tab === 'overview' ? overview(r, k, c, partial) : tab === 'cash' ? cash(r, c) : tab === 'team' ? team(r) : tab === 'stock' ? stock(r) : sales(r)}</div>
 <details class="bi-method"><summary>Como interpretar os indicadores</summary><p>Faturamento reconhece OS finalizadas pela data de conclusão. Orçamentos e OS abertas não são receita realizada. Caixa considera exclusivamente baixas e estornos registrados; saldo inicial deve ser lançado como aporte, sem compor lucro. O saldo representa o controle registrado, sem conciliação bancária.</p><p>Resultado estimado = faturamento − custos diretos históricos + outras receitas − despesas operacionais por competência. Compra de estoque afeta caixa, e o material entra no resultado quando a OS é concluída. Retiradas e aportes não compõem resultado. Cadastre impostos, taxas e despesas para incluí-los; evite lançar um mesmo custo direto também como despesa geral.</p><p>Custos são congelados ao gerar a OS. Valores desconhecidos permanecem sinalizados e podem ser complementados, sem sobrescrever custos históricos conhecidos. Ajustes físicos de estoque não geram pagamentos. Consumo mostra materiais baixados ao abrir a OS, inclusive serviços ainda em execução. O tempo de execução é tempo corrido entre início e conclusão, e não horas faturáveis. Este painel gerencial não substitui escrituração fiscal.</p></details>`;
  host.querySelector('#bi-filters').onsubmit = (e) => {
    e.preventDefault();
    filters = Object.fromEntries(new FormData(e.target));
    mountBI(host);
  };
  if (tab === 'cash') setupAccountFilters();
  host.onclick = async (e) => {
    const b = e.target.closest('[data-bi]');
    if (!b) return;
    try {
      await action(b.dataset.bi, b.dataset.id);
    } catch (error) {
      window.alert(error.message);
    }
  };
}
function overview(r, k, c, partial) {
  return `<div class="bi-kpis">${card('Faturamento concluído', money(k.receita), r.comparativo.variacao_receita == null ? 'Sem base anterior' : number(r.comparativo.variacao_receita) + '% sobre período anterior')}${card(k.resultado_tipo === 'contribuicao' ? 'Contribuição da equipe' : 'Resultado operacional estimado', money(k.resultado_estimado), partial)}${card('Recebimentos no período', money(c.entradas), 'Baixas recebidas, líquidas de estornos')}${card('Geração de caixa', money(c.geracao), 'Entradas menos saídas realizadas')}${card('OS concluídas', number(k.concluidas), 'Ticket médio ' + money(k.ticket_medio))}${card('Margem bruta conhecida', k.margem_percentual == null ? '—' : number(k.margem_percentual) + '%', partial)}${card('A receber hoje', money(c.a_receber), 'Em atraso: ' + money(c.receber_atrasado))}${card('A pagar hoje', money(c.a_pagar), 'Em atraso: ' + money(c.pagar_atrasado))}</div>
 <div class="bi-grid">${box('Evolução do faturamento', chart(r.serie, ['receita', 'custos'], ['Faturamento', 'Custos diretos conhecidos']))}${box('Entradas e saídas', chart(r.serie, ['entradas', 'saidas'], ['Recebimentos', 'Pagamentos']))}</div>
 <div class="bi-grid">${box(
   'Demonstrativo gerencial',
   table(
     ['Composição', 'Valor'],
     [
       ['Mão de obra', money(k.receita_servicos)],
       ['Peças e suprimentos cobrados', money(k.receita_pecas + k.receita_suprimentos)],
       ['(−) Custos diretos históricos', money(k.custos_diretos)],
       ['(=) Margem bruta conhecida', money(k.margem_bruta)],
       ['(+) Outras receitas', money(k.outras_receitas)],
       ['(−) Despesas operacionais', money(k.despesas_operacionais)],
       [
         'Resultado operacional da oficina',
         r.periodo.mecanico_id ? 'Sem rateio por mecânico' : money(k.resultado_estimado),
       ],
     ],
   ),
   'Valores por competência. ' + partial,
 )}${box(
   'Despesas por categoria',
   table(
     ['Categoria', 'Valor'],
     r.despesas.map((d) => [esc(d.categoria), money(d.valor)]),
   ),
 )}</div>
 ${box(
   'Projeção de caixa · próximos 30 dias',
   table(
     ['Vencimentos', 'Entradas previstas', 'Saídas previstas', 'Saldo projetado'],
     r.previsao.map((p) => [
       date(p.inicio) + ' — ' + date(p.fim),
       money(p.entradas),
       money(p.saidas),
       money(p.saldo),
     ]),
   ),
   'Parte do saldo atual registrado de ' +
     money(c.saldo_atual) +
     '. Não inclui títulos já vencidos e não garante recebimento.',
 )}`;
}
function cash(r, c) {
  return `<div class="bi-kpis">${card('Saldo inicial do período', money(c.saldo_inicial))}${card('Entradas realizadas', money(c.entradas))}${card('Saídas realizadas', money(c.saidas))}${card('Saldo final do período', money(c.saldo_final))}</div>
 ${box(
   'Contas a pagar e receber',
   `<div class="bi-account-filters"><label>Buscar<input id="bi-account-search" placeholder="Descrição ou categoria"></label><label>Situação<select id="bi-account-status"><option value="">Todas</option>${['aberto', 'parcial', 'atrasado', 'liquidado', 'cancelado'].map((s) => `<option>${s}</option>`).join('')}</select></label><label>Direção<select id="bi-account-type"><option value="">Todas</option><option value="receber">A receber</option><option value="pagar">A pagar</option></select></label></div>` +
     table(
       [
         'Lançamento',
         'Tipo / categoria',
         'Vencimento',
         'Valor',
         'Liquidado',
         'Em aberto',
         'Situação',
         'Ações',
       ],
       r.contas.map((t) => [
         `<strong>${esc(t.descricao)}</strong><small>Competência ${date(t.competencia)}</small>`,
         esc(t.tipo) + '<small>' + esc(t.categoria) + '</small>',
         date(t.vencimento),
         money(t.valor),
         money(t.pago),
         money(t.aberto),
         esc(t.status),
         t.cancelado
           ? '—'
           : button(t.tipo === 'receber' ? 'Receber' : 'Pagar', 'settle', t.id) +
             button('Editar', 'edit', t.id) +
             (!t.ordem_id && !t.pago ? button('Cancelar', 'cancel', t.id) : ''),
       ]),
     ),
   'Posição atual de todos os títulos, independente do período selecionado.',
 )}
 ${
   r.ordens_sem_conta?.length
     ? box(
         'OS antigas sem conta financeira',
         table(
           ['OS', 'Valor', 'Ação'],
           r.ordens_sem_conta.map((o) => [
             '#' + o.id,
             money(o.total),
             button('Criar conta da OS', 'order', o.id),
           ]),
         ),
         'Confira o histórico de recebimentos antes de registrar baixas.',
       )
     : ''
 }
 ${box(
   'Movimentações do período',
   table(
     ['Data', 'Lançamento', 'Tipo', 'Meio', 'Efeito no caixa', 'Ações'],
     r.movimentos.map((m) => [
       date(m.data),
       esc(m.descricao),
       esc(m.tipo),
       esc(m.meio),
       money(m.efeito_caixa),
       m.tipo === 'baixa' ? button('Estornar', 'reverse', m.id) : esc(m.observacao),
     ]),
   ),
   'Estornos preservam o lançamento original e afetam o caixa na data informada.',
 )}`;
}
function team(r) {
  return (
    box(
      'Produtividade por mecânico',
      table(
        [
          'Mecânico',
          'Concluídas',
          'Abertas / execução',
          'Serviços',
          'Faturamento',
          'Contribuição conhecida',
          'Ticket',
          'Tempo corrido médio',
        ],
        r.mecanicos.map((m) => [
          esc(m.nome),
          number(m.concluidas),
          `${m.abertas} / ${m.em_andamento}`,
          number(m.servicos),
          money(m.receita),
          money(m.margem) + (m.custos_pendentes ? '<small>Custos incompletos</small>' : ''),
          money(m.ticket),
          m.horas_medias == null ? '—' : number(m.horas_medias) + ' h',
        ]),
      ),
      'Concluídas no período. Abertas e em execução: posição atual. A contribuição não desconta despesas gerais.',
    ) +
    box(
      'Serviços mais vendidos',
      table(
        ['Serviço', 'Quantidade', 'Receita', 'Custo conhecido', 'Contribuição'],
        r.servicos.map((s) => [
          esc(s.nome),
          number(s.quantidade),
          money(s.receita),
          money(s.custo),
          money(s.margem) + (s.custos_pendentes ? ' *' : ''),
        ]),
      ),
      '* Serviço com custo incompleto.',
    ) +
    box(
      'Configuração de custos',
      button('Cadastrar custo de serviço', 'cost'),
      'Informe o custo direto para as próximas OS. Não altera custos históricos.',
    )
  );
}
function stock(r) {
  return (
    `<div class="bi-kpis">${card('Valor do estoque a custo', money(r.estoque.custo_total), 'Posição física atual')}${card('Consumo no período', money(r.estoque.consumo_custo), 'Materiais baixados para OS')}${card('Itens para reposição', number(r.estoque.baixo.length), 'Saldo no mínimo ou abaixo')}${card('Potencial de venda', money(r.estoque.venda_potencial), 'Simulação do saldo × preço, não é receita')}</div>` +
    box(
      'Peças e suprimentos consumidos',
      table(
        ['Item', 'Tipo', 'Quantidade / unidade', 'Custo histórico'],
        r.consumos.map((i) => [
          esc(i.nome),
          esc(i.tipo),
          number(i.quantidade) + ' ' + esc(i.unidade),
          money(i.custo),
        ]),
      ),
      'Quantidades não são somadas entre unidades diferentes.',
    ) +
    box(
      'Reposição prioritária',
      table(
        ['Código', 'Item', 'Saldo', 'Mínimo', 'Unidade'],
        r.estoque.baixo.map((i) => [
          esc(i.codigo),
          esc(i.nome),
          number(i.quantidade),
          number(i.minimo),
          esc(i.unidade),
        ]),
      ),
    )
  );
}
function sales(r) {
  return (
    `<div class="bi-kpis">${card('Orçamentos criados', number(r.funil.orcamentos), 'Criados no período selecionado')}${card('Aprovação', r.funil.taxa_aprovacao == null ? '—' : number(r.funil.taxa_aprovacao) + '%', 'Situação atual dos orçamentos do período')}${card('Convertidos em OS', number(r.funil.convertidos))}${card('Valor orçado', money(r.funil.valor_orcado), 'Não equivale a faturamento ou caixa')}</div>` +
    box(
      'Vendas concluídas',
      table(
        ['OS', 'Conclusão', 'Cliente', 'Mecânico', 'Receita', 'Custo conhecido', 'Ações'],
        r.vendas.map((v) => [
          '#' + v.id,
          date(v.data),
          esc(v.cliente),
          esc(v.mecanico),
          money(v.total),
          money(v.custo) + (v.custos_pendentes ? ' *' : ''),
          button('Conta da OS', 'order', v.id) +
            (v.custos_pendentes ? button('Completar custos', 'regularize', v.id) : ''),
        ]),
      ),
    ) +
    box(
      'Clientes por faturamento',
      table(
        ['Cliente', 'OS', 'Faturamento'],
        r.clientes.map((c) => [esc(c.nome), number(c.ordens), money(c.receita)]),
      ),
    ) +
    box(
      'Histórico a regularizar',
      table(
        ['OS', 'Status', 'Valor', 'Ação'],
        r.legado.map((o) => [
          '#' + o.id,
          esc(o.status),
          money(o.total),
          button('Informar conclusão e custos', 'regularize', o.id),
        ]),
      ),
      'OS antigas sem data não são incluídas no faturamento por período.',
    )
  );
}
function field(name, label, type = 'text', value = '', extra = '') {
  return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(String(value))}" ${extra} required></label>`;
}
function modal(title, html, save) {
  document.querySelector('#bi-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'bi-dialog';
  dialog.innerHTML = `<form class="bi-form"><h2>${esc(title)}</h2>${html}<p class="error" role="alert"></p><div class="bi-actions"><button type="button" data-close class="secondary">Cancelar</button><button type="submit">Salvar</button></div></form>`;
  document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.onclose = () => dialog.remove();
  dialog.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const submit = dialog.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await save(Object.fromEntries(new FormData(e.target)));
      dialog.close();
      await mountBI(host);
    } catch (error) {
      dialog.querySelector('.error').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
  dialog.showModal();
}
async function action(name, id) {
  if (name === 'tab') {
    tab = id;
    render();
    if (tab === 'cash') setupAccountFilters();
    return;
  }
  if (name === 'print') {
    window.print();
    return;
  }
  if (name === 'export') {
    exportCSV();
    return;
  }
  if (['month', '30', 'previous'].includes(name)) {
    const end = today(),
      d = new Date(end + 'T12:00:00Z');
    if (name === '30') {
      d.setUTCDate(d.getUTCDate() - 29);
      filters.inicio = d.toISOString().slice(0, 10);
      filters.fim = end;
    } else if (name === 'previous') {
      d.setUTCDate(0);
      filters.fim = d.toISOString().slice(0, 10);
      filters.inicio = filters.fim.slice(0, 8) + '01';
    } else {
      filters.inicio = end.slice(0, 8) + '01';
      filters.fim = end;
    }
    return mountBI(host);
  }
  if (name === 'new') {
    modal(
      'Novo lançamento financeiro',
      `<label>Natureza<select name="natureza"><option value="despesa_operacional">Despesa operacional (resultado e contas)</option><option value="compra_estoque">Compra de estoque (contas)</option><option value="outra_receita">Outra receita</option><option value="aporte">Aporte / saldo inicial (fora do lucro)</option><option value="retirada">Retirada (fora do lucro)</option></select></label>` +
        field('descricao', 'Descrição', 'text', '', 'maxlength="180"') +
        field('categoria', 'Categoria', 'text', '', 'maxlength="80"') +
        field('valor', 'Valor (R$)', 'number', '', 'min="0.01" step="0.01"') +
        field('competencia', 'Competência', 'date', today()) +
        field('vencimento', 'Vencimento', 'date', today()) +
        '<p class="note">Criar uma conta não movimenta o caixa. Registre a baixa quando houver recebimento ou pagamento.</p>',
      (b) => api('financeiro/titulos', 'POST', b),
    );
    return;
  }
  if (name === 'order') {
    const t = await api(`financeiro/ordens/${id}/conta`, 'POST', {});
    await mountBI(host);
    return action('settle', String(t.id));
  }
  const title = report.contas.find((t) => t.id === Number(id));
  if (name === 'settle') {
    if (!title.aberto) {
      window.alert('Esta conta já está liquidada.');
      return;
    }
    modal(
      (title.tipo === 'receber' ? 'Receber · ' : 'Pagar · ') + title.descricao,
      field(
        'valor',
        'Valor da baixa (R$)',
        'number',
        (title.aberto / 100).toFixed(2),
        `min="0.01" max="${title.aberto / 100}" step="0.01"`,
      ) +
        field('data', 'Data realizada', 'date', today(), `max="${today()}"`) +
        `<label>Meio<select name="meio">${['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'outro'].map((m) => `<option>${m}</option>`).join('')}</select></label><label>Observação<textarea name="observacao" maxlength="500"></textarea></label><p class="note">Apenas registra uma movimentação já realizada. Não executa transferência bancária.</p>`,
      (b) => api(`financeiro/titulos/${id}/baixas`, 'POST', b),
    );
    return;
  }
  if (name === 'edit') {
    modal(
      'Editar · ' + title.descricao,
      field('descricao', 'Descrição', 'text', title.descricao) +
        field('categoria', 'Categoria', 'text', title.categoria) +
        field('vencimento', 'Vencimento', 'date', title.vencimento) +
        (!title.ordem_id
          ? field(
              'valor',
              'Valor total (R$)',
              'number',
              title.valor / 100,
              'min="0.01" step="0.01"',
            )
          : ''),
      (b) => api(`financeiro/titulos/${id}`, 'PATCH', b),
    );
    return;
  }
  if (name === 'cancel') {
    if (window.confirm('Cancelar este lançamento sem baixa? O histórico será preservado.')) {
      await api(`financeiro/titulos/${id}/cancelar`, 'POST', {});
      await mountBI(host);
    }
    return;
  }
  if (name === 'reverse') {
    modal(
      'Estornar baixa',
      field('data', 'Data do estorno', 'date', today(), `max="${today()}"`) +
        field('observacao', 'Motivo', 'text', '', 'minlength="5" maxlength="500"'),
      (b) => api(`financeiro/movimentos/${id}/estornar`, 'POST', b),
    );
    return;
  }
  if (name === 'cost') {
    const services = await api('servicos');
    modal(
      'Custo direto para futuras OS',
      `<label>Serviço<select name="id">${services.map((s) => `<option value="${s.id}">${esc(s.nome)} · ${s.custo == null ? 'sem custo' : money(s.custo)}</option>`).join('')}</select></label>` +
        field('custo', 'Custo direto unitário (R$)', 'number', '', 'min="0" step="0.01"'),
      (b) => api(`financeiro/servicos/${b.id}/custo`, 'PATCH', { custo: b.custo }),
    );
    return;
  }
  if (name === 'regularize') {
    const order = await api('financeiro/ordens/' + id);
    const missing = order.itens.filter((i) => i.custo_unitario == null);
    modal(
      'Regularizar OS #' + id,
      (!order.finalizada_em
        ? field('data_conclusao', 'Data real de conclusão', 'date', '', `max="${today()}"`) +
          `<label>Mecânico responsável<select name="mecanico_id"><option value="">Não informado</option>${report.opcoes_mecanicos.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select></label>`
        : '') +
        missing
          .map((i) =>
            field(
              'cost_' + i.id,
              'Custo unitário · ' + i.nome,
              'number',
              '',
              'min="0" step="0.01"',
            ),
          )
          .join('') +
        '<p class="note">Informe os valores históricos reais. Custo zero significa ausência de custo, não valor desconhecido.</p>',
      (b) =>
        api(`financeiro/ordens/${id}/regularizar`, 'POST', {
          ...b,
          custos: missing.map((i) => ({ item_id: i.id, custo: b['cost_' + i.id] })),
        }),
    );
  }
}
function setupAccountFilters() {
  const inputs = ['#bi-account-search', '#bi-account-status', '#bi-account-type'].map((s) =>
    host.querySelector(s),
  );
  for (const input of inputs)
    input.oninput = () => {
      const [search, status, type] = inputs.map((i) => i.value.toLowerCase());
      host.querySelectorAll('.bi-account-filters + .bi-table tbody tr').forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.hidden = !(
          text.includes(search) &&
          (!status || row.cells[6].textContent === status) &&
          (!type || row.cells[1].textContent.startsWith(type))
        );
      });
    };
}
function exportCSV() {
  const rows = [
    ['AutoGest — relatório gerencial'],
    ['Inicio', filters.inicio, 'Fim', filters.fim, 'Mecanico', filters.mecanico_id || 'todos'],
    ['Exportado em', new Date().toISOString()],
    ['Aba', tabs[tab]],
    [],
  ];
  host.querySelectorAll('#bi-report .bi-box').forEach((section) => {
    rows.push([section.querySelector('h2').textContent]);
    const actionIndex = [...section.querySelectorAll('thead th')].findIndex(
      (c) => c.textContent === 'Ações',
    );
    section
      .querySelectorAll('tr')
      .forEach((tr) =>
        rows.push(
          [...tr.cells].filter((c, index) => index !== actionIndex).map((c) => c.innerText),
        ),
      );
    rows.push([]);
  });
  if (tab === 'overview')
    rows.push(
      ['Faturamento', report.kpis.receita / 100],
      ['Resultado estimado', report.kpis.resultado_estimado / 100],
      ['Linhas sem custo', report.kpis.custos_pendentes],
    );
  if (tab === 'overview' || tab === 'cash')
    rows.push(
      [],
      ['Evolução (valores em R$)'],
      ['Data', 'Receita', 'Custos diretos conhecidos', 'Entradas', 'Saídas'],
      ...report.serie.map((s) => [
        s.periodo,
        s.receita / 100,
        s.custos / 100,
        s.entradas / 100,
        s.saidas / 100,
      ]),
    );
  rows.push([], ['Observações'], ...report.avisos.map((a) => [a]), [
    'Caixa, contas e estoque são da oficina inteira; contas e estoque mostram posição atual.',
  ]);
  const safe = (v) => {
    let s = String(v ?? '');
    if (/^[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(safe).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `autogest-${tab}-${filters.inicio}-${filters.fim}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
