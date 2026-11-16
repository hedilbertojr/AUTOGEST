const { fail } = require('./errors');
function str(v, label, max = 500) {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(`${label}: valor obrigatório (máximo ${max} caracteres).`);
  return v.trim();
}
function numeric(value, label) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '')
    fail(`${label}: informe um número válido.`);
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${label}: informe um número válido.`);
  return number;
}
function integer(value, label, min = 0) {
  const number = numeric(value, label);
  if (!Number.isSafeInteger(number) || number < min)
    fail(`${label}: informe um inteiro a partir de ${min}.`);
  return number;
}
function money(value) {
  const number = numeric(value, 'Preço');
  if (number < 0 || number > 1e8) fail('Preço inválido.');
  return Math.round(number * 100);
}

module.exports = { str, integer, money };
