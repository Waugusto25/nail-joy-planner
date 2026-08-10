# Refino visual: cabeçalho vidro, cards, chips e vitrine 2 colunas

Ajustes puramente visuais (CSS + classes), sem mexer em regras de negócio, dados ou fluxos.

## 1. Cabeçalho fixo com efeito vidro

- O cabeçalho passa a ficar fixo no topo ao rolar a página, com fundo translúcido e desfoque suave (glassmorphism) e uma borda inferior rosa bem fina.
- No canto superior direito ficam apenas ícones discretos: sininho, engrenagem e um ícone de sair (o botão "Sair" com texto vira ícone, deixando o canto limpo).
- Título e nome do salão continuam à esquerda, com altura do cabeçalho um pouco mais compacta.

## 2. Cards e espaçamentos padronizados

- Um único estilo de card para agendamentos, produtos, serviços, eventos, benefícios e catálogos: cantos arredondados de 16px, sombra suave e borda fina em rosa neutro.
- Espaçamento interno mínimo de 16px em todos os cards, garantindo que textos, selos e botões nunca encostem nas bordas (inclui os cards que hoje usam padding menor ou nenhum).
- Cards com foto ganham respiro entre imagem e conteúdo.

## 3. Hierarquia de botões e seletores de horário

- Datas, horários e meses na agenda (painel da cliente, pedido de reagendamento e realocação do admin) passam a ser pílulas/chips arredondadas (20px), com contorno rosa quando disponíveis e preenchimento na cor principal quando selecionadas.
- Em cada tela, apenas a ação principal fica sólida (ex.: "Confirmar e falar no WhatsApp", "Quero este", "Salvar").
- Ações secundárias (WhatsApp, Detalhes, Cancelar, Editar, Voltar) passam para o estilo vazado com borda, mantendo peso visual menor.

## 4. Vitrine da Loja em 2 colunas no celular

- A aba Loja passa a exibir os produtos em grade de 2 colunas no celular (3 no desktop), em formato compacto: foto, marca, nome e preço.
- Textos com truncagem elegante e botão de compra em largura total dentro do card, para os cartões ficarem alinhados na grade.

## Detalhes técnicos

- `src/styles.css`: ajustar a utility `surface-card` (raio 16px, `--shadow-card` para `0 4px 12px rgb(0 0 0 / 0.05)`, borda `--card-border-accent`); criar utilities `card-pad` e `chip` / estado selecionado usando tokens semânticos (sem cores hardcoded); nova utility `glass-header` com `background-color` translúcido do card + `backdrop-filter: blur(8px)` (apenas a propriedade padrão, sem prefixo `-webkit-`).
- `src/components/app/app-header.tsx`: `sticky top-0 z-40` + `glass-header`; substituir o botão de texto "Sair" por `Button variant="ghost" size="icon"` com ícone `LogOut` e `aria-label`.
- `src/routes/_authenticated/painel.tsx`: aplicar chips nos seletores de mês/dia/hora e nos benefícios; `Store` com `grid-cols-2 lg:grid-cols-3`; padronizar variantes de botão nos cards de "Meus horários" e demais listas.
- `src/components/app/reschedule-request-dialog.tsx` e `admin-reschedule-dialog.tsx`: mesmos chips de dia/hora.
- `src/routes/_authenticated/admin.tsx` e componentes de aba (loja, pedidos, catálogos, financeiro): padronizar padding dos cards e variantes de botão secundário.
- Layout responsivo dos cabeçalhos de card seguindo `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` / `shrink-0` para não quebrar em telas estreitas.
