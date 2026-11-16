import dates from '../../../backend/src/finance/dates.js';
// Entirely fictional fixtures, used only by the static portfolio adapter.
export function seedFinanceExamples(data) {
  if (data.finance_examples_version === 1) return data;
  const { businessDate, addDays } = dates,
    today = businessDate();
  for (const key of ['financeiro_titulos', 'financeiro_movimentos', 'estoque_movimentos'])
    data[key] ??= [];
  data.usuarios ??= [
    { id: 2, nome: 'Lucas · Exemplo', papel: 'operador' },
    { id: 3, nome: 'Ana · Exemplo', papel: 'operador' },
  ];
  const add = (table, row) => {
    const item = { id: Math.max(0, ...data[table].map((r) => r.id)) + 1, ...row };
    data[table].push(item);
    return item;
  };
  const title = (natureza, descricao, valor, day, due, ordem_id = null) =>
    add('financeiro_titulos', {
      tipo: ['venda_os', 'outra_receita', 'aporte'].includes(natureza) ? 'receber' : 'pagar',
      natureza,
      descricao,
      categoria: natureza === 'despesa_operacional' ? descricao : 'Exemplos financeiros',
      valor,
      competencia: day,
      vencimento: due,
      ordem_id,
      cancelado: 0,
      criado_em: day + 'T12:00:00Z',
    });
  const pay = (t, valor, day) =>
    add('financeiro_movimentos', {
      titulo_id: t.id,
      tipo: 'baixa',
      valor,
      data: day,
      meio: 'pix',
      estorno_de: null,
      observacao: 'Movimentação fictícia de demonstração',
    });
  data.servicos.forEach((s) => {
    s.custo ??= Math.round(s.preco * 0.32);
  });
  const opening = title(
    'aporte',
    'Saldo inicial · Exemplo',
    800000,
    addDays(today, -70),
    addDays(today, -70),
  );
  pay(opening, opening.valor, opening.competencia);
  for (let i = 0; i < 28; i++) {
    const day = addDays(today, -i * 2),
      client = (i % 3) + 1,
      mechanic = (i % 2) + 2,
      service = data.servicos[i % data.servicos.length],
      part = data.estoque[1 + (i % 8)],
      supply = data.estoque.find((s) => s.tipo === 'suprimento');
    const rows = [
      {
        tipo: 'servico',
        referencia_id: service.id,
        nome: service.nome,
        quantidade: 1,
        preco: service.preco,
        custo_unitario: service.custo,
      },
      {
        tipo: 'peca',
        referencia_id: part.id,
        nome: part.nome,
        quantidade: 1,
        preco: part.venda,
        custo_unitario: part.custo,
      },
    ];
    if (supply)
      rows.push({
        tipo: 'suprimento',
        referencia_id: supply.id,
        nome: supply.nome,
        quantidade: 1,
        preco: 0,
        custo_unitario: supply.custo,
      });
    const total = rows.reduce((s, r) => s + r.preco * r.quantidade, 0),
      q = add('orcamentos', {
        cliente_id: client,
        veiculo_id: client,
        diagnostico: 'Atendimento fictício para explorar o BI.',
        status: 'aprovado',
        total,
        criado_em: addDays(day, -2) + 'T12:00:00Z',
      });
    rows.forEach((r) => add('itens', { orcamento_id: q.id, ...r }));
    const o = add('ordens', {
      orcamento_id: q.id,
      status: 'entregue',
      operador_id: mechanic,
      mecanico_conclusao_id: mechanic,
      criado_em: addDays(day, -1) + 'T12:00:00Z',
      iniciada_em: day + 'T12:00:00Z',
      finalizada_em: day + 'T16:00:00Z',
      entregue_em: day + 'T17:00:00Z',
    });
    rows
      .filter((r) => r.tipo !== 'servico')
      .forEach((r) =>
        add('estoque_movimentos', {
          estoque_id: r.referencia_id,
          ordem_id: o.id,
          tipo: 'consumo',
          quantidade: -r.quantidade,
          custo_unitario: r.custo_unitario,
          criado_em: day + 'T12:00:00Z',
        }),
      );
    const t = title(
      'venda_os',
      'OS #' + o.id + ' · Exemplo',
      total,
      day,
      addDays(day, i % 4 === 0 ? 10 : 0),
      o.id,
    );
    if (i % 5 !== 0) pay(t, i % 4 === 0 ? Math.round(total / 2) : total, day);
  }
  for (let month = 0; month < 2; month++)
    for (const [category, value] of [
      ['Aluguel', 180000],
      ['Energia', 42000],
      ['Internet e sistema', 19000],
      ['Salários e encargos', 260000],
      ['Impostos e taxas', 55000],
    ]) {
      const day = addDays(today, -month * 30 - 4),
        t = title(
          'despesa_operacional',
          category + ' · Exemplo',
          value,
          day,
          addDays(day, category === 'Energia' ? 14 : 0),
        );
      if (category !== 'Energia') pay(t, value, day);
    }
  const purchase = title(
    'compra_estoque',
    'Reposição de materiais · Exemplo',
    125000,
    today,
    addDays(today, 12),
  );
  const other = title(
    'outra_receita',
    'Receita acessória · Exemplo',
    16000,
    addDays(today, -3),
    today,
  );
  pay(other, other.valor, today);
  // Reconcile simulated historical consumption to the pre-existing catalog balances.
  for (const item of data.estoque) {
    const consumed = data.estoque_movimentos
      .filter((m) => m.estoque_id === item.id)
      .reduce((s, m) => s + m.quantidade, 0);
    add('estoque_movimentos', {
      estoque_id: item.id,
      tipo: 'saldo_inicial',
      quantidade: item.quantidade - consumed,
      custo_unitario: item.custo,
      criado_em: addDays(today, -70) + 'T12:00:00Z',
    });
  }
  data.finance_examples_version = 1;
  return data;
}
