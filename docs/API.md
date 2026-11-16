# API local

Base: `http://127.0.0.1:3000/api`. Escritas exigem `Content-Type: application/json` e corpo de até 1 MiB. As respostas de erro usam `{ "erro": "mensagem" }`.

## Consultas

`GET /health` retorna `{ "status": "ok" }`.

`GET /clientes`, `/veiculos`, `/servicos`, `/estoque`, `/orcamentos`, `/ordens`, `/notas` e `/notificacoes` listam os registros. Acrescente `/:id` para consultar um registro; o detalhe do orçamento inclui `itens`.

## Cadastros

| Método e rota        | Campos                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `POST /clientes`     | `nome`, `telefone`, `email` opcional                                |
| `POST /veiculos`     | `cliente_id`, `placa`, `marca`, `modelo`, `ano`                     |
| `POST /servicos`     | `nome`, `categoria`, `preco` em reais                               |
| `POST /estoque`      | `codigo`, `nome`, `quantidade`, `minimo`, `custo`, `venda` em reais |
| `PATCH /estoque/:id` | `quantidade`: novo saldo absoluto                                   |

## Orçamento

`POST /orcamentos`:

```json
{
  "cliente_id": 1,
  "veiculo_id": 1,
  "diagnostico": "Troca de escapamento",
  "itens": [
    { "tipo": "servico", "referencia_id": 1, "quantidade": 1 },
    { "tipo": "peca", "referencia_id": 1, "quantidade": 2 }
  ]
}
```

Os IDs de exemplo precisam existir. Para `servico`, a referência é um registro de serviços; para `peca`, é um registro do estoque. Quantidades devem ser inteiros positivos. O total da resposta está em centavos.

## Ações

Envie `{}` como corpo nas ações sem campos.

| Método e rota                   | Resultado                                          |
| ------------------------------- | -------------------------------------------------- |
| `POST /orcamentos/:id/aprovar`  | Aprova orçamento pendente                          |
| `POST /orcamentos/:id/gerar-os` | Cria OS e baixa estoque                            |
| `POST /orcamentos/:id/whatsapp` | Prepara link e registra histórico                  |
| `PATCH /ordens/:id`             | Avança o status com `{ "status": "em_andamento" }` |
| `POST /ordens/:id/whatsapp`     | Prepara aviso de status                            |
| `POST /ordens/:id/nota`         | Cria comprovante interno sem valor fiscal          |

Transições da OS: `aberta → em_andamento → finalizada → entregue`.

## Códigos de resposta

| Código | Significado                                                    |
| ------ | -------------------------------------------------------------- |
| 200    | Consulta ou atualização concluída                              |
| 201    | Operação POST concluída                                        |
| 400    | Campo, JSON ou transição de entrada inválidos                  |
| 403    | Origem externa ou acesso a arquivo restrito                    |
| 404    | Registro ou rota inexistente                                   |
| 405    | Método ou cadastro não permitido                               |
| 409    | Duplicidade, falta de estoque ou conflito com a situação atual |
| 413    | Corpo acima do limite                                          |
| 415    | Content-Type incompatível                                      |
| 500    | Falha interna; detalhes apenas no terminal                     |
