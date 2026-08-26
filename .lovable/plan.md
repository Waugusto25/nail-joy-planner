# Fallback seguro das variáveis do cliente do backend

## Objetivo
Eliminar a inicialização com chave ausente/vazia no deploy da Vercel, aceitando os três nomes de variável solicitados sem alterar o arquivo gerado automaticamente.

## Implementação
1. Criar um módulo de cliente mantido pelo aplicativo que:
   - leia, nesta ordem, `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`, `import.meta.env.VITE_SUPABASE_ANON_KEY` e `process.env.SUPABASE_PUBLISHABLE_KEY`;
   - normalize os valores com `trim()`, ignorando strings vazias ou compostas só por espaços;
   - aplique o mesmo tratamento seguro à URL;
   - só chame `createClient` depois de validar URL e chave, emitindo erro explícito com os nomes aceitos quando nenhuma configuração válida existir;
   - preserve o armazenamento de sessão e o tratamento das novas chaves públicas opacas já usados pelo projeto.
2. Migrar os imports de componentes, hooks e rotas do cliente gerado para o novo módulo estável.
3. Manter intactos o cliente administrativo e os helpers exclusivamente de servidor, pois usam credenciais server-side diferentes.

## Verificação
- Executar a checagem TypeScript do projeto.
- Validar a resolução separadamente com cada uma das três alternativas e com valores vazios/espaços.
- Abrir a aplicação no navegador e confirmar que a tela inicial inicializa sem o erro `supabaseKey is required`.

## Observação de deploy
O fallback permite qualquer um dos três nomes, mas a Vercel ainda precisa ter `VITE_SUPABASE_URL` e pelo menos uma das três chaves configuradas no ambiente do deploy; nenhuma chave será incorporada ao código-fonte.
