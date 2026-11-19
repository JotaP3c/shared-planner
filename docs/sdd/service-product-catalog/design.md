# Design do catálogo comercial

V14 cria `catalog_items`, `catalog_price_history` e `event_catalog_items`. As duas
primeiras guardam o item comercial versionado e a sequência de condições de preço.
`event_catalog_items` guarda as linhas contratadas, na ordem de exibição, associadas
ao evento. A FK mantém a referência mesmo após inativação. Cada item entra uma vez
por atendimento e recebe quantidade de 1 a 999. O limite é de 50 linhas.

Preços são `NUMERIC(12,2)` no banco e `BigDecimal` no Java. A data civil de
`startsAt` escolhe o preço promocional quando estiver entre início e fim, incluindo
ambas as datas. O preço unitário registrado já inclui a promoção. O desconto da
linha registra a diferença para o preço padrão multiplicada pela quantidade.
O subtotal é preço aplicado × quantidade. O total é escrito em `events.amount`,
que continua sendo a única base de receita do Financeiro e do Excel.

## Contratos

| Método e rota | Comportamento |
|---|---|
| `GET /api/calendars/{calendarId}/catalog` | Página `items`, `page`, `size`, `totalElements`. Filtros `q`, `type`, `active`, `category`, `appointmentDate`. |
| `POST /api/calendars/{calendarId}/catalog` | Cadastra item e registra o preço inicial. |
| `GET /api/calendars/{calendarId}/catalog/{id}` | Consulta item contextual e preço efetivo para `appointmentDate`. |
| `PUT /api/calendars/{calendarId}/catalog/{id}` | Atualiza item, vigência ou atividade com `version`. Versão desatualizada retorna 409. |
| `GET /api/calendars/{calendarId}/catalog/{id}/price-history` | Histórico decrescente com paginação, autor, data e condições aplicadas. |
| `POST /api/events/catalog-quote` | Recebe calendário, data de atendimento e itens com quantidade. Retorna linhas calculadas e total. |
| `POST /api/events`, `PUT /api/events/{id}` | Aceitam `catalogItems`, `observations`, `expectedCatalogTotal` e, na edição, `repriceCatalogItems`. |

O preço enviado pelo cliente serve para detectar divergências com a consulta, com
409 pedindo revisão da seleção. O backend calcula o valor persistido. Os campos
`expectedUnitPrice`, `expectedDiscount` e `expectedDurationMinutes` permitem conferir
as condições apresentadas por linha. O valor zero na duração esperada indica que
o item estava sem duração na cotação. Os DTOs antigos continuam aceitos. O catálogo
fica como primeira opção quando o ator pode consultá-lo. Para legados e calendários
sem acesso ao catálogo, o preenchimento manual permanece disponível como fluxo explícito.

## Edição, concorrência e permissões

Editar conteúdo, datas ou quantidades não reaplica o preço atual a itens já contratados.
Novos itens usam a vigência da data do atendimento. A ação **Atualizar preços pelo
catálogo** consulta as condições atuais e a confirmação de salvar aplica a revisão.
Pagamento fora de PENDING impede reprecificação e mudança de itens. Cancelamentos e
confirmações continuam nas rotinas existentes. Criar séries CLIENT pelo endpoint de
recorrência é rejeitado. Eventos e séries importados são preservados.
Converter um atendimento vinculado em outro tipo exige acesso ao catálogo e passa
pela mesma proteção de pagamento.

A atualização de evento mantém o lock pessimista existente. A resolução da tarifa
bloqueia os itens em ordem de UUID, na mesma transação que salva o evento. Editar o
catálogo usa o mesmo lock e verifica a versão para evitar sobrescrita de dados. A
restrição única diferível permite reordenar as linhas sem conflito intermediário.

`CATALOG_VIEW` e `CATALOG_MANAGE` são grants configuráveis e exigem `FINANCE_VIEW` no
calendário. Gerenciar exige também consultar. Perfis nativos ADMIN de calendário têm
consulta/gestão, FINANCE contextual tem consulta. Perfis personalizados conservam
suas permissões explícitas. A visualização financeira de eventos mantém a redação já
existente, inclusive nas linhas contratadas. A auditoria geral registra ações do item.
As condições de preço são consultadas no histórico protegido pelo grant financeiro.

## Angular

`CatalogPage` usa componentes do Design System para filtros, estados, formulário e
tabela responsiva. `CatalogService` carrega o catálogo contextual e seu histórico.
O calendário usa uma busca cancelável e navegável pelo teclado, quantidades e ações
explícitas de seleção e revisão. O total é apresentado em BRL. A duração estimada
soma duração por unidade e sugere o término. Produto sem duração não aumenta o
tempo de atendimento. O usuário pode ajustar a duração do compromisso.
