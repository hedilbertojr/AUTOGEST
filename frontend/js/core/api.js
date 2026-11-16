import { session } from './session.js';
import { isDemo } from './mode.js';
let demo;
export async function api(url, method = 'GET', body) {
  if (isDemo) {
    demo ??= import('../demo/runtime.js');
    if (['usuarios', 'auditoria'].includes(url)) return [];
    if (session.user?.papel === 'operador') {
      if (!/^ordens(?:\/\d+)?$/.test(url) || !['GET', 'PATCH'].includes(method))
        throw Error('Acesso restrito ao administrador.');
      if (method === 'PATCH' && !['em_andamento', 'finalizada'].includes(body?.status))
        throw Error('Operação exclusiva do dono.');
      const result = await (await demo).api(url, method, body);
      const clean = (r) => ({
        id: r.id,
        status: r.status,
        placa: r.placa || 'Veículo de exemplo',
        diagnostico: 'Atendimento de demonstração',
        itens: [],
      });
      return Array.isArray(result) ? result.map(clean) : clean(result);
    }
    return (await demo).api(url, method, body);
  }
  const r = await fetch('/api/' + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && session.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    const error = Error(data.erro || 'Erro na requisição.');
    error.status = r.status;
    if (r.status === 401 && !url.startsWith('auth/'))
      window.dispatchEvent(new Event('auth-expired'));
    throw error;
  }
  return data;
}
