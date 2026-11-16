import { seedFinanceExamples } from './finance-examples.js';
import financeModule from '../../../backend/src/finance/service.js';
import financeRoutes from '../../../backend/src/finance/routes.js';
import financeDates from '../../../backend/src/finance/dates.js';
import exampleCatalog from '../../../backend/src/database/seeds/example-catalog.js';
// Shares business rules with the Node backend; only the persistence adapter changes.
import registrationsModule from '../../../backend/src/services/registrations.service.js';
import quotesModule from '../../../backend/src/services/quotes.service.js';
import ordersModule from '../../../backend/src/services/orders.service.js';
import communicationsModule from '../../../backend/src/services/communications.service.js';
import routesModule from '../../../backend/src/routes/api.routes.js';
import validation from '../../../backend/src/shared/validation.js';
import errors from '../../../backend/src/shared/errors.js';
import seeds from '../../../backend/src/database/seeds/services.js';

export const STORAGE_KEY = 'autogest-portfolio-v1';
const tables = [
  'clientes',
  'veiculos',
  'servicos',
  'estoque',
  'orcamentos',
  'ordens',
  'notas',
  'notificacoes',
];
const clone = (value) => JSON.parse(JSON.stringify(value));

export function initialData() {
  let id = 0;
  return seedFinanceExamples({
    clientes: [
      { id: 1, nome: 'Marina · Exemplo', telefone: '11000000000', email: 'marina@example.com' },
      { id: 2, nome: 'Rafael · Exemplo', telefone: '21000000000', email: 'rafael@example.com' },
      { id: 3, nome: 'Camila · Exemplo', telefone: '31000000000', email: 'camila@example.com' },
    ],
    veiculos: [
      { id: 1, cliente_id: 1, placa: 'ABC1D23', marca: 'Fiat', modelo: 'Argo', ano: 2022 },
      { id: 2, cliente_id: 2, placa: 'DEF4G56', marca: 'Volkswagen', modelo: 'Polo', ano: 2021 },
      { id: 3, cliente_id: 3, placa: 'GHI7J89', marca: 'Chevrolet', modelo: 'Onix', ano: 2023 },
    ],
    servicos: [
      ...Object.entries(seeds.catalogo).flatMap(([categoria, items]) =>
        items.map(([nome, preco]) => ({ id: ++id, nome, categoria, preco: preco * 100 })),
      ),
      ...exampleCatalog.exampleServices.map((item) => ({ id: ++id, ...item })),
    ],
    estoque: exampleCatalog.exampleStock.map((item, index) => ({ id: index + 1, ...item })),
    orcamentos: [
      {
        id: 1,
        cliente_id: 1,
        veiculo_id: 1,
        diagnostico: 'Troca de escapamento e revisão dos filtros — atendimento de exemplo.',
        status: 'pendente',
        total: 32000,
        criado_em: '2026-01-01T12:00:00Z',
      },
    ],
    itens: [
      {
        id: 1,
        orcamento_id: 1,
        tipo: 'servico',
        referencia_id: 1,
        nome: 'Troca de escapamento',
        quantidade: 1,
        preco: 25000,
      },
      {
        id: 2,
        orcamento_id: 1,
        tipo: 'peca',
        referencia_id: 1,
        nome: 'Filtro de óleo',
        quantidade: 2,
        preco: 3500,
      },
    ],
    financeiro_titulos: [],
    financeiro_movimentos: [],
    estoque_movimentos: [],
    usuarios: [
      { id: 2, nome: 'Lucas · Exemplo', papel: 'operador' },
      { id: 3, nome: 'Ana · Exemplo', papel: 'operador' },
    ],
    ordens: [],
    notas: [],
    notificacoes: [],
  });
}

