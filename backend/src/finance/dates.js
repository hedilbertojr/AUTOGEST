const { fail } = require('../shared/errors');
const ZONE = 'America/Sao_Paulo';
function businessDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value)
      ? value.replace(' ', 'T') + 'Z'
      : value,
  );
  if (!Number.isFinite(date.getTime())) return null;
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function dateOnly(value, label = 'Data') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(`${label}: informe uma data válida.`);
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    fail(`${label}: informe uma data válida.`);
  return value;
}
function addDays(value, days) {
  const d = new Date(value + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function filters(input = {}, today = businessDate()) {
  const inicio = dateOnly(input.inicio || today.slice(0, 8) + '01', 'Início');
  const fim = dateOnly(input.fim || today, 'Fim');
  const days =
    Math.round((new Date(fim + 'T12:00:00Z') - new Date(inicio + 'T12:00:00Z')) / 86400000) + 1;
  if (days < 1 || days > 3660) fail('Escolha um período válido de até dez anos.');
  const mecanico_id = input.mecanico_id ? Number(input.mecanico_id) : null;
  if (mecanico_id !== null && (!Number.isSafeInteger(mecanico_id) || mecanico_id < 1))
    fail('Mecânico inválido.');
  return {
    inicio,
    fim,
    days,
    mecanico_id,
    anterior_inicio: addDays(inicio, -days),
    anterior_fim: addDays(inicio, -1),
    hoje: today,
  };
}
module.exports = { businessDate, dateOnly, addDays, filters, ZONE };
