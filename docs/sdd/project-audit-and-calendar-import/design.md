# Design técnico e decisões

## Descoberta

Baseline: monorepo d216b8a, backend 1e27685, frontend 68ed59b; só .vscode e
docs/reffs não rastreados. Arquitetura permanece Java17/SpringBoot4/JPA/Flyway,
Angular21 standalone/signals/FullCalendar. Histórico do dia e SDD existentes
foram auditados; login, tema, pagamento, confirmação e auditoria são reutilizados.

## Persistência e compatibilidade

V9: tipo PERSONAL/SHARED/LEGACY/IMPORTED, unicidade do pessoal por owner, backfill com novos
calendários pessoais (nunca mover legados), papéis contextuais múltiplos, telefone
e rodadas de aprovação. DTOs mantêm campos singulares legados e acrescentam listas.
V10: séries e identidades de ocorrência/importação em tabelas próprias, reutilizando
EventService para validação/autorização/pagamento/auditoria. Não editar V1–V8.

Na UI, CLIENT usa descrição canônica; textos legados são preservados/consolidados.
Telefone persistido como dígitos e apresentado (XX) 9XXXX-XXXX; opcional para não
invalidar dados históricos. Papéis múltiplos não concedem administração global.

## Aprovações

Consentimento é por evento e rodada, não por contador global. Sem voto do criador;
aprovadores ativos e membros atuais; unanimidade, rejeição terminal da rodada.
Lock do evento serializa decisões. Histórico anterior não é reescrito ao editar.
Datas/pagamento/confirmacão do CLIENT mantêm dimensões separadas.

## Séries/importação

Materialização limitada, com frequência, intervalo, dias da semana, COUNT/UNTIL e
ZoneId. Identidade por série+ocorrência para não contar duas vezes. Importador recebe
ICS com preview; campos desconhecidos/não representáveis são reportados, nunca
silenciosamente inferidos. Exportações reais não entram no Git. Nome de pessoa no
título não identifica dono. Sem arquivo/fim/origem inequívoca, bloquear a linha.

## Feriados

Catálogo versionado em recurso textual BR/2026; endpoint autenticado de leitura separado
de Event/CLIENT. Isso evita duplicidade, privilégio de escrita, aprovação e inclusão
em queries financeiras. Identificador estável e fim exclusivo all-day. Outros
países/anos podem adicionar recursos sem reescrever o serviço. Fontes oficiais
verificadas no relatório; pontos facultativos e feriados locais ficam de fora.

## Financeiro e operação

Reutilizar summary/timeline/appointments e somar cada calendário autorizado uma vez.
Fixtures sintéticas H2 com datas/valores determinísticos; não preencher preços dos
prints. Os prints de métricas de confirmação vazias/timeline com erro podem indicar
processos de versões diferentes; isso permanece hipótese até validar o runtime.
Não reiniciar servidor dev que aplica Flyway ao banco local sem backup autorizado.

## Operação real confirmada em 12/11

O frontend ativo usava C:\git, enquanto o backend da porta 8080 carregava classes
de C:\Kiro\shared-planner-backend. A .env antiga de C:\git não representava a
credencial do PostgreSQL portátil em uso. Configuração efetiva foi identificada
somente por leitura, sem alterar arquivos de C:\Kiro. O runner atual carrega uma
configuração privada externa e executa o JAR validado de C:\git. O proxy Angular
usa 127.0.0.1 explicitamente, evitando a resolução ::1 incompatível com o bind local.

Backup custom pg_dump fora do Git foi restaurado em PostgreSQL isolado; contagens
conferidas antes de aplicar V9/V10. V8 já constava aplicada no banco real. Nenhuma
migration histórica foi reescrita, nenhuma linha legada foi reatribuída e nenhuma
credencial de usuário foi redefinida. Operador lê credenciais somente em memória;
logs de SQL/debug ficam desligados no runtime de desenvolvimento desse runner.
