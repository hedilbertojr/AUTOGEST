# BI e gestão financeira

A aba **BI e resultados**, exclusiva do administrador, reúne cinco relatórios:

- Visão geral: faturamento concluído, ticket, margem conhecida, resultado operacional estimado, comparação com período anterior de igual duração e evolução diária/mensal.
- Caixa e contas: recebimentos, pagamentos, saldos registrados, contas parciais/vencidas, baixas, estornos e projeção por vencimento para os próximos 30 dias.
- Equipe e serviços: OS por mecânico, serviços vendidos, faturamento, contribuição conhecida e tempo corrido entre início e conclusão.
- Consumos e estoque: peças e suprimentos baixados para OS, quantidades por unidade, custo histórico, saldo valorizado e reposição.
- Vendas e clientes: OS concluídas, ranking de clientes, aprovação/conversão dos orçamentos criados no período e regularização do histórico.

## Regras de cálculo

Todos os valores são armazenados em centavos. Datas de movimentos são datas civis; timestamps UTC do SQLite são convertidos para America/Sao_Paulo.

O faturamento de uma OS é reconhecido na conclusão. Gerar uma OS cria uma conta a receber, congela os custos diretos dos itens e registra o consumo de materiais em uma transação. Aprovar um orçamento não gera faturamento nem caixa. Os custos congelados não mudam quando o catálogo é atualizado.

O caixa só muda mediante baixa registrada, inclusive parcial. O estorno é um novo movimento com a data efetiva, preservando o movimento original. Não é permitido liquidar valor acima do saldo, registrar baixa futura, estornar duas vezes a mesma baixa ou cancelar títulos com pagamentos líquidos. Nenhuma ação executa transferência bancária.

Resultado operacional estimado = faturamento de OS concluídas − custos diretos históricos + outras receitas − despesas operacionais por competência. Compras de estoque afetam contas/caixa; os materiais afetam o resultado na conclusão da OS. Aportes e retiradas ficam fora do resultado. Impostos, encargos, taxas e demais despesas precisam ser cadastrados. Não lance o mesmo gasto simultaneamente como custo direto e despesa operacional.

Custos desconhecidos são nulos, não zero. O painel sinaliza custos incompletos e permite complementar valores históricos desconhecidos. Um custo histórico já conhecido é preservado. Serviços novos podem ter custo direto informado; custos do catálogo valem para próximas OS.

OS antigas sem data de conclusão não recebem uma data presumida. A tela permite informar a data e responsável reais antes de incluí-las no faturamento. Registros financeiros antigos não são presumidos como pagos.

O filtro de mecânico afeta vendas concluídas, serviços e consumos. Caixa, despesas, contas, funil de orçamentos e estoque atual continuam mostrando a oficina inteira. Não há rateio automático de despesas gerais. Tempo corrido não equivale a horas trabalhadas/faturáveis.

Contas e estoque mostram a posição atual, identificada na tela. Os saldos de caixa do período usam somente movimentos até o encerramento selecionado. A previsão começa no saldo atual registrado e considera contas abertas com vencimento nos próximos 30 dias; vencidos aparecem separados e não são presumidos como recebidos.

O saldo inicial pode ser registrado como aporte e baixado na data correta. O painel não consulta bancos, não realiza conciliação, não calcula folha nem apura tributos automaticamente. É um demonstrativo gerencial, não uma DRE fiscal.

## Uso

1. Informe custos diretos em Serviços ou em BI → Equipe e serviços → Cadastrar custo de serviço.
2. Gere as OS normalmente e atribua os responsáveis.
3. Em Caixa e contas, registre despesas, compras, aportes e outras receitas. Informar uma conta não executa a baixa.
4. Registre recebimentos/pagamentos efetivos, com data e meio. Use estornos para correções, mantendo o histórico.
5. Filtre período/equipe, exporte CSV ou imprima o relatório selecionado. OS antigas podem ser regularizadas em Vendas e clientes.

O GitHub Pages contém somente exemplos fictícios, persistidos no navegador do visitante. Nenhum dado financeiro, usuário, senha ou banco local é incluído no build. A versão com servidor usa SQLite, sessões, CSRF, permissões e auditoria de alterações financeiras.

## API

Todas as rotas abaixo exigem administrador com senha regularizada. Mutações exigem CSRF.

| Método | Rota                                                    | Operação                                               |
| ------ | ------------------------------------------------------- | ------------------------------------------------------ |
| GET    | /api/bi?inicio=AAAA-MM-DD&fim=AAAA-MM-DD&mecanico_id=ID | Relatório consolidado                                  |
| POST   | /api/financeiro/titulos                                 | Criar título manual                                    |
| PATCH  | /api/financeiro/titulos/:id                             | Editar vencimento, descrição, categoria e valor manual |
| POST   | /api/financeiro/titulos/:id/baixas                      | Registrar baixa parcial/total                          |
| POST   | /api/financeiro/titulos/:id/cancelar                    | Cancelar título manual sem pagamentos líquidos         |
| POST   | /api/financeiro/movimentos/:id/estornar                 | Estornar baixa com motivo                              |
| POST   | /api/financeiro/ordens/:id/conta                        | Recuperar/criar conta de uma OS antiga                 |
| GET    | /api/financeiro/ordens/:id                              | Consultar custos históricos da OS                      |
| POST   | /api/financeiro/ordens/:id/regularizar                  | Complementar data/responsável e custos desconhecidos   |
| PATCH  | /api/financeiro/servicos/:id/custo                      | Definir custo direto futuro                            |

Naturezas manuais: despesa_operacional, compra_estoque, outra_receita, aporte e retirada. A natureza venda_os é criada pelo fluxo de OS. Formas: pix, dinheiro, cartao_credito, cartao_debito, boleto, transferencia e outro.
