# Extrato do cliente da Loja em PDF

## O que o botão faz
Novo botão "Exportar Extrato (PDF)" em dois lugares:
- No cartão de cada cliente na sub-aba Clientes LOJA.
- No cartão de cada pedido em Pedidos da LOJA (gera o extrato completo do cliente daquele pedido).

Ao clicar, o arquivo é gerado no próprio navegador e baixado como `extrato-<nome-do-cliente>.pdf`. Se o cliente ainda não tem pedidos, aparece um aviso e nada é gerado.

## Conteúdo do documento
- Cabeçalho: "Studio Jannah Nails — Loja", nome e telefone do cliente (sem o apelido interno) e data de geração.
- Resumo: Total geral de compras, Total já pago e Total pendente.
- Um bloco por pedido, do mais recente para o mais antigo:
  - Data do pedido e status (Pendente, Encomendado, Pronto para retirada, Entregue).
  - Itens com valor unitário.
  - Condição de pagamento: "À vista" ou "Parcelado em Nx".
  - Parcelas: número, valor, vencimento, situação (Paga/Pendente) e data de pagamento quando houver.
- Estilo neutro e profissional: fundo branco, texto escuro, linhas finas cinza, tabelas alinhadas, tamanho A4 com margens.

Datas seguem a formatação já corrigida ("DD/MM/AAAA" a partir de "AAAA-MM-DD", sem recuar um dia).

## Detalhes técnicos
- Instalar `html2pdf.js` (importado dinamicamente só no clique, para não pesar o carregamento inicial nem quebrar a renderização no servidor).
- Novo `src/lib/store-statement.ts`: função que recebe os pedidos do cliente e devolve os totais + o HTML do extrato (string), usando `formatPrice`, `formatISODate`, `formatPhone`, `formatInstallments` e `ORDER_STATUS_LABELS`. HTML com estilos inline próprios, isolado dos tokens do app, para o PDF sair igual em qualquer tema.
- Novo `src/components/app/store-statement-button.tsx`: botão reutilizável que carrega os pedidos do cliente (por `store_client_id`, com fallback por telefone para pedidos antigos sem vínculo), monta o HTML em um contêiner fora da tela, chama `html2pdf` e trata erro/estado de carregamento com `sonner`.
- Data do pedido: incluir `created_at` no `select` de `fetchStoreOrders` e no tipo `StoreOrderWithDetails` (hoje não é consultado); usar `delivery_date` como referência de entrega prevista.
- Integrar o botão em `src/components/app/store-clients-tab.tsx` e `src/components/app/store-order-card.tsx`.
- Sem mudanças de banco de dados; nenhum dado existente é alterado.

Verificação: typecheck e geração real de um PDF em ambiente de teste (cliente isolado com pedido parcelado), conferindo visualmente cabeçalho, totais, itens, parcelas e datas.
