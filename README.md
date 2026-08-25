# 💅 Jannah Nails — Sistema de Gestão & Agendamentos

> Plataforma web para gerenciamento de agendamentos, programa de fidelidade, catálogo de produtos e automação de atendimento via WhatsApp para salão de unhas.

🔗 **Aplicação em Produção:** [nail-joy-planner.lovable.app](https://nail-joy-planner.lovable.app)

---

## 🎯 Objetivo do Projeto

O **Jannah Nails** foi desenvolvido para resolver a complexidade do agendamento manual e do controle de clientes de um estúdio de beleza. A aplicação automatiza a comunicação via WhatsApp, gerencia a disponibilidade de horários e oferece um programa de fidelidade segmentado por tipo de serviço, reduzindo o não comparecimento (*no-show*) e organizando a operação do salão.

---

## 🚀 Funcionalidades da Aplicação

### 👤 Área da Cliente
- **Autenticação & Acesso Simplificado:** Login e cadastro via número de telefone com verificação OTP por WhatsApp e tratamento automático de nomes duplicados (ex: `JanainaSilva123`).
- **Onboarding Personalizado:** Exibição de modal/pop-up de boas-vindas no primeiro acesso com biografia e apresentação da profissional.
- **Agendamento de Serviços:** Seleção de datas e horários disponíveis com catálogo ilustrado de serviços (Unha Mão, Pé e Mão, Unha Pé e Esmaltação) com fotos e durações estimadas.
- **Fluxo de Pré-reserva & Política de Cancelamento:** Notificação explicativa sobre regras de cancelamento em até 24h com redirecionamento automático de mensagem parametrizada para o WhatsApp.
- **Cartão de Fidelidade Dinâmico:** Regra de acúmulo por categoria (a cada 5 procedimentos do mesmo tipo, o 6º serviço daquela categoria recebe 20% de desconto).
- **Loja Virtual & Catálogos Externos:** Vitrine de produtos à pronta-entrega integrados ao WhatsApp e área de links para catálogos digitais de parceiros.

### 🛡️ Painel Administrativo (Admin)
- **Gestão de Clientes:** Painel completo com listagem, consulta de IDs e opções de reset de senha e atualização de contato.
- **Controle de Agenda & Horários:** Configuração de dias de atendimento, bloqueios e aprovação manual de horários recebidos.
- **Gestão de Status de Agendamento:** Organização por abas (*Pré-agendamentos*, *Confirmados*, *Concluídos* e *Cancelados*) com acionamento de mensagens personalizadas para reconfirmação de presença.

---

## 🛠️ Tecnologias Utilizadas (Stack)

- **Frontend:** React, TypeScript, Tailwind CSS.
- **Build Tool:** Vite.
- **Roteamento & Estado:** React Router.
- **Integração Externa:** API de Redirecionamento e Formatação Dinâmica para WhatsApp Web/App (`wa.me`).
- **Plataforma de Desenvolvimento:** Lovable.

---

## 🧠 Aprendizados & Engenharia Aplicada

1. **Automação de Comunicação Dinâmica:** Construção de helpers em TypeScript para parametrizar e formatar mensagens dinâmicas de WhatsApp (datas, nomes, chaves Pix e lembretes de renovação).
2. **Regras de Negócio de Fidelidade Segmentada:** Implementação de lógica de contagem de procedimentos isolada por tipo de serviço para aplicar descontos automáticos no carrinho.
3. **Gerenciamento de Estados de Agendamento:** Controle de fluxo de aprovação e distinção de mensagens enviadas à cliente dependendo do status atual da reserva.

---

## 💻 Como Rodar o Projeto Localmente

1. Clone o repositório:
   ```bash
   git clone [https://github.com/seu-usuario/seu-repositorio.git](https://github.com/seu-usuario/seu-repositorio.git)
