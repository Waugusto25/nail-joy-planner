# Mensagens da Loja: saudação neutra e data de vencimento correta

## 1. Saudação sem nome e sem apelido
Hoje as mensagens da loja começam com "Olá, [Nome]!" — o apelido/nome vem do cadastro e é uso interno. Todas passam a começar com "Olá!" genérico:

- Cobrança/lembrete: "Olá! Passando para informar sobre o seu pedido. 📦" + Valor + "Vencimento: ..." + chave Pix em bloco de código + aviso de desconsiderar.
- Pronto para retirada: "Olá! Boas notícias! 🎉 ... Ficamos no aguardo! Qualquer dúvida, estamos à disposição."
- Encomendado: "Olá! Seu pedido já foi encaminhado aos nossos fornecedores. 🚚 ..."
- Catálogos (Clientes LOJA): "Olá! Estamos com catálogos novos... Qualquer dúvida, estamos à disposição."
- Status Pendente continua sem gerar mensagem.

O nome/apelido segue aparecendo normalmente no painel; só sai do texto enviado.

## 2. Data de vencimento com 1 dia a menos
A data gravada como "2026-09-05" é hoje convertida com `new Date(...)`, que interpreta como UTC e recua um dia no fuso do Brasil.

Correção: nova função de formatação que separa a string por "-" e monta "DD/MM/AAAA" sem passar por fuso, usada na mensagem de cobrança e também nas telas que mostram vencimento e entrega (cartão do pedido e dashboard), para todas exibirem a mesma data cadastrada.

## Detalhes técnicos
- `src/lib/salon.ts`: adicionar `formatISODate(value)` (split de "YYYY-MM-DD", fallback ao comportamento atual para timestamps completos); reescrever `orderChargeMessage`, `orderReadyMessage`, `orderOrderedMessage` e `catalogsGreetingMessage` sem `name`; ajustar `OrderMessageArgs`.
- `src/components/app/store-order-card.tsx` e `src/components/app/store-dashboard-tab.tsx`: usar `formatISODate` para `due_date`/`delivery_date` e remover o argumento `name` das chamadas.
- `src/components/app/store-clients-tab.tsx`: chamada de `catalogsGreetingMessage` sem nome.
- Links continuam gerados por `whatsappLinkTo`, que já aplica `encodeURIComponent`.

Verificação: typecheck e conferência de uma mensagem gerada com vencimento 05/09/2026 exibindo 05/09/2026.
