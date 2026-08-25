# Correção do WhatsApp no agendamento manual (cliente nova)

Três problemas no fluxo "Novo agendamento manual > Cliente nova":

## 1. Mensagem mostra o telefone como usuário
Hoje a mensagem de boas-vindas usa o próprio telefone tanto no campo "Seu Usuário" quanto na senha. O login real gerado no cadastro é um identificador criado a partir do nome da cliente (ex.: `maria-silva`), que nunca chega à mensagem.

Correção:
- `ensureManualClient` passa a devolver também o `login_id` gerado (ou o da cliente já existente) e o telefone gravado.
- `createManualAppointment` repassa esse `loginId` no retorno.
- `adminWelcomeMessage` passa a receber `loginId` e exibir:
  - `👤 Seu Usuário: <login criado no cadastro>`
  - `🔑 Sua Senha Inicial: <telefone só com dígitos>`

## 2. Mensagem não abre no WhatsApp da cliente
O link é aberto com `window.open` depois de várias operações assíncronas (salvar, sincronizar agenda, invalidar queries). Nesse ponto o navegador já não considera a ação como resultado do clique e bloqueia o pop-up — por isso nada abre, ou o usuário cai na conversa errada.

Correção:
- Abrir a conversa via elemento âncora criado e clicado no momento, com fallback para `window.location.assign` quando o pop-up é bloqueado.
- Se o número estiver ausente/inválido, mostrar toast com botão "Abrir WhatsApp" para envio manual, em vez de perder a mensagem silenciosamente.
- Garantir que o número usado é o telefone da cliente normalizado (`toWhatsappNumber`), não o do salão.

## 3. Emojis corrompidos
O restante do app monta os links por `whatsappLink`/`whatsappLinkTo`, que já aplicam `encodeURIComponent`. O agendamento manual usa o mesmo helper, mas o telefone é pré-tratado antes e o texto é montado com quebras de linha `\n` cruas; a padronização abaixo garante a mesma codificação UTF-8 dos outros mecanismos:
- Passar o telefone bruto para `whatsappLinkTo` (ele normaliza) e deixar toda a codificação por conta do helper.
- Manter um único ponto de montagem de URL do WhatsApp em `src/lib/salon.ts`, sem concatenação manual de texto no componente.

## Detalhes técnicos
Arquivos afetados:
- `src/lib/auth-helpers.server.ts` — retorno de `ensureManualClient` com `loginId`/`phone`.
- `src/lib/manual-booking-helpers.server.ts` — repassar `loginId` no objeto `client`.
- `src/lib/salon.ts` — `adminWelcomeMessage` com `loginId`; helper de abertura segura de link.
- `src/components/app/manual-appointment-dialog.tsx` — usar `loginId`, abrir link via âncora, toast com fallback.

Verificação: criar um agendamento manual para uma cliente nova em ambiente de teste e inspecionar a URL gerada (usuário = login do nome, texto com emojis intactos, telefone de destino = da cliente).
