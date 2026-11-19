# Catálogo de serviços e produtos

Entrega da etapa 3.1 a partir da [estabilização crítica](../phase-3-stabilization/validation-report.md).
A leitura de [`CLIENT`](../06-client-event-spec.md), [pagamentos](../10-payment-spec.md),
[permissões](../04-permissions.md), [contratos REST](../11-api-contracts.md) e do
[backlog](../33-development-backlog.md) identificou o ponto de integração em
`EventService` e na tela de calendário. A consulta financeira já agrega `Event.amount`,
e os perfis configuráveis já resolvem grants por calendário. O novo catálogo comercial
usa esses pontos de integração. As referências locais de evento e financeiro orientaram
os agrupamentos e a leitura dos valores no tema escuro.

| ID | Requisito | Critério de aceite |
|---|---|---|
| CAT-01 | Catálogo em Financeiro por calendário | Cadastrar, listar, buscar, filtrar, editar, desativar e reativar SERVICE/PRODUCT. Produto pode omitir duração. |
| CAT-02 | Vigência de promoções e histórico | Preço padrão em BRL, promoção opcional com datas inclusivas, histórico consultável por calendário. |
| CAT-03 | Agendamento CLIENT rápido | Seleção explícita por autocomplete, vários itens, quantidades, remoção, título e descrição derivados, total e duração sugerida, observações opcionais. Digitação isolada não cria cobrança. |
| CAT-04 | Contrato histórico do atendimento | Guardar ID, nome, quantidade, preço aplicado, desconto, subtotal e duração. Mudanças no catálogo não alteram o evento. Atualização de preço exige solicitação explícita e respeita pagamento. |
| CAT-05 | Escopo e confidencialidade | Grants configuráveis e validação no backend. Sem consulta cruzada de preços e sem elevar papéis globais. |
| CAT-06 | Legado e recorrência | Eventos sem itens continuam usando seus valores. Novas séries CLIENT são barradas na UI e na API. Séries e ocorrências existentes/importadas permanecem editáveis pelos fluxos históricos autorizados. |
| CAT-07 | Financeiro e auditoria | Relatórios e XLSX continuam somando cada atendimento uma vez. Estados de agenda, confirmação e pagamento separados. Histórico de preço e auditoria transacionais. |
| CAT-08 | Verificação e entrega | Testar Angular, API, PostgreSQL, concorrência, promoções e isolamento. Validar paridade dos repositórios com fontes locais. |

Estoque, inventário e reclassificação de eventos legados estão fora do escopo. A
migration não atribui itens a eventos existentes. Alteração de banco real requer
backup e autorização específica. Entrega local sem commits ou pushes.
