package com.sharedplanner.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

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
    void migratesLegacyDataThroughV8PersonalCalendarsRolesAndImportTablesWithoutLoss() throws Exception {
        String url = System.getenv("PLANNER_MIGRATION_TEST_URL");
        assertThat(url).startsWith("jdbc:postgresql://127.0.0.1:54629/audit_migration_test");
        String schema = "audit_" + UUID.randomUUID().toString().replace("-", "");
        var configuration = Flyway.configure().dataSource(url, "planner_test", "")
                .schemas(schema).defaultSchema(schema).locations("classpath:db/migration");
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
            assertThat(scalar(connection, "SELECT count(*) FROM flyway_schema_history WHERE version IN ('8','9','10') AND success=true"))
                    .isEqualTo("3");
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

    private String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
