import { isDemo } from './mode.js';
let demo;
export async function api(url, method = 'GET', body) {
  if (isDemo) {
    demo ??= import('../demo/runtime.js');
    return (await demo).api(url, method, body);
  }
  const r = await fetch('/api/' + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.erro || 'Erro na requisição.');
  return data;
}
