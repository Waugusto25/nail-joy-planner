# Adiantamentos da Loja
- [x] Botão e janela entre Dar baixa e PDF, valor/data e bloqueio acima do saldo; conferidos no celular e desktop.
- [x] Gravação atômica record_store_advance, histórico persistente e saldo no mês; teste real de 50 + 50 quitou 100 sem alterar a próxima parcela.
- [x] Recibo próprio conectado ao outbox e histórico em fatura/extrato/relatórios; PDF gerado e texto extraído com 50 adiantados e 50 restantes.
- [x] Dez testes novos e onze regressões aprovados; pedido temporário removido, sem alterar vendas reais.
- [ ] Entrega da nova mensagem WhatsApp na Vercel depende de atualizar a versão publicada lá; conteúdo e payload conferidos, sem enviar a uma cliente real.

# Vencimento nos pedidos da Loja
- [x] Substituída entrega junto ao telefone por vencimento DD/MM/AA, atrasos em vermelho e Quitado em verde; controles de entrega preservados, seis testes aprovados e lista autenticada conferida no celular.

# Automação WhatsApp — Evolution
- [x] Corrigida whatsapp_receipt_event realmente ligada às parcelas; vínculo conferido no banco e caso Wellington verificado: R$ 57,98 menos R$ 7,98 = R$ 50,00; sete testes aprovados, sem alterar pagamento nem reenviar recibo antigo.
- [x] Edição em janela limitada à tela, recibo parcial com valor recebido, saldo restante e Obrigada; função whatsapp_event atualizada por migration sem alterar vendas existentes.
- [ ] Validar edição autenticada e entrega do novo recibo na Vercel: sem sessão administrativa correspondente ao solicitante; código de envio precisa do próximo deploy Vercel.
- [x] Criar envio seguro, configurações e teste administrativo; painel autenticado e bloqueio HTTP conferidos.
- [x] Conectar mensagens do salão e somente vencimento/recebimento na Loja; outbox, gatilhos e rotina às 11h30 aplicados.
- [x] Preservar baixa automática Mercado Pago e baixa manual; quatro testes aprovados e endpoint sem autorização bloqueado.
- [x] Direcionar gatilho e novas tentativas ao servidor Vercel e liberar as dez mensagens pendentes; chamada 715 respondeu HTTP 200.
- [ ] Confirmar entrega real: a execução ignorou cinco pré-agendamentos cancelados e cinco cancelamentos retornaram à fila com erro de envio na Vercel; falta identificar o erro específico do servidor de produção.

# Calendário de meses — Horários
- [x] Substituir lista por grade anual, preservar configurações e recados.
- [x] Aplicar dois anos móveis e bloquear meses passados no horário de Brasília.
- [x] Verificar regras com 12 testes aprovados e calendário isolado na interface.
- [ ] Validar gravação no painel autenticado: conta solicitante sem usuário correspondente no app; precisa entrar como administradora no preview.

# Agendamento Manual
- [x] Integrar seleção visual de meses, datas e vagas por duração do procedimento.
- [x] Disponibilizar atendimento especial com data e horário livres, mantendo a verificação de sobreposição no servidor.
- [x] Verificar cálculos (7 testes aprovados), ligação com o formulário e compilação.
- [ ] Testar criação de agendamento no painel: acesso bloqueado porque não há sessão administrativa disponível e a conta solicitante não corresponde a uma conta do app.