const { fail } = require('../shared/errors');
async function readJson(req, limit) {
  if (!(req.headers['content-type'] || '').startsWith('application/json'))
    fail('Use application/json.', 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail('Requisição muito grande.', 413);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return body;
  } catch {
    fail('JSON inválido.');
  }
}
module.exports = { readJson };
