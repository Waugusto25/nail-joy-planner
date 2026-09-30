# Recuperar pedidos da Loja e bloquear "Limpar Histórico"

## Situação confirmada
Consultei o banco agora:
- Pedidos da Loja: 0 | Itens: 0 | Parcelas: 0
- Atendimentos concluídos: 0
- Clientes LOJA: 30 (preservados)

O botão "Limpar Histórico de Faturamento" (aba Financeiro) apagou **todos** os pedidos da loja (com itens e parcelas) e os atendimentos concluídos. Hoje o app não tem lixeira nem cópia própria desses dados, então **eu não consigo restaurá-los sozinho**.

## Parte 1 — Recuperação dos dados (depende de você)
1. Abrir um pedido ao suporte da Lovable (chat de ajuda / support@lovable.dev) pedindo a **restauração do backup do banco de dados** para antes da limpeza, informando data e horário aproximado em que clicou no botão. Eles têm acesso aos backups automáticos; eu não tenho.
2. Enquanto isso, fontes para recadastro manual caso o backup não esteja disponível: extratos/faturas em PDF já baixados e mensagens de cobrança enviadas no WhatsApp.
3. Assim que o backup for restaurado, eu confiro as contagens de pedidos, itens e parcelas e valido que a Dashboard e os PDFs voltaram a bater.

## Parte 2 — Desabilitar a limpeza (faço agora)
- Remover da aba Financeiro o botão "Limpar Histórico de Faturamento" e a janela de confirmação.
- Desativar a função no servidor que executa a exclusão (passa a recusar qualquer chamada), para que nem um clique antigo em cache consiga apagar.
- Apagar o código que excluía `store_orders` e atendimentos concluídos.

## Parte 3 — Proteção extra (evita perda futura)
- Bloqueio no banco: impedir exclusão em massa de pedidos da loja; exclusão só de um pedido por vez, pela administradora.
- Opcional (recomendo): tabela de "lixeira/auditoria" que guarda uma cópia de qualquer pedido, item ou parcela apagado, permitindo restaurar pelo próprio app.

## Detalhes técnicos
- Arquivos: `src/components/app/finance-tab.tsx` (remover botão/AlertDialog), `src/lib/finance.functions.ts` e `src/lib/finance-helpers.server.ts` (remover `clearFinanceHistory`).
- Migration: trigger `BEFORE DELETE` em `store_orders`, `store_order_items`, `store_order_installments` copiando `OLD` para `public.store_deleted_log (table_name, row jsonb, deleted_at, deleted_by)` com RLS só para admin + GRANTs.
