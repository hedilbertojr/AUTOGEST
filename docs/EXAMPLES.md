# Peças, suprimentos e serviços de exemplo

O catálogo fictício contém **32 itens de estoque** (16 peças e 16 suprimentos) e **29 serviços** de mão de obra. Os valores e aplicações são ilustrativos, sem garantia de compatibilidade com veículos reais.

- Peças: filtros, pastilhas, discos de freio, velas, correias, palhetas, lâmpadas, componentes de escape e direção.
- Suprimentos: óleo, fluidos, aditivo, desengripante, limpa-freios, graxa, selante, produtos de limpeza, luvas, panos, lixas e fita.
- Serviços: catálogo inicial e oito serviços de manutenção, freios, motor, arrefecimento e diagnóstico.

## Como usar

Em **Orçamentos → Novo orçamento → Adicionar item**, selecione **Serviço**, **Peça** ou **Suprimento**. Os itens de estoque exibem unidade/embalagem, preço e saldo disponível.

Mão de obra compõe o orçamento e não possui saldo físico. Peças e suprimentos são baixados juntos ao gerar a OS aprovada. Falta de qualquer item impede toda a geração; repetir a operação não baixa novamente.

Luvas, panos, lixas e shampoo de consumo interno têm preço de venda zero. Podem ser incluídos para registrar consumo na OS sem cobrança ao cliente. O custo fica disponível para o administrador no estoque.

As quantidades representam unidades ou embalagens inteiras. Por exemplo, quatro unidades de óleo de 1 L equivalem a quatro frascos. Não são quantidades fracionárias extraídas de um recipiente maior.

Exemplo: Troca de óleo e filtro (R$ 80), 1 filtro de óleo (R$ 35), 4 frascos de óleo (R$ 48 cada) e 2 pares de luvas de consumo interno (R$ 0). Total ilustrativo: **R$ 307,00**. Ao gerar a OS, saem 1 filtro, 4 frascos e 2 pares de luvas.

## Base local

```powershell
npm.cmd run backup
npm.cmd run seed:examples
```

O comando de exemplos só acrescenta códigos e nomes ausentes. Não substitui nomes, quantidades ou preços já cadastrados. Rodá-lo novamente não duplica itens nem repõe estoque consumido. Cadastros novos de uma instalação normal não recebem esses exemplos sem o comando explícito.

## Portfólio

A demo inclui o catálogo automaticamente. Visitantes com dados antigos recebem os novos exemplos sem perder os testes anteriores. O botão **Restaurar demonstração** volta aos saldos iniciais e apaga os testes realizados naquele navegador.
