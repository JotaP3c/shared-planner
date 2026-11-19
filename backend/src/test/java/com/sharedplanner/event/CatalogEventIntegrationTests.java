package com.sharedplanner.event;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.access.AccessAssignment;
import com.sharedplanner.access.AccessAssignmentRepository;
import com.sharedplanner.access.AccessProfile;
import com.sharedplanner.access.AccessProfileRepository;
import com.sharedplanner.access.Permission;
import com.sharedplanner.access.ProfileScope;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.CalendarType;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.catalog.CatalogItemRequest;
import com.sharedplanner.catalog.CatalogItemType;
import com.sharedplanner.catalog.CatalogService;
import com.sharedplanner.finance.FinanceService;
import com.sharedplanner.recurrence.EventSeriesRepository;
import com.sharedplanner.recurrence.EventSeriesService;
import com.sharedplanner.recurrence.RecurrenceRule;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "debug=false", "logging.level.root=ERROR"})
@Transactional
class CatalogEventIntegrationTests {
    private static final LocalDateTime START = LocalDateTime.of(2030, 11, 17, 10, 0);
    @Autowired EventService events;
    @Autowired EventCatalogPricing pricing;
    @Autowired CatalogService catalog;
    @Autowired FinanceService finance;
    @Autowired UserRepository users;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired EventRepository eventRepository;
    @Autowired EventSeriesRepository seriesRepository;
    @Autowired EventSeriesService series;
    @Autowired EntityManager entityManager;
    @Autowired MockMvc http;
    @Autowired AccessAssignmentRepository assignments;
    @Autowired AccessProfileRepository profiles;

    @Test void persistsMultipleItemSnapshotsWithPromotionAndCountsLegacyRevenueOnce() {
        Fixture fixture = fixture();
        var service = catalog.create(fixture.calendarId(), service("Procedure", "80.00", true, null), fixture.actor());
        var product = catalog.create(fixture.calendarId(), product("25.50"), fixture.actor());
        List<CatalogItemSelection> selections = List.of(select(service.id(), 2), select(product.id(), 1));

        var quote = pricing.quote(new EventCatalogQuote.Request(fixture.calendarId(), START.toLocalDate(), selections), fixture.actor());
        assertThat(quote.amount()).isEqualByComparingTo("185.50");
        assertThat(quote.catalogItems().get(0).discount()).isEqualByComparingTo("40.00");
        assertThat(quote.catalogItems().get(1).durationMinutes()).isNull();
        assertThat(pricing.quote(new EventCatalogQuote.Request(fixture.calendarId(), START.toLocalDate().minusDays(1), selections),
                fixture.actor()).amount()).isEqualByComparingTo("225.50");

        var created = events.create(client(fixture.calendarId(), selections, "185.50"), fixture.actor());
        events.create(legacy(fixture.calendarId()), fixture.actor());
        entityManager.flush();
        entityManager.clear();
        var reloaded = events.findById(created.id(), fixture.actor());
        assertThat(reloaded.catalogLinked()).isTrue();
        assertThat(reloaded.catalogItems()).extracting(EventCatalogItem::catalogItemId).containsExactly(service.id(), product.id());
        assertThat(reloaded.amount()).isEqualByComparingTo("185.50");
        assertThat(reloaded.title()).isEqualTo("Synthetic client — 2× Procedure, Product");
        assertThat(reloaded.workDescription()).isEqualTo("2× Procedure, Product");
        assertThat(reloaded.observations()).isEqualTo("Only a note, not a price.");
        assertThat(reloaded.paymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(reloaded.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.PENDING_CONFIRMATION);

        var summary = finance.summarize(fixture.calendarId(), START.toLocalDate(), START.toLocalDate(), fixture.actor());
        assertThat(summary.expectedAmount()).isEqualByComparingTo("221.25");
        assertThat(summary.appointmentCount()).isEqualTo(2);
        assertThat(summary.receivedAmount()).isZero();
    }

    @Test void preservesContractedTermsUntilExplicitRepriceAndProtectsPartialPayments() {
        Fixture fixture = fixture();
        var item = catalog.create(fixture.calendarId(), service("Original procedure", "80.00", true, null), fixture.actor());
        var event = events.create(client(fixture.calendarId(), List.of(select(item.id(), 2)), "160.00"), fixture.actor());
        catalog.update(fixture.calendarId(), item.id(), service("Renamed procedure", "60.00", true, item.version()), fixture.actor());

        var unchanged = events.update(event.id(), edit(null, false, null, START.plusWeeks(2)), fixture.actor());
        assertThat(unchanged.amount()).isEqualByComparingTo("160.00");
        assertThat(unchanged.catalogItems().get(0).name()).isEqualTo("Original procedure");
        assertThat(unchanged.observations()).isEqualTo("Only a note, not a price.");
        var changed = events.update(event.id(), edit(List.of(select(item.id(), 2)), true, "120.00", START), fixture.actor());
        assertThat(changed.amount()).isEqualByComparingTo("120.00");
        assertThat(changed.catalogItems().get(0).name()).isEqualTo("Renamed procedure");
        events.updatePayment(event.id(), new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID,
                PaymentMethod.PIX, new BigDecimal("40.00"), null), fixture.actor());

        denied(HttpStatus.BAD_REQUEST, () -> events.update(event.id(), edit(List.of(select(item.id(), 1)), false, null, START), fixture.actor()));
        denied(HttpStatus.BAD_REQUEST, () -> events.update(event.id(), edit(null, true, null, START), fixture.actor()));
        var preserved = events.update(event.id(), edit(null, false, null, START.plusDays(1)), fixture.actor());
        assertThat(preserved.amount()).isEqualByComparingTo("120.00");
        assertThat(preserved.receivedAmount()).isEqualByComparingTo("40.00");
    }

