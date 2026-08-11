# Nail Bliss Manager

Crie um aplicativo web para o gerenciamento de clientes e serviços do meu salão de unhas, estruturado conforme as especificações abaixo:

1. Sistema de Login, Cadastro e Autenticação (Cliente)
Acesso Inicial: Tela com opções "Entrar" e "Cadastrar", solicitando Nome Completo e Número de Telefone (o telefone funcionará como a senha do usuário).

Primeiro Acesso & Verificação: Ao identificar um novo número de telefone, o sistema deve solicitar uma verificação via WhatsApp com o envio de um código de 4 dígitos para confirmação.

Nomes Duplicados: Caso um nome completo já exista no sistema, gere automaticamente um nome de usuário/login alternativo com números (ex: JanainaSilva123).

Recuperação de Acesso: Opção de recuperação de conta no login via confirmação por WhatsApp.

Tela de Boas-Vindas (Após 1º Login): Assim que a cliente realizar o primeiro acesso, exiba um pop-up/modal com a imagem de saudação (contendo minha foto e biografia) e um botão de fechar (ícone "X") para que a cliente possa fechar a mensagem após a leitura.

2. Painel da Cliente
Agendamento de Serviços:

A cliente poderá selecionar data e horários disponíveis (configurados previamente no painel Admin).

Lista de Serviços:

Unha Mão — R$ 25,00 (Duração: 1h)

Pé e Mão — R$ 50,00 (Duração: 2h)

Unha Pé — R$ 30,00 (Duração: 1h)

Apenas Esmaltação — R$ 20,00 (Duração: 30 min)

Cada serviço deve exibir uma foto ilustrativa correspondente, com opção de ser alterada futuramente.

Fluxo de Confirmação & Política de Cancelamento:

Sem pagamentos online no app. Ao escolher o serviço, deve surgir um pop-up de confirmação avisando sobre a política de cancelamento de até 24 horas antes.

Ao confirmar, a cliente é redirecionada ao meu WhatsApp com uma mensagem automática de pré-reserva.

Cartão de Fidelidade Integrado:

A cada 5 procedimentos acumulados do mesmo tipo, a cliente ganha 20% de desconto no 6º procedimento do mesmo tipo (ex: 5 mãos dão direito a 20% de desconto no próximo procedimento de mãos; não acumula entre categorias diferentes).

Loja Virtual (Pronta-Entrega):

Exibição de produtos à venda (esmaltes, perfumes, joias, produtos de beleza e cabelo). Ao selecionar um item, gera uma mensagem direta no meu WhatsApp.

Aba de Catálogos (Encomendas):

Área destinada à exibição de links externos para catálogos digitais de revistas parceiras.

3. Painel Administrativo (Admin)
Credenciais de Acesso:

Usuário: JannahSilva

Senha: 27082018@#

Gestão de Clientes:

Lista completa com Nome Completo, Telefone (senha) e ID de Login.

Opção para a administradora resetar a senha ou atualizar o número de telefone da cliente caso ela perca o acesso.

Gestão de Agenda:

Configuração de dias de atendimento presencial e blocos de horários disponíveis.

Confirmação/Aprovação manual dos agendamentos recebidos via WhatsApp.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nail-joy-planner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f96d0623-3d94-4c29-b904-ecb9c33dfe92).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
