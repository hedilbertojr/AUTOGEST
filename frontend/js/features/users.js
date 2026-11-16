import { api } from '../core/api.js';
import { escapeHtml } from '../core/format.js';
import { isDemo } from '../core/mode.js';
import { session } from '../core/session.js';

function editor(title, html, submit) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form class="user-form"><div class="dialog-heading"><h2>${escapeHtml(title)}</h2><button type="button" class="ghost" data-close aria-label="Fechar">✕</button></div>${html}<p class="user-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-close>Cancelar</button><button type="submit">Salvar</button></div></form>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dialog.close()));
  dialog.onclose = () => dialog.remove();
  dialog.querySelector('form').onsubmit = async (event) => {
    event.preventDefault();
    const b = event.target.querySelector('[type=submit]');
    b.disabled = true;
    try {
      await submit(Object.fromEntries(new FormData(event.target)));
      dialog.close();
    } catch (error) {
      dialog.querySelector('.user-error').textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
  dialog.showModal();
}
const input = (name, label, value = '', type = 'text') =>
  `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" required maxlength="${type === 'password' ? 128 : 150}" ${type === 'password' ? 'minlength="12" autocomplete="new-password"' : ''}></label>`;
const role = (value = 'operador') =>
  `<label>Perfil<select name="papel"><option value="operador" ${value === 'operador' ? 'selected' : ''}>Mecânico / operador</option><option value="admin" ${value === 'admin' ? 'selected' : ''}>Administrador / dono</option></select></label>`;
export function createUser(onSaved) {
  if (isDemo)
    return window.alert(
      'Criação de contas e senhas está disponível na versão com servidor. Esta demo usa somente perfis fictícios.',
    );
  editor(
    'Novo usuário',
    input('nome', 'Nome') +
      input('email', 'E-mail de acesso', '', 'email') +
      role() +
      input('senha', 'Senha temporária', '', 'password') +
      '<p class="note">O usuário precisará trocar a senha no primeiro acesso. Entregue a senha diretamente à pessoa.</p>',
    async (body) => {
      await api('usuarios', 'POST', body);
      await onSaved();
    },
  );
}
export async function userAction(action, id, state, onSaved) {
  if (isDemo) return window.alert('Gerenciamento de usuários disponível na versão com servidor.');
  const user = state.usuarios.find((u) => u.id === id);
  if (action === 'user-edit')
    editor(
      'Editar usuário',
      input('nome', 'Nome', user.nome) +
        input('email', 'E-mail de acesso', user.email, 'email') +
        role(user.papel),
      async (body) => {
        await api('usuarios/' + id, 'PATCH', body);
        await onSaved();
      },
    );
  if (action === 'user-toggle') {
    if (
      !window.confirm(
        `${user.ativo ? 'Desativar' : 'Reativar'} a conta de ${user.nome}? As sessões abertas serão encerradas.`,
      )
    )
      return;
    await api('usuarios/' + id, 'PATCH', { ativo: !user.ativo });
    await onSaved();
  }
  if (action === 'user-password')
    editor(
      'Redefinir senha · ' + user.nome,
      input('senha', 'Nova senha temporária', '', 'password') +
        '<p class="note">As sessões desse usuário serão encerradas. A troca será obrigatória no próximo login.</p>',
      async (body) => {
        await api('usuarios/' + id + '/senha', 'POST', body);
        await onSaved();
      },
    );
}
export function assignOrder(orderId, users, onSaved) {
  const choices = users.filter((u) => u.papel === 'operador' && u.ativo);
  editor(
    'Atribuir OS #' + orderId,
    `<label>Mecânico responsável<select name="operador_id"><option value="">Sem responsável</option>${choices.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('')}</select></label>`,
    async (body) => {
      await api(`ordens/${orderId}/responsavel`, 'PATCH', {
        operador_id: body.operador_id ? Number(body.operador_id) : null,
      });
      await onSaved();
    },
  );
}
export function usersTable(rows) {
  if (isDemo)
    return '<div class="empty"><strong>Gestão de usuários do dono</strong><p>Na versão com servidor, o administrador cria contas, define perfis, desativa acessos e redefine senhas temporárias.</p><p>A demo não cria credenciais reais.</p></div>';
  return (
    '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Conta</th><th>Ações</th></tr></thead><tbody>' +
    rows
      .map(
        (u) =>
          `<tr><td>${escapeHtml(u.nome)}</td><td>${escapeHtml(u.email)}</td><td>${u.papel === 'admin' ? 'Administrador' : 'Mecânico'}</td><td>${u.ativo ? 'Ativa' : 'Desativada'}${u.trocar_senha ? ' · Senha temporária' : ''}</td><td><div class="actions"><button data-action="user-edit" data-id="${u.id}">Editar</button>${u.id !== session.user.id ? `<button data-action="user-toggle" data-id="${u.id}">${u.ativo ? 'Desativar' : 'Reativar'}</button><button data-action="user-password" data-id="${u.id}">Redefinir senha</button>` : ''}</div></td></tr>`,
      )
      .join('') +
    '</tbody></table></div>'
  );
}
