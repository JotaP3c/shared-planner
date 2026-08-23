package com.sharedplanner.finance;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventRepository;
import com.sharedplanner.event.EventStatus;
import com.sharedplanner.event.EventType;
import com.sharedplanner.event.PaymentMethod;
import com.sharedplanner.event.PaymentStatus;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class FinanceSummaryIntegrationTests {

    private static final LocalDate START_DATE = LocalDate.of(2026, 8, 1);
    private static final LocalDate END_DATE = LocalDate.of(2026, 8, 31);

    @Autowired
    private FinanceService financeService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SharedCalendarRepository calendarRepository;

    @Autowired
    private CalendarMemberRepository memberRepository;

    @Test
    void summarizesEveryFinancialFieldAndExcludesInapplicableEvents() {
        Fixture fixture = fixture();

        clientEvent(
                fixture,
                "Paid at lower boundary",
                new BigDecimal("100.00"),
                PaymentStatus.PAID,
                new BigDecimal("100.00"),
                START_DATE.atStartOfDay(),
                EventStatus.SCHEDULED
        );
        clientEvent(
                fixture,
                "Pending at upper boundary",
                new BigDecimal("200.00"),
                PaymentStatus.PENDING,
                BigDecimal.ZERO,
                END_DATE.atTime(23, 59, 59),
                EventStatus.SCHEDULED
        );
        clientEvent(
                fixture,
                "Partially paid",
                new BigDecimal("300.00"),
                PaymentStatus.PARTIALLY_PAID,
                new BigDecimal("120.00"),
                START_DATE.plusDays(10).atTime(14, 0),
                EventStatus.SCHEDULED
        );
        clientEvent(
                fixture,
                "Refunded",
                new BigDecimal("50.00"),
                PaymentStatus.REFUNDED,
                BigDecimal.ZERO,
                START_DATE.plusDays(20).atTime(9, 0),
                EventStatus.SCHEDULED
        );

        clientEvent(
                fixture,
                "Cancelled",
                new BigDecimal("900.00"),
                PaymentStatus.PAID,
                new BigDecimal("900.00"),
                START_DATE.plusDays(5).atTime(10, 0),
                EventStatus.CANCELLED
        );
        clientEvent(
                fixture,
                "Before interval",
                new BigDecimal("800.00"),
                PaymentStatus.PAID,
                new BigDecimal("800.00"),
                START_DATE.minusDays(1).atTime(23, 59, 59),
                EventStatus.SCHEDULED
        );
        clientEvent(
                fixture,
                "At exclusive upper boundary",
                new BigDecimal("700.00"),
                PaymentStatus.PAID,
                new BigDecimal("700.00"),
                END_DATE.plusDays(1).atStartOfDay(),
                EventStatus.SCHEDULED
        );
        nonClientEvent(fixture, EventType.PERSONAL, START_DATE.plusDays(12).atTime(10, 0));
        nonClientEvent(fixture, EventType.SHARED, START_DATE.plusDays(13).atTime(10, 0));
        eventRepository.flush();

        FinanceSummaryResponse summary = financeService.summarize(
                fixture.calendar().getId(),
                START_DATE,
                END_DATE,
                fixture.authentication()
        );

        assertThat(summary.calendarId()).isEqualTo(fixture.calendar().getId());
        assertThat(summary.startDate()).isEqualTo(START_DATE);
        assertThat(summary.endDate()).isEqualTo(END_DATE);
        assertThat(summary.expectedAmount()).isEqualByComparingTo("650.00");
        assertThat(summary.receivedAmount()).isEqualByComparingTo("220.00");
        assertThat(summary.pendingAmount()).isEqualByComparingTo("430.00");
        assertThat(summary.appointmentCount()).isEqualTo(4L);
        assertThat(summary.paidCount()).isEqualTo(1L);
        assertThat(summary.pendingCount()).isEqualTo(1L);
        assertThat(summary.partiallyPaidCount()).isEqualTo(1L);
        assertThat(summary.refundedCount()).isEqualTo(1L);
    }

    @Test
    void rejectsPeriodWhoseEndPrecedesStart() {
        Fixture fixture = fixture();

        assertThatThrownBy(() -> financeService.summarize(
                fixture.calendar().getId(),
                END_DATE,
                START_DATE,
                fixture.authentication()
        ))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("End date must be equal to or after start date");
    }

    private Fixture fixture() {
        User owner = userRepository.save(new User(
                "Finance owner",
                "finance-summary-owner@example.com",
                "unused",
                UserRole.ADMIN,
                null
        ));
        User financeMember = userRepository.save(new User(
                "Finance member",
                "finance-summary-member@example.com",
                "unused",
                UserRole.USER,
                owner
        ));
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("Finance summary", owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        memberRepository.save(new CalendarMember(
                calendar,
                financeMember,
                CalendarMemberRole.FINANCE,
                owner
        ));

        return new Fixture(
                owner,
                financeMember,
                calendar,
                new UsernamePasswordAuthenticationToken(financeMember.getEmail(), null)
        );
    }

    private Event clientEvent(
            Fixture fixture,
            String title,
            BigDecimal amount,
            PaymentStatus paymentStatus,
            BigDecimal receivedAmount,
            LocalDateTime startsAt,
            EventStatus eventStatus
    ) {
        Event event = new Event(fixture.calendar(), fixture.owner());
        event.fill(
                EventType.CLIENT,
                eventStatus,
                title,
                "Client",
                null,
                null,
                "Service",
                amount,
                startsAt,
                startsAt.plusHours(1),
                null,
                fixture.owner()
        );

        if (paymentStatus != PaymentStatus.PENDING) {
            event.registerPayment(
                    paymentStatus,
                    paymentStatus == PaymentStatus.REFUNDED ? null : PaymentMethod.PIX,
                    receivedAmount,
                    paymentStatus == PaymentStatus.REFUNDED ? null : startsAt,
                    fixture.owner()
            );
        }

        return eventRepository.save(event);
    }

    private Event nonClientEvent(Fixture fixture, EventType type, LocalDateTime startsAt) {
        Event event = new Event(fixture.calendar(), fixture.owner());
        event.fill(
                type,
                type == EventType.SHARED ? EventStatus.PENDING_APPROVAL : EventStatus.SCHEDULED,
                type + " event",
                null,
                type == EventType.PERSONAL ? "Person" : null,
                null,
                null,
                null,
                startsAt,
                startsAt.plusHours(1),
                type == EventType.SHARED ? fixture.financeMember() : null,
                fixture.owner()
        );
        return eventRepository.save(event);
    }

    private record Fixture(
            User owner,
            User financeMember,
            SharedCalendar calendar,
            UsernamePasswordAuthenticationToken authentication
    ) {
    }
}
