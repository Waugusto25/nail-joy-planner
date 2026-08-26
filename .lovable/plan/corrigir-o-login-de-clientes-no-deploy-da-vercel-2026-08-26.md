# Corrigir o login de clientes no deploy da Vercel

## Diagnóstico confirmado

O erro `PGRST205: Could not find the table 'public.profiles' in the schema cache` acontece antes do cadastro ou login, na primeira busca de telefone em `phoneAccess`.

A tabela `profiles` existe no backend atual do aplicativo e o fluxo registrou logins com sucesso no preview. Portanto, não falta migration neste projeto: o servidor publicado na Vercel está usando uma `SUPABASE_URL` de outro banco, onde a tabela não existe.

## Plano de correção

1. **Unificar a origem da configuração do backend**
   - Centralizar a resolução da URL usada pelo navegador e pelo servidor.
   - Evitar que uma variável `SUPABASE_URL` de uma integração externa incorreta sobrescreva silenciosamente o backend configurado para este aplicativo.
   - Manter chaves privadas somente no servidor.

2. **Validar URL e credencial administrativa em conjunto**
   - Antes de executar `phoneAccess`, detectar configuração incompatível e retornar uma mensagem específica de ambiente, em vez de “não foi possível salvar a consulta”.
   - Preservar o tratamento correto de chaves opacas `sb_secret_` sem enviá-las como Bearer JWT.

3. **Configuração necessária na Vercel**
   - Remover ou corrigir as variáveis criadas pela integração que apontam para o banco vazio.
   - Configurar `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` e a credencial privada do servidor para apontarem ao mesmo backend que contém `profiles` e `user_roles`.
   - Fazer um novo deploy após alterar as variáveis. Nenhuma credencial privada será exibida ou incorporada ao código.

4. **Verificação**
   - Confirmar que a consulta de `profiles` no servidor não retorna mais `PGRST205`.
   - Executar cadastro temporário pelo formulário publicado, confirmar criação em `profiles` e `user_roles`, autenticação e redirecionamento para `/painel`.
   - Remover a conta temporária após o teste.

## Limite operacional

A alteração defensiva no código pode ser implementada aqui. A troca das variáveis do projeto na Vercel precisa ser feita nas configurações da própria Vercel, pois elas não são gerenciáveis por este editor.
