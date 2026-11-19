# Design do refinamento

| Tela | Referência e decisão |
| --- | --- |
| Calendário | Dashboard escuro, calendário compartilhado e painéis claros orientam grade, botões segmentados e resumo lateral. No celular, a grade compacta seleciona a data da agenda logo abaixo. A ação Agendar neste dia usa o dia selecionado. |
| Criação e detalhes | O modal SaaS orienta grupos de campos, corpo rolável e ações separadas. No CLIENT, catálogo e resumo substituem a repetição de preço e descrição. O resumo mostra cliente, agenda, data, intervalo e duração. Modais em paisagem curta reservam altura para os campos. |
| Financeiro | O painel escuro orienta cartões com acento semântico, evolução de receita e roscas. A evolução ajusta eixo e densidade de rótulos à largura do painel, com detalhe por toque ou teclado. Distribuições usam os estados reais de pagamento e confirmação. |
| Catálogo | Usa o cabeçalho, botões, badges, campos e painéis existentes. O formulário de filtros permanece montado ao recolher. Em celular, a mesma tabela passa a organizar cada item em duas colunas e deixa as ações abaixo. |
| Login | A referência escura orienta o painel de entrada, a marca e o seletor de tema. Em paisagem curta, reduz o espaço vertical e mantém o formulário rolável. |
| Configurações | A referência de perfil orienta a apresentação da conta acima das opções de tema. As opções mantêm os três modos e indicação explícita da seleção. |
| Pendências | A referência escura orienta a faixa de estado, data com ícone e ações. Em telas estreitas, os botões ocupam a largura disponível. |
| Membros, usuários, perfis e permissões | Seguem a hierarquia dos painéis administrativos nos mockups e os componentes da etapa anterior. Agrupam os controles por membro, ampliam ações para toque e acomodam textos e permissões longos. |

O Design System fornece tokens de cor, espaço, foco e tipografia e os controles
`spButton`, `spInput`, `spSelect`, `spTabs`, `spBadge` e `spTable`. O
`ThemeService` resolve os temas. A agenda diária usa o mesmo conjunto filtrado
do FullCalendar, incluindo feriados em leitura e eventos que atravessam a meia-noite.

O XLSX usa o exportador existente. `Appointments` continua com uma linha por
atendimento e a descrição dos itens. Quando há itens contratados, `Item Details`
acrescenta uma linha por item com os IDs do atendimento e do catálogo, quantidade,
preço unitário aplicado, desconto, subtotal e duração. Os valores são numéricos
com formatação BRL. A aba é informativa e os totais usam o valor do atendimento.
O limite de 20 mil linhas de itens é verificado antes da criação da planilha
em memória e complementa o limite de texto.
