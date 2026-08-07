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

3. **Ver senha no login e no cadastro**
   - Adicionar um botão de olhinho dentro de cada campo de senha/telefone-senha (login, cadastro e recuperação) para mostrar ou esconder o que foi digitado, e conferir se está correto.

4. **Agendamento em passos (carrossel), sem rolagem**
   - Transformar o agendamento em uma sequência de telas, uma por vez:
     1. Escolher o procedimento
     2. Escolher a data
     3. Escolher o horário
     4. Conferir procedimento + data + horário (com o valor e o desconto de fidelidade, quando houver) e confirmar
   - Ao escolher uma opção, o app avança automaticamente para o passo seguinte, já no topo da tela (sem precisar rolar).
   - Seta "voltar" sempre visível para retroceder a qualquer momento, mantendo o que já foi escolhido.
   - Indicador de progresso (1 de 4) no topo.
   - Na confirmação, o comportamento atual continua: cria a pré-reserva e abre o WhatsApp com a mensagem para você.

## Detalhes técnicos

- `src/lib/salon.ts`: novo helper `whatsappLinkTo(phone, message)` com normalização (`onlyDigits`, prefixo `55` para números de 10/11 dígitos); atualizar `INSTAGRAM_URL`.
- `src/routes/_authenticated/admin.tsx`: trocar `whatsappLink(...)` por `whatsappLinkTo(client.phone, ...)` na agenda (linha ~176) e em `ClientsTab` (linha ~306).
- Novo `src/components/app/password-input.tsx`: campo com toggle de visibilidade (ícones `Eye`/`EyeOff` do lucide), usado nos formulários de `src/routes/index.tsx`.
- Novo `src/components/app/booking-wizard.tsx` (ou refatorar `BookingFlow` em `src/routes/_authenticated/painel.tsx`): estado `step` 0-3, transição com `Carousel` do shadcn (`src/components/ui/carousel.tsx`, já disponível) ou slides animados com CSS transform; botão de voltar por passo; `scrollIntoView` no topo ao trocar de passo. As queries de serviços, dias, horários e a lógica de fidelidade/preço permanecem as mesmas.
- Sem alterações de banco de dados ou RLS.