export function createDemoApi(storage) {
  let data = initialData();
  const saved = storage?.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const candidate = JSON.parse(saved);
      if ([...tables, 'itens'].every((key) => Array.isArray(candidate[key]))) data = candidate;
    } catch {
      /* Ignore an obsolete or incomplete local snapshot. */
    }
  }
  // Add new examples without resetting balances, prices or visitor-created records.
  const defaults = initialData();
  for (const [table, key] of [
    ['estoque', 'codigo'],
    ['servicos', 'nome'],
  ]) {
    for (const sample of defaults[table]) {
      const found = data[table].find(
        (item) => String(item[key]).toLowerCase() === String(sample[key]).toLowerCase(),
      );
      if (!found)
        data[table].push({ ...sample, id: Math.max(0, ...data[table].map((item) => item.id)) + 1 });
      else if (table === 'estoque') {
        found.tipo ??= sample.tipo;
        found.unidade ??= sample.unidade;
      }
    }
  }
  for (const item of data.estoque) {
    item.tipo ??= 'peca';
    item.unidade ??= 'un';
  }
  for (const key of [
    'financeiro_titulos',
    'financeiro_movimentos',
    'estoque_movimentos',
    'usuarios',
  ])
    data[key] ??= key === 'usuarios' ? defaults.usuarios : [];
  seedFinanceExamples(data);
  const { businessDate } = financeDates;
  const { fail } = errors;
  function get(table, id) {
    const record = data[table]?.find((row) => row.id === validation.integer(id, 'ID', 1));
    if (!record) fail('Registro não encontrado.', 404);
    return record;
  }
  function insert(table, fields) {
    if (table === 'veiculos' && data.veiculos.some((r) => r.placa === fields.placa))
      fail('Placa já cadastrada.', 409);
    if (table === 'estoque' && data.estoque.some((r) => r.codigo === fields.codigo))
      fail('Código já cadastrado.', 409);
    const defaults =
      table === 'orcamentos'
        ? { status: 'pendente' }
        : table === 'ordens'
          ? { status: 'aberta' }
          : {};
    const row = {
      ...defaults,
      id: Math.max(0, ...data[table].map((r) => r.id)) + 1,
      criado_em: new Date().toISOString(),
      ...fields,
    };
    data[table].push(row);
    return row;
  }
  const quoteForOrder = (id) => get('orcamentos', get('ordens', id).orcamento_id);
  const enrich = (table, row) => {
    if (table === 'veiculos') return { ...row, cliente: get('clientes', row.cliente_id).nome };
    if (table === 'orcamentos')
      return {
        ...row,
        cliente: get('clientes', row.cliente_id).nome,
        placa: get('veiculos', row.veiculo_id).placa,
      };
    if (table === 'ordens') {
      const quote = get('orcamentos', row.orcamento_id);
      return {
        ...row,
        total: quote.total,
        cliente_id: quote.cliente_id,
        cliente: get('clientes', quote.cliente_id).nome,
        placa: get('veiculos', quote.veiculo_id).placa,
      };
    }
    if (table === 'notas')
      return { ...row, cliente: get('clientes', quoteForOrder(row.ordem_id).cliente_id).nome };
    if (table === 'notificacoes') return { ...row, cliente: get('clientes', row.cliente_id).nome };
    return row;
  };
  const repository = {
    tables,
    get,
    insert,
    list(table) {
      return data[table].map((r) => enrich(table, r)).sort((a, b) => b.id - a.id);
    },
    items(id) {
      return data.itens.filter((r) => r.orcamento_id === id);
    },
    orderForQuote(id) {
      return data.ordens.find((r) => r.orcamento_id === id);
    },
    noteForOrder(id) {
      return data.notas.find((r) => r.ordem_id === id);
    },
    requiredParts(id) {
      const totals = new Map();
      for (const item of data.itens.filter(
        (r) => r.orcamento_id === id && ['peca', 'suprimento'].includes(r.tipo),
      ))
        totals.set(item.referencia_id, (totals.get(item.referencia_id) || 0) + item.quantidade);
      return [...totals].map(([referencia_id, quantidade]) => ({ referencia_id, quantidade }));
    },
    captureCosts(id) {
      for (const item of data.itens.filter((i) => i.orcamento_id === id))
        item.custo_unitario =
          get(item.tipo === 'servico' ? 'servicos' : 'estoque', item.referencia_id).custo ?? null;
    },
    receivable(order) {
      const q = get('orcamentos', order.orcamento_id);
      if (q.total > 0 && !data.financeiro_titulos.some((t) => t.ordem_id === order.id))
        insert('financeiro_titulos', {
          tipo: 'receber',
          natureza: 'venda_os',
          descricao: 'OS #' + order.id,
          categoria: 'Serviços e materiais',
          valor: q.total,
          competencia: businessDate(order.finalizada_em || order.criado_em),
          vencimento: businessDate(),
          ordem_id: order.id,
          cancelado: 0,
        });
    },
    setStock(id, quantity) {
      const old = get('estoque', id);
      insert('estoque_movimentos', {
        estoque_id: old.id,
        tipo: 'ajuste',
        quantidade: quantity - old.quantidade,
        custo_unitario: old.custo,
      });
      const row = get('estoque', id);
      row.quantidade = quantity;
      return row;
    },
    decreaseStock(id, quantity, orderId) {
      insert('estoque_movimentos', {
        estoque_id: Number(id),
        ordem_id: orderId,
        tipo: 'consumo',
        quantidade: -quantity,
        custo_unitario: get('estoque', id).custo,
      });
      get('estoque', id).quantidade -= quantity;
    },
    approveQuote(id) {
      const row = get('orcamentos', id);
      row.status = 'aprovado';
      return row;
    },
    setOrderStatus(id, status) {
      const row = get('ordens', id);
      row.status = status;
      const col = {
        em_andamento: 'iniciada_em',
        finalizada: 'finalizada_em',
        entregue: 'entregue_em',
      }[status];
      if (col) row[col] = new Date().toISOString();
      if (status === 'finalizada') {
        row.mecanico_conclusao_id = row.operador_id ?? null;
        repository.receivable(row);
        const t = data.financeiro_titulos.find((t) => t.ordem_id === row.id);
        if (t) t.competencia = businessDate(row.finalizada_em);
      }
      return row;
    },
  };
  // Every write snapshots the complete demo below, so service transactions remain atomic.
  const transaction = (callback) => callback();
  const dispatch = routesModule.createRouter(repository, {
    registrations: registrationsModule.createRegistrationsService(repository),
    quotes: quotesModule.createQuotesService(repository, transaction),
    orders: ordersModule.createOrdersService(repository, transaction),
    communications: communicationsModule.createCommunicationsService(repository),
  });
  const finance = financeModule.createFinanceService({
    snapshot: () => data,
    find: (table, id) => data[table].find((r) => r.id === id),
    insert,
    update(table, id, fields) {
      return Object.assign(get(table, id), fields);
    },
    atomic: transaction,
    audit() {},
  });
  return {
    async api(url, method = 'GET', body = {}) {
      const before = clone(data);
      try {
        const parsed = new URL(url, 'https://demo.local/');
        const parts = parsed.pathname.split('/').filter(Boolean);
        const result = ['bi', 'financeiro'].includes(parts[0])
          ? financeRoutes.financeRoute(
              finance,
              method,
              parts,
              body,
              Object.fromEntries(parsed.searchParams),
            )
          : dispatch(method, parts, body);
        // Demo communications are previews; do not expose real outbound contact links.
        if (method === 'POST' && url.endsWith('/whatsapp')) result.link = '';
        if (method !== 'GET') storage?.setItem(STORAGE_KEY, JSON.stringify(data));
        return clone(result);
      } catch (error) {
        data = before;
        throw error;
      }
    },
    reset() {
      const fresh = initialData();
      storage?.setItem(STORAGE_KEY, JSON.stringify(fresh));
      data = fresh;
    },
  };
}

let runtime;
function instance() {
  if (!runtime) {
    let storage;
    try {
      storage = globalThis.localStorage;
    } catch {
      /* In privacy mode the demo stays in memory. */
    }
    runtime = createDemoApi(storage);
  }
  return runtime;
}
export const api = (...args) => instance().api(...args);
export const reset = () => instance().reset();
