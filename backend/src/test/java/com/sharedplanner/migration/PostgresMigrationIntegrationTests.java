package com.sharedplanner.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import com.sharedplanner.stabilization.PostgresTestBackup;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Opt-in real PostgreSQL test. Refuses the application's local/production database. */
@EnabledIfEnvironmentVariable(named = "PLANNER_MIGRATION_TEST_URL", matches = ".+")
class PostgresMigrationIntegrationTests {
    @Test
    void migratesLegacyDataThroughPermissionsAndCorrectionProvenanceWithoutLoss() throws Exception {
        String url = System.getenv("PLANNER_MIGRATION_TEST_URL");
        assertThat(url).startsWith("jdbc:postgresql://127.0.0.1:54629/audit_migration_test");
        String schema = "audit_" + UUID.randomUUID().toString().replace("-", "");
        var configuration = Flyway.configure().dataSource(url, "planner_test", "")
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
        PostgresTestBackup.create("audit_migration_test", null);
        configuration.target("7").load().migrate();
        UUID owner = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        UUID calendar = UUID.randomUUID();
        UUID client = UUID.randomUUID();
        UUID personal = UUID.randomUUID();
        try (Connection connection = DriverManager.getConnection(url, "planner_test", "")) {
            connection.setSchema(schema);
            try (var statement = connection.createStatement()) {
                for (UUID user : new UUID[]{owner, other, third}) {
                    statement.executeUpdate("INSERT INTO users(id,full_name,email,password_hash,role) VALUES ('" + user
                            + "','Synthetic migration user','" + user + "@example.invalid','unused-test-only','USER')");
                }
                statement.executeUpdate("INSERT INTO calendars(id,name,owner_user_id) VALUES ('" + calendar
                        + "','TEST ONLY legacy calendar','" + owner + "')");
                statement.executeUpdate("INSERT INTO calendar_members(id,calendar_id,user_id,member_role) VALUES ('"
                        + UUID.randomUUID() + "','" + calendar + "','" + owner + "','ADMIN')");
                statement.executeUpdate("INSERT INTO events(id,calendar_id,created_by_user_id,event_type,status,title,client_name,work_description,description,amount,starts_at,ends_at) VALUES ('"
                        + client + "','" + calendar + "','" + owner
                        + "','CLIENT','SCHEDULED','Synthetic client','Synthetic client','Original service','Original notes',100,'2026-11-11 09:00','2026-11-11 10:00')");
                statement.executeUpdate("INSERT INTO events(id,calendar_id,created_by_user_id,event_type,status,title,person_name,starts_at,ends_at) VALUES ('"
                        + personal + "','" + calendar + "','" + owner
                        + "','PERSONAL','SCHEDULED','Synthetic personal','Synthetic person','2026-11-11 11:00','2026-11-11 12:00')");
            }
            configuration.target("8").load().migrate();
            assertThat(scalar(connection, "SELECT confirmation_status FROM events WHERE id='" + client + "'"))
                    .isEqualTo("PENDING_CONFIRMATION");
            assertThat(scalar(connection, "SELECT confirmation_status FROM events WHERE id='" + personal + "'"))
                    .isNull();
            PostgresTestBackup.create("audit_migration_test", schema);
            Flyway latest = configuration.target("latest").load();
            latest.migrate();
            latest.validate();
            assertThat(scalar(connection, "SELECT count(*) FROM calendars WHERE calendar_type='PERSONAL'"))
                    .isEqualTo("3");
            assertThat(scalar(connection, "SELECT calendar_type FROM calendars WHERE id='" + calendar + "'"))
                    .isEqualTo("LEGACY");
            assertThat(scalar(connection, "SELECT count(*) FROM events WHERE calendar_id='" + calendar + "'"))
                    .isEqualTo("2");
            assertThat(scalar(connection, "SELECT description FROM events WHERE id='" + client + "'"))
                    .isEqualTo("Original notes");
            assertThat(scalar(connection, "SELECT work_description FROM events WHERE id='" + client + "'"))
                    .isEqualTo("Original service");
            assertThat(scalar(connection, "SELECT count(*) FROM calendar_members m JOIN calendars c ON c.id=m.calendar_id WHERE c.calendar_type='PERSONAL' AND m.user_id=c.owner_user_id AND m.member_role='ADMIN'"))
                    .isEqualTo("3");
            assertThat(scalar(connection, "SELECT count(*) FROM calendar_member_roles")).isEqualTo("4");
            assertThat(scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE version IN ('8','9','10','11','12') AND success=true"))
                    .isEqualTo("5");
            assertThat(scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE success=true AND version IS NOT NULL"))
                    .isEqualTo("13");
            assertThat(scalar(connection, "SELECT max(version::integer) FROM flyway_schema_history WHERE success=true"))
                    .isEqualTo("13");
            assertThat(scalar(connection, "SELECT count(*) FROM events WHERE financial_simulation=false AND simulation_reference_date IS NULL"))
                    .isEqualTo("2");
            assertThat(scalar(connection, "SELECT count(*) FROM development_event_corrections")).isEqualTo("0");
            assertThatThrownBy(() -> {
                try (var statement = connection.createStatement()) {
                    statement.executeUpdate("UPDATE events SET financial_simulation=true WHERE id='" + client + "'");
                }
            }).isInstanceOfSatisfying(SQLException.class,
                    exception -> assertThat(exception.getSQLState()).isEqualTo("23514"));
            assertThat(scalar(connection, "SELECT amount FROM events WHERE id='" + client + "'"))
                    .isEqualTo("100.00");
            assertThat(scalar(connection, "SELECT count(*) FROM events WHERE financial_simulation=false AND simulation_reference_date IS NULL"))
                    .isEqualTo("2");
            assertThat(scalar(connection, "SELECT count(*) FROM access_profiles WHERE built_in=true AND active=true")).isEqualTo("7");
            assertThat(scalar(connection, "SELECT count(*) FROM access_assignments")).isEqualTo("0");
            assertThat(scalar(connection, "SELECT count(*) FROM access_profile_permissions pp JOIN access_profiles p ON p.id=pp.profile_id WHERE p.code='USER' AND pp.permission IN ('USERS_MANAGE','ROLES_MANAGE','AUDIT_VIEW_ALL')")).isEqualTo("0");
            assertThat(scalar(connection, "SELECT count(*) FROM access_profile_permissions pp JOIN access_profiles p ON p.id=pp.profile_id WHERE p.code='CALENDAR_FINANCE' AND pp.permission IN ('FINANCE_VIEW','FINANCE_EXPORT')")).isEqualTo("2");
            assertThatThrownBy(() -> {
                try (var statement = connection.createStatement()) {
                    statement.executeUpdate("INSERT INTO calendars(id,name,owner_user_id,calendar_type) VALUES ('"
                            + UUID.randomUUID() + "','Duplicate personal','" + owner + "','PERSONAL')");
                }
            }).isInstanceOf(SQLException.class);
            assertThat(latest.migrate().migrationsExecuted).isZero();
            assertThat(scalar(connection, "SELECT count(*) FROM calendars WHERE calendar_type='PERSONAL'"))
                    .isEqualTo("3");
        }
    }

    @Test
    void financialMigrationPreservesValidLegacyAndAtomicallyRejectsInvalidLegacy() throws Exception {
        String url=System.getenv("PLANNER_MIGRATION_TEST_URL");
        assertThat(url).isEqualTo("jdbc:postgresql://127.0.0.1:54629/audit_migration_test");
        for(boolean invalid : new boolean[]{false,true}) {
            String schema="audit_"+UUID.randomUUID().toString().replace("-","");
            var configuration=Flyway.configure().dataSource(url,"planner_test","")
                    .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
            PostgresTestBackup.create("audit_migration_test",null);
            configuration.target("12").load().migrate();
            UUID owner=UUID.randomUUID(),calendar=UUID.randomUUID(),event=UUID.randomUUID();
            try(Connection connection=DriverManager.getConnection(url,"planner_test","")) {
                connection.setSchema(schema);
                try(var statement=connection.createStatement()) {
                    statement.executeUpdate("INSERT INTO users(id,full_name,email,password_hash,role) VALUES ('"+owner+"','Synthetic legacy','"+owner+"@phase3.invalid','test-only','USER')");
                    statement.executeUpdate("INSERT INTO calendars(id,name,owner_user_id) VALUES ('"+calendar+"','Synthetic legacy','"+owner+"')");
                    statement.executeUpdate("INSERT INTO events(id,calendar_id,created_by_user_id,event_type,status,title,client_name,work_description,amount,starts_at,ends_at,payment_status,payment_method,received_amount,paid_at) VALUES ('"+event+"','"+calendar+"','"+owner+"','CLIENT','SCHEDULED','Synthetic legacy','Synthetic client','Synthetic service',100,'2030-11-17 10:00','2030-11-17 11:00','PAID','PIX',"+(invalid?"101":"100")+",'2030-11-17 11:00')");
                }
                var backup=PostgresTestBackup.create("audit_migration_test",schema);
                PostgresTestBackup.restoreForVerification(backup);
                try(Connection restored=DriverManager.getConnection("jdbc:postgresql://127.0.0.1:54629/phase3_backup_restore","planner_test","")) {
                    restored.setSchema(schema);
                    assertThat(scalar(restored,"select received_amount from events where id='"+event+"'"))
                            .isEqualTo(invalid?"101.00":"100.00");
                    assertThat(scalar(restored,"select max(version::integer) from flyway_schema_history where success=true")).isEqualTo("12");
                }
                if(invalid) {
                    assertThatThrownBy(()->configuration.target("latest").load().migrate()).isInstanceOf(org.flywaydb.core.api.FlywayException.class);
                    assertThat(scalar(connection,"select max(version::integer) from flyway_schema_history where success=true")).isEqualTo("12");
                    assertThat(scalar(connection,"select received_amount from events where id='"+event+"'")).isEqualTo("101.00");
                    assertThat(scalar(connection,"select count(*) from pg_constraint where conname='ck_events_financial_state' and connamespace='"+schema+"'::regnamespace")).isEqualTo("0");
                } else {
                    configuration.target("latest").load().migrate();
                    assertThat(scalar(connection,"select received_amount from events where id='"+event+"'")).isEqualTo("100.00");
                    assertThat(scalar(connection,"select count(*) from events")).isEqualTo("1");
                    assertThat(scalar(connection,"select convalidated::text from pg_constraint where conname='ck_events_financial_state' and connamespace='"+schema+"'::regnamespace")).isEqualTo("true");
                }
            }
        }
    }

    private String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
