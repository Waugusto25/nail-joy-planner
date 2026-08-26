# Corrigir exclusão de cliente no domínio Vercel

## Diagnóstico verificado

- O botão **Excluir** do painel Admin chama `adminDeleteClientFn` em `src/routes/_authenticated/admin.tsx`.
- `adminDeleteClientFn` usa `requireSupabaseAuth`, valida se a pessoa logada tem role `admin` via `has_role`, e chama `adminDeleteClient(context.supabase, clientId)` em `src/lib/auth.functions.ts`.
- `adminDeleteClient` chama a RPC `public.delete_client_account(uuid)` em `src/lib/auth-helpers.server.ts`.
- A RPC existe no banco, é `SECURITY DEFINER`, tem `SET search_path = public`, e o banco concede execução para `authenticated` e `service_role`, não para `anon`.
- O toast genérico no domínio indica que o erro real provavelmente está chegando pelo RPC/server function, mas a UI ainda não expõe detalhes suficientes para diferenciar token ausente, sessão inválida, falta de role admin ou bloqueio por dependência de dados.

## Plano de correção

### 1. Reproduzir o erro com a sessão real do Admin

- Abrir o `/admin` local com sessão autenticada.
- Tentar excluir uma cliente descartável ou simular a chamada `adminDeleteClientFn` com uma cliente segura.
- Capturar o erro exato retornado pela server function/RPC, sem depender apenas do toast.

### 2. Corrigir a causa no ponto certo

Conforme o erro real encontrado:

- Se for **Authorization/token ausente no domínio externo**: ajustar o middleware/camada de chamada para garantir que a sessão da administradora seja anexada à server function no deploy externo.
- Se for **role admin não reconhecida**: corrigir a verificação `has_role`/sessão para usar o usuário autenticado correto.
- Se for **dependência de dados bloqueando a exclusão**: reforçar `public.delete_client_account(uuid)` para limpar/ocultar todos os vínculos da cliente antes de marcar o perfil como excluído.
- Se for **mensagem perdida no client**: manter a correção funcional e melhorar o toast para mostrar uma mensagem acionável, sem expor dados sensíveis.

### 3. Verificar o fluxo completo

- Executar a exclusão usando uma sessão admin autenticada.
- Confirmar no banco que a cliente ficou com `deleted_at` preenchido, telefone anonimizado, `auth_phone` limpo e sem role ativa em `user_roles`.
- Confirmar que ela desaparece da lista do Admin, já que a tela filtra `profiles.deleted_at is null`.
- Confirmar que a própria conta admin não pode ser excluída.

## Artefatos previstos

- Possível ajuste em `src/start.ts`, `src/lib/auth.functions.ts`, `src/lib/auth-helpers.server.ts` ou `src/routes/_authenticated/admin.tsx`, conforme a causa real.
- Possível migration para reaplicar `public.delete_client_account(uuid)` se a falha estiver na função do banco.

## Critério de pronto

A lixeira do painel Admin exclui logicamente uma cliente no fluxo autenticado, a cliente some da lista e o banco confirma o estado final esperado.
