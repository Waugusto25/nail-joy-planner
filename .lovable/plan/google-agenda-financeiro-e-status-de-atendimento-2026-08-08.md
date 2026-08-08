# Google Agenda, Financeiro e Status de Atendimento

## 1. Google Agenda (sincronização automática)

Para criar eventos na agenda da conta jannahsilva.oliveira@gmail.com, é preciso conectar essa conta Google ao app uma única vez (um card de conexão vai aparecer no chat para você autorizar com essa conta).

Depois disso, ao confirmar um pré-agendamento no painel (status "Confirmado"), o app cria o compromisso automaticamente:

- Título: `Nome da Cliente — Procedimento`
- Início: data e hora do agendamento; término: início + duração do procedimento
- Descrição: telefone/WhatsApp da cliente, valor a cobrar e cupom/benefício aplicado (se houver)

Regras de comportamento:
- O evento é criado uma vez por agendamento (guardamos o ID do evento para não duplicar).
- Ao cancelar o atendimento, o evento é removido da agenda.
- Se a Google Agenda falhar, o agendamento continua confirmado no app e aparece um aviso discreto — nada travado.

## 2. Controle Financeiro (nova aba no painel Admin)

Nova aba "Financeiro" com:
- Faturamento bruto do período, somando apenas atendimentos "Concluído" (valor já com desconto aplicado).
- Total de atendimentos concluídos e ticket médio (faturamento ÷ nº de atendimentos).
- Detalhamento por procedimento: barras comparativas com receita por serviço (Unha Mão, Pé e Mão, Unha Pé, Esmaltação, avulsos) + ranking dos serviços mais lucrativos do mês.
- Resumo por forma de pagamento (PIX, crédito, débito, dinheiro) para conferência de caixa.
- Filtro de período: mês atual, meses anteriores (seletor) e intervalo personalizado de datas.

## 3. Status e forma de pagamento

- Cada agendamento no Admin passa a ter um seletor de fluxo: Pendente → Confirmado → Concluído, com opção Cancelado.
- Ao marcar "Concluído", abre um diálogo pedindo a forma de pagamento (PIX, Cartão de Crédito, Cartão de Débito, Dinheiro). Sem escolher, não conclui.
- Somente atendimentos "Concluído" entram no financeiro. Toda a lógica de fidelidade/indicação atual ao concluir continua igual.

## Detalhes técnicos

Banco (uma migração):
- `appointments`: novas colunas `payment_method text` (nulo até concluir), `completed_at timestamptz`, `google_event_id text`.

Backend:
- Conectar o connector Google Calendar (conta da Jannah) e chamar a API via gateway a partir de server functions — nunca do navegador.
- Novo `src/lib/calendar-helpers.server.ts` + `src/lib/calendar.functions.ts`: `syncAppointmentToCalendar` (create) e `removeAppointmentFromCalendar` (delete), ambos restritos a admin via `has_role`, buscando cliente/serviço com o cliente admin no servidor.
- `confirmAppointmentFn`: define status confirmado e dispara a criação do evento.
- `completeAppointmentFn` (existente) passa a receber `paymentMethod` validado por Zod e gravar `payment_method` + `completed_at`.

Frontend:
- `admin.tsx`: aba "Financeiro" (agregação via consultas filtradas por data e status), diálogo de forma de pagamento na conclusão, e seletor de status na lista da agenda.
- Gráficos com Recharts, usando tokens de cor do design system.
