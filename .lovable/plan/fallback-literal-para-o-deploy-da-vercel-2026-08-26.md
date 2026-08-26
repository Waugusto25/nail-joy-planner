# Fallback literal para o deploy da Vercel

## Objetivo
Garantir que o cliente público do backend sempre receba uma URL e uma chave válidas durante a compilação e execução na Vercel, mesmo quando as variáveis estejam ausentes, nulas, vazias ou contenham apenas espaços.

## Implementação
1. Atualizar `src/lib/supabase-env.ts`, que hoje centraliza a resolução usada pelo cliente ativo:
   - manter a prioridade de `VITE_SUPABASE_URL` e `SUPABASE_URL`;
   - manter a prioridade de `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY` e `SUPABASE_PUBLISHABLE_KEY`;
   - aplicar `trim()` e ignorar valores vazios em todas as alternativas;
   - usar como último fallback a URL literal `https://uhrurskyobcwleygmfam.supabase.co` e a chave pública literal fornecida;
   - não copiar os colchetes/parênteses Markdown presentes no texto do pedido para a URL real.
2. Manter `src/integrations/supabase/client.ts` intacto por ser gerado automaticamente; `src/lib/supabase-client.ts` já é o cliente efetivamente importado pelas telas.
3. Preservar o tratamento de chaves públicas opacas (`sb_publishable_`) e a configuração atual de sessão.

## Verificação
- Testar a prioridade das variáveis quando preenchidas.
- Testar valores `undefined`, vazios e compostos apenas por espaços, confirmando o uso dos padrões literais.
- Executar a checagem TypeScript.
- Abrir a aplicação e confirmar que não ocorre `supabaseKey is required` no console.

## Sincronização
As alterações serão registradas nos arquivos do projeto. Commit e push manuais não serão executados porque o estado Git é gerenciado pela plataforma; a sincronização com o repositório conectado ocorre pelo fluxo próprio do projeto.
