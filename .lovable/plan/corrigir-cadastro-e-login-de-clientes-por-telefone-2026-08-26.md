# Corrigir cadastro e login de clientes por telefone

## Objetivo
Tornar o acesso por nome e telefone confiável tanto para novas clientes quanto para clientes já cadastradas, sem abrir leitura pública de perfis.

## Estado confirmado
- O formulário e o schema já removem caracteres não numéricos antes de chamar o servidor.
- `phoneAccess` usa um cliente administrativo no servidor para consultar e gravar `profiles` e `user_roles`.
- O banco já tem índice único em `profiles.phone`, RLS habilitado e permissão de gravação para `service_role`.
- Os 18 perfis atuais possuem uma role; não há telefones desnormalizados ou duplicados.
- A criação atual não verifica o erro da inserção em `user_roles`, podendo devolver sucesso com cadastro parcial.

## Implementação
1. **Normalização centralizada e defensiva**
   - Criar uma função única que converta telefone/DDD para somente dígitos e reutilizá-la no schema, na consulta, na senha e nas gravações do fluxo de cliente.
   - Validar novamente no servidor antes de qualquer busca, evitando depender apenas do formulário.

2. **Fortalecer `phoneAccess`**
   - Manter toda busca e gravação de perfil exclusivamente no cliente administrativo do servidor; não criar política anônima para consultar clientes por telefone.
   - Verificar explicitamente erros da busca, atualização do perfil e atualização da conta de autenticação.
   - Em conta existente, confirmar que a role `client` existe sem alterar contas administrativas.
   - Em conta nova, criar autenticação, perfil e role `client`, validando cada etapa.
   - Se perfil ou role falhar, remover a conta recém-criada para não deixar cadastro parcial e retornar uma mensagem acionável.

3. **Testes automatizados e de integração**
   - Adicionar testes para normalização de telefone formatado (`(35) 99999-9999` → `35999999999`).
   - Cobrir cadastro novo, login existente, atribuição da role `client` e rollback quando a role falhar.
   - Executar um fluxo ponta a ponta com uma conta temporária: enviar nome/telefone formatado, confirmar criação em `profiles` e `user_roles`, autenticação e redirecionamento para `/painel`; depois remover os dados temporários.
   - Repetir com o mesmo telefone para confirmar que entra na mesma conta sem duplicar perfil ou role.

## Detalhes técnicos
- Arquivos principais: `src/lib/auth-schemas.ts`, `src/lib/auth-helpers.server.ts` e novos testes focados no fluxo de autenticação.
- `src/lib/auth.functions.ts` continuará como wrapper fino de `createServerFn`.
- Não será liberado acesso anônimo a `profiles` ou `user_roles`; a chave administrativa permanecerá restrita ao servidor.
- Migração só será adicionada se a implementação revelar uma garantia de banco ausente; as permissões, RLS e unicidade solicitadas já estão presentes.

## Critérios de aceite
- Telefones com máscara ou caracteres especiais são buscados e armazenados apenas como dígitos.
- Nova cliente recebe perfil e role `client` ou nenhuma conta residual é deixada em caso de erro.
- Cliente existente entra sem criar duplicatas.
- Após autenticar, a cliente chega ao painel protegido.
