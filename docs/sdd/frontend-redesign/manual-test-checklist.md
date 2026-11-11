# Roteiro de homologação manual — redesign 2026-11-11

Executar com backend `dev` e frontend (`npm.cmd start` ou SSR `node dist/.../server.mjs`).
Não usar o banco local para testes destrutivos sem autorização; preferir dados de teste.
Registrar resultado (OK/NOK + observação) e navegador/resolução.

## Tema (Light / Dark / System)
- [ ] Login: alternar Claro, Escuro e Sistema no seletor do card; toda a tela muda, sem bloco claro no escuro.
- [ ] Sistema: mudar o tema do SO com a página aberta; login e shell acompanham.
- [ ] Refresh (F5) em cada modo: sem "flash" do tema errado.
- [ ] Logout → login: preferência mantida. Fechar e reabrir o navegador: mantida.
- [ ] Duas abas: trocar o tema em uma; a outra acompanha.
- [ ] Configurações e menu do perfil mostram a mesma preferência.

## Login
- [ ] Campos vazios: mensagens "Informe seu e-mail/senha".
- [ ] Credencial inválida: "E-mail ou senha inválidos."; botão reabilita.
- [ ] Mostrar/ocultar senha por teclado (Tab + Enter/Espaço).
- [ ] Sem Google, cadastro, recuperação ou "lembrar".
- [ ] 1440×900, 1280×720, 1024×640 (sem ilustração), 390×844 (só o card).

## Calendário
- [ ] Mês/Semana/Dia, anterior/próximo, Hoje; filtros de calendário e tipo; busca global.
- [ ] Criar CLIENT/PERSONAL/SHARED; editar; cancelar; detalhe.
- [ ] Início 23:00: atalho de duração só oferece 15/30/45 min.
- [ ] Após criar/pagar/cancelar CLIENT, o card "Resumo financeiro" atualiza sem recarregar.
- [ ] Modal: foco no primeiro campo; Tab/Shift+Tab não saem do modal; Esc fecha; foco volta ao botão de origem.
- [ ] Card de pendência: título abre detalhe; Aprovar/Reprovar só para o aprovador.

## Pendências
- [ ] Aprovar/Reprovar atualiza a lista e o número do sino na mesma tela.
- [ ] Evento decidido, reaberto pelo criador e recarregado: reaparece.
- [ ] Usuário não solicitado não vê os botões.

## Membros / Usuários / Financeiro / Configurações
- [ ] Membros: adicionar, trocar papel, remover; proprietário protegido; em 390 px a tabela vira cartões.
- [ ] Usuários (ADMIN global): buscar, criar, e-mail duplicado → mensagem; editar nome/papel/ativo; o próprio ADMIN não consegue desativar/rebaixar.
- [ ] Usuário não ADMIN acessando `/admin/users` é redirecionado.
- [ ] Financeiro: oito métricas, períodos, intervalo customizado, gráfico de distribuição só quando há atendimentos, tema escuro correto.
- [ ] Configurações: três modos de tema e dados somente leitura.

## Acessibilidade
- [ ] Navegação completa por teclado; foco visível.
- [ ] Leitor de tela anuncia erros (`alert`) e carregamentos (`status`).
- [ ] Contraste AA conferido em claro e escuro (ferramenta de contraste).
- [ ] `prefers-reduced-motion`: sem animações de spinner/transição.
