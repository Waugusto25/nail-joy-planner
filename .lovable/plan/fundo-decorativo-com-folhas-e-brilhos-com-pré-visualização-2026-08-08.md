# Fundo decorativo com folhas e brilhos (com pré-visualização)

Objetivo: deixar o fundo do app parecido com a imagem de referência — folhas em traço fino nos cantos, brilhos rosa e dourado e degradê rosa→champanhe — e te mostrar uma pré-visualização em imagem antes de qualquer publicação.

## O que muda visualmente

- Ornamento de folhas em traço fino no canto superior direito e no canto inferior esquerdo, em rosa queimado/dourado suave, bem discreto.
- Ondas abstratas finas no canto inferior direito, como na referência.
- Pontinhos de glitter rosa e dourado espalhados com mais densidade nas bordas e quase nenhum atrás do conteúdo, para não atrapalhar a leitura.
- Degradê de fundo mantido (rosa-bege → champanhe) e cartão branco com sombra rosada — isso não muda.
- O ornamento fica atrás de tudo, sem capturar cliques, e nunca por cima de textos ou campos.

## Onde aparece

O mesmo fundo já é usado na tela de acesso, no painel da cliente e no painel administrativo, então o ornamento entra nas três telas de uma vez.

## Detalhes técnicos

- Trocar as manchas atuais de folhas (feitas com `radial-gradient` dentro de `bg-petal` em `src/styles.css`) por dois SVGs decorativos em `src/assets` (canto superior e canto inferior), usados como `background-image` posicionados nos cantos, com `no-repeat` e tamanho relativo à tela.
- O glitter continua em CSS, com posições redistribuídas para as bordas e opacidade menor no centro.
- Em telas pequenas o ornamento reduz tamanho e opacidade, para o celular não ficar carregado.
- Nenhuma mudança em lógica, banco de dados, agendamento ou autenticação.

## Pré-visualização antes de publicar

Depois de aplicar, eu abro o app internamente e gero capturas de tela (celular e desktop) da tela de acesso e do painel para você aprovar. A publicação só é sugerida depois dessa conferência.