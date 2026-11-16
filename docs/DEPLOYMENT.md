# Backend autenticado na internet

A demo do GitHub Pages é pública e estática. Para usar contas reais do dono e dos mecânicos, é necessário um servidor Node.js 24 com HTTPS e armazenamento persistente.

Nenhum serviço pago é contratado pelo projeto. Antes de escolher um provedor, confirme que ele mantém um disco persistente entre reinícios e deploys. Não use o banco SQLite em disco temporário para dados reais.

## Requisitos

- Node.js 24, ou suporte ao Dockerfile incluído.
- Uma única instância do backend para este banco SQLite.
- Volume persistente, backups e espaço protegido para o banco.
- HTTPS na entrada e proxy que preserve o Host do endereço público.
- `NODE_ENV=production`, `APP_ORIGIN=https://endereco-publico`, `HOST=0.0.0.0` e `DB_PATH` no volume persistente.

## Contêiner

O Dockerfile prepara a aplicação para executar com usuário sem privilégios de root. O exemplo pressupõe um proxy HTTPS já configurado:

```sh
docker build -t autogest .
docker volume create autogest-data
docker run -d --name autogest \
  -p 127.0.0.1:3000:3000 \
  -v autogest-data:/data \
  -e APP_ORIGIN=https://sua-oficina.exemplo.com \
  autogest
docker exec -it autogest npm run admin:create
```

Troque o domínio de exemplo pelo endereço HTTPS real. O comando interativo cria a primeira conta do dono sem colocar a senha no histórico de comandos. O banco fica em `/data/autogest.db` no volume persistente. Não escale para múltiplas réplicas usando o mesmo arquivo SQLite.

O endpoint `/api/health` é público para monitoramento, mas todas as rotas de dados exigem login. O aplicativo não oferece acesso administrativo padrão nem cadastro público de contas.

O Dockerfile é um artefato de implantação; os testes automatizados verificam a aplicação Node.js. A imagem Docker precisa ser construída e validada no ambiente de hospedagem escolhido.
