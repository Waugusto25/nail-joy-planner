# Rodar o app na Vercel sem chave administrativa

## Situação verificada

- 10 módulos de servidor usam o cliente administrativo (`createAdminClient`): auth, conta, agendamento, agendamento manual, fidelidade, carteira de pontos, reagendamento, calendário, push.
- `src/lib/auth-helpers.server.ts` usa a API de administração de usuários: `auth.admin.createUser`, `updateUserById` e `deleteUser`. Essa API só funciona com a credencial privada — não existe equivalente com a chave pública.
- As demais chamadas são leituras/escritas comuns em `profiles`, `user_roles`, `appointments`, `referrals`, `app_settings` etc., hoje feitas ignorando RLS.

Ou seja: a parte de dados é substituível por RLS e funções de banco; a parte de criação/edição de contas precisa mudar de estratégia, não só de cliente.

## Estratégia

### 1. Criação e login de conta sem API de administração
- O cadastro passa a ocorrer no navegador com `signUp` (chave pública), usando o e-mail derivado do telefone e a senha interna derivada já existente em `src/lib/salon.ts`.
- Login continua com `signInWithPassword`.
- `profiles` e `user_roles` deixam de ser criados por código privilegiado: uma trigger `on auth.users` grava o perfil e a role `client` a partir dos metadados do cadastro.
- Troca de telefone/senha interna passa a usar `updateUser` na sessão da própria cliente, em vez de `updateUserById`.
- Exclusão de cliente pelo admin passa a ser exclusão lógica (`deleted_at`) + limpeza dos dados de aplicação por função de banco. Remover a linha em `auth.users` não é possível sem a credencial privada; a conta fica inativa e sem acesso.

### 2. Regras de acesso no banco (substituem o bypass de RLS)
- RLS habilitada em todas as tabelas envolvidas, com policies por `auth.uid()` para a cliente e via `has_role(auth.uid(),'admin')` para a administradora.
- Consulta de disponibilidade e catálogo/loja: policies `SELECT` públicas restritas apenas às colunas e linhas necessárias.
- Busca por telefone no acesso unificado: função `SECURITY DEFINER` que recebe o telefone normalizado e devolve somente "existe / não existe" e o `login_id`, sem expor a tabela.
- Operações que hoje dependem de privilégio (queimar/devolver pontos, criar agendamento manual, mudar status, reagendar, registrar push) viram funções `SECURITY DEFINER` com verificação interna de papel, chamadas por `rpc` a partir de server functions autenticadas com `requireSupabaseAuth`.
- `GRANT` explícito para `authenticated` (e `anon` só onde houver leitura pública) em cada tabela/função.

### 3. Reescrita por módulo
Ordem de execução, cada etapa mantendo o app funcional:
1. Migration de RLS, policies, grants, triggers e funções `SECURITY DEFINER`.
2. `auth-helpers` + tela de acesso (`src/routes/index.tsx`).
3. `account-helpers` (perfil, telefone, exclusão lógica).
4. `booking`, `manual-booking`, `reschedule`, `cancel`.
5. `loyalty`, `loyalty-wallet`.
6. `calendar`, `push`.
7. Remoção de `src/lib/supabase-admin.server.ts` e da dependência de `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`.

### 4. Variáveis finais na Vercel
Depois da reescrita, só isto é necessário (todos valores públicos, presentes no `.env` do projeto):
`VITE_SUPABASE_URL`, `SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_PROJECT_ID`.

## Verificação
- Testes automatizados do acesso por telefone (nova cliente e cliente existente).
- Teste de isolamento: uma cliente não lê agendamentos, pontos nem perfil de outra.
- Fluxo completo no navegador: cadastro, pré-agendamento, confirmação pelo admin, reagendamento, cancelamento, fidelidade.
- Confirmação de que nenhum arquivo lê mais a credencial privada.

## Ponto de atenção
A senha interna derivada do telefone passa a ser gerada no navegador. Ela já é derivada hoje, mas com a chave pública qualquer pessoa que descubra a derivação e o telefone de uma cliente consegue entrar na conta dela. Recomendo, na mesma reescrita, trocar a derivação por um código de acesso enviado no WhatsApp (OTP) ou senha escolhida pela cliente. Sem isso, o modelo "só telefone" fica frágil fora do ambiente com credencial privada.
