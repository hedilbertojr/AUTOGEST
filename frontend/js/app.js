import { session, isAdmin, resources } from './core/session.js';
import { initializeAccess } from './features/access.js';
import { createUser, userAction, assignOrder } from './features/users.js';
import { isDemo } from './core/mode.js';
import { renderView } from './components/dashboard.js';
import { createBudgetEditor } from './features/budget-editor.js';
import { $ } from './core/dom.js';
import { api } from './core/api.js';
import { escapeHtml, reais, labels } from './core/format.js';
import { pages } from './config/pages.js';
import { renderTable as drawTable } from './components/table.js';
import { field, select } from './components/fields.js';
let budgetEditor;
let state = Object.fromEntries(Object.keys(pages).map((key) => [key, []])),
  page = 'clientes',
  query = '',
  busy = false,
  editingId = null,
  formPage = null,
  toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 5000);
}
async function refresh() {
  const entries = await Promise.all(resources().map(async (k) => [k, await api(k)]));
  if (!session.user) return;
  state = {
    ...Object.fromEntries(Object.keys(pages).map((k) => [k, []])),
    ...Object.fromEntries(entries),
  };
  render();
}
$('#nav').innerHTML = Object.entries(pages)
  .map(([k, p]) => `<button data-page="${k}"><span>${p[2]}</span>${p[0]}</button>`)
  .join('');
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-page]');
  if (b) {
    page = b.dataset.page;
    query = '';
    $('#search').value = '';
    render();
  }
});
$('#search').addEventListener('input', (e) => {
  query = e.target.value.toLocaleLowerCase('pt-BR');
  renderTable();
});
function render() {
  if (!resources().includes(page)) page = isAdmin() ? 'clientes' : 'ordens';
  document
    .querySelectorAll('[data-page]')
    .forEach((b) => (b.hidden = !resources().includes(b.dataset.page)));
  renderView(state, page, query);
  if (!isAdmin()) $('#new').hidden = true;
}
function renderTable() {
  drawTable(state, page, query);
}
function openModal(title, html, readOnly = false) {
  formPage = page;
  $('#modal-title').textContent = title;
  $('#fields').innerHTML = html;
  $('#form-error').textContent = '';
  $('#save').hidden = readOnly;
  $('#cancel').textContent = readOnly ? 'Fechar' : 'Cancelar';
  $('#modal').showModal();
}
$('#close').onclick = $('#cancel').onclick = () => $('#modal').close();
$('#new').onclick = () => {
  if (!isAdmin()) return;
  if (page === 'usuarios') return createUser(refresh);
  editingId = null;
  let html = '';
  if (page === 'clientes')
    html =
      field('nome', 'Nome completo', 'text', { wide: true }) +
      field('telefone', 'Telefone com DDD', 'tel', { max: 30 }) +
      field('email', 'E-mail', 'email', { optional: true, max: 254 });
  if (page === 'veiculos')
    html =
      select('cliente_id', 'Cliente', state.clientes, (r) => r.nome) +
      field('placa', 'Placa') +
      field('marca', 'Marca') +
      field('modelo', 'Modelo') +
      field('ano', 'Ano', 'number', { min: 1900, value: new Date().getFullYear() });
  if (page === 'servicos')
    html =
      field('nome', 'Serviço') +
      field('categoria', 'Categoria') +
      field('preco', 'Preço (R$)', 'number', { min: 0, step: '.01' });
  if (page === 'estoque')
    html =
      field('codigo', 'Código') +
      field('nome', 'Nome do item') +
      '<label>Tipo<select name="tipo"><option value="peca">Peça</option><option value="suprimento">Suprimento</option></select></label>' +
      field('unidade', 'Unidade / embalagem', 'text', { value: 'un', max: 30 }) +
      field('quantidade', 'Quantidade', 'number', { min: 0, value: 0 }) +
      field('minimo', 'Estoque mínimo', 'number', { min: 0, value: 0 }) +
      field('custo', 'Custo (R$)', 'number', { min: 0, step: '.01' }) +
      field('venda', 'Venda (R$)', 'number', { min: 0, step: '.01' });
  if (page === 'orcamentos')
    html =
      select('cliente_id', 'Cliente', state.clientes, (r) => r.nome) +
      select('veiculo_id', 'Veículo', [], (r) => r.placa) +
      '<label class="wide">Diagnóstico<textarea name="diagnostico" maxlength="3000" required></textarea></label><div class="wide"><h3>Serviços, peças e suprimentos</h3><p class="note">Mão de obra não possui saldo. Peças e suprimentos baixam do estoque ao gerar a OS. Venda de R$ 0,00 representa consumo interno sem cobrança. Informe quantidades inteiras de unidades ou embalagens.</p><div id="items"></div><button type="button" class="secondary" id="add-item">+ Adicionar item</button><div id="budget-total"></div></div>';
  openModal(pages[page][3], html);
  if (page === 'orcamentos') {
    budgetEditor = createBudgetEditor(state);
    document.querySelector('[name=cliente_id]').onchange = budgetEditor.vehicles;
    $('#add-item').onclick = budgetEditor.addItem;
    budgetEditor.addItem();
  }
};
$('#form').onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  busy = true;
  $('#save').disabled = true;
  $('#form-error').textContent = '';
  try {
    const b = Object.fromEntries(new FormData(e.target));
    if (formPage === 'orcamentos') b.itens = budgetEditor.budgetItems();
    await api(editingId ? `estoque/${editingId}` : formPage, editingId ? 'PATCH' : 'POST', b);
    $('#modal').close();
    await refresh();
    toast('Registro salvo com sucesso.');
  } catch (e) {
    $('#form-error').textContent = e.message;
  } finally {
    busy = false;
    $('#save').disabled = false;
  }
};
$('#content').onclick = async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || busy) return;
  if (b.dataset.action.startsWith('user-')) {
    try {
      await userAction(b.dataset.action, Number(b.dataset.id), state, refresh);
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (b.dataset.action === 'assign') {
    assignOrder(Number(b.dataset.id), state.usuarios, refresh);
    return;
  }
  const actionPage = page;
  const id = Number(b.dataset.id),
    action = b.dataset.action;
  if (action === 'stock') {
    editingId = id;
    const r = state.estoque.find((x) => x.id === id);
    openModal(
      'Ajustar saldo · ' + r.nome,
      field('quantidade', 'Novo saldo físico', 'number', { min: 0, value: r.quantidade }) +
        '<p class="note">Informe a quantidade atual, após conferir fisicamente o estoque.</p>',
    );
    return;
  }
  if (isDemo && action === 'reopen') {
    const message = state.notificacoes.find((n) => n.id === id).mensagem;
    openModal('Prévia da comunicação', '<p class="detail">' + escapeHtml(message) + '</p>', true);
    return;
  }
  if (action === 'reopen') {
    window.open(state.notificacoes.find((n) => n.id === id).link, '_blank', 'noopener,noreferrer');
    return;
  }
  busy = true;
  b.disabled = true;
  let popup;
  try {
    if (action === 'detail') {
      const o = await api('orcamentos/' + id);
      openModal(
        'Orçamento #' + id,
        `<div class="detail"><p>${escapeHtml(o.diagnostico)}</p><ul>${o.itens.map((i) => `<li>${i.quantidade} × ${escapeHtml(i.nome)} · ${reais(i.preco * i.quantidade)}</li>`).join('')}</ul><h3>Total: ${reais(o.total)}</h3></div>`,
        true,
      );
      return;
    }
    if (isDemo && action === 'whatsapp') {
      const n = await api(`${actionPage}/${id}/whatsapp`, 'POST', {});
      await refresh();
      openModal(
        'Prévia da comunicação',
        '<p class="detail">' +
          escapeHtml(n.mensagem) +
          '</p><p class="note">Demonstração: nenhuma mensagem foi enviada.</p>',
        true,
      );
      return;
    }
    if (action === 'whatsapp') {
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      const n = await api(`${actionPage}/${id}/whatsapp`, 'POST', {});
      if (popup) popup.location = n.link;
      toast('Link preparado. O envio é feito por você no WhatsApp.');
    }
    if (action === 'approve') await api(`orcamentos/${id}/aprovar`, 'POST', {});
    if (action === 'order') {
      const os = await api(`orcamentos/${id}/gerar-os`, 'POST', {});
      toast('OS #' + os.id + ' criada. Estoque atualizado.');
    }
    if (action === 'status') {
      const o = state.ordens.find((x) => x.id === id);
      await api('ordens/' + id, 'PATCH', {
        status: { aberta: 'em_andamento', em_andamento: 'finalizada', finalizada: 'entregue' }[
          o.status
        ],
      });
    }
    if (action === 'note') {
      const n = await api(`ordens/${id}/nota`, 'POST', {});
      toast('Comprovante interno #' + n.id + ' gerado, sem valor fiscal.');
    }
    await refresh();
  } catch (e) {
    if (popup) popup.close();
    toast(e.message);
  } finally {
    busy = false;
    b.disabled = false;
  }
};
initializeAccess(
  async () => {
    page = isAdmin() ? 'clientes' : 'ordens';
    await refresh();
  },
  () => {
    state = Object.fromEntries(Object.keys(pages).map((k) => [k, []]));
    $('#content').textContent = '';
  },
).catch((error) => {
  console.error(error);
  $('#access-panel').textContent = 'Não foi possível preparar o acesso. Recarregue a página.';
});

if (isDemo) {
  $('#demo-banner').hidden = false;
  document.querySelector('aside footer').innerHTML =
    '<span class="dot"></span> Portfólio interativo<small>Dados fictícios neste navegador</small>';
  document.querySelector('.local').textContent = '● Modo demonstração';
  $('#reset-demo').onclick = async () => {
    if (!window.confirm('Restaurar os exemplos? Seus testes neste navegador serão removidos.'))
      return;
    const demo = await import('./demo/runtime.js');
    demo.reset();
    await refresh();
    toast('Demonstração restaurada.');
  };
}
