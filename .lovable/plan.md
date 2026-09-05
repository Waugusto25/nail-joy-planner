# Corrigir vencimentos das parcelas repetindo o mesmo mês

## O problema (confirmado no código)

No formulário de pedido da Loja, quando o pedido **não** está sendo unificado com uma parcela anterior, todas as parcelas recebem exatamente a mesma data de vencimento (a data de entrega informada). O avanço de +1 mês por parcela só é aplicado no caso de unificação. Por isso um parcelamento em 4x fica com 05/09/2026 nas quatro parcelas.

## Correção

- Aplicar sempre o avanço mensal: parcela 1 na data informada, parcela 2 em +1 mês, parcela 3 em +2 meses, e assim por diante — independentemente de haver unificação.
- Manter intactas as parcelas já pagas (elas continuam com o vencimento e o pagamento originais).
- Se não houver data informada, as parcelas continuam sem vencimento (como hoje).
- Respeitar meses mais curtos (dia 31 vira o último dia do mês) — a função de soma de meses já faz isso.
- Sem mudanças no banco; nada de dados existentes é reescrito por esta alteração.

## Detalhe técnico

- Arquivo: `src/components/app/store-order-form.tsx`, bloco de criação das parcelas (uso de `monthlyDue`).
- Trocar `due_date: paid.get(n)?.due_date ?? (merging ? monthlyDue : deliveryDate || null)` por `due_date: paid.get(n)?.due_date ?? monthlyDue`.
- `addMonthsISO` em `src/lib/store.ts` já é livre de fuso horário; nada muda nela.

## Verificação

- Criar um pedido de teste em 4x com entrega em 05/09/2026 e conferir vencimentos 05/09, 05/10, 05/11 e 05/12/2026 na tela e no banco; remover o pedido de teste depois.
- Conferir que um pedido unificado continua somando na primeira parcela e escalonando os meses.
