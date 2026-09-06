# Corrigir a numeração de parcelas por produto no extrato PDF

## Problema
No extrato PDF, a lista `[1, 2, 3]` ao lado de cada produto hoje é calculada por preenchimento sequencial a partir da parcela 1 (`allocateItemsToInstallments` em `src/lib/store.ts`). Isso ignora como o pedido evoluiu de fato:

- Produto original parcelado em 3x → correto: aparece `[1, 2, 3]`.
- Produto **adicionado depois**, com parcelas 1 e 2 já pagas, encaixado nas parcelas 3, 4 e 5 → hoje aparece errado (a partir de 1); o correto é `[3, 4, 5]`.

O banco já registra essa informação: cada parcela guarda em `added_extra_cents` quanto daquele mês veio de produtos acrescentados depois.

## Solução
Reescrever a alocação de itens por parcela em duas camadas, sem nenhuma mudança no banco:

1. **Separar itens originais de itens acrescentados**: a soma de `added_extra_cents` das parcelas do pedido indica o valor total adicionado depois. Percorrendo os itens do fim para o começo (os acrescentados entram por último, via `sort_order`), separam-se os itens cujo valor somado corresponde a esse total — esses são os "acrescentados"; os demais são os originais. Se a conta não fechar (dados antigos sem `added_extra_cents`), cai no comportamento atual como fallback.

2. **Itens originais** preenchem a capacidade base de cada parcela (`amount_cents - added_extra_cents - merged_extra_cents - carried_in_cents`), em ordem, da parcela 1 em diante — incluindo parcelas já pagas. → produto em 3x aparece `[1, 2, 3]`.

3. **Itens acrescentados** preenchem apenas a capacidade extra (`added_extra_cents`) de cada parcela, em ordem de vencimento — ou seja, só as parcelas que de fato receberam acréscimo. → produto adicionado depois aparece `[3, 4, 5]`.

4. A linha "Itens inclusos" de cada parcela no PDF passa a refletir essa mesma alocação corrigida.

## Arquivos
- `src/lib/store.ts` — reescrita de `allocateItemsToInstallments` (duas camadas: base + extras). Assinatura e retorno (`byItem` / `byInstallment`) permanecem, então nada mais muda de interface.
- `src/lib/store-statement.ts` — sem mudança estrutural; apenas consome a alocação corrigida (ajustes pontuais de texto se necessário).

## Verificação
- `bunx tsgo --noEmit`.
- Teste de mesa com os dois cenários do pedido: (a) item em 3x → `[1, 2, 3]`; (b) pedido com parcelas 1–2 pagas e item acrescentado em 3x → `[3, 4, 5]`.
- Geração de um PDF de teste com `jsPDF` + inspeção visual da página renderizada (cabeçalho, itens com colchetes, parcelas).
