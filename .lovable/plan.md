# Trocar o fundo pela arte de flores rosa

Usar a imagem que você enviou (flores em traço rosa com manchas rosa claras) como fundo real do app, no lugar dos ornamentos em SVG e dos brilhos atuais.

## O que muda visualmente

- A arte enviada passa a ser o fundo das telas: acesso, painel da cliente e painel administrativo.
- Enquadramento pensado para não cobrir o conteúdo: as flores ficam nos cantos/bordas, com o centro limpo para leitura.
- No celular a imagem cobre a tela toda (formato vertical, igual ao original). No desktop ela é ampliada/espelhada nas laterais para não distorcer.
- Uma leve camada branca translúcida sobre a imagem mantém o contraste dos textos.
- Cartão branco com sombra rosada, textos em bordô e campos com borda rosa continuam iguais.

## O que sai

- Os dois ornamentos SVG de folhas e a camada de glitter atual são removidos (a arte nova já traz esse desenho).

## Detalhes técnicos

- Subir a imagem enviada para o CDN de assets e referenciar o ponteiro `.asset.json`.
- Reescrever a utilidade `bg-petal` em `src/styles.css`: `background-image` com a arte, `background-size: cover`, `background-position` fixa e `background-attachment: fixed` no desktop; ajustes por media query para celular.
- Manter o gradiente rosa-champanhe como cor de base atrás da imagem (aparece nas áreas que a arte não cobre).
- Apagar `src/assets/ornament-leaves-top.svg` e `ornament-leaves-bottom.svg` e as regras `::before`/`::after` correspondentes.
- Nenhuma mudança em lógica, banco, agendamento, fidelidade ou autenticação.

## Pré-visualização

Depois de aplicar, gero capturas de tela (celular e desktop) da tela de acesso e do painel para você aprovar antes de publicar.
