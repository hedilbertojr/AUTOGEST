const { filters, businessDate, addDays } = require('./dates');
const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);
const inRange = (day, start, end) => Boolean(day && day >= start && day <= end);
const divide = (n, d) => (d ? Math.round((n / d) * 100) / 100 : null);
const rate = (n, d) => (d ? Math.round((n / d) * 10000) / 100 : null);
const dayOf = (value) => (value ? businessDate(value) : null);
const signed = (movement) => (movement.tipo === 'estorno' ? -movement.valor : movement.valor);
const mechanicOf = (order) =>
  order.finalizada_em ? order.mecanico_conclusao_id : order.operador_id;

function report(snapshot, input = {}) {
  const f = filters(input);
  const orders = snapshot.ordens || [],
    quotes = snapshot.orcamentos || [],
    items = snapshot.itens || [],
    stock = snapshot.estoque || [],
    titles = snapshot.financeiro_titulos || [],
    movements = snapshot.financeiro_movimentos || [],
    stockMoves = snapshot.estoque_movimentos || [],
    users = snapshot.usuarios || [];
  const quoteById = new Map(quotes.map((r) => [r.id, r]));
  const stockById = new Map(stock.map((r) => [r.id, r]));
  const userById = new Map(users.map((r) => [r.id, r]));
  const orderById = new Map(orders.map((r) => [r.id, r]));
  const titleById = new Map(titles.map((r) => [r.id, r]));
  const itemsByQuote = new Map();
  for (const item of items) {
    if (!itemsByQuote.has(item.orcamento_id)) itemsByQuote.set(item.orcamento_id, []);
    itemsByQuote.get(item.orcamento_id).push(item);
  }
  const eligible = (order) => !f.mecanico_id || mechanicOf(order) === f.mecanico_id;
  const completed = (start, end) =>
    orders.filter(
      (o) =>
        ['finalizada', 'entregue'].includes(o.status) &&
        eligible(o) &&
        inRange(dayOf(o.finalizada_em), start, end),
    );
  function totals(list, start, end) {
    let receita = 0,
      servicos = 0,
      pecas = 0,
      suprimentos = 0,
      custos = 0,
      custos_pendentes = 0,
      linhas = 0;
    for (const order of list) {
      receita += quoteById.get(order.orcamento_id)?.total || 0;
      for (const item of itemsByQuote.get(order.orcamento_id) || []) {
        const value = item.preco * item.quantidade;
        if (item.tipo === 'servico') servicos += value;
        else if (item.tipo === 'suprimento') suprimentos += value;
        else pecas += value;
        linhas++;
        if (item.custo_unitario == null) custos_pendentes++;
        else custos += item.custo_unitario * item.quantidade;
      }
    }
    const expenses = sum(
      titles.filter(
        (t) =>
          !t.cancelado &&
          t.natureza === 'despesa_operacional' &&
          inRange(t.competencia, start, end),
      ),
      (t) => t.valor,
    );
    const other = sum(
      titles.filter(
        (t) => !t.cancelado && t.natureza === 'outra_receita' && inRange(t.competencia, start, end),
      ),
      (t) => t.valor,
    );
    const margem = receita - custos;
    return {
      receita,
      receita_servicos: servicos,
      receita_pecas: pecas,
      receita_suprimentos: suprimentos,
      custos_diretos: custos,
      custos_pendentes,
      linhas_custo: linhas,
      cobertura_custos: linhas ? rate(linhas - custos_pendentes, linhas) : null,
      margem_bruta: margem,
      margem_percentual: rate(margem, receita),
      despesas_operacionais: expenses,
      outras_receitas: other,
      resultado_estimado: f.mecanico_id ? margem : margem + other - expenses,
      resultado_tipo: f.mecanico_id ? 'contribuicao' : 'operacional',
      concluidas: list.length,
      ticket_medio: list.length ? Math.round(receita / list.length) : 0,
    };
  }
  const currentOrders = completed(f.inicio, f.fim),
    previousOrders = completed(f.anterior_inicio, f.anterior_fim);
  const kpis = totals(currentOrders, f.inicio, f.fim),
    previous = totals(previousOrders, f.anterior_inicio, f.anterior_fim);
  const cashRows = movements.filter((m) => titleById.has(m.titulo_id));
  const effect = (m) => signed(m) * (titleById.get(m.titulo_id).tipo === 'receber' ? 1 : -1);
  const cashPeriod = cashRows.filter((m) => inRange(m.data, f.inicio, f.fim));
  const opening = sum(
    cashRows.filter((m) => m.data < f.inicio),
    effect,
  );
  const inflow = sum(
    cashPeriod.filter((m) => titleById.get(m.titulo_id).tipo === 'receber'),
    signed,
  );
  const outflow = sum(
    cashPeriod.filter((m) => titleById.get(m.titulo_id).tipo === 'pagar'),
    signed,
  );
  const balanceNow = sum(
    cashRows.filter((m) => m.data <= f.hoje),
    effect,
  );
  const paidByTitle = new Map();
  for (const m of cashRows.filter((m) => m.data <= f.hoje))
    paidByTitle.set(m.titulo_id, (paidByTitle.get(m.titulo_id) || 0) + signed(m));
  const accounts = titles
    .map((t) => {
      const pago = paidByTitle.get(t.id) || 0,
        aberto = t.cancelado ? 0 : Math.max(0, t.valor - pago);
      return {
        ...t,
        pago,
        aberto,
        status: t.cancelado
          ? 'cancelado'
          : aberto === 0
            ? 'liquidado'
            : t.vencimento < f.hoje
              ? 'atrasado'
              : pago
                ? 'parcial'
                : 'aberto',
      };
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.id - a.id);
  const pending = accounts.filter((t) => !t.cancelado && t.aberto > 0);
  const cash = {
    saldo_inicial: opening,
    entradas: inflow,
    saidas: outflow,
    geracao: inflow - outflow,
    saldo_final: opening + inflow - outflow,
    saldo_atual: balanceNow,
    a_receber: sum(
      pending.filter((t) => t.tipo === 'receber'),
      (t) => t.aberto,
    ),
    a_pagar: sum(
      pending.filter((t) => t.tipo === 'pagar'),
      (t) => t.aberto,
    ),
    receber_atrasado: sum(
      pending.filter((t) => t.tipo === 'receber' && t.status === 'atrasado'),
      (t) => t.aberto,
    ),
    pagar_atrasado: sum(
      pending.filter((t) => t.tipo === 'pagar' && t.status === 'atrasado'),
      (t) => t.aberto,
    ),
  };
  const series = new Map();
  const bucket = (day) => (f.days <= 62 ? day : day.slice(0, 7));
  for (let day = f.inicio; day <= f.fim; day = addDays(day, 1)) {
    const key = bucket(day);
    if (!series.has(key))
      series.set(key, { periodo: key, receita: 0, custos: 0, entradas: 0, saidas: 0 });
  }
  for (const o of currentOrders) {
    const cell = series.get(bucket(dayOf(o.finalizada_em)));
    if (!cell) continue;
    cell.receita += quoteById.get(o.orcamento_id)?.total || 0;
    cell.custos += sum(
      itemsByQuote.get(o.orcamento_id) || [],
      (i) => (i.custo_unitario || 0) * i.quantidade,
    );
  }
  for (const m of cashPeriod) {
    const cell = series.get(bucket(m.data));
    if (cell)
      cell[titleById.get(m.titulo_id).tipo === 'receber' ? 'entradas' : 'saidas'] += signed(m);
  }
  const mechanics = new Map();
  function mechanic(id) {
    const key = id || 0;
    if (!mechanics.has(key))
      mechanics.set(key, {
        id: key,
        nome: userById.get(id)?.nome || 'Sem responsável informado',
        concluidas: 0,
        em_andamento: 0,
        abertas: 0,
        receita: 0,
        custo: 0,
        servicos: 0,
        custos_pendentes: 0,
        horas: [],
        margem: 0,
      });
    return mechanics.get(key);
  }
  for (const u of users.filter((u) => u.papel === 'operador'))
    if (!f.mecanico_id || u.id === f.mecanico_id) mechanic(u.id);
  for (const order of orders.filter(eligible)) {
    const row = mechanic(mechanicOf(order));
    if (order.status === 'aberta') row.abertas++;
    if (order.status === 'em_andamento') row.em_andamento++;
  }
  const serviceMap = new Map(),
    clientMap = new Map();
  for (const o of currentOrders) {
    const row = mechanic(mechanicOf(o)),
      quote = quoteById.get(o.orcamento_id);
    row.concluidas++;
    row.receita += quote?.total || 0;
    if (o.iniciada_em && String(o.finalizada_em).length > 10) {
      const hours = (new Date(o.finalizada_em) - new Date(o.iniciada_em)) / 36e5;
      if (Number.isFinite(hours) && hours >= 0) row.horas.push(hours);
    }
    const clientId = quote?.cliente_id;
    if (!clientMap.has(clientId))
      clientMap.set(clientId, {
        id: clientId,
        nome: snapshot.clientes?.find((c) => c.id === clientId)?.nome || 'Cliente',
        receita: 0,
        ordens: 0,
      });
    const client = clientMap.get(clientId);
    client.receita += quote?.total || 0;
    client.ordens++;
    for (const item of itemsByQuote.get(o.orcamento_id) || []) {
      if (item.custo_unitario == null) row.custos_pendentes++;
      else row.custo += item.custo_unitario * item.quantidade;
      if (item.tipo !== 'servico') continue;
      row.servicos += item.quantidade;
      if (!serviceMap.has(item.referencia_id))
        serviceMap.set(item.referencia_id, {
          id: item.referencia_id,
          nome: item.nome,
          quantidade: 0,
          receita: 0,
          custo: 0,
          custos_pendentes: 0,
        });
      const s = serviceMap.get(item.referencia_id);
      s.quantidade += item.quantidade;
      s.receita += item.preco * item.quantidade;
      if (item.custo_unitario == null) s.custos_pendentes++;
      else s.custo += item.custo_unitario * item.quantidade;
    }
  }
  const consumption = new Map();
  for (const m of stockMoves.filter(
    (m) =>
      m.tipo === 'consumo' &&
      inRange(dayOf(m.criado_em), f.inicio, f.fim) &&
      (!f.mecanico_id || mechanicOf(orderById.get(m.ordem_id) || {}) === f.mecanico_id),
  )) {
    const item = stockById.get(m.estoque_id);
    if (!consumption.has(m.estoque_id))
      consumption.set(m.estoque_id, {
        id: m.estoque_id,
        nome: item?.nome || 'Item',
        tipo: item?.tipo || 'peca',
        unidade: item?.unidade || 'un',
        quantidade: 0,
        custo: 0,
      });
    const row = consumption.get(m.estoque_id);
    row.quantidade += Math.abs(m.quantidade);
    row.custo += Math.abs(m.quantidade) * m.custo_unitario;
  }
  const stockValue = sum(stock, (i) => i.quantidade * i.custo),
    stockSale = sum(stock, (i) => i.quantidade * i.venda);
  const low = stock
    .filter((i) => i.quantidade <= i.minimo)
    .sort((a, b) => a.quantidade - b.quantidade)
    .map((i) => ({
      id: i.id,
      nome: i.nome,
      codigo: i.codigo,
      tipo: i.tipo,
      unidade: i.unidade,
      quantidade: i.quantidade,
      minimo: i.minimo,
      custo: i.custo,
    }));
  const cohort = quotes.filter((q) => inRange(dayOf(q.criado_em), f.inicio, f.fim));
  const quoteOrders = new Set(orders.map((o) => o.orcamento_id));
  const categories = new Map();
  for (const title of titles.filter(
    (t) =>
      !t.cancelado &&
      t.natureza === 'despesa_operacional' &&
      inRange(t.competencia, f.inicio, f.fim),
  ))
    categories.set(title.categoria, (categories.get(title.categoria) || 0) + title.valor);
  const forecast = [];
  let projected = balanceNow;
  for (let i = 0; i < 4; i++) {
    const start = addDays(f.hoje, i * 7),
      end = addDays(f.hoje, i === 3 ? 29 : i * 7 + 6);
    const rows = pending.filter((t) => inRange(t.vencimento, start, end));
    const entradas = sum(
        rows.filter((t) => t.tipo === 'receber'),
        (t) => t.aberto,
      ),
      saidas = sum(
        rows.filter((t) => t.tipo === 'pagar'),
        (t) => t.aberto,
      );
    projected += entradas - saidas;
    forecast.push({ inicio: start, fim: end, entradas, saidas, saldo: projected });
  }
  const legacy = orders.filter(
    (o) => ['finalizada', 'entregue'].includes(o.status) && !o.finalizada_em,
  );
  const currentDetails = currentOrders.map((o) => ({
    id: o.id,
    data: dayOf(o.finalizada_em),
    cliente:
      snapshot.clientes?.find((c) => c.id === quoteById.get(o.orcamento_id)?.cliente_id)?.nome ||
      'Cliente',
    mecanico: userById.get(mechanicOf(o))?.nome || 'Sem responsável informado',
    total: quoteById.get(o.orcamento_id)?.total || 0,
    custo: sum(
      itemsByQuote.get(o.orcamento_id) || [],
      (i) => (i.custo_unitario || 0) * i.quantidade,
    ),
    custos_pendentes: (itemsByQuote.get(o.orcamento_id) || []).filter(
      (i) => i.custo_unitario == null,
    ).length,
  }));
  return {
    periodo: f,
    kpis,
    comparativo: {
      ...previous,
      variacao_receita: previous.receita
        ? rate(kpis.receita - previous.receita, previous.receita)
        : null,
    },
    caixa: cash,
    serie: [...series.values()],
    mecanicos: [...mechanics.values()]
      .map((m) => ({
        ...m,
        margem: m.receita - m.custo,
        ticket: m.concluidas ? Math.round(m.receita / m.concluidas) : 0,
        horas_medias: m.horas.length
          ? divide(
              sum(m.horas, (v) => v),
              m.horas.length,
            )
          : null,
        horas: undefined,
      }))
      .sort((a, b) => b.receita - a.receita),
    servicos: [...serviceMap.values()]
      .map((s) => ({ ...s, margem: s.receita - s.custo }))
      .sort((a, b) => b.receita - a.receita),
    clientes: [...clientMap.values()].sort((a, b) => b.receita - a.receita),
    consumos: [...consumption.values()].sort((a, b) => b.custo - a.custo),
    estoque: {
      custo_total: stockValue,
      venda_potencial: stockSale,
      itens: stock.length,
      baixo: low,
      consumo_custo: sum([...consumption.values()], (i) => i.custo),
    },
    funil: {
      orcamentos: cohort.length,
      aprovados: cohort.filter((q) => q.status === 'aprovado').length,
      convertidos: cohort.filter((q) => quoteOrders.has(q.id)).length,
      valor_orcado: sum(cohort, (q) => q.total),
      taxa_aprovacao: rate(cohort.filter((q) => q.status === 'aprovado').length, cohort.length),
    },
    despesas: [...categories]
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor),
    previsao: forecast,
    contas: accounts,
    ordens_sem_conta: orders
      .filter(
        (o) =>
          (quoteById.get(o.orcamento_id)?.total || 0) > 0 &&
          !titles.some((t) => t.ordem_id === o.id),
      )
      .map((o) => ({ id: o.id, total: quoteById.get(o.orcamento_id).total, status: o.status })),
    movimentos: cashPeriod
      .map((m) => ({
        ...m,
        descricao: titleById.get(m.titulo_id).descricao,
        direcao: titleById.get(m.titulo_id).tipo,
        efeito_caixa: effect(m),
      }))
      .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id),
    vendas: currentDetails,
    legado: legacy.map((o) => ({
      id: o.id,
      status: o.status,
      total: quoteById.get(o.orcamento_id)?.total || 0,
    })),
    opcoes_mecanicos: users
      .filter((u) => u.papel === 'operador')
      .map((u) => ({ id: u.id, nome: u.nome })),
    avisos: [
      ...(kpis.custos_pendentes
        ? [
            `${kpis.custos_pendentes} linha(s) de serviço ou material sem custo histórico. As margens exibem somente os custos conhecidos.`,
          ]
        : []),
      ...(legacy.length
        ? [
            `${legacy.length} OS antiga(s) sem data de conclusão. Regularize para incluí-las no faturamento por período.`,
          ]
        : []),
      ...(f.mecanico_id
        ? [
            'O filtro de mecânico afeta vendas, serviços e consumos. Caixa, contas, despesas e funil mostram a oficina inteira; despesas gerais não são rateadas.',
          ]
        : []),
    ],
  };
}
module.exports = { report, signed };
