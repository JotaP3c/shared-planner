# Design e auditoria

## Descoberta antes da implementação

Java17/SpringBoot4/JPA/Flyway, Angular21 standalone/signals/FullCalendar. Permissões
existentes eram inferidas de enums globais/contextuais e não havia catálogo configurável
nem relatório XLSX. Papéis combinados, provisionamento pessoal, preservação de legado,
recorrência finita e idempotência ICS já estavam implementados e serão reutilizados.

Frontend de acesso: baseline focada executada em 12/11: 23 testes em cinco arquivos PASS.
Os agentes dos módulos executam suas baselines focadas antes de alterar os componentes.
Estado Git inicial: somente `.vscode/` e `docs/reffs/` não rastreados no monorepo;
standalones sem alterações. Não descartar esses arquivos locais.

## Autorização única

AuthorizationService delega ao mesmo resolvedor de perfis para todas as operações.
Enums legados mapeiam para perfis nativos; associação explícita substitui o fallback
somente naquele escopo. Grants globais habilitam módulos/operações; grants contextuais
e vínculo restringem registros. FINANCE global mantém exigência de membership. Permissões
de edição própria e de qualquer autor permanecem distintas. Revogação reavaliada no
banco a cada chamada, sem confiar em claims antigos do JWT.

API `/api/access`: catálogo, CRUD de perfis, associações, usuários autorizados e resultado
efetivo. `/auth/me.permissions` e `CalendarResponse.permissions` orientam menus, guards e
controles; arrays vazios ou ausentes negam. ROLES_MANAGE é global; MEMBERS_MANAGE não
permite alterar perfis globais. AUDIT_VIEW_ALL distingue auditoria sem calendário de
AUDIT_VIEW contextual. Owner e administrador global essencial não podem perder acesso.

## Dados locais e proveniência

V11: perfis/permissões/associações aditivos. V12: marcação financeira de simulação e
ledger de correções, sem atualizar valores por migration. Plano privado fixa IDs, UIDs,
estado anterior e destino; execução local transacional, guarda de ambiente, preview,
repetição sem alterações. Identidades da importação original são preservadas para
manter deduplicação da mesma carga. Desdobramento registra origem e identidade derivada.
Eventos importados corrigidos para SHARED mantêm estado de migração sem convites;
edições normais posteriores continuam pelas regras de aprovação do produto.

A massa explicitamente solicitada de 35 CLIENT segue as faixas por duração; valores
anteriores são retidos no snapshot do ledger. Uma exceção de R$50 para 35 minutos foi
identificada na conferência de 13/11 e reconciliada para R$90 com delta idempotente.
Simulação marcada no Event com referência congelada em12/11, sem confundir horário
de execução com recebimento real. Outubro/dezembro e registros fora da massa permanecem
preservados por checksum; estados de cancelamento não são reativados.

## Financeiro e Excel

Reusar summary/timeline/appointments e mesma autorização/deduplicação de calendários.
Gráfico de linhas/áreas SVG acessível com dados backend; roscas de status exclusivo.
Preferências de painéis separadas dos filtros aplicados; colapso altera somente UI.
Apache POI gera quatro abas e gráficos nativos sobre dados de origem, em snapshot
transacional limitado. Payments representa snapshot de pagamento por atendimento,
pois o modelo não possui ledger de transações/reembolsos; não inventar histórico.

Fontes oficiais e verificação de compatibilidade da biblioteca serão registradas no
relatório. Testes de estrutura XLSX não equivalem a abertura no Microsoft Excel;
registrar separadamente se o aplicativo estiver disponível para execução.

## Matriz nativa contextual

Os perfis globais USER/SYSTEM_FINANCE habilitam operações de módulo, mas a tabela
abaixo só concede dados onde há vínculo e grant contextual. SYSTEM_FINANCE também
habilita consulta/exportação nos calendários dos quais participa. SYSTEM_ADMIN é
essencial protegido e mantém o bypass já existente, sem criar novos vínculos.

| Permissão | Visualizador | Editor | Financeiro | Admin de calendário |
|---|---|---|---|---|
| CALENDAR_VIEW / MEMBERS_VIEW | Sim | Sim | Sim | Sim |
| EVENT_APPROVE, somente designado | Sim | Sim | Sim | Sim |
| EVENT_CREATE | Não | Sim | Não | Sim |
| EVENT_EDIT / EVENT_CANCEL | Não | Próprios | Não | Todos |
| EVENT_EDIT_ALL | Não | Não | Não | Sim |
| FINANCE_VIEW | Não | Não | Sim | Sim |
| FINANCE_VIEW_OWN / FINANCE_MANAGE_OWN | Não | Próprios | Não | Sim |
| FINANCE_MANAGE | Não | Não | Não | Sim |
| FINANCE_EXPORT | Não | Não | Sim | Sim |
| MEMBERS_MANAGE | Não | Não | Não | Sim |
| AUDIT_VIEW | Não | Não | Não | Sim |
| CALENDAR_IMPORT | Não | Sim | Não | Sim |
| USERS_VIEW / USERS_MANAGE / ROLES_MANAGE | Não | Não | Não | Não |
| AUDIT_VIEW_ALL | Não | Não | Não | Não |

Perfis personalizados podem alterar esses grants no escopo permitido. Edição,
cancelamento e aprovação continuam sujeitos ao estado do evento e à designação.
CALENDAR_VIEW é pré-requisito transversal dos grants contextuais nos dois escopos;
sem ele, o resultado contextual é vazio. CALENDAR_IMPORT também depende de EVENT_CREATE,
pois reutiliza o fluxo de criação. FINANCE_EXPORT/FINANCE_MANAGE dependem de FINANCE_VIEW;
FINANCE_MANAGE_OWN depende de FINANCE_VIEW_OWN. A tela explica essas dependências e
permite consultar o resultado efetivo, sem acrescentar grants automaticamente.
Alterar papéis legados restaura os perfis padrão daquele escopo; isso remove overrides
obsoletos. Restaurar padrões ou delegar perfis/papéis também respeita o teto de
permissões do ator. Nenhum administrador contextual pode usar esses caminhos para
elevar o próprio privilégio ou conceder permissões globais.