    @Test void redactsFinancialSnapshotAndRejectsQuoteFromAnotherCalendar() throws Exception {
        Fixture fixture = fixture();
        Fixture other = fixture();
        var item = catalog.create(fixture.calendarId(), product("100.00"), fixture.actor());
        var event = events.create(client(fixture.calendarId(), List.of(select(item.id(), 1)), "100.00"), fixture.actor());
        User viewer = userWithRole(UserRole.USER);
        SharedCalendar calendar = calendars.findById(fixture.calendarId()).orElseThrow();
        members.save(new CalendarMember(calendar, viewer, CalendarMemberRole.VIEWER, calendar.getOwner()));

        http.perform(get("/api/events/{id}", event.id()).with(user(viewer.getEmail())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.catalogLinked").value(true))
                .andExpect(jsonPath("$.workDescription").value("Product"))
                .andExpect(jsonPath("$.amount").doesNotExist()).andExpect(jsonPath("$.catalogItems").doesNotExist());
        http.perform(post("/api/events/catalog-quote").with(user(viewer.getEmail())).contentType("application/json")
                        .content(quoteBody(fixture.calendarId(), item.id())))
                .andExpect(status().isForbidden());
        http.perform(post("/api/events/catalog-quote").with(user(other.actor().getName())).contentType("application/json")
                        .content(quoteBody(other.calendarId(), item.id())))
                .andExpect(status().isNotFound());
    }

    @Test void rejectsStaleExpectedPriceDuplicateAndNewInactiveItemsWithoutCreatingAnEvent() {
        Fixture fixture = fixture();
        var item = catalog.create(fixture.calendarId(), service("Quoted", "80.00", true, null), fixture.actor());
        long before = eventRepository.count();
        denied(HttpStatus.CONFLICT, () -> events.create(client(fixture.calendarId(), List.of(select(item.id(), 1)), "50.00"), fixture.actor()));
        denied(HttpStatus.BAD_REQUEST, () -> events.create(client(fixture.calendarId(),
                List.of(select(item.id(), 1), select(item.id(), 2)), null), fixture.actor()));
        catalog.update(fixture.calendarId(), item.id(), service("Quoted", "80.00", false, item.version()), fixture.actor());
        denied(HttpStatus.NOT_FOUND, () -> events.create(client(fixture.calendarId(), List.of(select(item.id(), 1)), null), fixture.actor()));
        assertThat(eventRepository.count()).isEqualTo(before);
    }

    @Test void rejectsStaleQuoteWhenAnItemGainsDurationWithoutChangingPrice() {
        Fixture fixture = fixture();
        var item = catalog.create(fixture.calendarId(), product("25.50"), fixture.actor());
        var selection = new CatalogItemSelection(item.id(), 1, new BigDecimal("25.50"), BigDecimal.ZERO, 0);
        var request = client(fixture.calendarId(), List.of(selection), "25.50");
        var accepted = events.create(request, fixture.actor());
        assertThat(accepted.catalogItems().get(0).durationMinutes()).isNull();

        catalog.update(fixture.calendarId(), item.id(), new CatalogItemRequest("Product", CatalogItemType.PRODUCT,
                null, null, new BigDecimal("25.50"), null, null, null, 15, null, true, item.version()), fixture.actor());
        long before = eventRepository.count();
        denied(HttpStatus.CONFLICT, () -> events.create(request, fixture.actor()));
        assertThat(eventRepository.count()).isEqualTo(before);
    }

    @Test void editingContentWithoutFinanceOrCatalogGrantsPreservesTheContractEvenWhenItemIsInactive() {
        Fixture fixture = fixture();
        var item = catalog.create(fixture.calendarId(), service("Contracted procedure", "80.00", true, null), fixture.actor());
        var event = events.create(client(fixture.calendarId(), List.of(select(item.id(), 1)), "80.00"), fixture.actor());
        catalog.update(fixture.calendarId(), item.id(), service("No longer offered", "50.00", false, item.version()), fixture.actor());

        User editor = userWithRole(UserRole.USER);
        SharedCalendar calendar = calendars.findById(fixture.calendarId()).orElseThrow();
        members.save(new CalendarMember(calendar, editor, CalendarMemberRole.EDITOR, calendar.getOwner()));
        var profile = profiles.save(new AccessProfile("TEST_" + UUID.randomUUID(), "Synthetic editor", ProfileScope.CALENDAR, false,
                Set.of(Permission.CALENDAR_VIEW, Permission.EVENT_EDIT, Permission.EVENT_EDIT_ALL)));
        var assignment = new AccessAssignment(editor.getId(), calendar.getId());
        assignment.assign(List.of(profile));
        assignments.save(assignment);
        Authentication actor = UsernamePasswordAuthenticationToken.authenticated(editor.getEmail(), null, List.of());

        var updated = events.update(event.id(), edit(null, false, null, START.plusDays(5)), actor);
        assertThat(updated.title()).isEqualTo("Synthetic edit");
        assertThat(updated.startsAt()).isEqualTo(START.plusDays(5));
        assertThat(updated.catalogLinked()).isTrue();
        assertThat(updated.catalogItems()).isNull();
        assertThat(updated.amount()).isNull();
        assertThat(updated.observations()).isEqualTo("Only a note, not a price.");
        var contracted = events.findById(event.id(), fixture.actor());
        assertThat(contracted.amount()).isEqualByComparingTo("80.00");
        assertThat(contracted.catalogItems().get(0).name()).isEqualTo("Contracted procedure");
        denied(HttpStatus.FORBIDDEN, () -> events.update(event.id(), edit(List.of(select(item.id(), 2)), false, null, START), actor));
        var asPersonal = new UpdateEventRequest(EventType.PERSONAL, "Synthetic edit", null, "Synthetic owner",
                null, null, null, START, START.plusHours(1), null);
        denied(HttpStatus.FORBIDDEN, () -> events.update(event.id(), asPersonal, actor));
        assertThat(events.findById(event.id(), fixture.actor()).catalogItems()).hasSize(1);
    }

    @Test void rejectsNewClientSeriesAndConversionOfPersonalSeriesWithoutCreatingClientOccurrences() throws Exception {
        Fixture fixture = fixture();
        long before = eventRepository.count();
        long seriesBefore = seriesRepository.count();
        String request = """
                {"event":{"calendarId":"%s","eventType":"CLIENT","title":"Synthetic client","clientName":"Synthetic client",
                "workDescription":"Legacy service","amount":10,"startsAt":"2030-11-17T10:00:00","endsAt":"2030-11-17T11:00:00"},
                "recurrence":{"frequency":"DAILY","count":2,"zoneId":"America/Sao_Paulo"}}
                """.formatted(fixture.calendarId());
        http.perform(post("/api/event-series").with(user(fixture.actor().getName())).contentType("application/json").content(request))
                .andExpect(status().isBadRequest());
        assertThat(eventRepository.count()).isEqualTo(before);
        assertThat(seriesRepository.count()).isEqualTo(seriesBefore);

        var personal = new CreateEventRequest(fixture.calendarId(), EventType.PERSONAL, "Synthetic personal", null,
                "Synthetic owner", null, null, null, START, START.plusHours(1), null);
        var existing = series.create(new EventSeriesService.CreateSeriesRequest(personal,
                new RecurrenceRule(RecurrenceRule.Frequency.DAILY, 1, null, null, 2, "America/Sao_Paulo")), fixture.actor());
        var asClient = new UpdateEventRequest(EventType.CLIENT, "Synthetic client", "Synthetic client", null,
                null, "Legacy service", BigDecimal.TEN, START, START.plusHours(1), null);
        denied(HttpStatus.BAD_REQUEST, () -> series.update(existing.id(), EventSeriesService.Scope.ALL, null, asClient, fixture.actor()));
        denied(HttpStatus.BAD_REQUEST, () -> events.update(existing.events().get(0).id(), asClient, fixture.actor()));
        assertThat(series.byEvent(existing.events().get(0).id(), fixture.actor()).events())
                .allMatch(event -> event.eventType() == EventType.PERSONAL);
    }

    private Fixture fixture() {
        User owner = userWithRole(UserRole.USER);
        SharedCalendar calendar = calendars.save(new SharedCalendar("Synthetic calendar", owner, CalendarType.PERSONAL));
        members.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        return new Fixture(calendar.getId(), UsernamePasswordAuthenticationToken.authenticated(owner.getEmail(), null, List.of()));
    }

    private User userWithRole(UserRole role) {
        return users.save(new User("Synthetic operator", UUID.randomUUID() + "@example.invalid", "test-only", role, null));
    }

    private static CatalogItemRequest service(String name, String promotion, boolean active, Long version) {
        LocalDate day = START.toLocalDate();
        return new CatalogItemRequest(name, CatalogItemType.SERVICE, null, null, new BigDecimal("100.00"),
                new BigDecimal(promotion), day, day.plusDays(1), 30, null, active, version);
    }

    private static CatalogItemRequest product(String price) {
        return new CatalogItemRequest("Product", CatalogItemType.PRODUCT, null, null, new BigDecimal(price),
                null, null, null, null, null, true, null);
    }

    private static CatalogItemSelection select(UUID id, int qty) {
        return new CatalogItemSelection(id, qty, null, null, null);
    }

    private static CreateEventRequest client(UUID calendar, List<CatalogItemSelection> items, String expectedTotal) {
        return new CreateEventRequest(calendar, EventType.CLIENT, null, "Synthetic client", null,
                null, "This client-supplied price/description is not authoritative", BigDecimal.ONE,
                START, START.plusHours(1), null, null, null, null, items, "Only a note, not a price.",
                expectedTotal == null ? null : new BigDecimal(expectedTotal));
    }

    private static CreateEventRequest legacy(UUID calendar) {
        return new CreateEventRequest(calendar, EventType.CLIENT, "Synthetic legacy", "Synthetic client", null,
                null, "Historical service", new BigDecimal("35.75"), START, START.plusHours(1), null);
    }

    private static UpdateEventRequest edit(List<CatalogItemSelection> items, boolean reprice, String expectedTotal, LocalDateTime date) {
        return new UpdateEventRequest(EventType.CLIENT, "Synthetic edit", "Synthetic client", null,
                null, null, null, date, date.plusHours(1), null, null, null, null, items, null, reprice,
                expectedTotal == null ? null : new BigDecimal(expectedTotal));
    }

    private static String quoteBody(UUID calendar, UUID item) {
        return "{\"calendarId\":\"" + calendar + "\",\"appointmentDate\":\"2030-11-17\",\"catalogItems\":[{\"catalogItemId\":\""
                + item + "\",\"quantity\":1}]}";
    }

    private static void denied(HttpStatus status, Runnable operation) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode()).isEqualTo(status));
    }

    private record Fixture(UUID calendarId, Authentication actor) {
    }
}
