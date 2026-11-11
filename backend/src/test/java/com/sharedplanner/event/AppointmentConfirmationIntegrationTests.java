package com.sharedplanner.event;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditLogRepository;
import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.finance.FinanceService;
import com.sharedplanner.finance.FinanceSummaryResponse;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** NF-01 — confirmação de atendimento independente do pagamento (H2 MODE=PostgreSQL). */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class AppointmentConfirmationIntegrationTests {

    private static final LocalDateTime START = LocalDateTime.of(2026, 11, 20, 15, 0);
    private static final LocalDateTime END = START.plusMinutes(45);
    private static final LocalDate MONTH_START = LocalDate.of(2026, 11, 1);
    private static final LocalDate MONTH_END = LocalDate.of(2026, 11, 30);
    private static final BigDecimal AMOUNT = new BigDecimal("50.00");

    @Autowired private EventService eventService;
    @Autowired private FinanceService financeService;
    @Autowired private EventRepository eventRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private SharedCalendarRepository calendarRepository;
    @Autowired private CalendarMemberRepository memberRepository;
    @Autowired private AuditLogRepository auditLogRepository;

    @Test
    void newClientEventStartsAwaitingConfirmationAndNonClientHasNoConfirmation() {
        Fixture fixture = fixture("conf-new");
        EventResponse client = createClient(fixture);
        assertThat(client.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.PENDING_CONFIRMATION);

        EventResponse personal = eventService.create(new CreateEventRequest(
                fixture.calendar().getId(), EventType.PERSONAL, "Pessoal", null, "Pessoa", null, null,
                null, START, END, null), fixture.auth());
        assertThat(personal.confirmationStatus()).isNull();
    }

    @Test
    void confirmingKeepsPaymentPendingAndCountsAsConfirmedRevenue() {
        Fixture fixture = fixture("conf-confirm");
        EventResponse created = createClient(fixture);

        EventResponse confirmed = eventService.confirmAppointment(created.id(), fixture.auth());

        assertThat(confirmed.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.CONFIRMED);
        assertThat(confirmed.paymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(confirmed.confirmationChangedByEmail()).isEqualTo(fixture.owner().getEmail());
        assertThat(confirmed.confirmationChangedAt()).isNotNull();

        FinanceSummaryResponse summary = summary(fixture);
        assertThat(summary.confirmedAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.expectedAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.receivedAmount()).isEqualByComparingTo("0");
        assertThat(summary.confirmedCount()).isEqualTo(1L);
        assertThat(summary.awaitingConfirmationCount()).isZero();

        // Pagar depois: continua CONFIRMED, recebido entra no financeiro.
        EventResponse paid = eventService.updatePayment(created.id(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, END), fixture.auth());
        assertThat(paid.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.CONFIRMED);
        assertThat(paid.paymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(summary(fixture).receivedAmount()).isEqualByComparingTo("50.00");

        assertThat(auditActions(created)).contains(AuditAction.APPOINTMENT_CONFIRMED);
        List<ConfirmationHistoryResponse> history = eventService.confirmationHistory(created.id(), fixture.auth());
        assertThat(history).hasSize(1);
        assertThat(history.get(0).previousStatus()).isEqualTo(AppointmentConfirmationStatus.PENDING_CONFIRMATION);
        assertThat(history.get(0).newStatus()).isEqualTo(AppointmentConfirmationStatus.CONFIRMED);
    }

    @Test
    void unschedulingRequiresReasonAndJustificationForOther() {
        Fixture fixture = fixture("conf-reason");
        EventResponse created = createClient(fixture);

        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(null, null, null, null), fixture.auth()), HttpStatus.BAD_REQUEST);
        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.OTHER, "   ", null, null), fixture.auth()),
                HttpStatus.BAD_REQUEST);

        EventResponse unscheduled = eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.OTHER, " Viagem ", null, null), fixture.auth());
        assertThat(unscheduled.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.CANCELLED);
        assertThat(unscheduled.unscheduleReason()).isEqualTo(UnscheduleReason.OTHER);
        assertThat(unscheduled.unscheduleNotes()).isEqualTo("Viagem");
        // O evento continua registrado (não vira status CANCELLED da equipe).
        assertThat(unscheduled.status()).isEqualTo(EventStatus.SCHEDULED);
    }

    @Test
    void unscheduledAppointmentLeavesExpectedRevenueButKeepsReceivedPayment() {
        Fixture fixture = fixture("conf-paid-unscheduled");
        EventResponse created = createClient(fixture);
        eventService.updatePayment(created.id(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, END), fixture.auth());

        EventResponse unscheduled = eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.GAVE_UP, null, null, null), fixture.auth());

        // Pagamento preservado, nada apagado nem estornado automaticamente.
        assertThat(unscheduled.paymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(unscheduled.receivedAmount()).isEqualByComparingTo("50.00");

        FinanceSummaryResponse summary = summary(fixture);
        assertThat(summary.expectedAmount()).isEqualByComparingTo("0");
        assertThat(summary.pendingAmount()).isEqualByComparingTo("0");
        assertThat(summary.receivedAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.unscheduledAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.unscheduledCount()).isEqualTo(1L);
        assertThat(summary.confirmedCount()).isZero();

        // Estorno manual continua possível depois de desmarcado.
        EventResponse refunded = eventService.updatePayment(created.id(),
                new UpdatePaymentRequest(PaymentStatus.REFUNDED, PaymentMethod.PIX, BigDecimal.ZERO, null), fixture.auth());
        assertThat(refunded.paymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    void rescheduleMovesTheSameEventWithoutDuplicatingRevenue() {
        Fixture fixture = fixture("conf-reschedule");
        EventResponse created = createClient(fixture);
        eventService.confirmAppointment(created.id(), fixture.auth());
        long eventsBefore = eventRepository.count();

        LocalDateTime newStart = START.plusDays(2);
        EventResponse rescheduled = eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.RESCHEDULE, "Pediu sexta", newStart, newStart.plusMinutes(45)),
                fixture.auth());

        assertThat(eventRepository.count()).isEqualTo(eventsBefore);
        assertThat(rescheduled.id()).isEqualTo(created.id());
        assertThat(rescheduled.startsAt()).isEqualTo(newStart);
        assertThat(rescheduled.confirmationStatus()).isEqualTo(AppointmentConfirmationStatus.RESCHEDULED);
        assertThat(rescheduled.rescheduleCount()).isEqualTo(1);

        FinanceSummaryResponse summary = summary(fixture);
        assertThat(summary.appointmentCount()).isEqualTo(1L);
        assertThat(summary.expectedAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.unconfirmedAmount()).isEqualByComparingTo("50.00");
        assertThat(summary.rescheduledCount()).isEqualTo(1L);
        assertThat(summary.rescheduleOccurrences()).isEqualTo(1L);

        // Remarcado pode ser confirmado na nova data.
        assertThat(eventService.confirmAppointment(created.id(), fixture.auth()).confirmationStatus())
                .isEqualTo(AppointmentConfirmationStatus.CONFIRMED);

        List<ConfirmationHistoryResponse> history = eventService.confirmationHistory(created.id(), fixture.auth());
        ConfirmationHistoryResponse rescheduleEntry = history.stream()
                .filter(item -> item.reason() == UnscheduleReason.RESCHEDULE)
                .findFirst()
                .orElseThrow();
        assertThat(rescheduleEntry.previousStartsAt()).isEqualTo(START);
        assertThat(rescheduleEntry.newStartsAt()).isEqualTo(newStart);
        assertThat(auditActions(created)).contains(AuditAction.APPOINTMENT_RESCHEDULED);
    }

    @Test
    void rescheduleRequiresAValidNewPeriod() {
        Fixture fixture = fixture("conf-reschedule-invalid");
        EventResponse created = createClient(fixture);

        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.RESCHEDULE, null, null, null), fixture.auth()),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.RESCHEDULE, null, END, START), fixture.auth()),
                HttpStatus.BAD_REQUEST);
        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.RESCHEDULE, null, START, END), fixture.auth()),
                HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsInvalidTransitions() {
        Fixture fixture = fixture("conf-transitions");
        EventResponse created = createClient(fixture);
        eventService.confirmAppointment(created.id(), fixture.auth());

        // Confirmar duas vezes.
        assertStatus(() -> eventService.confirmAppointment(created.id(), fixture.auth()), HttpStatus.CONFLICT);

        eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.GAVE_UP, null, null, null), fixture.auth());

        // A partir de desmarcado não há confirmação, nova desmarcação nem remarcação.
        assertStatus(() -> eventService.confirmAppointment(created.id(), fixture.auth()), HttpStatus.CONFLICT);
        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.GAVE_UP, null, null, null), fixture.auth()),
                HttpStatus.CONFLICT);
    }

    @Test
    void rejectsNonClientAndStaffCancelledEvents() {
        Fixture fixture = fixture("conf-invalid-targets");
        EventResponse personal = eventService.create(new CreateEventRequest(
                fixture.calendar().getId(), EventType.PERSONAL, "Pessoal", null, "Pessoa", null, null,
                null, START, END, null), fixture.auth());
        assertStatus(() -> eventService.confirmAppointment(personal.id(), fixture.auth()), HttpStatus.BAD_REQUEST);

        EventResponse client = createClient(fixture);
        eventService.delete(client.id(), fixture.auth());
        assertStatus(() -> eventService.confirmAppointment(client.id(), fixture.auth()), HttpStatus.BAD_REQUEST);
    }

    @Test
    void viewerCannotConfirmOrUnschedule() {
        Fixture fixture = fixture("conf-authz");
        EventResponse created = createClient(fixture);
        User viewer = userRepository.save(new User("Viewer", "conf-authz-viewer@example.com", "unused",
                UserRole.USER, fixture.owner()));
        memberRepository.save(new CalendarMember(fixture.calendar(), viewer, CalendarMemberRole.VIEWER, fixture.owner()));
        var viewerAuth = new UsernamePasswordAuthenticationToken(viewer.getEmail(), null);

        assertStatus(() -> eventService.confirmAppointment(created.id(), viewerAuth), HttpStatus.FORBIDDEN);
        assertStatus(() -> eventService.unscheduleAppointment(created.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.GAVE_UP, null, null, null), viewerAuth),
                HttpStatus.FORBIDDEN);
        assertThat(eventRepository.findById(created.id()).orElseThrow().getConfirmationStatus())
                .isEqualTo(AppointmentConfirmationStatus.PENDING_CONFIRMATION);
    }

    @Test
    void confirmationDistributionIsMutuallyExclusive() {
        Fixture fixture = fixture("conf-distribution");
        EventResponse a = createClient(fixture);
        EventResponse b = createClient(fixture);
        EventResponse c = createClient(fixture);
        createClient(fixture);
        eventService.confirmAppointment(a.id(), fixture.auth());
        eventService.unscheduleAppointment(b.id(),
                new UnscheduleAppointmentRequest(UnscheduleReason.GAVE_UP, null, null, null), fixture.auth());
        eventService.unscheduleAppointment(c.id(), new UnscheduleAppointmentRequest(UnscheduleReason.RESCHEDULE,
                null, START.plusDays(1), END.plusDays(1)), fixture.auth());

        FinanceSummaryResponse summary = summary(fixture);
        assertThat(summary.appointmentCount()).isEqualTo(4L);
        assertThat(summary.confirmedCount() + summary.awaitingConfirmationCount()
                + summary.rescheduledCount() + summary.unscheduledCount()).isEqualTo(4L);
        assertThat(summary.paidCount() + summary.pendingCount()
                + summary.partiallyPaidCount() + summary.refundedCount()).isEqualTo(4L);
        assertThat(summary.expectedAmount()).isEqualByComparingTo("150.00");
        assertThat(summary.confirmedAmount().add(summary.unconfirmedAmount()))
                .isEqualByComparingTo(summary.expectedAmount());
    }

    // ---- helpers -------------------------------------------------------------

    private EventResponse createClient(Fixture fixture) {
        return eventService.create(new CreateEventRequest(
                fixture.calendar().getId(), EventType.CLIENT, "joao teste", "Joao", null, null, "Corte",
                AMOUNT, START, END, null), fixture.auth());
    }

    private FinanceSummaryResponse summary(Fixture fixture) {
        return financeService.summarize(fixture.calendar().getId(), MONTH_START, MONTH_END, fixture.auth());
    }

    private List<AuditAction> auditActions(EventResponse event) {
        return auditLogRepository.findAll().stream()
                .filter(log -> event.id().equals(log.getEntityId()))
                .map(log -> log.getAction())
                .toList();
    }

    private void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(status));
    }

    private Fixture fixture(String prefix) {
        User owner = userRepository.save(new User("Owner", prefix + "-owner@example.com", "unused", UserRole.USER, null));
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(prefix, owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        return new Fixture(owner, calendar);
    }

    private record Fixture(User owner, SharedCalendar calendar) {
        UsernamePasswordAuthenticationToken auth() {
            return new UsernamePasswordAuthenticationToken(owner.getEmail(), null);
        }
    }
}
