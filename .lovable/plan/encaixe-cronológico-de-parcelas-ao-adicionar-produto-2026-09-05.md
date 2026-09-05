# Encaixe cronológico de parcelas ao adicionar produto

Hoje, ao acrescentar um produto a um pedido aberto, o valor novo é diluído em todas as parcelas pendentes (ou o saldo é redividido). O novo comportamento passa a ser o encaixe mês a mês descrito abaixo.

## 1. Escolha do parcelamento do novo item

No modal "Adicionar produto ao pedido", em lugar das opções atuais (manter parcelas / redividir saldo), aparece um único campo: **Parcelar o novo item em X vezes** (1x, 2x, 3x...). O valor dos itens acrescentados é dividido nesse número de vezes, com a sobra de centavos na primeira.

## 2. Regra de encaixe

- Parcelas já pagas: nenhuma alteração.
- Parcela 1 do novo item soma na 1ª parcela pendente existente, mantendo o vencimento já agendado.
- Parcela 2 do novo item soma na 2ª pendente, e assim por diante.
- Se o novo item tiver mais parcelas do que as pendentes existentes, as excedentes criam parcelas novas, uma por mês, contando +1 mês a partir do vencimento da última parcela existente (paga ou pendente).
- Nenhuma parcela pendente é removida e nenhum valor pendente antigo é redistribuído.

Exemplo: 1 pendente de R$ 58,93 em 10/09/2026 + item de R$ 100,00 em 5x resulta em 10/09 R$ 78,93; 10/10, 10/11, 10/12 e 10/01/2027 com R$ 20,00 cada.

## 3. Total e saldo

O total do pedido passa a ser o anterior + os itens novos; o saldo devedor é a soma das parcelas não pagas. O card, a dashboard, as mensagens de WhatsApp e o extrato em PDF leem esses mesmos dados e se atualizam sozinhos.

## 4. Exibição do acréscimo

Cada parcela que recebeu soma mostra, em letra pequena e discreta, algo como "Inclui R$ 20,00 do item acrescentado". A legenda já existente de valores vindos de pedido unificado continua funcionando em paralelo.

## Detalhes técnicos

- Migração: nova coluna `added_extra_cents integer not null default 0` em `store_order_installments` (acumulativa, somada a cada acréscimo), para não confundir com `merged_extra_cents`, que significa "valor vindo de outro pedido". Sem alteração de RLS/grants (tabela já configurada).
- `src/lib/store.ts`: substituir `redistributeInstallments` por função pura `appendItemInstallments(order, addedCents, count)` retornando `{ update, insert, totalInstallments, pendingBalanceCents }`. Sem `remove`. `update` traz `amount_cents` somado e `added_extra_cents` acumulado; `insert` traz `number`, `amount_cents`, `due_date` e `added_extra_cents`. Vencimentos por `addMonthsISO` a partir do último vencimento existente. Tipo `StoreOrderInstallment` e `fetchStoreOrders` ganham o campo novo.
- `store-order-add-items-dialog.tsx`: troca do bloco de modos pelo campo de número de parcelas; prévia mostrando valor de cada parcela nova e o cronograma resultante; gravação de itens, `update`/`insert` das parcelas e `update` do pedido (`amount_cents`, `item_name`, `installments`).
- `store-order-card.tsx`: legenda extra quando `added_extra_cents > 0`, no mesmo estilo da legenda de unificação.
- Testes: verificação da função pura nos casos 5x com 1 pendente, 2x com 3 pendentes, 3x com pedido totalmente pago; depois conferência no painel com pedido de teste criado e removido, sem tocar dados reais.
