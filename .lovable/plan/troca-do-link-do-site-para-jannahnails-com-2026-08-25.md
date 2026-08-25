# Troca do link do site para jannahnails.com

## O que muda

Todas as mensagens enviadas às clientes passam a divulgar `https://jannahnails.com` em vez do endereço antigo `nail-joy-planner.lovable.app`.

## Onde está hoje

O link aparece hardcoded em um único ponto do código: a mensagem de boas-vindas enviada pela administradora no agendamento manual (`src/lib/salon.ts`, dentro de `adminWelcomeMessage`). As outras mensagens (confirmação, reconfirmação, cancelamento, reagendamento, fidelidade, indicação, eventos) não citam o endereço do site.

## Implementação

1. Em `src/lib/salon.ts`, criar a constante exportada `APP_URL = "https://jannahnails.com"` junto às demais constantes de identidade (`SALON_NAME`, `INSTAGRAM_URL`), com comentário indicando que é a fonte única do endereço público.
2. Substituir o literal `"https://nail-joy-planner.lovable.app"` em `adminWelcomeMessage` por `APP_URL`, para que qualquer troca futura de domínio seja feita em um lugar só.
3. Passar a usar `APP_URL` em qualquer mensagem futura — nenhuma outra mensagem atual precisa de ajuste.

## Observação sobre o domínio

A troca do link nas mensagens é independente da configuração do domínio em si. Para o endereço `jannahnails.com` realmente abrir o aplicativo, ele precisa ser conectado nas configurações de domínio do projeto (Publicar > Domínios) e apontado por DNS. Se quiser, faço a alteração do texto agora e você conecta o domínio quando estiver pronto — até lá o link antigo continua funcionando em paralelo.

## Verificação

- Buscar novamente por `nail-joy-planner` no código: deve retornar zero ocorrências.
- Typecheck do projeto sem erros.
