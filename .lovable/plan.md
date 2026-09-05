# Adicionar produto a um pedido já aberto

Hoje, para vender de novo para a mesma cliente, é preciso criar outro pedido. Este plano permite acrescentar itens ao pedido que já existe, mantendo um único card e um único histórico.

## 1. Botão no card do pedido

No card aberto (detalhes expandidos), aparece o botão **+ Adicionar Produto a este Pedido** quando o pedido ainda está em aberto: status Pendente ou Encomendado, ou quando existe pelo menos uma parcela pendente. Pedidos totalmente pagos e finalizados não mostram o botão.

## 2. Janela de inserção

Ao clicar, abre uma janela simples com:

- Lista de novos itens (nome + valor unitário), com **+ Adicionar item** e botão de remover.
- Total dos novos itens somado na hora e o novo valor total do pedido.
- Escolha de como cobrar:
  - **Manter as parcelas restantes** — o valor novo é dividido entre as parcelas que ainda estão pendentes.
  - **Redividir o saldo devedor em X parcelas** — informa o número de parcelas e o saldo devedor é redistribuído nesse número, com vencimentos mensais a partir do próximo vencimento em aberto (ou da data escolhida, se não houver).
- Botões Cancelar e Salvar.

Se o pedido não tiver nenhuma parcela pendente (tudo pago), a única opção oferecida é criar parcela(s) nova(s) para o valor acrescentado.

## 3. Recálculo

- Os novos itens entram na lista de produtos do pedido.
- O valor total do pedido passa a ser o valor anterior + os novos itens.
- Parcelas já pagas ficam intocadas (valor, vencimento e data de pagamento).
- O acréscimo é dividido apenas entre as parcelas pendentes; centavos de sobra vão para a primeira parcela pendente.
- Parcelas já unificadas em outro pedido continuam fora do cálculo.
- O resumo do card, a dashboard da loja, as mensagens de WhatsApp e o extrato em PDF passam a refletir o novo total automaticamente, pois todos leem os mesmos dados.

## Detalhes técnicos

- Sem migração: usa `store_order_items` e `store_order_installments` já existentes.
- Novo componente `src/components/app/store-order-add-items-dialog.tsx` (~150 linhas), com validação Zod dos itens e tokens semânticos do Tailwind.
- Nova função pura em `src/lib/store.ts`: `redistributeInstallments(order, addedCents, mode, count)` retornando as parcelas a atualizar/criar — testável e sem acesso ao banco, reaproveitando `splitInstallments` de `src/lib/salon.ts`.
- Gravação: `insert` em `store_order_items` (com `sort_order` continuando o último), `update` em `store_orders` (`amount_cents`, `item_name`, `installments`) e `update`/`insert` nas parcelas pendentes. Nada é apagado das parcelas pagas.
- Vencimentos calculados por `addMonthsISO` (mesma lógica local, sem deslocamento de fuso) — extraída de `store-order-form.tsx` para `src/lib/store.ts` para reuso.
- `store-order-card.tsx` ganha o botão e o estado de abertura do diálogo; a invalidação usa a chave `admin-store-orders` já em uso.
- Verificação: pedido de teste com uma parcela paga e duas pendentes, acréscimo de item, conferência dos valores no banco nos dois modos, e remoção do pedido de teste no fim. Nenhum dado real é tocado.
