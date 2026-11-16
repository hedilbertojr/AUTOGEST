# AutoGest

**Projeto de portfólio de [Hedilberto Junior](https://github.com/hedilbertojr).**

[Explorar demonstração](https://hedilbertojr.github.io/AUTOGEST/) · [Como funciona a demo](docs/PORTFOLIO.md)

A versão online usa dados fictícios e armazenamento no navegador de cada visitante. O backend Node.js/SQLite completo está neste repositório para execução local. A demo reutiliza as mesmas regras de negócio.

Gestão local de oficina com Node.js 24+, SQLite persistente e interface em português. Projeto organizado em camadas, com migrações, testes e ferramentas de manutenção.

## Iniciar

No VS Code, abra **esta pasta `autogest`** e execute na raiz:

```powershell
npm.cmd start
```

Abra **http://127.0.0.1:3000**. Para encerrar, use `Ctrl+C`.

Não é preciso instalar pacotes para executar a aplicação. Em desenvolvimento, rode `npm.cmd ci` para instalar o Prettier. Também é possível usar `node backend/src/server.js`.

Se já houver um servidor da versão anterior aberto, encerre-o antes de iniciar esta versão. O ponto de entrada antigo `backend/server.js` continua disponível para atalhos existentes.

## Estrutura

```text
autogest/
├── backend/
│   ├── src/
│   │   ├── config/          # Ambiente e caminhos
│   │   ├── database/
│   │   │   ├── migrations/  # Evolução versionada do banco
│   │   │   └── seeds/       # Catálogo inicial
│   │   ├── http/            # JSON, erros e arquivos estáticos
│   │   ├── repositories/    # Consultas SQL
│   │   ├── routes/          # Endpoints
│   │   ├── services/        # Regras de negócio
│   │   ├── shared/          # Validações e erros
│   │   ├── app.js           # Montagem da aplicação
│   │   └── server.js        # Inicialização e encerramento
│   ├── tests/              # Testes integrados e de regressão
│   ├── data/               # Novos bancos locais
│   ├── backups/            # Cópias consistentes do SQLite
│   ├── .env.example
│   └── package.json        # Atalhos para execução pelo backend
├── frontend/
│   ├── css/
│   ├── js/
│   │   ├── components/     # Painel, tabelas e campos
│   │   ├── config/         # Configuração das seções
│   │   ├── core/           # HTTP, DOM e formatação
│   │   ├── features/       # Editor de orçamento
│   │   └── app.js          # Estado e eventos da interface
│   └── index.html
├── docs/                   # Arquitetura, API e manutenção
├── scripts/                # Verificação e backup
├── .vscode/                # Preferências do editor
├── .editorconfig
├── .prettierrc.json
├── package.json
└── package-lock.json
```

## Funcionalidades

- Cadastro de clientes e veículos com validações e vínculo de propriedade.
- Catálogo inicial com 21 serviços em Escape, Ar-Condicionado, Pneus e Rodas e Estética.
- Peças, custo e preço de venda, ajuste de saldo e alerta de reposição.
- Orçamentos com serviços e peças, diagnóstico e preços calculados no servidor em centavos.
- Aprovação e geração de OS com baixa transacional de estoque, sem duplicidades.
- Fluxo da OS: aberta → em andamento → finalizada → entregue.
- Comprovantes internos únicos por OS concluída, **sem valor fiscal**.
- Links de WhatsApp e histórico de preparação. O operador realiza o envio no WhatsApp.
- Busca e interface adaptada para computador e celular.

Os preços do catálogo são exemplos. A aplicação inicia sem clientes ou atendimentos fictícios.

## Configuração e dados existentes

A configuração é opcional. Para mudar porta, host ou banco, copie `backend/.env.example` para `backend/.env`.

| Variável  | Padrão                                         |
| --------- | ---------------------------------------------- |
| `PORT`    | `3000`                                         |
| `HOST`    | `127.0.0.1`                                    |
| `DB_PATH` | `data/autogest.db`, relativo à pasta `backend` |

**Compatibilidade:** quando existe `backend/autogest.db` da versão anterior e `DB_PATH` não está definido, a aplicação continua usando esse banco. As migrações preservam os cadastros e preços existentes. Ao criar um `.env` em uma instalação antiga, use `DB_PATH=autogest.db` para continuar no mesmo arquivo.

O exemplo `.env.example` aponta para `data/autogest.db`, indicado para instalações novas. Não altere o caminho em uma instalação com dados sem conferir qual banco deseja abrir.

A configuração padrão atende somente esta máquina. Esta versão não possui autenticação, SMTP ou emissão NF-e/NFS-e oficial; mantenha o uso local.

## Comandos

Execute na raiz `autogest`:

| Comando                    | Finalidade                                           |
| -------------------------- | ---------------------------------------------------- |
| `npm.cmd start`            | Iniciar                                              |
| `npm.cmd run dev`          | Reiniciar automaticamente após alterações no backend |
| `npm.cmd test`             | Testar regras, API e persistência em bancos isolados |
| `npm.cmd run check`        | Verificar sintaxe de todos os módulos                |
| `npm.cmd run format`       | Padronizar a formatação                              |
| `npm.cmd run format:check` | Conferir a formatação                                |
| `npm.cmd run backup`       | Criar backup consistente em `backend/backups`        |

Os dois comandos de formatação exigem `npm.cmd ci`. Em outros terminais, `npm` também funciona.

## Primeiro atendimento

1. Cadastre João Teste, telefone `11999998888`, e-mail `joao@teste.com`.
2. Cadastre o veículo do João: `ABC1D23`, Fiat Uno, 2020.
3. Cadastre `FLT-001`, Filtro de óleo, quantidade 10, mínimo 2, custo 15, venda 35.
4. Crie um orçamento com Troca de escapamento, Recarga de gás e 2 filtros. Total de exemplo: R$ 540,00.
5. Confira os detalhes, prepare o link WhatsApp e aprove o orçamento.
6. Gere a OS: o estoque deve cair para 8.
7. Avance a OS até finalizada e entregue; gere o comprovante interno.
8. Confira Comprovantes e Comunicações.

## Documentação

- [Arquitetura e responsabilidades](docs/ARCHITECTURE.md)
- [Rotas e contratos da API](docs/API.md)
- [Desenvolvimento, backup e restauração](docs/DEVELOPMENT.md)
