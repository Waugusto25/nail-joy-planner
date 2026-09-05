# Loja: clientes, pedidos com vários itens, parcelas e Dashboard

Nada da agenda, dos agendamentos ou dos cadastros do salão é alterado ou apagado. Os pedidos já registrados continuam aparecendo, cada um com um item único de mesmo valor.

## 1. Clientes com duas sub-abas

Na aba **Clientes**, duas sub-abas:

- **Clientes Salão** — exatamente a lista e as ações de hoje (WhatsApp, apelido, editar telefone, excluir).
- **Clientes LOJA** — nova lista de contatos da loja (nome, telefone, apelido), sem login próprio, com cadastrar, editar, excluir e WhatsApp.

Em cada cliente do salão, um botão **Copiar para a Loja** cria o contato na Loja com nome, telefone e apelido (avisa se já existir).

WhatsApp na sub-aba Loja abre a mensagem de catálogos:

```text
Olá! Estamos com catálogos novos. Que tal dar uma olhada e ver o que tem de novo? 🛍️✨

👉 Nome do Catálogo: link
👉 Nome do Catálogo: link

Qualquer dúvida estamos à disposição!
```

Os links vêm dos catálogos ativos cadastrados na aba Catálogos. Mensagens da loja em linguagem neutra.

## 2. Novo cadastro de Pedidos da Loja

- Cliente escolhido por campo de busca entre os contatos da Loja; nome, telefone e apelido vêm automaticamente (sem digitação manual).
- Lista de itens dinâmica: botão **+ Adicionar item**, cada linha com nome e valor unitário, e botão para remover.
- **Valor a Receber** somado automaticamente.
- Formas de pagamento e parcelamento como hoje; quando parcelado, mostra o valor exato de cada parcela (total ÷ nº de parcelas).
- Data prevista de entrega e status do pedido mantidos.

## 3. Cartão do pedido registrado

- Cabeçalho: nome do cliente + apelido.
- Itens listados com valor de cada um.
- Valor total e valor da parcela.
- Cada parcela com data de vencimento editável, data de pagamento e um botão de marcar como **paga/pendente**.

## 4. WhatsApp por status do pedido

- **Entregue**: cobrança com valor, vencimento e chave Pix.
- **Pronto para retirada**: aviso de que chegou e está pronto.
- **Encomendado**: aviso de que foi enviado ao fornecedor.
- **Pendente**: não abre mensagem.

A chave Pix fica editável nas configurações do painel.

## 5. Dashboard da Loja

Nova aba **Dashboard**, logo após Catálogos, com cartões:

- Total a receber no mês (parcelas pendentes com vencimento no mês).
- Total já recebido no mês (parcelas pagas no mês).
- Valor total do mês (recebidos + a receber).
- Gráfico simples por status e lista dos próximos vencimentos.

## Detalhes técnicos

Migração (nada é removido):

- `store_clients` — `full_name`, `phone`, `nickname`, `source_profile_id`, `notes`; GRANT + RLS somente admin (`has_role(auth.uid(),'admin')`).
- `store_order_items` — `order_id` (FK `store_orders`, cascade), `name`, `unit_price_cents`, `sort_order`; índice em `order_id`.
- `store_order_installments` — `order_id`, `number`, `amount_cents`, `due_date`, `paid_at`; índice em `order_id`.
- `store_orders`: novas colunas `store_client_id` (FK, nullable), mantendo `client_name`/`client_phone` para os pedidos antigos.
- `app_settings`: coluna `pix_key text not null default ''`.
- Backfill: um `store_order_items` por pedido existente (nome e valor atuais) e parcelas geradas a partir de `installments`/`amount_cents`.

Código:

- `src/lib/salon.ts`: novos geradores de mensagem (`catalogsGreetingMessage`, `orderChargeMessage`, `orderReadyMessage`, `orderOrderedMessage`) reaproveitando `whatsappLinkTo`, que já aplica `encodeURIComponent`.
- Novos componentes: `src/components/app/store-clients-tab.tsx`, `store-client-edit-dialog.tsx`, `store-order-form.tsx`, `store-order-card.tsx`, `store-dashboard-tab.tsx`; `store-orders-tab.tsx` passa a orquestrar formulário + cartões.
- `admin.tsx`: sub-abas em Clientes e nova `TabsTrigger`/`TabsContent` "Dashboard" depois de Catálogos.
- `admin-settings-dialog.tsx`: campo da chave Pix.
- Tipos explícitos, Zod na validação do formulário, tokens semânticos do Tailwind, componentes até ~150 linhas.

Teste: contato de loja e pedido de teste isolados, removidos no fim; nenhum dado real tocado.
