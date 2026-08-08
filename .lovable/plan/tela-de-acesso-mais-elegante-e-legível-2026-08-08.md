# Tela de acesso mais elegante e legível

Objetivo: sair do branco puro, dar destaque ao cartão central e deixar todos os textos e campos fáceis de ler — mantendo a identidade rosa/champanhe do Jannah Nails.

## Fundo

- Fundo em gradiente suave: rosa-bege muito claro (#FFF0F5) descendo para um champanhe acetinado, em vez do branco atual.
- Textura discreta por cima do gradiente: silhuetas de folhas e pontinhos de brilho em rosa e dourado, com opacidade muito baixa (marca d'água) e sem interferir na leitura.
- A textura é feita em CSS puro (gradientes radiais + pontos de luz), sem imagem nova para carregar, então não pesa no celular.

## Cartão central de login

- Interior do cartão em branco puro, para contrastar com o fundo colorido.
- Sombra elegante ao redor: `0 8px 24px rgba(214, 51, 132, 0.12)`.
- Borda fina em rosa queimado / dourado claro, destacando o painel do fundo.
- Mesmo tratamento no cartão do acesso da administradora, para ficarem coerentes.

## Legibilidade dos textos

- Textos instrucionais ("Informe seu nome e seu telefone...", "Seu telefone é o seu acesso...", "A amiga que te indicou ganha 10%...") passam do cinza-rosado claro para um bordô elegante (#5C1D38), com contraste forte sobre o cartão branco.
- Títulos dos campos ("Nome completo", "Telefone com DDD", "Quem indicou você?") em bordô mais escuro e peso semibold.
- Ajuste feito no token de texto secundário do app, então ganha legibilidade também no painel da cliente e no admin.

## Campos de digitação

- Fundo cinza-claro suave (#F9F9F9) dentro da caixa, para a cliente ver exatamente onde clicar.
- Borda em rosa suave (#E0B0C8), e borda/anel rosa mais forte quando o campo está em foco.
- Texto digitado em vinho escuro (quase preto), e placeholder num tom médio legível.

## Detalhes técnicos

- `src/styles.css`: novos tokens (`--input-surface`, `--input-border`, `--input-foreground`, `--card-border-accent`, `--shadow-card`) registrados em `@theme inline`; `--muted-foreground` escurecido para o bordô; utilitário `bg-petal` reescrito como gradiente + textura; `surface-card` com sombra e borda de destaque. Todos os valores em `oklch`, sem classes de cor fixas nos componentes.
- `src/components/ui/input.tsx`: usar os tokens de campo (fundo, borda, texto, foco).
- `src/routes/index.tsx`: cartão de login com fundo branco puro e a nova sombra/borda; nenhum texto ou lógica alterada.
- Nada de mudança em banco de dados, autenticação ou regras de negócio — o ajuste é só visual.
