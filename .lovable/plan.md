# Login por telefone (identificador único)

## Como vai funcionar

Tela inicial passa a ter um único formulário: **Nome completo** + **Telefone (com DDD)**.

1. Ao enviar, o sistema procura o telefone no banco.
2. **Telefone já cadastrado** → entra direto na conta dessa cliente. Se o nome digitado for diferente do salvo, o nome é atualizado.
3. **Telefone não cadastrado** → cria a conta na hora usando o telefone como identificador único, salva o nome e entra.
4. Nomes repetidos são permitidos: várias "Marias" podem existir sem conflito.

Sem código de 4 dígitos e sem etapa de confirmação — o acesso é imediato.

## Acesso da admin

Continua separado: um link discreto "Acesso da administradora" na tela inicial abre o formulário com **ID de login + senha** (JannahSilva), sem alterações no funcionamento atual do painel admin.

## Recuperação de acesso

Deixa de ser necessária para clientes (o telefone é a chave de entrada), então o fluxo "Esqueci meu acesso" e o diálogo de código são removidos da tela inicial.

## Detalhes técnicos

- Banco: adicionar índice único em `profiles.phone` para garantir um cadastro por telefone.
- `src/lib/auth-helpers.server.ts`: nova função `phoneAccess(fullName, phone)` que busca o perfil por telefone; se existir, atualiza `full_name` quando mudou e devolve o e-mail sintético; se não existir, gera `login_id` único, cria o usuário (e-mail sintético `login@jannahnails.app`, senha = telefone), insere o perfil e o papel `client`. Remover as funções de código/recuperação que ficam sem uso.
- `src/lib/auth.functions.ts`: substituir `startSignupFn`/`finishSignupFn`/`startRecoveryFn`/`finishRecoveryFn` por `phoneAccessFn`; manter `resolveLoginFn` (usado no acesso admin por ID) e `adminUpdateClientFn`.
- `src/lib/auth-schemas.ts`: novo `phoneAccessInput` (nome + telefone); remover schemas de código/recuperação.
- `src/routes/index.tsx`: um formulário nome+telefone que chama `phoneAccessFn` e depois `supabase.auth.signInWithPassword` com o e-mail retornado e o telefone como senha; abaixo, seção recolhível de acesso da administradora (ID + senha). Manter o olhinho de ver senha e o link do Instagram.
- Tabela `verification_codes` deixa de ser usada (não será removida).
