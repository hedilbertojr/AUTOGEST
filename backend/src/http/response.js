function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}
function sendError(res, error, logger = console) {
  const conflict = /UNIQUE constraint/.test(error.message);
  const missing = error.code === 'ENOENT' || error.code === 'EISDIR';
  const status = error.status || (conflict ? 409 : missing ? 404 : 500);
  if (status === 500) logger.error(error);
  json(res, status, {
    erro: conflict
      ? 'Já existe um registro com estes dados.'
      : missing
        ? 'Arquivo não encontrado.'
        : status === 500
          ? 'Erro interno do servidor.'
          : error.message,
  });
}
module.exports = { json, sendError };
