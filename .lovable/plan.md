# Ajustes no app Jannah Nails

## 1. Acesso unificado (nome + telefone)
A tela de acesso já é única e sem código de 4 dígitos — mantemos assim: a cliente informa nome completo e telefone, o sistema procura pelo telefone e entra direto ou cria o cadastro na hora. Sem envio de código por WhatsApp (conforme sua escolha).

Pequeno ajuste de texto na tela para reforçar "entrar ou criar conta em um passo só".

## 2. Horário de início e término no agendamento
- O resumo do passo final e a mensagem enviada ao WhatsApp passam a mostrar "Horário: 08:30 às 09:30 (1h)".
- Cálculo em minutos a partir da duração real cadastrada no painel: aceita 45 min, 1h15, 2h30 e se adapta sozinho se a duração for alterada.
- Os horários ocupados passam a considerar a duração de cada atendimento: um horário fica indisponível quando o procedimento escolhido se sobrepõe a um atendimento já marcado, não só quando o início é igual.

## 3. Intervalos (almoço/café)
- Nova área no painel Admin, na aba Horários: cadastrar intervalos fixos por dia da semana (dia, início, fim, nome opcional como "Almoço").
- Horários dentro de um intervalo não aparecem para a cliente.
- Se a duração do procedimento invadir o intervalo, aquele horário também não é oferecido — o próximo disponível fica após o fim da pausa.

## 4. Painel Admin — novas funções
- **Excluir cliente**: botão com confirmação na aba Clientes; apaga a conta e todo o histórico de agendamentos dela.
- **Trocar foto dos serviços**: na aba Serviços, upload de nova imagem para cada procedimento (inclusive os quatro padrão), com pré-visualização.
- **Procedimentos avulsos**: cadastrar novos procedimentos com nome, preço, duração e foto; editáveis e desativáveis como os demais.
- **Fidelidade**: avulsos não geram pontos nem aparecem no cartão de fidelidade, e nunca recebem o desconto de 20%. O cartão continua só com os procedimentos padrão do salão.

## Detalhes técnicos
- Migração no banco:
  - `services`: coluna `loyalty_eligible boolean not null default true`; os quatro serviços padrão ficam `true`, novos avulsos entram `false`.
  - Nova tabela `schedule_breaks` (`weekday`, `start_time`, `end_time`, `label`, `active`) com leitura pública e escrita só para admin (GRANTs + RLS).
- Bucket de storage `service-images` (leitura pública, upload só admin) para as fotos de serviços.
- `busyTimes` passa a devolver as ocupações com início e duração; a montagem dos horários livres cruza slots, pausas e ocupações usando a duração do procedimento escolhido.
- Nova server function protegida `adminDeleteClientFn` (valida `has_role` admin) que apaga agendamentos, perfil, papel e a conta de autenticação.
- Novos helpers em `src/lib/salon.ts` para somar minutos a um horário e formatar faixas "HH:MM às HH:MM".
- Fidelidade em `painel.tsx` e no cálculo de desconto passam a filtrar por `loyalty_eligible`.