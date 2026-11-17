# Remodelagem profissional — requisitos

Continuação em 17/11/2026 do anexo de remodelagem integral. A Foundation e suas
alterações não commitadas são a base desta etapa, não uma implementação a substituir.
Catálogo e contratos existentes: [Design System Foundation](../design-system/design.md).

## Descoberta

- Angular 21 standalone/signals, Reactive Forms, FullCalendar e gráficos SVG próprios;
  nenhuma biblioteca genérica de UI a trocar. Figma MCP não disponível; usar as referências locais.
- SDD, README, histórico Git, estilos, componentes e temas revisados antes de editar.
- Baseline de código/build e 30 capturas preservados em diretório privado, incluindo
  claro/escuro, quatro resoluções e estados de perfil; não descartar alterações existentes.
- Problemas: sidebar e painéis consomem área útil; estilos e medidas repetidos; excesso
  de sombras/cabeçalhos altos; hierarquia desigual entre páginas e formulários; cores
  de ação usadas também como texto; tokens tipográficos sem letter spacing; a Inter
  era apenas preferencial e a fonte efetiva dependia da instalação do computador.
- Estados, consentimento, filtros, financeiro e permissões já funcionam e são preservados.

## Aceite

| ID | Requisito |
|---|---|
| PRO-01 | Unificar tipografia, cores semânticas, espaços e interação no DS existente; adicionar letter spacing e fonte local licenciada |
| PRO-02 | Reutilizar componentes/diretivas e reduzir duplicação entre aliases legados e controles Angular; acrescentar tabs e tabela nativa |
| PRO-03 | Layout principal compacto, navegação responsiva e acessível, preferências e grants preservados |
| PRO-04 | Calendário prioritário, eventos legíveis, filtros organizados, calendários compartilhados identificados e estados reais de dia inteiro/recorrência |
| PRO-05 | Financeiro com hierarquia clara, valores tabulares, gráficos/legendas legíveis, filtros recolhíveis e exportação existente preservada |
| PRO-06 | Usuários, membros, perfis, auditoria e pendências com tabelas e estados consistentes |
| PRO-07 | Formulários/modais agrupados, validações e ações claras; login/configurações integrados ao produto |
| PRO-08 | Claro, escuro e sistema; foco/teclado/contraste; desktop, tablet e mobile; movimento reduzido |
| PRO-09 | Production build, validação TypeScript, testes pertinentes e comparação visual antes/depois executados e registrados |
| PRO-10 | Documentos e equivalência entre monorepo/standalone frontend; nenhum commit/push automático |

Sem alteração de backend, banco, API, autenticação/JWT, guards/interceptors, permissões,
regras, cálculos ou validações de negócio. Dados de teste permanecem exclusivamente nos
fixtures de QA; nenhuma massa nova ou indicador fictício é introduzido na aplicação.
