# 22 — PostgreSQL Migration Specification

## Objetivo e escopo

Substituir SQL Server por PostgreSQL como banco de runtime, preservando UUIDs, relações, valores `numeric(12,2)`, timestamps, papéis, estados e auditoria. SQL Server permanece intacto como SOURCE; PostgreSQL é TARGET. Separação de repositórios está fora do escopo.

## Regras de arquitetura

- INFRA-PG-001: PostgreSQL deve ser a única dependência de banco em runtime após a migração.
- INFRA-PG-002: credenciais devem vir de ambiente; nenhuma senha real será versionada.
- INFRA-PG-003: Flyway deve criar o schema PostgreSQL vazio de forma reproduzível.
- INFRA-PG-004: transferência deve preservar IDs, FKs, hashes, valores e contagens por tabela.
- INFRA-PG-005: SQL Server SOURCE não pode ser apagado ou alterado pela migração.
- INFRA-PG-006: `docker compose down` preserva dados; `down -v` remove o volume local.

## Mapeamento

| SQL Server | PostgreSQL | Observação |
|---|---|---|
| UNIQUEIDENTIFIER | uuid | `gen_random_uuid()` |
| NVARCHAR(n/MAX) | varchar(n)/text | PostgreSQL usa UTF-8 |
| DATETIME2 | timestamp without time zone | mantém semântica `LocalDateTime` atual |
| BIT | boolean | defaults true/false |
| DECIMAL(12,2) | numeric(12,2) | precisão monetária preservada |
| NEWID() | gen_random_uuid() | extensão nativa atual |
| SYSUTCDATETIME() | CURRENT_TIMESTAMP | aplicação não modela timezone |

## Estratégia Flyway

As migrations V1–V6 existentes são inseparavelmente T-SQL (`dbo`, `GO`, catálogo de constraints). O projeto está em desenvolvimento e não há baseline PostgreSQL publicada. Decisão: substituir seu conteúdo por SQL PostgreSQL equivalente mantendo versões e intenções lógicas V1–V6. V7 preserva a collation case-insensitive da origem para unicidade de e-mail com índice em `lower(email)`. Bancos SQL Server existentes não executarão a nova linha e permanecem fonte somente leitura. Um PostgreSQL vazio deve migrar de V1 a V7.

## Transferência

Ordem: users → calendars → calendar_members → events → audit_logs. Exportar SOURCE em leitura, importar TARGET transacionalmente, validar contagens, IDs órfãos, FKs, somas `amount/received_amount`, status e hashes. Dados não serão transferidos automaticamente até SOURCE e TARGET estarem acessíveis e as credenciais/instância forem confirmadas. Evidências e contagens devem ser registradas no validation report.
