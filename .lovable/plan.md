# Corrigir erro ao confirmar/cancelar agendamento no domínio externo

## Diagnóstico confirmado
- A tela Admin chama `confirmAppointmentFn`, `setAppointmentPendingFn` e `cancelAppointmentFn` ao tocar em **Confirmar?**, **Pendente** e **Cancelar**.
- Essas funções estão em `src/lib/calendar.functions.ts` e ainda usam o middleware gerado `requireSupabaseAuth`.
- Esse middleware gerado exige diretamente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`; quando o domínio externo/Vercel não fornece esses nomes exatos, a função retorna a mensagem exibida no print: `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY`.
- Já existe no projeto o middleware próprio `requireServerSupabaseAuth`, criado para o deploy externo, que resolve URL/chave com fallback e valida a sessão autenticada por bearer token.

## Implementação
1. Corrigir ações da agenda administrativa
   - Trocar `src/lib/calendar.functions.ts` para usar `requireServerSupabaseAuth`.
   - Manter a validação de administradora via `has_role` antes de confirmar, voltar para pendente ou cancelar.
   - Preservar as integrações existentes de notificação, devolução de pontos e Google Agenda.

2. Evitar o mesmo erro em ações relacionadas da mesma tela
   - Revisar server functions chamadas pelo Admin que ainda usam o middleware gerado e impactam botões da agenda, como conclusão de atendimento e reagendamento.
   - Migrar apenas as funções autenticadas que dependem do mesmo deploy externo para o middleware próprio, sem alterar regras de negócio.

3. Melhorar mensagem operacional se ainda houver falha real
   - Garantir que a UI mostre o erro específico retornado pela função, sem mascarar tudo como erro genérico.
   - Não expor chaves, URLs internas ou detalhes sensíveis ao usuário final.

## Verificação
- Executar checagem TypeScript.
- Reproduzir no navegador com sessão da administradora:
  - confirmar um pré-agendamento;
  - cancelar um agendamento;
  - se aplicável, concluir atendimento.
- Confirmar no banco que o status do agendamento mudou corretamente.
- Confirmar que a mensagem `Missing Supabase environment variable(s)` não aparece mais nesse fluxo.

## Observação de deploy
Depois da correção no código, o domínio externo/Vercel precisa receber o novo build. A mudança remove a dependência rígida de `SUPABASE_PUBLISHABLE_KEY` nessas ações, mas o deploy ainda precisa ter pelo menos a URL e a chave pública configuradas por algum dos nomes aceitos pelo resolvedor do projeto.
