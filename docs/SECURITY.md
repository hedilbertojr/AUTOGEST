# Acesso, perfis e senhas

## Primeiro acesso do dono

No terminal, na pasta do projeto:

```powershell
npm.cmd run admin:create
npm.cmd start
```

O primeiro comando solicita nome, e-mail e uma senha de 12 a 128 caracteres, com entrada oculta e confirmação. Não existe senha padrão e não há cadastro público de administrador. O comando só funciona enquanto o banco ainda não tem usuários.

Abra `http://127.0.0.1:3000` e entre com os dados escolhidos. Em **Usuários**, cadastre os mecânicos, atribua o perfil **Mecânico / operador** e defina uma senha temporária. O sistema exige que a pessoa troque essa senha antes de trabalhar.

## Permissões

| Ação                                    | Administrador / dono | Mecânico / operador                   |
| --------------------------------------- | -------------------- | ------------------------------------- |
| Criar, editar e desativar usuários      | Sim                  | Não                                   |
| Definir perfis e redefinir senhas       | Sim                  | Não                                   |
| Clientes, veículos, catálogo e estoque  | Sim                  | Não                                   |
| Orçamentos, aprovação e criação de OS   | Sim                  | Não                                   |
| Atribuir uma OS ao mecânico             | Sim                  | Não                                   |
| Consultar ordens                        | Todas                | Somente as atribuídas à própria conta |
| Ver diagnóstico e itens de trabalho     | Sim                  | Somente nas próprias OS, sem preços   |
| Iniciar e finalizar serviço             | Sim                  | Somente nas próprias OS               |
| Marcar entrega e gerar comprovante      | Sim                  | Não                                   |
| Consultar preços, totais e comunicações | Sim                  | Não                                   |
| Trocar a própria senha e sair           | Sim                  | Sim                                   |
| Consultar auditoria                     | Sim                  | Não                                   |

O dono atribui o serviço em **Ordens de serviço → Atribuir mecânico**. Sem essa atribuição, o serviço não aparece para o operador.

As permissões são aplicadas em cada requisição no servidor. Esconder botões na interface apenas melhora a navegação; não substitui a autorização.

## Proteções implementadas

- Hash scrypt com salt aleatório de 16 bytes e parâmetros N=131072, r=8, p=1. Senhas não são armazenadas em texto puro nem devolvidas pela API.
- Sessões opacas aleatórias de 256 bits. O banco armazena o hash do token, e o navegador recebe o token somente em cookie HttpOnly e SameSite=Strict.
- CSRF obrigatório para alterações autenticadas, além da verificação de origem. O token CSRF fica em memória na página; não é uma credencial de login.
- Em produção, cookie Secure com prefixo `__Host-`, associado ao domínio configurado em `APP_ORIGIN`.
- Expiração após 30 minutos sem atividade ou 8 horas de sessão, mesmo que exista atividade.
- Limite de 10 tentativas por conta e 40 por IP em uma janela de 15 minutos. A resposta de login não distingue conta inexistente, desativada ou senha incorreta.
- Alterar a própria senha, redefinir a senha ou editar/desativar uma conta revoga as sessões correspondentes.
- O próprio administrador não pode desativar nem remover o perfil administrativo de sua conta. O sistema também protege o último administrador ativo.
- Registros de acesso, alterações de usuários, redefinição de senha e atribuição de OS, sem gravar senhas ou tokens nos eventos.

## Hospedagem real

GitHub Pages hospeda a demonstração estática. Não executa o servidor de autenticação nem SQLite. A demo pública permite escolher perfis fictícios e não solicita credenciais reais. A gestão de contas e senhas funciona na versão com servidor.

Para acesso real pela internet, hospede o backend Node.js com armazenamento persistente do SQLite e HTTPS. Configure:

```env
NODE_ENV=production
APP_ORIGIN=https://sua-oficina.exemplo.com
SESSION_SECURE=true
HOST=0.0.0.0
```

`APP_ORIGIN` deve ser o endereço externo exato, sem barra final. O proxy HTTPS deve preservar o Host original. O servidor não confia em cabeçalhos `X-Forwarded-*` para definir a identidade do cliente ou ativar/desativar cookies seguros. Atrás de um proxy, o limite por IP pode agrupar visitantes; o limite por conta continua ativo.

Não há recuperação por e-mail, autenticação de dois fatores ou integração com provedores externos nesta versão. Um administrador ativo pode redefinir a senha temporária de outro usuário. Guarde a credencial do dono e os backups em local seguro.

## Referências

- [OWASP: armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP: gestão de sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
