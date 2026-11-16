export const escapeHtml = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const reais = (v) =>
  (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const labels = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
  link_gerado: 'Link gerado',
};
export const badge = (v) =>
  `<span class="badge ${['aprovado', 'finalizada', 'entregue'].includes(v) ? 'green' : ['pendente', 'aberta'].includes(v) ? 'amber' : ''}">${escapeHtml(labels[v] || v)}</span>`;
