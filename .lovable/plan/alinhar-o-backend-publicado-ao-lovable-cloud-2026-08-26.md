# Alinhar o backend publicado ao Lovable Cloud

## Diagnóstico confirmado

- `src/lib/supabase-env.ts` já contém como fallback a URL do backend ativo deste projeto e a chave pública correspondente.
- `src/lib/supabase-admin.server.ts` prioriza as variáveis externas `SUPABASE_URL`/`VITE_SUPABASE_URL`; quando a Vercel injeta outra URL, o servidor consulta outra instância e recebe `PGRST205` para `profiles`.
- As operações de cadastro usam privilégios administrativos. A credencial privada não pode ser colocada como fallback literal no código, pois isso daria acesso total ao banco a qualquer pessoa com acesso ao bundle ou repositório.

## Implementação

1. **Fixar a identidade pública do backend do projeto**
   - Manter a URL e a chave pública atuais como fallback conhecido em `src/lib/supabase-env.ts`.
   - Criar uma resolução única de configuração para que cliente e servidor usem o mesmo par URL/chave pública.
   - Normalizar URLs e rejeitar pares incompatíveis antes de qualquer consulta.

2. **Manter a credencial administrativa segura**
   - Em `src/lib/supabase-admin.server.ts`, aceitar somente `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` vindas do ambiente do servidor.
   - Não inserir a Service Role Key literal no código-fonte.
   - Validar que a chave administrativa pertence à mesma URL configurada, retornando um erro objetivo de configuração quando não pertencer.

3. **Revincular os secrets do Lovable Cloud**
   - Reaplicar os secrets gerenciados do backend ao runtime do projeto para eliminar vínculos desatualizados no ambiente Lovable.
   - Preservar o tratamento de chaves opacas `sb_secret_` por `apikey`, sem Bearer inválido.

4. **Cobertura e verificação**
   - Atualizar os testes de resolução para cobrir ausência de variáveis, URL externa divergente e configuração coerente.
   - Consultar `profiles` e `user_roles` usando o cliente administrativo após o revínculo.
   - Executar os testes do fluxo de autenticação e confirmar que a página não apresenta mais a mensagem de banco incorreto no ambiente Lovable.

## Limite da publicação na Vercel

Os secrets do Lovable Cloud não são transferidos automaticamente para a Vercel. Para manter esse deploy externo, a URL e a credencial privada correspondentes precisam ser configuradas com segurança nas variáveis da própria Vercel e um novo deploy deve ser realizado. Nenhuma credencial privada será exibida ou versionada.
