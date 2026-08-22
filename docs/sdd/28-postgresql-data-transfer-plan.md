# 28 — SQL Server to PostgreSQL Data Transfer Plan

## Baseline da origem

Leitura em 2026-08-21, instância `localhost,1433`, banco `shared_planner_dev`:

| Tabela | Linhas antes |
|---|---:|
| users | 6 |
| calendars | 4 |
| calendar_members | 10 |
| events | 11 |
| audit_logs | 11 |

`flyway_schema_history` possui 6 linhas e não será copiada; o Flyway PostgreSQL recria sua própria história.

## Procedimento controlado

1. Subir um PostgreSQL vazio e permitir ao backend aplicar V1–V7.
2. Parar o backend para congelar o TARGET.
3. Exportar a origem somente leitura, em ordem de FK: users, calendars, calendar_members, events, audit_logs.
4. Importar em uma única transação preservando UUIDs, timestamps, hashes, estados e valores monetários.
5. Validar contagens antes/depois, FKs órfãs, soma de `amount` e `received_amount`, e amostras por UUID.
6. Fazer rollback completo em qualquer divergência; nunca executar `DELETE`, `UPDATE` ou DDL na origem.

## Gate de execução

A cópia só é aceita quando as cinco contagens do TARGET forem respectivamente 6, 4, 10, 11 e 11 e todas as verificações de integridade retornarem zero. Credenciais da origem devem ser fornecidas apenas em ambiente/sessão, nunca versionadas.

## Resultado executado — 2026-08-21

A origem foi exportada em objetos JSON independentes, com `sqlcmd` e transação `SERIALIZABLE`, para arquivos temporários fora do repositório. O backend e o frontend ficaram parados durante a importação. `docker/import-sqlserver-snapshot.sql` exigiu target vazio e Flyway completo, importou em uma única transação e executou os gates antes do commit. V7 foi aplicada incrementalmente após a carga para preservar a unicidade case-insensitive de e-mail da collation `Latin1_General_CI_AS`.

| Tabela | Antes SQL Server | Depois PostgreSQL | Diferenças de UUID |
|---|---:|---:|---:|
| users | 6 | 6 | 0 |
| calendars | 4 | 4 | 0 |
| calendar_members | 10 | 10 | 0 |
| events | 11 | 11 | 0 |
| audit_logs | 11 | 11 | 0 |

Validações adicionais: hashes BCrypt com 0 diferenças; FKs órfãs = 0; `SUM(amount)=340.00`; `SUM(received_amount)=110.00`; login com credencial migrada passou. O SQL Server SOURCE continuou disponível e suas contagens permaneceram inalteradas.

SQL Server armazena `datetime2(7)` e PostgreSQL usa microssegundos. A exportação aplicou `datetime2(6)` explicitamente; 53 valores possuíam sétimo dígito diferente de zero, com arredondamento máximo de 0,5 microssegundo e sem conversão de fuso.
