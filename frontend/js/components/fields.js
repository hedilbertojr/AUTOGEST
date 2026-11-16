import { escapeHtml } from '../core/format.js';
export function field(name, title, type = 'text', options = {}) {
  return `<label${options.wide ? ' class="wide"' : ''}>${title}<input name="${name}" type="${type}" ${options.optional ? '' : 'required'} ${options.min != null ? `min="${options.min}"` : ''} ${type === 'number' ? 'step="' + (options.step || '1') + '"' : ''} maxlength="${options.max || 150}" value="${escapeHtml(options.value ?? '')}"></label>`;
}
export function select(name, title, rows, label) {
  return `<label>${title}<select name="${name}" required><option value="">Selecione…</option>${rows.map((r) => `<option value="${r.id}">${escapeHtml(label(r))}</option>`).join('')}</select></label>`;
}
