# Plano: Limpar texto acidental da tela inicial

## Objetivo
Remover o bloco de texto que foi inserido acidentalmente na tela inicial (`/`), pois a mensagem era um comando de edição e não conteúdo a ser exibido para a usuária.

## Estado atual
Em `src/routes/index.tsx`, logo após o formulário de acesso da administradora e antes do link do Instagram, existe um `<div>` exibindo o texto:

```text
Remova a mensagem da tela inicial e deixe apenas a página em branco, como antes.
```

## Ação planejada
1. Remover o `<div className="mt-8 space-y-6 border-t...">...</div>` das linhas 111-113 de `src/routes/index.tsx`.
2. Manter todo o restante da página intacto (formulário de acesso, link do Instagram, diálogo de sincronização de calendário).

## Resultado esperado
A tela inicial volta a ter a aparência anterior, sem o bloco de texto indesejado.

## Artefatos
- `src/routes/index.tsx`