# Design System Foundation — requisitos

Data: 16/11/2026. Escopo autorizado: primeira etapa da biblioteca visual Angular,
sem remodelar telas, backend, APIs, contratos ou regras de negócio. Sem commits/pushes.
Código equivalente no monorepo e no standalone frontend, conforme a topologia vigente.

## Investigação e funcionalidades preservadas

Lidos o índice SDD, estado atual, fluxos frontend, redesign, design de perfis/financeiro
e especificação de sincronização. As 12 referências foram examinadas; duas são cópias
idênticas. Azul/navy, superfícies claras/escurecidas, tipografia sans, cartões de 16 px,
campos de 10 px e espaçamentos em múltiplos de 4 px orientam a base.

Angular 21 standalone/signals, Reactive Forms, SSR e FullCalendar 6.1 já estão em uso.
Não há biblioteca genérica de UI. Reutilizar `ThemeService`, script pré-pintura,
`sp-icon`, `spDialogFocus`, gráficos existentes e variáveis `--sp-*`. Não introduzir
Material/CDK, Tailwind, pacote de ícones ou outro gerenciador de tema.

Duplicações observadas: gap/padding 4/8/12/16/24, radius 10, tamanhos 13/14, peso 650
e transições 150 ms repetidos em base/páginas. Tokens de cor já centralizados. Os
botões azuis legados no escuro e textos muted claros não atingem o contraste de texto
normal em algumas combinações; novos controles usam tokens semânticos adequados.
Migrar as telas legadas para esses padrões pertence à próxima etapa.

## Critérios de aceite

- DS-01: tokens centralizados de cor, tipografia, espaço, forma, sombra, tamanho,
  interação, foco, transição e camadas; preservar tokens e aparência legados.
- DS-02: Button, IconButton, Input, Select, Checkbox, Card, Badge, Modal, Tooltip,
  Dropdown, PageHeader, EmptyState e LoadingState reutilizáveis, com APIs pequenas.
- DS-03: controles nativos compatíveis com Reactive Forms; rótulos associados,
  descrições/erros acessíveis, disabled/loading verdadeiros, teclado e foco visível.
- DS-04: modais contêm/restauram foco; dropdown e tooltip suportam teclado e Escape;
  reduzir movimento conforme preferência do sistema, sem depender apenas de cor.
- DS-05: `/design-system` funciona em desenvolvimento sem dados reais, autenticador
  ou requisições de negócio; demonstra os componentes e três preferências de tema.
- DS-06: build padrão de produção não inclui a rota nem o import lazy da demonstração.
  Visitar esse caminho segue o fallback existente, sem renderizar o catálogo.
- DS-07: testes pertinentes, regressão frontend, build, temas, contraste e responsividade
  conferidos; documentar limites de acessibilidade automática e evidências reais.
- DS-08: documentação do catálogo e orientação de uso; manter telas atuais funcionais,
  dependências/lockfile e backend intactos; sem commits nem pushes.
