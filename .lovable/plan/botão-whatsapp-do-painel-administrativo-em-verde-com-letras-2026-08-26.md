# Botão WhatsApp do painel administrativo em verde com letras brancas

## O problema

O botão "WhatsApp" nos cards da agenda do painel administrativo usa `variant="outline"`, o que o deixa com aparência secundária e pouco visível. A administradora pediu para deixá-lo verde com letras brancas para destacar melhor.

## O que será feito

1. **Atualizar o estilo do botão "WhatsApp"** em `src/routes/_authenticated/admin.tsx`, na função `renderCard` (próximo à linha 368).
   - Manter `size="sm"`.
   - Trocar `variant="outline"` por `variant="default"`.
   - Aplicar classes Tailwind para fundo verde e texto branco: `className="bg-green-600 text-white hover:bg-green-700"`.
   - Manter o comportamento, a mensagem e o `onClick` existentes.

## Detalhes técnicos

- Nenhuma alteração de banco de dados ou RLS.
- Nenhuma mudança na lógica de abertura do WhatsApp ou na montagem da mensagem.
- O botão continua só aparecendo quando existe telefone válido da cliente.
