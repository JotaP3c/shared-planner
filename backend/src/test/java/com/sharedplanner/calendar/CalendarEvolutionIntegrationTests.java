package com.sharedplanner.calendar;

import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.event.*;
import com.sharedplanner.finance.FinanceService;
import com.sharedplanner.user.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class CalendarEvolutionIntegrationTests {
    @Autowired CalendarService calendars;
    @Autowired SharedCalendarRepository calendarRepository;
    @Autowired CalendarMemberRepository members;
    @Autowired UserService users;
    @Autowired UserRepository userRepository;
    @Autowired EventService events;
    @Autowired EventRepository eventRepository;
    @Autowired AuthorizationService authorization;
    @Autowired FinanceService finance;
    @Autowired EntityManager entityManager;
    private static final LocalDateTime START = LocalDateTime.of(2026, 11, 20, 10, 0);

    @Test
    void registrationAtomicallyProvisionsExactlyOneIsolatedPersonalCalendar() {
        User admin = user("registration-admin", UserRole.ADMIN);
        UserResponse created = users.create(new CreateUserRequest("João", "personal-new@example.test", "test-only-123", UserRole.USER), auth(admin));
        User person = userRepository.findById(created.id()).orElseThrow();
        SharedCalendar personal = calendarRepository.findByOwnerIdAndCalendarType(person.getId(), CalendarType.PERSONAL).orElseThrow();
        assertThat(calendars.provisionPersonalCalendar(person).getId()).isEqualTo(personal.getId());
        assertThat(calendarRepository.findByOwnerEmailIgnoreCase(person.getEmail())).hasSize(1);
        assertThat(members.findByCalendarIdOrderByCreatedAtAsc(personal.getId())).singleElement()
                .satisfies(member -> assertThat(member.getRoles()).containsExactly(CalendarMemberRole.ADMIN));
        User outsider = user("registration-outsider", UserRole.USER);
        assertThat(calendars.list(auth(outsider))).isEmpty();
        assertStatus(() -> authorization.ensureCalendarVisible(personal.getId(), auth(outsider)), HttpStatus.NOT_FOUND);
    }

    @Test
    void combinedEditorFinanceDoesNotGrantMemberOrSystemAdministration() {
        Fixture fixture = fixture("combined");
        User editor = user("combined-editor", UserRole.USER);
        calendars.addMember(fixture.calendar().getId(), new AddCalendarMemberRequest(editor.getEmail(), null,
                Set.of(CalendarMemberRole.EDITOR, CalendarMemberRole.FINANCE)), auth(fixture.owner()));
        authorization.ensureCanCreateEvent(fixture.calendar().getId(), auth(editor));
        authorization.ensureCanUseFinance(fixture.calendar().getId(), auth(editor));
        assertStatus(() -> authorization.ensureCanManageCalendar(fixture.calendar().getId(), auth(editor)), HttpStatus.FORBIDDEN);
        assertStatus(() -> users.list(auth(editor)), HttpStatus.FORBIDDEN);
        assertThat(calendars.list(auth(editor))).singleElement().satisfies(calendar -> {
            assertThat(calendar.memberRoles()).containsExactlyInAnyOrder(CalendarMemberRole.EDITOR, CalendarMemberRole.FINANCE);
            assertThat(calendar.canCreateEvents()).isTrue();
        });
    }

    @Test
    void regularUserCanCreateSharedCalendarAndAddAnotherCalendarAdminOnly() {
        Fixture fixture = fixture("admins");
        User second = user("admins-second", UserRole.USER);
        calendars.addMember(fixture.calendar().getId(), new AddCalendarMemberRequest(second.getEmail(), CalendarMemberRole.ADMIN), auth(fixture.owner()));
        authorization.ensureCanManageCalendar(fixture.calendar().getId(), auth(second));
        assertStatus(() -> users.list(auth(second)), HttpStatus.FORBIDDEN);
        CalendarMember owner = members.findByCalendarIdAndUserId(fixture.calendar().getId(), fixture.owner().getId()).orElseThrow();
        assertStatus(() -> calendars.updateMember(fixture.calendar().getId(), owner.getId(),
                new UpdateCalendarMemberRequest(null, Set.of(CalendarMemberRole.EDITOR, CalendarMemberRole.FINANCE)), auth(second)), HttpStatus.BAD_REQUEST);
    }

    @ParameterizedTest
    @EnumSource(EventType.class)
    void everyTypeInANewSharedCalendarNeedsAllOtherMembersApproval(EventType type) {
        Fixture fixture = fixture("all-" + type);
        User first = add(fixture, "first", CalendarMemberRole.VIEWER);
        User second = add(fixture, "second", CalendarMemberRole.FINANCE);
        EventResponse created = events.create(request(fixture.calendar(), type), auth(fixture.owner()));
        assertThat(created.status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(created.approvalRequestedFromEmails()).containsExactlyInAnyOrder(first.getEmail(), second.getEmail());
        assertStatus(() -> events.approve(created.id(), auth(fixture.owner())), HttpStatus.FORBIDDEN);
        EventResponse partial = events.approve(created.id(), auth(first));
        assertThat(partial.status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(events.listPendingApprovals(auth(first))).isEmpty();
        assertThat(events.listPendingApprovals(auth(second))).extracting(EventResponse::id).contains(created.id());
        EventResponse approved = events.approve(created.id(), auth(second));
        assertThat(approved.status()).isEqualTo(EventStatus.APPROVED);
        assertThat(events.approvalHistory(created.id(), auth(first))).hasSize(2);
    }

    @Test
    void rejectionEndsTheRoundAndEditingReopensWithoutErasingResponses() {
        Fixture fixture = fixture("history");
        User first = add(fixture, "first", CalendarMemberRole.VIEWER);
        User second = add(fixture, "second", CalendarMemberRole.VIEWER);
        EventResponse created = events.create(request(fixture.calendar(), EventType.PERSONAL), auth(fixture.owner()));
        assertThat(events.reject(created.id(), auth(first)).status()).isEqualTo(EventStatus.REJECTED);
        assertStatus(() -> events.approve(created.id(), auth(second)), HttpStatus.BAD_REQUEST);
        EventResponse reopened = events.update(created.id(), new UpdateEventRequest(EventType.PERSONAL, "Updated", null,
                "Pessoa", "Description", null, null, START, START.plusHours(1), null), auth(fixture.owner()));
        assertThat(reopened.status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(reopened.approvals()).allSatisfy(approval -> {
            assertThat(approval.round()).isEqualTo(2);
            assertThat(approval.status()).isEqualTo(EventApprovalStatus.PENDING);
        });
        assertThat(events.approvalHistory(created.id(), auth(first))).hasSize(4)
                .anySatisfy(approval -> assertThat(approval.status()).isEqualTo(EventApprovalStatus.REJECTED));
    }

    @Test
    void revokedMemberCannotRespondAndUnrelatedUserCannotReadHistory() {
        Fixture fixture = fixture("revocation");
        User target = add(fixture, "target", CalendarMemberRole.VIEWER);
        EventResponse created = events.create(request(fixture.calendar(), EventType.CLIENT), auth(fixture.owner()));
        CalendarMember membership = members.findByCalendarIdAndUserId(fixture.calendar().getId(), target.getId()).orElseThrow();
        calendars.removeMember(fixture.calendar().getId(), membership.getId(), auth(fixture.owner()));
        assertStatus(() -> events.approve(created.id(), auth(target)), HttpStatus.FORBIDDEN);
        assertThat(events.listPendingApprovals(auth(target))).isEmpty();
        assertStatus(() -> events.approvalHistory(created.id(), auth(target)), HttpStatus.NOT_FOUND);
    }

    @Test
    void emptySharedCalendarCannotCreateEventAndExplicitSelfApprovalIsRejected() {
        Fixture fixture = fixture("empty");
        assertStatus(() -> events.create(request(fixture.calendar(), EventType.PERSONAL), auth(fixture.owner())), HttpStatus.BAD_REQUEST);
        add(fixture, "target", CalendarMemberRole.VIEWER);
        CreateEventRequest self = new CreateEventRequest(fixture.calendar().getId(), EventType.PERSONAL,
                "Self", null, "Pessoa", null, null, null, START, START.plusHours(1), null,
                null, List.of(fixture.owner().getEmail()), false);
        assertStatus(() -> events.create(self, auth(fixture.owner())), HttpStatus.BAD_REQUEST);
    }

    @Test
    void clientPhoneAndSingleDescriptionPreserveBothLegacyTexts() {
        User owner = user("phone-owner", UserRole.USER);
        SharedCalendar personal = calendars.provisionPersonalCalendar(owner);
        CreateEventRequest request = new CreateEventRequest(personal.getId(), EventType.CLIENT, "Appointment", "Cliente", null,
                "Observações antigas", "Serviço antigo", BigDecimal.TEN, START, START.plusHours(1), null,
                "+55 (47) 99999-1234", null, false);
        EventResponse created = events.create(request, auth(owner));
        assertThat(created.clientPhone()).isEqualTo("47999991234");
        assertThat(created.description()).contains("Serviço antigo", "Observações antigas");
        assertThat(created.workDescription()).isEqualTo(created.description());
        assertThat(created.status()).isEqualTo(EventStatus.SCHEDULED);
        long before = eventRepository.count();
        CreateEventRequest invalid = new CreateEventRequest(personal.getId(), EventType.CLIENT, "Invalid", "Cliente", null,
                "Descrição", null, BigDecimal.TEN, START, START.plusHours(1), null, "123", null, false);
        assertStatus(() -> events.create(invalid, auth(owner)), HttpStatus.BAD_REQUEST);
        assertThat(eventRepository.count()).isEqualTo(before);
    }

    @Test
    void allDayUsesExclusiveMidnightEndAndLegacyCalendarsKeepTheirExistingPolicy() {
        User owner = user("legacy-owner", UserRole.USER);
        SharedCalendar legacy = calendarRepository.save(new SharedCalendar("Legacy", owner));
        members.save(new CalendarMember(legacy, owner, CalendarMemberRole.ADMIN, owner));
        EventResponse timed = events.create(request(legacy, EventType.PERSONAL), auth(owner));
        assertThat(timed.status()).isEqualTo(EventStatus.SCHEDULED);
        assertThat(timed.allDay()).isFalse();
        CreateEventRequest allDay = request(legacy, EventType.PERSONAL).withAllDay(true)
                .withPeriod(START.toLocalDate().atStartOfDay(), START.toLocalDate().plusDays(1).atStartOfDay());
        assertThat(events.create(allDay, auth(owner)).allDay()).isTrue();
        assertStatus(() -> events.create(request(legacy, EventType.PERSONAL).withAllDay(true), auth(owner)), HttpStatus.BAD_REQUEST);
    }

    @Test
    void approvalCollectionsAreFetchedInBatchesForTheCalendarRange() {
        User admin = user("batch-admin", UserRole.ADMIN);
        User target = user("batch-target", UserRole.USER);
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("Batch legacy", admin));
        for (int i = 0; i < 60; i++) {
            Event event = new Event(calendar, admin);
            event.fill(EventType.SHARED, EventStatus.PENDING_APPROVAL, "Batch " + i, null, null,
                    null, null, null, START.plusMinutes(i), START.plusMinutes(i + 30), target, admin);
            event.beginApprovalRound(List.of(target));
            eventRepository.save(event);
        }
        entityManager.flush();
        entityManager.clear();
        var statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            var values = events.list(calendar.getId(), START, START.plusDays(1), auth(admin));
            assertThat(values).hasSize(60).allSatisfy(event -> assertThat(event.approvals()).hasSize(1));
            // Three batches (50 + 10 and any membership collection), rather than one per event.
            assertThat(statistics.getCollectionFetchCount()).isLessThanOrEqualTo(3);
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }

    @Test
    void paymentConfirmationAndCancellationKeepTheCompletedApprovalHistory() {
        Fixture fixture = fixture("separate-state");
        User target = add(fixture, "target", CalendarMemberRole.VIEWER);
        EventResponse created = events.create(request(fixture.calendar(), EventType.CLIENT), auth(fixture.owner()));
        events.approve(created.id(), auth(target));
        EventResponse paid = events.updatePayment(created.id(), new UpdatePaymentRequest(
                PaymentStatus.PAID, PaymentMethod.PIX, BigDecimal.TEN, null), auth(fixture.owner()));
        assertThat(paid.status()).isEqualTo(EventStatus.APPROVED);
        EventResponse confirmed = events.confirmAppointment(created.id(), auth(fixture.owner()));
        assertThat(confirmed.status()).isEqualTo(EventStatus.APPROVED);
        assertThat(confirmed.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.CONFIRMED);
        assertThat(confirmed.paymentStatus()).isEqualTo(PaymentStatus.PAID);
        events.delete(created.id(), auth(fixture.owner()));
        EventResponse cancelled = events.findById(created.id(), auth(fixture.owner()));
        assertThat(cancelled.status()).isEqualTo(EventStatus.CANCELLED);
        assertThat(cancelled.approvals()).singleElement().satisfies(approval -> assertThat(approval.status()).isEqualTo(EventApprovalStatus.APPROVED));
        assertThat(events.approvalHistory(created.id(), auth(fixture.owner()))).hasSize(1);
    }

    @Test
    void designatedEditorsCanBothApproveWithoutEitherGainingEditOrDeleteOfAnotherAuthor() {
        Fixture fixture = fixture("editor-targets");
        User first = add(fixture, "first", CalendarMemberRole.EDITOR);
        User second = add(fixture, "second", CalendarMemberRole.EDITOR);
        EventResponse created = events.create(request(fixture.calendar(), EventType.SHARED), auth(fixture.owner()));
        for (User editor : List.of(first, second)) {
            assertStatus(() -> events.delete(created.id(), auth(editor)), HttpStatus.FORBIDDEN);
            assertStatus(() -> events.update(created.id(), new UpdateEventRequest(EventType.SHARED, "Unauthorized",
                    null, null, null, null, null, START, START.plusHours(1), null), auth(editor)), HttpStatus.FORBIDDEN);
        }
        assertThat(events.approve(created.id(), auth(first)).status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(events.approve(created.id(), auth(second)).status()).isEqualTo(EventStatus.APPROVED);
    }

    @Test
    void auxiliaryImportCalendarPreservesOnePersonalCalendarAndRequiresExplicitSharing() {
        User owner = user("aux-owner", UserRole.USER);
        User outsider = user("aux-outsider", UserRole.FINANCE);
        calendars.provisionPersonalCalendar(owner);
        CalendarResponse auxiliary = calendars.create(new CreateCalendarRequest("Synthetic birthdays", CalendarType.IMPORTED), auth(owner));
        CalendarResponse shared = calendars.create(new CreateCalendarRequest("Synthetic shared"), auth(owner));
        assertThat(auxiliary.calendarType()).isEqualTo(CalendarType.IMPORTED);
        assertThat(shared.calendarType()).isEqualTo(CalendarType.SHARED);
        assertThat(auxiliary.ownerEmail()).isEqualTo(owner.getEmail());
        assertThat(auxiliary.memberRoles()).containsExactly(CalendarMemberRole.ADMIN);
        assertThat(calendarRepository.findByOwnerEmailIgnoreCase(owner.getEmail()))
                .filteredOn(calendar -> calendar.getCalendarType() == CalendarType.PERSONAL).hasSize(1);
        assertThat(members.findByCalendarIdOrderByCreatedAtAsc(auxiliary.id())).singleElement()
                .satisfies(member -> assertThat(member.getUser().getId()).isEqualTo(owner.getId()));
        SharedCalendar calendar = calendarRepository.findById(auxiliary.id()).orElseThrow();
        EventResponse birthday = events.create(request(calendar, EventType.PERSONAL), auth(owner));
        assertThat(birthday.status()).isEqualTo(EventStatus.SCHEDULED);
        assertThat(birthday.approvals()).isEmpty();
        assertThat(birthday.amount()).isNull();
        assertThat(finance.summarize(auxiliary.id(), START.toLocalDate(), START.toLocalDate(), auth(owner)).appointmentCount()).isZero();
        assertStatus(() -> authorization.ensureCalendarVisible(auxiliary.id(), auth(outsider)), HttpStatus.NOT_FOUND);
        assertStatus(() -> authorization.ensureCanUseFinance(auxiliary.id(), auth(outsider)), HttpStatus.NOT_FOUND);
        assertStatus(() -> users.list(auth(owner)), HttpStatus.FORBIDDEN);
    }

    @ParameterizedTest
    @EnumSource(value = CalendarType.class, names = {"PERSONAL", "LEGACY"})
    void explicitCalendarCreationCannotForgeAnAdditionalPersonalCalendarOrLegacyPolicy(CalendarType type) {
        User owner = user("reserved-" + type, UserRole.ADMIN);
        calendars.provisionPersonalCalendar(owner);
        long before = calendarRepository.count();
        assertStatus(() -> calendars.create(new CreateCalendarRequest("Forged", type), auth(owner)), HttpStatus.BAD_REQUEST);
        assertThat(calendarRepository.count()).isEqualTo(before);
    }

    @Test
    void systemAdminCanProvisionTheConfirmedImportDestinationWithoutJoiningIt() {
        User admin = user("delegation-admin", UserRole.ADMIN);
        User owner = user("delegation-owner", UserRole.USER);
        calendars.provisionPersonalCalendar(owner);
        CalendarResponse created = calendars.create(new CreateCalendarRequest("Synthetic birthdays", CalendarType.IMPORTED,
                owner.getEmail().toUpperCase(java.util.Locale.ROOT)), auth(admin));
        SharedCalendar stored = calendarRepository.findById(created.id()).orElseThrow();
        assertThat(stored.getOwner().getId()).isEqualTo(owner.getId());
        assertThat(stored.getCreatedBy().getId()).isEqualTo(admin.getId());
        assertThat(members.findByCalendarIdOrderByCreatedAtAsc(created.id())).singleElement().satisfies(member -> {
            assertThat(member.getUser().getId()).isEqualTo(owner.getId());
            assertThat(member.getCreatedBy().getId()).isEqualTo(admin.getId());
            assertThat(member.getRoles()).containsExactly(CalendarMemberRole.ADMIN);
        });
        assertThat(members.existsByCalendarIdAndUserId(created.id(), admin.getId())).isFalse();
        assertThat(calendarRepository.findByOwnerEmailIgnoreCase(owner.getEmail())).hasSize(2)
                .filteredOn(calendar -> calendar.getCalendarType() == CalendarType.PERSONAL).hasSize(1);
    }

    @Test
    void regularUserCannotAssignAnotherOwnerAndCanExplicitlyAssignThemselves() {
        User actor = user("delegation-regular", UserRole.USER);
        User other = user("delegation-other", UserRole.USER);
        long before = calendarRepository.count();
        assertStatus(() -> calendars.create(new CreateCalendarRequest("Denied", CalendarType.IMPORTED, other.getEmail()), auth(actor)), HttpStatus.FORBIDDEN);
        assertStatus(() -> calendars.create(new CreateCalendarRequest("Denied unknown", CalendarType.IMPORTED, "unknown@example.test"), auth(actor)), HttpStatus.FORBIDDEN);
        assertThat(calendarRepository.count()).isEqualTo(before);
        CalendarResponse own = calendars.create(new CreateCalendarRequest("Own destination", CalendarType.IMPORTED, actor.getEmail()), auth(actor));
        assertThat(own.ownerEmail()).isEqualTo(actor.getEmail());
        assertStatus(() -> users.list(auth(actor)), HttpStatus.FORBIDDEN);
    }

    @Test
    void delegatedDestinationRequiresAnExistingActiveOwnerWithoutLeavingOrphans() {
        User admin = user("delegation-check-admin", UserRole.ADMIN);
        User inactive = user("delegation-inactive", UserRole.USER);
        inactive.updateProfile(inactive.getFullName(), UserRole.USER, false, admin);
        userRepository.flush();
        long calendarsBefore = calendarRepository.count();
        long membersBefore = members.count();
        assertStatus(() -> calendars.create(new CreateCalendarRequest("Missing", CalendarType.IMPORTED, "missing@example.test"), auth(admin)), HttpStatus.NOT_FOUND);
        assertStatus(() -> calendars.create(new CreateCalendarRequest("Inactive", CalendarType.IMPORTED, inactive.getEmail()), auth(admin)), HttpStatus.CONFLICT);
        assertThat(calendarRepository.count()).isEqualTo(calendarsBefore);
        assertThat(members.count()).isEqualTo(membersBefore);
    }

    private User user(String key, UserRole role) {
        return userRepository.save(new User(key, key + "@example.test", "unused", role, null));
    }
    private Fixture fixture(String key) {
        User owner = user(key + "-owner", UserRole.USER);
        CalendarResponse calendar = calendars.create(new CreateCalendarRequest(key), auth(owner));
        return new Fixture(owner, calendarRepository.findById(calendar.id()).orElseThrow(), key);
    }
    private User add(Fixture fixture, String key, CalendarMemberRole role) {
        User user = user(fixture.key() + "-" + key, UserRole.USER);
        calendars.addMember(fixture.calendar().getId(), new AddCalendarMemberRequest(user.getEmail(), role), auth(fixture.owner()));
        return user;
    }
    private CreateEventRequest request(SharedCalendar calendar, EventType type) {
        return new CreateEventRequest(calendar.getId(), type, "Test appointment", type == EventType.CLIENT ? "Cliente" : null,
                type == EventType.PERSONAL ? "Pessoa" : null, "Description", type == EventType.CLIENT ? "Service" : null,
                type == EventType.CLIENT ? BigDecimal.TEN : null, START, START.plusHours(1), null);
    }
    private static UsernamePasswordAuthenticationToken auth(User user) { return new UsernamePasswordAuthenticationToken(user.getEmail(), null); }
    private void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode()).isEqualTo(status));
    }
    private record Fixture(User owner, SharedCalendar calendar, String key) {}
}
