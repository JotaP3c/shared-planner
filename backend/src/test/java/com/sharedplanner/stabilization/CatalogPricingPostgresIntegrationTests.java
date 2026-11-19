package com.sharedplanner.stabilization;

import com.sharedplanner.calendar.CalendarService;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.catalog.CatalogItemRequest;
import com.sharedplanner.catalog.CatalogItemType;
import com.sharedplanner.catalog.CatalogService;
import com.sharedplanner.event.CatalogItemSelection;
import com.sharedplanner.event.CreateEventRequest;
import com.sharedplanner.event.EventCatalogItem;
import com.sharedplanner.event.EventCatalogPricing;
import com.sharedplanner.event.EventCatalogQuote;
import com.sharedplanner.event.EventRepository;
import com.sharedplanner.event.EventService;
import com.sharedplanner.event.EventType;
import com.sharedplanner.event.UpdateEventRequest;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {"spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.driver-class-name=org.postgresql.Driver", "debug=false", "logging.level.root=ERROR"})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "PLANNER_PHASE3_TEST_URL", matches = ".+")
class CatalogPricingPostgresIntegrationTests {
    private static final LocalDateTime START = LocalDateTime.of(2030, 11, 17, 10, 0);

    @DynamicPropertySource
    static void isolatedDatabase(DynamicPropertyRegistry properties) {
        String url = System.getenv("PLANNER_PHASE3_TEST_URL");
        if (!"jdbc:postgresql://127.0.0.1:54629/phase3_stabilization_test".equals(url)) {
            throw new IllegalStateException("Only the isolated PostgreSQL test database is permitted.");
        }
        PostgresTestBackup.create("phase3_stabilization_test", null);
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> "planner_test");
        properties.add("spring.datasource.password", () -> "");
    }

    @Autowired CatalogService catalog;
    @Autowired EventService events;
    @Autowired EventCatalogPricing pricing;
    @Autowired EventRepository eventRepository;
    @Autowired UserRepository users;
    @Autowired CalendarService calendars;
    @Autowired PlatformTransactionManager transactions;
    @Autowired JdbcTemplate jdbc;

    @Test
    void bookingWaitsForPriceUpdateAndRejectsStaleQuoteWithoutPersistingACharge() throws Exception {
        Fixture fixture = fixture();
        var item = catalog.create(fixture.calendarId(), product("10.00", null), fixture.actor());
        var selection = new CatalogItemSelection(item.id(), 2, new BigDecimal("10.00"), BigDecimal.ZERO, null);
        long before = eventRepository.count();
        var updatedUncommitted = new CountDownLatch(1);
        var commit = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var writer = executor.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                catalog.update(fixture.calendarId(), item.id(), product("13.50", item.version()), fixture.actor());
                updatedUncommitted.countDown();
                await(commit, "Price transaction was not released");
                return null;
            }));
            await(updatedUncommitted, "Price transaction did not acquire its lock");
            var booking = executor.submit(() -> {
                try {
                    events.create(request(fixture.calendarId(), List.of(selection), new BigDecimal("20.00")), fixture.actor());
                    return HttpStatus.CREATED.value();
                } catch (ResponseStatusException exception) {
                    return exception.getStatusCode().value();
                }
            });

            assertThat(waitForCatalogLock()).as("PostgreSQL must observe the booking waiting on catalog_items").isTrue();
            assertThat(booking.isDone()).isFalse();
            commit.countDown();
            writer.get(10, TimeUnit.SECONDS);
            assertThat(booking.get(10, TimeUnit.SECONDS)).isEqualTo(409);
        } finally {
            commit.countDown();
            executor.shutdownNow();
        }
        assertThat(eventRepository.count()).isEqualTo(before);

        var fresh = new CatalogItemSelection(item.id(), 2, null, null, null);
        var quote = pricing.quote(new EventCatalogQuote.Request(fixture.calendarId(), START.toLocalDate(), List.of(fresh)), fixture.actor());
        assertThat(quote.amount()).isEqualByComparingTo("27.00");
        var event = events.create(request(fixture.calendarId(), List.of(fresh), quote.amount()), fixture.actor());
        assertThat(events.findById(event.id(), fixture.actor()).amount()).isEqualByComparingTo("27.00");
    }

    @Test
    void reorderingAndRemovingSnapshotsKeepsHistoricallyContractedPrices() {
        Fixture fixture = fixture();
        var first = catalog.create(fixture.calendarId(), product("10.00", null), fixture.actor());
        var second = catalog.create(fixture.calendarId(), product("15.00", null), fixture.actor());
        var one = new CatalogItemSelection(first.id(), 1, null, null, null);
        var two = new CatalogItemSelection(second.id(), 2, null, null, null);
        var event = events.create(request(fixture.calendarId(), List.of(one, two), new BigDecimal("40.00")), fixture.actor());
        catalog.update(fixture.calendarId(), second.id(), product("50.00", second.version()), fixture.actor());

        events.update(event.id(), update(List.of(two, one)), fixture.actor());
        assertThat(events.findById(event.id(), fixture.actor()).catalogItems()).extracting(EventCatalogItem::catalogItemId)
                .containsExactly(second.id(), first.id());
        events.update(event.id(), update(List.of(two)), fixture.actor());
        var saved = events.findById(event.id(), fixture.actor());
        assertThat(saved.catalogItems()).extracting(EventCatalogItem::catalogItemId).containsExactly(second.id());
        assertThat(saved.amount()).isEqualByComparingTo("30.00");
    }

    private Fixture fixture() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("phase3_stabilization_test");
        User owner = users.saveAndFlush(new User("Synthetic booking owner", UUID.randomUUID() + "@example.invalid",
                "test-only", UserRole.USER, null));
        SharedCalendar calendar = calendars.provisionPersonalCalendar(owner);
        Authentication actor = UsernamePasswordAuthenticationToken.authenticated(owner.getEmail(), null, List.of());
        return new Fixture(calendar.getId(), actor);
    }

    private static CatalogItemRequest product(String price, Long version) {
        return new CatalogItemRequest("Synthetic product", CatalogItemType.PRODUCT, null, null, new BigDecimal(price),
                null, null, null, null, null, true, version);
    }

    private static CreateEventRequest request(UUID calendar, List<CatalogItemSelection> items, BigDecimal expected) {
        return new CreateEventRequest(calendar, EventType.CLIENT, "Synthetic booking", "Synthetic client", null, null,
                null, null, START, START.plusHours(1), null, null, null, null, items, null, expected);
    }

    private static UpdateEventRequest update(List<CatalogItemSelection> selections) {
        return new UpdateEventRequest(EventType.CLIENT, "Synthetic booking", "Synthetic client", null, null, null,
                null, START, START.plusHours(1), null, null, null, null, selections, null, false, null);
    }

    private boolean waitForCatalogLock() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        do {
            int waiting = jdbc.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%catalog_items%'
                    """, Integer.class);
            if (waiting > 0) return true;
            Thread.sleep(20);
        } while (System.nanoTime() < deadline);
        return false;
    }

    private static void await(CountDownLatch signal, String message) {
        try {
            if (!signal.await(10, TimeUnit.SECONDS)) throw new IllegalStateException(message);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(message, exception);
        }
    }

    private record Fixture(UUID calendarId, Authentication actor) {
    }
}
