import { $ } from '../core/dom.js';
import { escapeHtml, reais } from '../core/format.js';
export function createBudgetEditor(state) {
  function vehicles() {
    const id = Number(document.querySelector('[name=cliente_id]').value);
    document.querySelector('[name=veiculo_id]').innerHTML =
      '<option value="">Selecione…</option>' +
      state.veiculos
        .filter((v) => v.cliente_id === id)
        .map((v) => `<option value="${v.id}">${escapeHtml(v.placa + ' · ' + v.modelo)}</option>`)
        .join('');
  }
  function fillItem(row) {
    const tipo = row.querySelector('.item-type').value;
    row.querySelector('.item-ref').innerHTML =
      '<option value="">Selecione…</option>' +
      state[tipo === 'servico' ? 'servicos' : 'estoque']
        .filter((r) => tipo === 'servico' || (r.tipo || 'peca') === tipo)
        .map(
          (r) =>
            `<option value="${r.id}">${escapeHtml(r.nome)} · ${reais(tipo === 'servico' ? r.preco : r.venda)}${tipo === 'servico' ? '' : ' / ' + escapeHtml(r.unidade || 'un') + ' · saldo ' + r.quantidade}</option>`,
        )
        .join('');
    updateTotal();
  }
  function addItem() {
    const row = document.createElement('div');
    row.className = 'line-item';
    row.innerHTML =
      '<select class="item-type" aria-label="Tipo"><option value="servico">Serviço</option><option value="peca">Peça</option><option value="suprimento">Suprimento</option></select><select class="item-ref" aria-label="Item" required></select><input class="item-qty" aria-label="Quantidade" type="number" min="1" step="1" value="1" required><button type="button" class="ghost" aria-label="Remover item">×</button>';
    $('#items').append(row);
    fillItem(row);
    row.querySelector('.item-type').onchange = () => fillItem(row);
    row.querySelector('.item-ref').onchange = updateTotal;
    row.querySelector('input').oninput = updateTotal;
    row.querySelector('button').onclick = () => {
      row.remove();
      updateTotal();
    };
  }
  function budgetItems() {
    return [...document.querySelectorAll('.line-item')].map((row) => ({
      tipo: row.querySelector('.item-type').value,
      referencia_id: Number(row.querySelector('.item-ref').value),
      quantidade: Number(row.querySelector('.item-qty').value),
    }));
  }
  function updateTotal() {
    if (!$('#budget-total')) return;
    const total = budgetItems().reduce((s, i) => {
      const r = state[i.tipo === 'servico' ? 'servicos' : 'estoque'].find(
        (x) => x.id === i.referencia_id,
      );
      return s + (r ? (i.tipo === 'servico' ? r.preco : r.venda) * i.quantidade : 0);
    }, 0);
    $('#budget-total').textContent = 'Total estimado: ' + reais(total);
  }

  return { vehicles, addItem, budgetItems };
}
