# Corrigir erro "Não foi possível salvar seu cadastro"

## O que eu verifiquei antes deste plano

- A tabela `profiles` **existe** (com `id`, `full_name`, `login_id`, `phone`, `email`, `nickname`), assim como `user_roles` e `referrals`.
- Todas essas tabelas já têm **RLS habilitado** e **permissões (GRANT) concedidas** a `authenticated` e `service_role`.
- O cadastro é feito no servidor com a **chave administrativa (service role)**, que por definição ignora RLS.

Conclusão: **não é problema de tabela ausente nem de RLS**, portanto nenhuma migration é necessária. Uma migration aqui apenas mascararia a causa real.

## Diagnóstico provável (a confirmar no primeiro passo)

O fluxo cria a conta de autenticação com sucesso (é por isso que "a autenticação conectou") e falha logo depois, no momento de gravar a ficha em `profiles`. Hoje esse erro é engolido por uma mensagem genérica, então a causa exata não aparece em lugar nenhum.

A hipótese mais forte é o **formato da chave administrativa**: as chaves novas (`sb_secret_...`) não são tokens JWT. Quando enviadas como token de autorização, a API de dados as rejeita, embora a API de autenticação as aceite — exatamente o padrão observado (login funciona, gravação falha).

## Plano

1. **Revelar a causa real**: registrar no log do servidor o erro devolvido pelo banco (código, mensagem e dica) quando a gravação da ficha falha, e reproduzir um cadastro de teste para ler esse erro. A correção definitiva sai desse log.
2. **Corrigir o cliente administrativo** para tratar chaves opacas (`sb_secret_`/`sb_publishable_`) corretamente, enviando apenas o cabeçalho de chave de API e sem token JWT inválido — mantendo compatibilidade com a chave antiga em formato JWT.
3. **Tornar a mensagem de erro útil** para a cliente: em vez de "Não foi possível salvar seu cadastro", diferenciar os casos (telefone já usado, configuração do servidor ausente, falha temporária), sem expor detalhes técnicos.
4. **Limpeza segura**: manter o comportamento atual de desfazer a conta de autenticação quando a ficha não puder ser gravada, para não deixar contas órfãs.
5. **Verificar de fato**: executar um cadastro real ponta a ponta no app e confirmar que a linha correspondente aparece em `profiles` e em `user_roles`, além de o acesso ao painel da cliente funcionar.

## Detalhes técnicos

- Arquivos envolvidos: `src/lib/supabase-admin.server.ts` (montagem do cliente administrativo) e `src/lib/auth-helpers.server.ts` (`phoneAccess`, `ensureManualClient`).
- No cliente administrativo: definir `global.headers` com `apikey` e, apenas para chaves em formato JWT, `Authorization: Bearer`; nunca enviar chave opaca como Bearer.
- Em `phoneAccess`: logar `profileError.code/message/details/hint` no servidor antes de lançar; converter `23505` (duplicidade) em mensagem específica.
- Se o log do passo 1 apontar outra causa (por exemplo variável de ambiente ausente no deploy), a correção segue esse achado em vez da hipótese acima — sem migration.
