# Voltar a salvar na Google Agenda no site da Vercel

## Causa confirmada

A sincronização usa o gateway de conectores da Lovable (`src/lib/calendar-helpers.server.ts`), e ele exige duas credenciais lidas do ambiente do servidor: `LOVABLE_API_KEY` e `GOOGLE_CALENDAR_API_KEY`. Essas duas chaves existem no backend da Lovable, mas não existem no ambiente da Vercel. Sem elas, a função lança "Google Agenda não está conectada.".

Além disso, em `confirmAppointmentFn` e no cancelamento, a falha da agenda é capturada e apenas registrada no log. Resultado: o status do atendimento muda normalmente, mas nenhum evento é criado na agenda da administradora nem enviado como convite para a cliente — exatamente o sintoma relatado.

## Correção proposta (recomendada)

Publicar a sincronização como um endpoint na hospedagem da Lovable (onde as credenciais existem) e o site da Vercel passa a chamá-lo.

1. Novo endpoint público `src/routes/api/public/hooks/calendar-sync`
   - Recebe: ação (`sync`, `cancel`, `color`) e o id do atendimento.
   - Valida um token de serviço no cabeçalho (mesmo padrão já usado nos lembretes, via tabela de tokens de serviço), recusando chamadas sem credencial.
   - Executa os helpers atuais (`syncAppointmentToCalendar`, `markAppointmentCancelledInCalendar`, `syncCalendarStatusColor`) sem alterar as regras de negócio.

2. Ponte no servidor para uso quando as chaves não estiverem presentes
   - Em `calendar-helpers.server.ts`, se `LOVABLE_API_KEY`/`GOOGLE_CALENDAR_API_KEY` não existirem no ambiente, encaminhar a operação para o endpoint acima usando a URL da hospedagem Lovable e o token de serviço.
   - Se as chaves existirem (execução dentro da Lovable), continua chamando o gateway diretamente como hoje.

3. Deixar a falha visível
   - Confirmar/cancelar continua funcionando mesmo se a agenda falhar, mas a tela da Agenda passa a mostrar um aviso claro ("atendimento confirmado, porém não foi possível publicar na Google Agenda") em vez de falhar em silêncio.

4. Sincronização retroativa
   - Manter o botão/rotina de republicação de atendimentos futuros funcionando pelo mesmo caminho, para recuperar os agendamentos que ficaram sem evento nesse período.

## Alternativa mais simples (se preferir)

Cadastrar na Vercel as duas variáveis de ambiente do conector (`LOVABLE_API_KEY` e `GOOGLE_CALENDAR_API_KEY`) e redeployar. Não exige mudança de arquitetura, mas coloca credenciais do conector no painel da Vercel e depende de você copiá-las manualmente lá.

## Detalhes técnicos

- Arquivos afetados: `src/lib/calendar-helpers.server.ts` (resolução de credencial + ponte HTTP), novo `src/routes/api/public/hooks/calendar-sync.ts`, `src/routes/_authenticated/admin.tsx` (mensagem de aviso).
- Banco: novo token de serviço `calendar` na tabela de tokens já existente (migration), sem alterar tabelas de atendimento.
- Segredos: nada exposto no front; o token vai apenas em cabeçalho de servidor para servidor.

## Verificação

- Confirmar um pré-agendamento de teste e checar que o evento aparece na agenda da administradora com a cliente como convidada.
- Cancelar e checar que o evento fica marcado como CANCELADO em vermelho.
- Conferir que a resposta da ação informa sucesso ou falha real da agenda.
