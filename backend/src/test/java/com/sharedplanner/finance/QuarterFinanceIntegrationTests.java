package com.sharedplanner.finance;

import com.sharedplanner.calendar.*;
import com.sharedplanner.event.*;
import com.sharedplanner.holiday.HolidayService;
import com.sharedplanner.user.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Entirely synthetic, transactionally rolled back; never seeds the local runtime database. */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "debug=false", "logging.level.root=ERROR"})
@Transactional
class QuarterFinanceIntegrationTests {
    @Autowired UserRepository users;
    @Autowired SharedCalendarRepository calendars;
    @Autowired CalendarMemberRepository members;
    @Autowired EventRepository events;
    @Autowired FinanceService finance;

    @ParameterizedTest
    @ValueSource(ints = {10, 11, 12})
    void monthlyTotalsTimelineAndRecentAppointmentsAgreeAcrossAuthorizedCalendars(int month) {
        Fixture fixture = fixture(month);
        LocalDate first = LocalDate.of(2026, month, 1);
        LocalDate last = first.withDayOfMonth(first.lengthOfMonth());
        var left = finance.summarize(fixture.left().getId(), first, last, fixture.auth());
        var right = finance.summarize(fixture.right().getId(), first, last, fixture.auth());
        int factor = month - 9;
        assertThat(left.expectedAmount().add(right.expectedAmount())).isEqualByComparingTo(money(990, factor));
        assertThat(left.receivedAmount().add(right.receivedAmount())).isEqualByComparingTo(money(460, factor));
        assertThat(left.pendingAmount().add(right.pendingAmount())).isEqualByComparingTo(money(580, factor));
        assertThat(left.appointmentCount() + right.appointmentCount()).isEqualTo(8);
        assertThat(left.paidCount() + right.paidCount()).isEqualTo(2);
        assertThat(left.partiallyPaidCount() + right.partiallyPaidCount()).isEqualTo(3);
        assertThat(left.pendingCount() + right.pendingCount()).isEqualTo(2);
        assertThat(left.refundedCount() + right.refundedCount()).isEqualTo(1);
        assertThat(right.unscheduledCount()).isEqualTo(1);
        assertThat(right.rescheduledCount()).isEqualTo(1);
        assertThat(right.rescheduleOccurrences()).isEqualTo(1);
        for (SharedCalendar calendar : List.of(fixture.left(), fixture.right())) {
            var summary = finance.summarize(calendar.getId(), first, last, fixture.auth());
            var timeline = finance.timeline(calendar.getId(), first, last, fixture.auth());
            assertThat(timeline.points().stream().map(FinanceTimelineResponse.Point::expectedAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(summary.expectedAmount());
            assertThat(timeline.points().stream().map(FinanceTimelineResponse.Point::receivedAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo(summary.receivedAmount());
            var recent = finance.appointments(calendar.getId(), first, last, 50, fixture.auth());
            assertThat(recent).hasSize(4);
            assertThat(recent).extracting(FinanceAppointmentResponse::eventId).doesNotHaveDuplicates();
            assertThat(summary.confirmedCount() + summary.awaitingConfirmationCount()
                    + summary.rescheduledCount() + summary.unscheduledCount()).isEqualTo(summary.appointmentCount());
        }
        long before = events.count();
        new HolidayService().calendar("BR", 2026);
        assertThat(events.count()).isEqualTo(before);
        assertThat(finance.summarize(fixture.left().getId(), first, last, fixture.auth())).isEqualTo(left);
    }

    @Test
    void civilDailyWeeklyBiweeklyCustomAndMonthBoundariesExcludeOtherPeriods() {
        Fixture fixture = fixture(11);
        var id = fixture.left().getId();
        var auth = fixture.auth();
        // November's synthetic prices are twice October's, by design.
        assertThat(finance.summarize(id, date(10), date(10), auth).expectedAmount()).isEqualByComparingTo("400");
        assertThat(finance.summarize(id, date(9), date(15), auth).expectedAmount()).isEqualByComparingTo("1000");
        assertThat(finance.summarize(id, date(1), date(15), auth).expectedAmount()).isEqualByComparingTo("1200");
        assertThat(finance.summarize(id, date(16), date(30), auth).expectedAmount()).isEqualByComparingTo("160");
        assertThat(finance.summarize(id, date(10), date(15), auth).receivedAmount()).isEqualByComparingTo("240");
        assertThat(finance.summarize(id, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), auth)
                .appointmentCount()).isZero();
        assertThat(finance.summarize(id, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31), auth)
                .appointmentCount()).isZero();
    }

    @Test
    void globalFinanceNeverBypassesMembershipAndViewerCannotReadValues() {
        Fixture fixture = fixture(10);
        User outsider = users.save(new User("Synthetic outsider", "quarter-outsider@example.invalid", "unused", UserRole.FINANCE, null));
        User viewer = users.save(new User("Synthetic viewer", "quarter-viewer@example.invalid", "unused", UserRole.USER, null));
        members.save(new CalendarMember(fixture.left(), viewer, CalendarMemberRole.VIEWER, fixture.owner()));
        for (User user : List.of(outsider, viewer)) {
            assertThatThrownBy(() -> finance.summarize(fixture.left().getId(), LocalDate.of(2026,10,1),
                    LocalDate.of(2026,10,31), new UsernamePasswordAuthenticationToken(user.getEmail(), null)))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            error -> assertThat(error.getStatusCode()).isEqualTo(
                                    user == outsider ? HttpStatus.NOT_FOUND : HttpStatus.FORBIDDEN));
        }
    }

    private Fixture fixture(int month) {
        int factor = month - 9;
        User owner = users.save(new User("Synthetic account A", "quarter-a@example.invalid", "unused", UserRole.FINANCE, null));
        User other = users.save(new User("Synthetic account B", "quarter-b@example.invalid", "unused", UserRole.FINANCE, null));
        SharedCalendar left = calendars.save(new SharedCalendar("TEST ONLY — Calendar A", owner));
        SharedCalendar right = calendars.save(new SharedCalendar("TEST ONLY — Calendar B", other));
        members.save(new CalendarMember(left, owner, CalendarMemberRole.ADMIN, owner));
        members.save(new CalendarMember(right, other, CalendarMemberRole.ADMIN, other));
        members.save(new CalendarMember(right, owner, CalendarMemberRole.VIEWER, other));
        client(left, owner, month, 5, 100, 100, PaymentStatus.PAID, factor).confirmAppointment(owner);
        client(left, owner, month, 10, 200, 0, PaymentStatus.PENDING, factor);
        client(left, owner, month, 15, 300, 120, PaymentStatus.PARTIALLY_PAID, factor);
        client(left, owner, month, 20, 80, 0, PaymentStatus.REFUNDED, factor);
        client(right, other, month, 6, 150, 150, PaymentStatus.PAID, factor).confirmAppointment(other);
        client(right, other, month, 7, 250, 50, PaymentStatus.PARTIALLY_PAID, factor)
                .unscheduleAppointment(UnscheduleReason.GAVE_UP, null, other);
        client(right, other, month, 14, 100, 40, PaymentStatus.PARTIALLY_PAID, factor);
        Event moved = client(right, other, month, 9, 60, 0, PaymentStatus.PENDING, factor);
        moved.rescheduleAppointment(LocalDate.of(2026, month,18).atTime(9,0),
                LocalDate.of(2026,month,18).atTime(10,0), "Synthetic rescheduling", other);
        client(left, owner, month, 12, 999, 0, PaymentStatus.PENDING, factor).cancel(owner);
        for (EventType type : List.of(EventType.PERSONAL, EventType.SHARED)) {
            Event event = new Event(left, owner);
            var start = LocalDate.of(2026, month, 11).atTime(12, 0);
            event.fill(type, type == EventType.SHARED ? EventStatus.PENDING_APPROVAL : EventStatus.SCHEDULED,
                    "Synthetic nonfinancial", null, "Synthetic person", null, null, null, start,
                    start.plusHours(1), type == EventType.SHARED ? other : null, owner);
            events.save(event);
        }
        events.flush();
        return new Fixture(owner, left, right, new UsernamePasswordAuthenticationToken(owner.getEmail(), null));
    }

    private Event client(SharedCalendar calendar, User actor, int month, int day, int amount,
                         int received, PaymentStatus status, int factor) {
        Event event = new Event(calendar, actor);
        var start = LocalDate.of(2026, month, day).atTime(9, 0);
        event.fill(EventType.CLIENT, EventStatus.SCHEDULED, "Synthetic appointment", "Synthetic client", null,
                null, "Synthetic service", money(amount, factor), start, start.plusHours(1), null, actor);
        if (status != PaymentStatus.PENDING) {
            event.registerPayment(status, status == PaymentStatus.REFUNDED ? null : PaymentMethod.PIX,
                    money(received, factor), status == PaymentStatus.REFUNDED ? null : start, actor);
        }
        return events.save(event);
    }

    private LocalDate date(int day) { return LocalDate.of(2026, 11, day); }
    private BigDecimal money(int amount, int factor) { return BigDecimal.valueOf((long) amount * factor); }
    private record Fixture(User owner, SharedCalendar left, SharedCalendar right,
                           UsernamePasswordAuthenticationToken auth) {}
}
