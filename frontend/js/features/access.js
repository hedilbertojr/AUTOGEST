import { icon, brandMark } from '../core/icons.js';
import { api } from '../core/api.js';
import { session } from '../core/session.js';
import { isDemo } from '../core/mode.js';
import { escapeHtml } from '../core/format.js';
import { $ } from '../core/dom.js';

export async function initializeAccess(onReady, onClear) {
  const gate = $('#access-panel');
  function lock() {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    document.body.classList.add('access-locked');
    gate.hidden = false;
  }
  async function enter(user) {
    session.user = user;
    gate.hidden = true;
    document.body.classList.remove('access-locked');
    $('#account-name').innerHTML =
      '<strong>' +
      escapeHtml(user.nome) +
      '</strong><small>' +
      (user.papel === 'admin' ? 'Administrador' : 'Mecânico') +
      '</small>';
    $('#account-avatar').textContent = user.nome
      .split(/\s+/)
      .filter((part) => /\p{L}/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    await onReady();
  }
  function login(message = '') {
    session.user = null;
    session.csrf = null;
    onClear();
    lock();
    gate.innerHTML = `<div class="access-card"><div class="access-brand">${brandMark()}</div><p class="eyebrow">ACESSO À OFICINA</p><h1>Bem-vindo de volta</h1><p>Entre com a conta fornecida pelo dono da oficina.</p><form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Senha<input name="senha" type="password" autocomplete="current-password" maxlength="128" required></label><p id="access-error" role="alert">${escapeHtml(message)}</p><button type="submit">${icon('arrow-right')}Entrar no sistema</button></form><p class="note">Primeiro acesso do dono: no terminal do projeto, execute <code>npm.cmd run admin:create</code>. Se esqueceu a senha, peça uma redefinição ao administrador.</p></div>`;
    $('#login-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target,
        button = form.querySelector('button');
      button.disabled = true;
      $('#access-error').textContent = '';
      try {
        const result = await api('auth/login', 'POST', Object.fromEntries(new FormData(form)));
        session.user = result.usuario;
        session.csrf = result.csrf;
        form.reset();
        if (result.usuario.trocar_senha) password(true);
        else await enter(result.usuario);
      } catch (error) {
        $('#access-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  function demo() {
    session.user = null;
    session.csrf = null;
    onClear();
    lock();
    gate.innerHTML = `<div class="access-card"><div class="access-brand">${brandMark()}</div><p class="eyebrow">PORTFÓLIO INTERATIVO</p><h1>Escolha um perfil</h1><p>Explore as telas do dono e do mecânico com dados fictícios.</p><div class="demo-profiles"><button id="demo-admin">${icon('briefcase-business')}<span>Explorar como dono<small>Gestão completa da oficina</small></span>${icon('arrow-right')}</button><button class="secondary" id="demo-operator">${icon('wrench')}<span>Explorar como mecânico<small>Ordens atribuídas à equipe</small></span>${icon('arrow-right')}</button></div><p class="note">Esta é uma simulação pública de permissões. Não use dados ou senhas reais. A autenticação segura roda na versão com servidor.</p></div>`;
    $('#demo-admin').onclick = () => enter({ id: 1, nome: 'Dono · Exemplo', papel: 'admin' });
    $('#demo-operator').onclick = () =>
      enter({ id: 2, nome: 'Mecânico · Exemplo', papel: 'operador' });
  }
  function password(forced = false) {
    lock();
    gate.innerHTML = `<div class="access-card"><div class="access-brand">${brandMark()}</div><h1>${forced ? 'Crie sua senha pessoal' : 'Alterar minha senha'}</h1><p>${forced ? 'Sua senha é temporária. Troque-a antes de acessar a oficina.' : 'Após salvar, todas as suas sessões serão encerradas.'}</p><form id="password-form"><label>Senha atual<input name="senha_atual" type="password" autocomplete="current-password" maxlength="128" required></label><label>Nova senha<input name="nova_senha" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Confirme a nova senha<input name="confirmacao" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><p class="note">Use de 12 a 128 caracteres. Prefira uma frase longa e exclusiva.</p><p id="access-error" role="alert"></p><button type="submit">${icon('lock-keyhole')}Salvar nova senha</button></form><button id="password-back" class="ghost">${forced ? 'Sair' : 'Voltar'}</button></div>`;
    $('#password-form').onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const button = event.target.querySelector('button');
      if (data.nova_senha !== data.confirmacao) {
        $('#access-error').textContent = 'As senhas não coincidem.';
        return;
      }
      button.disabled = true;
      try {
        await api('auth/password', 'POST', data);
        login('Senha alterada. Faça login com sua nova senha.');
      } catch (error) {
        $('#access-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    $('#password-back').onclick = forced ? logout : () => enter(session.user);
  }
  async function logout() {
    if (!isDemo) {
      try {
        await api('auth/logout', 'POST', {});
      } catch (error) {
        if (error.status !== 401) {
          window.alert(error.message);
          return;
        }
      }
    }
    isDemo ? demo() : login();
  }
  $('#logout').onclick = logout;
  $('#change-password').hidden = isDemo;
  $('#change-password').onclick = () => password(false);
  window.addEventListener('auth-expired', () => {
    if (session.user) login('Sua sessão expirou. Faça login novamente.');
  });
  if (isDemo) {
    demo();
    return;
  }
  try {
    const result = await api('auth/session');
    session.user = result.usuario;
    session.csrf = result.csrf;
    if (result.usuario.trocar_senha) password(true);
    else await enter(result.usuario);
  } catch (error) {
    login(error.status === 401 ? '' : error.message);
  }
}
