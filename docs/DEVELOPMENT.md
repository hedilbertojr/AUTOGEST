# Desenvolvimento e manutenção

## Comandos na raiz

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run format:check
npm.cmd run dev
```

`npm ci` instala o Prettier na versão fixada pelo lockfile. A aplicação e os testes usam apenas recursos nativos do Node e funcionam sem instalar dependências. O comando `format` reescreve a formatação; `format:check` só verifica.

## Alterações

1. Mantenha SQL no repositório ou nas migrações, e regras de atendimento nos serviços.
2. Valide entrada antes de gravar. Nunca use preço enviado pelo navegador para calcular orçamento.
3. Faça alterações relacionadas de estoque e atendimento em uma única transação.
4. Adicione testes de regressão para bugs e mudanças no fluxo de negócio.
5. Execute verificação de sintaxe, testes e verificação de formatação antes de entregar.

Para uma mudança no banco, adicione `003-descricao.sql` e valide a abertura de um banco existente. O teste de persistência cobre a atualização de um banco com cadastros e a preservação do catálogo.

## Backup e restauração

Execute `npm.cmd run backup` na raiz. O script usa a API de backup do SQLite, compatível com o modo WAL, e grava uma cópia consistente em `backend/backups`. Proteja as cópias, pois contêm os dados da oficina.

Para restaurar sem sobrescrever o banco atual:

1. Encerre a aplicação com `Ctrl+C`.
2. Copie o backup escolhido para um nome novo, como `backend/data/restaurado.db`.
3. Em `backend/.env`, configure `DB_PATH=data/restaurado.db`.
4. Inicie a aplicação e confira os registros.

Nunca copie apenas o arquivo `.db` de um banco em uso: alterações recentes podem estar no arquivo WAL. Use o comando de backup.
