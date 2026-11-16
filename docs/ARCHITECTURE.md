# Arquitetura

## Backend

O projeto usa Node.js 24 e SQLite integrado. O servidor é criado por `createApp(config)`, que recebe configuração e devolve uma instância isolada. Importar a aplicação não inicia uma porta nem abre um banco global.

O caminho de uma requisição é:

```text
HTTP → rota → serviço → repositório → SQLite
```

- `src/config`: carrega ambiente e valida opções de inicialização.
- `src/http`: leitura de JSON, limite de tamanho, resposta de erro e arquivos estáticos.
- `src/routes`: associa método, recurso e ação ao serviço correspondente.
- `src/services`: valida cadastros e aplica regras de orçamento, estoque e OS.
- `src/repositories`: concentra as consultas SQL e o acesso aos registros.
- `src/database`: conexão, transações, migrações versionadas e catálogo inicial.
- `src/shared`: erros de aplicação e funções de validação reutilizáveis.
- `src/app.js`: monta as dependências e cria o servidor.
- `src/server.js`: inicia o servidor e fecha conexões ao receber SIGINT/SIGTERM.

Uma camada separada de controllers não foi adicionada porque as rotas já são pequenas e delegam diretamente aos serviços. Adicione-a quando existir transformação HTTP que justifique essa responsabilidade.

## Consistência dos dados

Valores monetários são armazenados em centavos. O frontend envia preços em reais nos cadastros; no orçamento, o servidor consulta o preço cadastrado e ignora preços fornecidos pelo navegador. O orçamento guarda uma cópia do nome e preço de cada item.

Gerar uma OS valida a aprovação e o estoque de todas as peças, agrupa itens repetidos e baixa o saldo dentro de `BEGIN IMMEDIATE`. Se qualquer etapa falhar, a transação é desfeita. Restrições UNIQUE impedem duas OS para o mesmo orçamento e dois comprovantes para a mesma OS.

Migrações são aplicadas em ordem, uma única vez, com registro em `schema_migrations`. Para evoluir o banco, crie um novo arquivo SQL; não altere uma migração aplicada em instalações existentes. O catálogo inicial só é inserido quando a tabela está vazia.

## Frontend

O navegador carrega módulos ES nativos, sem etapa de build:

- `js/core`: comunicação HTTP, DOM e formatação/escape de texto.
- `js/config`: nomes e descrições das seções.
- `js/components`: painel, tabelas e campos reutilizáveis.
- `js/features`: editor de orçamento e seleção de peças/serviços.
- `js/app.js`: navegação, eventos, estado da página e coordenação das operações.

Texto vindo de registros é escapado antes de entrar em HTML. Links do WhatsApp são criados no servidor. O histórico registra a preparação do link e não a entrega de uma mensagem.

## Limites atuais

Uso local em uma máquina, sem autenticação, SMTP, emissão fiscal oficial ou multiempresa. O armazenamento SQLite usa uma conexão síncrona por instância. Não trate esta configuração como uma implantação pública ou como um serviço de alta concorrência.
