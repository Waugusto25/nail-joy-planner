# Corrigir WhatsApp do painel admin e link do Instagram

## O problema

No painel administrativo, os botões "WhatsApp" (na agenda e na lista de clientes) usam sempre o número do salão, então a mensagem abre a conversa com você mesma. Confirmei no código: ambos chamam a função que monta o link com o número fixo da Jannah Nails.

O link do Instagram na tela inicial existe, mas aponta para um endereço sem o parâmetro do perfil que você usa.

## O que será feito

1. **Mensagens para o número da cliente**
   - Criar uma variação da função de link do WhatsApp que recebe o telefone de destino, normaliza os dígitos e acrescenta o código do Brasil (55) quando faltar.
   - Usar essa variação nos dois botões do painel admin (agenda e clientes), enviando para o telefone cadastrado da cliente — o mesmo número que serve de senha.
   - Se a cliente não tiver telefone válido, o botão fica desabilitado.
   - Os botões da cliente (pré-reserva e loja) continuam apontando para o seu WhatsApp, como hoje.

2. **Link do Instagram**
   - Atualizar o endereço do perfil para `https://www.instagram.com/jannah_silvaah?igsh=OTRoZjFka2p0dDhn`, para que o link da tela inicial abra seu perfil corretamente.

## Detalhes técnicos

- `src/lib/salon.ts`: novo helper `whatsappLinkTo(phone, message)` com normalização (`onlyDigits`, prefixo `55` para números de 10/11 dígitos); atualizar `INSTAGRAM_URL`.
- `src/routes/_authenticated/admin.tsx`: trocar `whatsappLink(...)` por `whatsappLinkTo(client.phone, ...)` na agenda (linha ~176) e em `ClientsTab` (linha ~306).
- Sem alterações de banco de dados ou RLS.