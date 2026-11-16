const fs = require('node:fs/promises');
const path = require('node:path');
const { fail } = require('../shared/errors');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};
async function serveStatic(req, res, pathname, root) {
  if (!['GET', 'HEAD'].includes(req.method)) fail('Método não permitido.', 405);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    fail('Caminho inválido.');
  }
  const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
  if (relative.split(/[\\/]/).some((part) => part.startsWith('.')) || relative.includes('\0'))
    fail('Acesso não permitido.', 403);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) fail('Acesso não permitido.', 403);
  const data = await fs.readFile(file);
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : data);
}
module.exports = { serveStatic };
