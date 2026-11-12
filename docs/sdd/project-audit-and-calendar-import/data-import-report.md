# Relatório de fontes e importação

## Importação real executada — 12/11/2026

Fonte ZIP oficial fornecida pelo dono, copiada para o diretório privado indicado e
conferida por SHA-256. **Nenhum ZIP, ICS, título real, UID real ou screenshot privado
foi adicionado aos repositórios.** Mapeamento e autorização confirmados no chat;
relatórios detalhados estão em `C:\shared-planner-private\import-reports`.

| Origem confirmada | VEVENT no arquivo | Ocorrências importadas em 2026 | Duplicados na segunda execução | Bloqueados |
|---|---:|---:|---:|---:|
| Agenda da Malu → pessoal da Malu | 405 | 361 | 361 | 1 sem título |
| Agenda do João → pessoal do João | 12 | 3 | 3 | 0 |
| Birthdays → Aniversários do João (privado, separado) | 1 | 1 | 1 | 0 |
| **Total** | **418** | **365** | **365** | **1** |

Os 418 componentes VEVENT representam 416 UIDs distintos, incluindo duas exceções.
101 UIDs não produzem ocorrências na janela confirmada de 2026 (92 na primeira
agenda, 9 na segunda), portanto não foram carregados. Quantidade de componentes
da exportação não equivale à quantidade de ocorrências materializadas em um ano.

Recorrência: 5 regras na fonte (4 semanais, 1 anual), 2 componentes de exceção e
15 propriedades EXDATE analisados. Na janela de 2026 foram persistidas **3 séries
e 54 ocorrências de série**, incluídas nas 365 ocorrências acima. Restantes são
eventos avulsos. Horários UTC/IANA, datas de dia inteiro e fim exclusivo preservados.
O aniversário privado foi importado somente após opt-in explícito e verificação de
destino com owner como único membro. Nenhum acesso foi concedido ao outro usuário.

| Mês de 2026 | Agenda da Malu | Agenda do João | Aniversários | Total importado |
|---|---:|---:|---:|---:|
| Outubro | 53 | 0 | 0 | **53** |
| Novembro | 52 | 1 | 0 | **53** |
| Dezembro | 46 | 0 | 0 | **46** |

Classificação conservadora: PERSONAL, sem preço ou recebimento inventado; origem
GOOGLE_ICS e identidade externa persistidas. Consulta real confirmou **0** eventos
importados com tipo financeiro/valor/recebimento. Segunda execução criou **0** linhas;
365 identidades distintas. Os 5 eventos anteriores mantiveram o mesmo checksum dos
campos históricos; banco passou de 5 para 370 eventos. Nenhum dado sintético entrou
nesse banco. Calendários pessoais: 3, sem owners duplicados; todos os pessoais e o
auxiliar importado possuem somente seus respectivos owners como membros.

Pendência de dados: 1 evento sem título ficou bloqueado, com UID/detalhes disponíveis
somente no relatório privado para correção pelo dono. Nenhum título foi inventado.
Eventos fora de 2026 permanecem na exportação, não descartados nem importados por
engano. Feriados são camada oficial separada, sem dados financeiros.

## Histórico da descoberta inicial

O inventário e o bloqueio abaixo registram o estado anterior ao fornecimento do ZIP.
Foram superados pelo complemento e pela autorização de 12/11; preservados como evidência.

## Inventário em 11/11/2026

- `docs/reffs` contém 12 imagens de referência visual do produto.
- `docs/reffs/google-calendar-2026` não existe neste checkout.
- Nenhum arquivo `.ics`/`.ical` encontrado nos três repositórios.
- Prints anexados mostram outubro/novembro do Google Agenda com várias agendas
  selecionadas. Não fornecem origem individual inequívoca, UID, hora final, regras
  de recorrência ou exceções. Não há fonte estruturada de dezembro.

## Resultado operacional

Importados reais: **0**. Duplicados reais: **não avaliado**, pois nenhuma importação
foi executada. Não atribuir automaticamente Academia, Dentista ou atendimentos a
João/Malu pelo título/cor. Títulos e horários visíveis são apenas evidência parcial;
não se tornam fixtures públicas com dados pessoais nem registros reais incompletos.

Bloqueios: fornecer exportação ICS e confirmar o mapa calendário de origem → destino
autorizado. A ferramenta terá preview e deduplicação antes da confirmação. Preços
ausentes nunca serão inventados. Testes do importador usam exclusivamente dados
sintéticos, identificados como teste, sem dados dos prints.
