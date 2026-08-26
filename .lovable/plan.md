# Corrigir `supabaseKey is required` no deploy da Vercel

## Diagnóstico confirmado
- Nenhum arquivo ativo do navegador importa `src/integrations/supabase/client.ts`; todos usam `src/lib/supabase-client.ts`.
- O cliente ativo já aceita `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY` e `SUPABASE_PUBLISHABLE_KEY`, ignora valores vazios e possui os valores públicos padrão solicitados.
- O stack trace fornecido cita `src/lib/supabase-server.ts`, mas esse arquivo não existe no código atual. Portanto, a revisão compilada pela Vercel não corresponde ao estado atual deste projeto.
- As funções administrativas atuais criam clientes de servidor com `SUPABASE_SERVICE_ROLE_KEY`. Essa credencial secreta ausente também produz `supabaseKey is required` e não pode ser substituída pela chave pública sem quebrar operações administrativas e a segurança.

## Implementação
1. Preservar o cliente gerado e o cliente público ativo
   - Não simplificar `src/integrations/supabase/client.ts`, pois isso removeria o armazenamento de sessão do preview e o tratamento necessário para chaves públicas opacas.
   - Manter `src/lib/supabase-client.ts` como ponto único usado pelo navegador, com o fallback público literal já existente.

2. Corrigir a inicialização no servidor
   - Criar um resolvedor exclusivamente server-side que normalize URL e credenciais antes de chamar `createClient`.
   - Usar a URL pública padrão somente como fallback de URL.
   - Exigir `SUPABASE_SERVICE_ROLE_KEY` nas operações administrativas, com erro explícito de configuração em vez da mensagem genérica `supabaseKey is required`.
   - Migrar os helpers administrativos repetidos para esse resolvedor único, sem expor a credencial secreta ao navegador.

3. Garantir correspondência entre código e deploy
   - Confirmar que não existe referência a `src/lib/supabase-server.ts` no código entregue.
   - Validar que todos os imports do navegador continuam apontando para `src/lib/supabase-client.ts`.
   - Registrar claramente que a Vercel precisa compilar a revisão atual e receber as variáveis server-side exigidas; alterar apenas o cliente do navegador não corrige uma falha originada em função SSR.

## Verificação
- Executar a checagem TypeScript.
- Testar o resolvedor público com variáveis ausentes, vazias e preenchidas.
- Testar o resolvedor administrativo sem segredo e confirmar mensagem explícita, sem chamar `createClient` com `undefined`.
- Abrir a aplicação e executar login e uma operação administrativa no preview.
- Conferir novamente os logs das funções após a publicação da revisão corrigida.

## Dependência externa
A sincronização/commit para o GitHub e a configuração da Vercel são gerenciadas fora desta edição. A credencial administrativa secreta do Lovable Cloud não está disponível para copiar para a Vercel; caso o deploy externo dependa dessas operações privilegiadas, ele precisará de uma estratégia de backend compatível em vez de incorporar uma chave pública no lugar do segredo.
