# Remodelagem profissional — decisões de design

Este incremento aplica a [Foundation existente](../design-system/design.md) às telas.
Não duplica seu catálogo: conserva Button/IconButton, formulários nativos, Card, Badge,
Modal, Tooltip, Dropdown, PageHeader, EmptyState, LoadingState, ícones e foco de diálogo.

## Direção visual e estrutura

Azul orienta ações, navy organiza a navegação, superfícies neutras priorizam conteúdo.
Hierarquia de títulos/labels/ajuda, alinhamentos e densidade seguem os mesmos tokens.
Evitar sombras pesadas, gradientes decorativos e informação repetida. Elementos de
mockups sem suporte real não criam novas funcionalidades nem valores demonstrativos.

Inter variável v4.1 é distribuída localmente em `assets/fonts/InterVariable.woff2`, com
OFL incluída. Uma requisição same-origin, sem CDN em runtime nem pacote npm adicional;
`font-display: swap` e fallback de sistema preservam o acesso enquanto a fonte carrega.
Origem: [Inter](https://rsms.me/inter/),
[arquivo v4.1](https://github.com/rsms/inter/blob/v4.1/docs/font-files/InterVariable.woff2),
[licença OFL](https://github.com/rsms/inter/blob/v4.1/LICENSE.txt).

Tokens acrescentados: `--sp-letter-spacing-tight/normal/wide`, números tabulares,
secondary/disabled, hover de tabela e medidas de sidebar. Cores vêm de `_tokens.scss`,
com contrastes semânticos distintos para ação preenchida e links/textos por tema.

`_control-foundations.scss` concentra placeholders Sass para botões e campos. Aliases
legados e diretivas usam a mesma origem; a migração não mantém um segundo padrão visual.

## Complemento do catálogo

| Peça | Contrato | Aplicação |
|---|---|---|
| `sp-tabs` | items `{id,label,disabled?,panelId?}`, value/valueChange, label, mode | `tabs`: tablist/roving focus/setas/Home/End; `toggle`: botões aria-pressed para selecionar uma visualização sem inventar painéis |
| `table[spTable]` | density comfortable/compact | Mantém tabela/caption/th nativos e classe responsiva; não cria datasource, seleção ou regras de ordenação |

O catálogo `/design-system` continua apenas em desenvolvimento e demonstra também essas
peças. Rotas, autenticação e contratos de produção permanecem iguais.

## Aplicação nas telas

| Área | Decisão implementada |
|---|---|
| Layout principal | Sidebar de 224 px, recolhida em 72 px no desktop; topbar e busca compactas. Em até 1024 px, navegação em gaveta com fundo, fechamento por Escape e retorno de foco. Os módulos continuam sujeitos aos grants existentes. |
| Calendário | Grade ocupa a área principal; painel de resumo usa 280/260 px e passa para baixo em até 1180 px. Criação de calendário permanece disponível em disclosure após a grade. Filtros por tipo, seleção de calendários e navegação de datas ficam agrupados; mês/semana/dia usam `sp-tabs` em modo `toggle`. |
| Eventos | Blocos compactos mantêm texto legível, cor semântica por categoria/estado e ponto de cor do calendário. O contexto do calendário aparece no título de apoio; calendários compartilhados são identificados no seletor. Eventos de dia inteiro conservam a indicação própria e cancelamentos mantêm contraste com título riscado. |
| Formulários e modais | Tipos de evento ficam em grupo horizontal com seleção por teclado; campos relacionados são agrupados e cabeçalho/ações permanecem separados do corpo rolável. Cliente mantém uma descrição de serviço e telefone opcional. Obrigatoriedade, erros após interação e alerta de envio são expostos semanticamente sem trocar validadores. Detalhes conservam seções de agenda, aprovação, confirmação e financeiro. |
| Financeiro | KPIs destacam valores tabulares; contagens e confirmação formam níveis secundários. Filtros recolhíveis mantêm um resumo do contexto aplicado. Gráficos próprios recebem paleta, eixos, legendas e tooltips consistentes; exportação mantém a rotina existente com estado de geração e erro. |
| Administração | Usuários, membros, perfis/permissões, auditoria e pendências compartilham cabeçalhos, painéis, controles e estados. Tabelas mantêm semântica nativa e rolagem local quando necessário. O editor de perfis separa lista, permissões e associação de usuários; seleção e proteção de perfis permanecem explícitas. |
| Login | Marca, ilustração SVG decorativa e formulário usam a mesma tipografia e tokens. No espaço reduzido, o formulário é priorizado. Alternância de tema, mostrar senha, validações e carregamento continuam ligados à autenticação real; nenhuma opção de login sem suporte foi acrescentada. |
| Configurações | Aparência usa opções claro/escuro/sistema em radiogroup; informações da conta são somente leitura. A preferência continua sob responsabilidade do serviço de temas existente. |

## Orientação de uso e organização

As diretivas `spButton`, `spInput`, `spSelect` e `spCheckbox` padronizam controles
nativos, mantendo Reactive Forms, eventos, validação e comportamento de formulário.
`sp-card`, sua classe de composição legada, badges e estados compartilhados organizam conteúdo e feedback sem
acoplar regras de calendário ou financeiro à biblioteca visual. Cabeçalhos existentes
podem manter sua marcação semântica e as classes globais padronizadas; não é necessário
reescrever uma tela inteira apenas para trocar seu contêiner.

Usar `sp-tabs` em modo `tabs` somente quando existirem painéis reais associados por
`panelId`; usar `toggle` para uma escolha de visualização, como no calendário. Aplicar
`spTable` a tabelas nativas dentro do contêiner de rolagem da página. Os componentes
Dropdown e Tooltip atendem ações e ajuda complementar; um conjunto de checkboxes de
filtro usa grupo rotulado e Tab nativo, sem se anunciar como menu de ações.

Tokens e regras comuns ficam em `src/styles/`; controles reutilizáveis ficam em
`shared/ui/design-system/`. `_shell.scss`, `_calendar.scss`, `_fullcalendar.scss`,
`_finance.scss`, `_charts.scss`, `_pages.scss`, `_modal.scss` e `_login.scss` concentram
a composição das áreas. Estilos locais ficam restritos às particularidades da tela,
evitando uma segunda implementação de botões ou campos.

## Responsividade, interação e temas

Grids usam colunas flexíveis e pontos de quebra por conteúdo: KPIs financeiros passam
de quatro para duas colunas, gráficos para uma coluna e formulários se empilham em
telas menores. O gráfico de evolução preserva largura mínima legível com rolagem
horizontal no próprio gráfico; tabelas largas também rolam no contêiner, sem exigir
que a página inteira se alargue. O calendário mantém suas visualizações reais e o
painel lateral continua recolhível independentemente do menu.

Foco visível deriva dos tokens. A gaveta móvel retém Tab, deixa o conteúdo de fundo
inert e devolve foco ao acionador ao fechar; o menu de perfil aceita setas, Home/End
e Escape. Seletores de tema e tipo de evento usam foco itinerante; modais reutilizam
a diretiva de foco existente. Campos nativos conservam labels, mensagens e estados
disabled/loading; `role="alert"` e estados de carregamento/vazio dão feedback nas
operações pertinentes.

Claro e escuro compartilham dimensões e composição; a preferência sistema resolve
pelo serviço de temas já existente. O tamanho raiz permanece em 100% para preservar
rem e preferências de fonte do navegador. As transições rápidas usam tokens e a regra
global `prefers-reduced-motion: reduce` reduz animações/transições e desativa rolagem
suave. Detalhes de verificações e eventuais limites de acessibilidade pertencem ao
[relatório de validação](validation-report.md).

## Preservação de comportamento

Mudar a apresentação não muda filtros aplicados, valores, autorizações, aprovações,
validações ou mutações. Metadados ausentes não são fabricados: eventos recorrentes
mantêm a identificação apenas onde o contrato já retorna informação de série.
Capturas de QA usam fixtures isolados, sem acessar dados reais ou alterar o banco.

Em particular, o `EventResponse` da listagem não fornece `seriesId`. A grade não
acrescenta um selo de recorrência inferido por título, proximidade de datas ou origem
ICS. A consulta e o gerenciamento reais de série no detalhe/edição continuam
disponíveis, incluindo o escopo de ocorrência, futuras ou série inteira quando
retornado pela funcionalidade existente. Exibir um indicador confiável na listagem
depende de metadados desse contrato e não justifica alterar a API nesta etapa.
