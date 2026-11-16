# Portfólio no GitHub Pages

O AutoGest tem duas formas de execução:

- `npm start`: servidor Node.js com SQLite, destinado ao uso local.
- `npm run build:demo`: demonstração estática para GitHub Pages, gerada em `dist/`.

A demonstração reutiliza serviços, validações e rotas do backend, empacotados com esbuild. Um repositório em memória substitui o SQLite e salva os testes no localStorage do navegador. Os dados iniciais são exemplos fictícios e não vêm do banco da oficina. O botão Restaurar demonstração volta aos exemplos iniciais.

Orçamentos, aprovação, geração de OS, baixa de estoque e comprovantes podem ser testados. As comunicações mostram uma prévia; não abrem um contato de WhatsApp nem enviam mensagens. Cada visitante mantém seu próprio estado, sem compartilhamento de dados entre pessoas.

## Publicação

1. Publique o código-fonte no repositório público `hedilbertojr/AUTOGEST`.
2. Em **Settings → Pages → Source**, selecione **GitHub Actions**.
3. O workflow `.github/workflows/pages.yml` testa e publica o conteúdo de `dist/` a cada push na branch `main`.

Endereço planejado: `https://hedilbertojr.github.io/AUTOGEST/`.

O workflow executa instalação, verificação de sintaxe, formatação, testes do backend, testes da demo e build antes do deploy. O banco SQLite, backups, `.env`, `node_modules` e arquivos temporários ficam fora do Git.

## Testar a demo

```powershell
npm.cmd ci
npm.cmd run test:demo
npm.cmd run build:demo
```

Sirva a pasta `dist/` com um servidor HTTP estático. Não abra o HTML diretamente por `file://`, pois ele usa módulos JavaScript.
