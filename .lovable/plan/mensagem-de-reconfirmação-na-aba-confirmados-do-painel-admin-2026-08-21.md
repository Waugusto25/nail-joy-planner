# Mensagem de reconfirmação na aba Confirmados do painel admin

## O problema

Hoje o botão "Confirmar" aparece tanto na aba **Pré-agendamentos** quanto na aba **Confirmados**, e ambos disparam a mesma mensagem de confirmação (`confirmationMessage`). A administradora precisa distinguir visualmente a ação de reconfirmação de presença para clientes já confirmadas.

## O que será feito

1. **Novo texto do botão na aba Confirmados**
   - Alterar o rótulo de "Confirmar" para **"Confirmar?"** apenas quando o agendamento já estiver com `status === "confirmado"`.
   - Na aba Pré-agendamentos o botão continua como "Confirmar".

2. **Nova mensagem de reconfirmação de presença**
   - Criar em `src/lib/salon.ts` a função `reconfirmMessage({ name, day, start })` que retorna:
     ```
     Olá! Como você está? ✨

     Passando para confirmar o seu horário de atendimento agendado para {data legível}. 🌸

     Você confirma a sua presença?

     Fico no aguardo da sua resposta! 🥰
     ```
   - Criar helper `formatConfirmDateTime(day, start)` que produz algo como "Amanhã" ou "Sábado, 22 de Agosto às 09:00", reaproveitando `dayGroupLabel` e `shortTime`.

3. **Manter mensagem antiga para Pré-agendamentos**
   - Na aba Pré-agendamentos, o botão "Confirmar" continua chamando `confirmationMessage` (mensagem carismática de confirmação inicial).

4. **Ajuste no painel admin**
   - Em `src/routes/_authenticated/admin.tsx`, a função `renderCard` precisa saber em qual sub-aba está sendo renderizada (`context: "pendente" | "confirmado"`).
   - Gerar o `notice` correto antes de chamar `setStatus`:
     - Pré-agendamentos: `confirmationMessage`
     - Confirmados: `reconfirmMessage`
   - O botão de WhatsApp direto (já existente no card) também deve usar a mensagem adequada ao contexto.

## Detalhes técnicos

- `src/lib/salon.ts`: adicionar `reconfirmMessage` e `formatConfirmDateTime`.
- `src/routes/_authenticated/admin.tsx`: refatorar `renderCard` para receber contexto; ajustar rótulo e mensagem do botão Confirmar/Confirmar?; manter demais ações inalteradas.
- Sem alterações de banco de dados, RLS ou server functions.
