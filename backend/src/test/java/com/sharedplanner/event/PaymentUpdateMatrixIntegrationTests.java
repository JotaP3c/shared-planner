package com.sharedplanner.event;

import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditLogRepository;
import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BLG-TEST-001 — matriz de updatePayment (AC-PAY-001..004).
 * Cobre transições válidas para PENDING/PARTIALLY_PAID/PAID/REFUNDED, valores inválidos,
 * método obrigatório, datas, tipos incompatíveis, cancelamento e autorização, verificando
 * que uma falha não altera o estado nem grava auditoria. Executa em H2 (MODE=PostgreSQL):
 * constraints e migrations reais de PostgreSQL não são exercitadas aqui.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class PaymentUpdateMatrixIntegrationTests {

    private static final LocalDateTime START = LocalDateTime.of(2026, 9, 10, 10, 0);
    private static final LocalDateTime END = START.plusHours(1);
    private static final LocalDateTime PAID_AT = LocalDateTime.of(2026, 9, 10, 11, 30);
    private static final BigDecimal AMOUNT = new BigDecimal("100.00");

    @Autowired
    private EventService eventService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SharedCalendarRepository calendarRepository;

    @Autowired
    private CalendarMemberRepository memberRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    // ---- Transições válidas ------------------------------------------------

    @Test
    void pendingToPaidRecordsFullPaymentAndAudit() {
        Fixture fixture = fixture("pay-paid");
        Event event = clientEvent(fixture);

        EventResponse response = eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                fixture.adminAuth()
        );

        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(response.receivedAmount()).isEqualByComparingTo(AMOUNT);
        assertThat(response.paymentMethod()).isEqualTo(PaymentMethod.PIX);
        assertThat(response.paidAt()).isEqualTo(PAID_AT);
        assertThat(paymentAudits(event)).isEqualTo(1);
    }

    @Test
    void partialPaymentWithoutDateGetsServerTimestamp() {
        Fixture fixture = fixture("pay-partial");
        Event event = clientEvent(fixture);

        EventResponse response = eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID, PaymentMethod.CASH, new BigDecimal("40.50"), null),
                fixture.adminAuth()
        );

        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.PARTIALLY_PAID);
        assertThat(response.receivedAmount()).isEqualByComparingTo("40.50");
        assertThat(response.paidAt()).isNotNull();
    }

    @Test
    void paidCanBeRefundedAndRefundKeepsNoReceivedAmount() {
        Fixture fixture = fixture("pay-refund");
        Event event = clientEvent(fixture);
        eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.CREDIT_CARD, AMOUNT, PAID_AT),
                fixture.adminAuth()
        );

        EventResponse response = eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.REFUNDED, PaymentMethod.CREDIT_CARD, BigDecimal.ZERO, null),
                fixture.adminAuth()
        );

        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(response.receivedAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(paymentAudits(event)).isEqualTo(2);
    }

    @Test
    void paidCanReturnToPendingWithoutReceivedAmountOrDate() {
        Fixture fixture = fixture("pay-back-pending");
        Event event = clientEvent(fixture);
        eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                fixture.adminAuth()
        );

        EventResponse response = eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PENDING, null, null, null),
                fixture.adminAuth()
        );

        // Comportamento atual registrado (BR-PAY-003 histórico é DECISÃO NECESSÁRIA):
        // o estado volta a PENDING e o valor recebido é zerado.
        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(response.receivedAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ---- Valores e campos inválidos: estado preservado, sem auditoria -------

    @Test
    void rejectsReceivedAmountGreaterThanEventAmount() {
        assertRejectedWithoutSideEffects("pay-over",
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, new BigDecimal("100.01"), PAID_AT),
                "greater than event amount");
    }

    @Test
    void rejectsPaidWithAmountDifferentFromEventAmount() {
        assertRejectedWithoutSideEffects("pay-paid-short",
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, new BigDecimal("99.99"), PAID_AT),
                "equal to event amount");
    }

    @Test
    void rejectsPartialPaymentEqualToTotalOrZero() {
        assertRejectedWithoutSideEffects("pay-partial-full",
                new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                "lower than event amount");
        assertRejectedWithoutSideEffects("pay-partial-zero",
                new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID, PaymentMethod.PIX, BigDecimal.ZERO, PAID_AT),
                "lower than event amount");
    }

    @Test
    void rejectsPaidOrPartialWithoutPaymentMethod() {
        assertRejectedWithoutSideEffects("pay-no-method",
                new UpdatePaymentRequest(PaymentStatus.PAID, null, AMOUNT, PAID_AT),
                "require paymentMethod");
        assertRejectedWithoutSideEffects("pay-partial-no-method",
                new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID, null, new BigDecimal("10.00"), PAID_AT),
                "require paymentMethod");
    }

    @Test
    void rejectsPendingWithReceivedAmountOrPaidAt() {
        assertRejectedWithoutSideEffects("pay-pending-amount",
                new UpdatePaymentRequest(PaymentStatus.PENDING, null, new BigDecimal("1.00"), null),
                "cannot have received amount");
        assertRejectedWithoutSideEffects("pay-pending-date",
                new UpdatePaymentRequest(PaymentStatus.PENDING, null, null, PAID_AT),
                "cannot have paidAt");
    }

    @Test
    void rejectsRefundWithReceivedAmount() {
        assertRejectedWithoutSideEffects("pay-refund-amount",
                new UpdatePaymentRequest(PaymentStatus.REFUNDED, PaymentMethod.PIX, new BigDecimal("5.00"), null),
                "Refunded payments cannot have received amount");
    }

    @Test
    void rejectsMissingStatus() {
        assertRejectedWithoutSideEffects("pay-no-status",
                new UpdatePaymentRequest(null, PaymentMethod.PIX, AMOUNT, PAID_AT),
                "Payment status is required");
    }

    @Test
    void keepsTwoDecimalPrecision() {
        Fixture fixture = fixture("pay-precision");
        Event event = clientEvent(fixture);

        EventResponse response = eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PARTIALLY_PAID, PaymentMethod.PIX, new BigDecimal("33.33"), PAID_AT),
                fixture.adminAuth()
        );

        assertThat(response.receivedAmount()).isEqualByComparingTo("33.33");
    }

    // ---- Tipos incompatíveis e cancelamento --------------------------------

    @ParameterizedTest
    @EnumSource(value = EventType.class, names = {"PERSONAL", "SHARED"})
    void rejectsPaymentsForNonClientEvents(EventType type) {
        Fixture fixture = fixture("pay-type-" + type.name().toLowerCase());
        Event event = new Event(fixture.calendar(), fixture.admin());
        event.fill(type, EventStatus.SCHEDULED, "Not revenue", null,
                type == EventType.PERSONAL ? "Pessoa" : null, null, null, null, START, END, null, fixture.admin());
        eventRepository.saveAndFlush(event);

        assertThatThrownBy(() -> eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, BigDecimal.ZERO, PAID_AT),
                fixture.adminAuth()
        )).hasMessageContaining("Only client events can have payments");

        assertThat(paymentAudits(event)).isZero();
    }

    @Test
    void rejectsPaymentOnCancelledEvent() {
        Fixture fixture = fixture("pay-cancelled");
        Event event = clientEvent(fixture);
        event.cancel(fixture.admin());
        eventRepository.flush();

        assertThatThrownBy(() -> eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                fixture.adminAuth()
        )).hasMessageContaining("Cancelled events cannot be changed");

        assertThat(event.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(paymentAudits(event)).isZero();
    }

    // ---- Autorização (comportamento atual; Q-005 define a política futura) --

    @Test
    void viewerAndFinanceMembersCannotUpdatePayment() {
        Fixture fixture = fixture("pay-authz");
        Event event = clientEvent(fixture);

        for (CalendarMemberRole role : new CalendarMemberRole[]{CalendarMemberRole.VIEWER, CalendarMemberRole.FINANCE}) {
            User member = member(fixture, role);
            assertForbidden(event, member);
        }

        assertThat(event.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(paymentAudits(event)).isZero();
    }

    @Test
    void editorCannotUpdatePaymentOfAnotherAuthorsEvent() {
        Fixture fixture = fixture("pay-editor");
        Event event = clientEvent(fixture);
        User editor = member(fixture, CalendarMemberRole.EDITOR);

        assertForbidden(event, editor);
        assertThat(paymentAudits(event)).isZero();
    }

    @Test
    void nonMemberCannotUpdatePayment() {
        Fixture fixture = fixture("pay-outsider");
        Event event = clientEvent(fixture);
        User outsider = userRepository.save(new User(
                "Outsider", "pay-outsider-out@example.com", "unused", UserRole.USER, fixture.admin()));

        assertThatThrownBy(() -> eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                auth(outsider)
        )).isInstanceOf(ResponseStatusException.class);

        assertThat(paymentAudits(event)).isZero();
    }

    // ---- Helpers ------------------------------------------------------------

    private void assertRejectedWithoutSideEffects(String prefix, UpdatePaymentRequest request, String message) {
        Fixture fixture = fixture(prefix);
        Event event = clientEvent(fixture);

        assertThatThrownBy(() -> eventService.updatePayment(event.getId(), request, fixture.adminAuth()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining(message)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        assertThat(event.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(event.getReceivedAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(event.getPaymentMethod()).isNull();
        assertThat(event.getPaidAt()).isNull();
        assertThat(paymentAudits(event)).isZero();
    }

    private void assertForbidden(Event event, User user) {
        assertThatThrownBy(() -> eventService.updatePayment(
                event.getId(),
                new UpdatePaymentRequest(PaymentStatus.PAID, PaymentMethod.PIX, AMOUNT, PAID_AT),
                auth(user)
        ))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    private long paymentAudits(Event event) {
        return auditLogRepository.findAll().stream()
                .filter(log -> event.getId().equals(log.getEntityId()))
                .filter(log -> log.getAction() == AuditAction.PAYMENT_UPDATED)
                .count();
    }

    private Fixture fixture(String prefix) {
        User admin = userRepository.save(new User(
                "Owner", prefix + "-owner@example.com", "unused", UserRole.USER, null));
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(prefix, admin));
        memberRepository.save(new CalendarMember(calendar, admin, CalendarMemberRole.ADMIN, admin));
        return new Fixture(admin, calendar, prefix);
    }

    private User member(Fixture fixture, CalendarMemberRole role) {
        User user = userRepository.save(new User(
                role.name(),
                fixture.prefix() + "-" + role.name().toLowerCase() + "@example.com",
                "unused",
                UserRole.USER,
                fixture.admin()
        ));
        memberRepository.save(new CalendarMember(fixture.calendar(), user, role, fixture.admin()));
        return user;
    }

    private Event clientEvent(Fixture fixture) {
        Event event = new Event(fixture.calendar(), fixture.admin());
        event.fill(EventType.CLIENT, EventStatus.SCHEDULED, "Client appointment", "Client", null,
                "Description", "Service", AMOUNT, START, END, null, fixture.admin());
        return eventRepository.saveAndFlush(event);
    }

    private static UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }

    private record Fixture(User admin, SharedCalendar calendar, String prefix) {
        UsernamePasswordAuthenticationToken adminAuth() {
            return auth(admin);
        }
    }
}
