package com.sharedplanner.event;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class EventFinancialIntegrityIntegrationTests {

    private static final LocalDateTime START = LocalDateTime.of(2026, 8, 25, 10, 0);
    private static final LocalDateTime END = START.plusHours(1);

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

    @Test
    void paidClientEventCannotChangeAmountOrType() {
        Fixture fixture = fixture("paid-integrity");
        Event paid = clientEvent(fixture, new BigDecimal("100.00"));
        paid.registerPayment(
                PaymentStatus.PAID,
                PaymentMethod.PIX,
                new BigDecimal("100.00"),
                LocalDateTime.of(2026, 8, 25, 11, 0),
                fixture.owner()
        );
        eventRepository.flush();

        assertThatThrownBy(() -> eventService.update(
                paid.getId(),
                updateRequest(EventType.CLIENT, new BigDecimal("80.00"), null),
                fixture.authentication()
        )).hasMessageContaining("payment history cannot change amount");

        assertThatThrownBy(() -> eventService.update(
                paid.getId(),
                updateRequest(EventType.PERSONAL, null, null),
                fixture.authentication()
        )).hasMessageContaining("payment history cannot change type");

        assertThat(paid.getEventType()).isEqualTo(EventType.CLIENT);
        assertThat(paid.getAmount()).isEqualByComparingTo("100.00");
        assertThat(paid.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(paid.getReceivedAmount()).isEqualByComparingTo("100.00");
    }

    @Test
    void paidClientEventCanChangeNonFinancialFieldsWhenAmountIsPreserved() {
        Fixture fixture = fixture("paid-allowed");
        Event paid = clientEvent(fixture, new BigDecimal("100.00"));
        LocalDateTime paidAt = LocalDateTime.of(2026, 8, 25, 11, 0);
        paid.registerPayment(
                PaymentStatus.PAID,
                PaymentMethod.PIX,
                new BigDecimal("100.00"),
                paidAt,
                fixture.owner()
        );
        eventRepository.flush();

        EventResponse response = eventService.update(
                paid.getId(),
                new UpdateEventRequest(
                        EventType.CLIENT,
                        "Renamed appointment",
                        "Client renamed",
                        "must be discarded",
                        "Updated description",
                        "Updated work",
                        new BigDecimal("100.0"),
                        START.plusDays(1),
                        END.plusDays(1),
                        null
                ),
                fixture.authentication()
        );

        assertThat(response.title()).isEqualTo("Renamed appointment");
        assertThat(response.personName()).isNull();
        assertThat(response.paymentStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(response.receivedAmount()).isEqualByComparingTo("100.00");
        assertThat(response.paidAt()).isEqualTo(paidAt);
    }

    @Test
    void pendingClientConversionClearsFinancialSnapshotAndInapplicableFields() {
        Fixture fixture = fixture("pending-conversion");
        Event pending = clientEvent(fixture, new BigDecimal("75.00"));
        pending.registerPayment(
                PaymentStatus.PENDING,
                PaymentMethod.CASH,
                BigDecimal.ZERO,
                LocalDateTime.of(2026, 8, 25, 9, 0),
                fixture.owner()
        );
        eventRepository.flush();

        EventResponse response = eventService.update(
                pending.getId(),
                new UpdateEventRequest(
                        EventType.PERSONAL,
                        "Personal appointment",
                        "must be discarded",
                        "Person",
                        "Personal description",
                        "must be discarded",
                        new BigDecimal("999.00"),
                        START,
                        END,
                        "must-be-discarded@example.com"
                ),
                fixture.authentication()
        );

        Event updated = eventRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getEventType()).isEqualTo(EventType.PERSONAL);
        assertThat(updated.getClientName()).isNull();
        assertThat(updated.getPersonName()).isEqualTo("Person");
        assertThat(updated.getWorkDescription()).isNull();
        assertThat(updated.getAmount()).isNull();
        assertThat(updated.getApprovalRequestedFrom()).isNull();
        assertThat(updated.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(updated.getPaymentMethod()).isNull();
        assertThat(updated.getReceivedAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(updated.getPaidAt()).isNull();
        assertThat(response.amount()).isNull();
        assertThat(response.paymentStatus()).isNull();
    }

    @Test
    void sharedEventNormalizesFieldsAndClearsPreviousApproverWhenReopened() {
        Fixture fixture = fixture("shared-normalization");
        User target = userRepository.save(new User(
                "Approval target",
                "target-shared-normalization@example.com",
                "unused",
                UserRole.USER,
                fixture.owner()
        ));
        memberRepository.save(new CalendarMember(
                fixture.calendar(),
                target,
                CalendarMemberRole.EDITOR,
                fixture.owner()
        ));

        EventResponse created = eventService.create(
                new CreateEventRequest(
                        fixture.calendar().getId(),
                        EventType.SHARED,
                        "Shared appointment",
                        "must be discarded",
                        "must be discarded",
                        "Shared description",
                        "must be discarded",
                        new BigDecimal("500.00"),
                        START,
                        END,
                        target.getEmail()
                ),
                fixture.authentication()
        );

        Event shared = eventRepository.findById(created.id()).orElseThrow();
        assertThat(shared.getClientName()).isNull();
        assertThat(shared.getPersonName()).isNull();
        assertThat(shared.getWorkDescription()).isNull();
        assertThat(shared.getAmount()).isNull();
        assertThat(shared.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(shared.getReceivedAmount()).isEqualByComparingTo(BigDecimal.ZERO);

        shared.approve(target);
        eventRepository.flush();
        assertThat(shared.getApprovedBy()).isEqualTo(target);

        eventService.update(
                shared.getId(),
                new UpdateEventRequest(
                        EventType.SHARED,
                        "Shared appointment updated",
                        null,
                        null,
                        "Updated description",
                        null,
                        null,
                        START.plusHours(2),
                        END.plusHours(2),
                        target.getEmail()
                ),
                fixture.authentication()
        );

        assertThat(shared.getStatus()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(shared.getApprovedBy()).isNull();
        assertThat(shared.getApprovalRequestedFrom()).isEqualTo(target);
    }

    private Fixture fixture(String prefix) {
        User owner = userRepository.save(new User(
                "Owner",
                prefix + "-owner@example.com",
                "unused",
                UserRole.ADMIN,
                null
        ));
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(prefix, owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        return new Fixture(
                owner,
                calendar,
                new UsernamePasswordAuthenticationToken(owner.getEmail(), null)
        );
    }

    private Event clientEvent(Fixture fixture, BigDecimal amount) {
        Event event = new Event(fixture.calendar(), fixture.owner());
        event.fill(
                EventType.CLIENT,
                EventStatus.SCHEDULED,
                "Client appointment",
                "Client",
                null,
                "Description",
                "Service",
                amount,
                START,
                END,
                null,
                fixture.owner()
        );
        return eventRepository.save(event);
    }

    private UpdateEventRequest updateRequest(EventType type, BigDecimal amount, String approvalEmail) {
        return new UpdateEventRequest(
                type,
                "Updated appointment",
                type == EventType.CLIENT ? "Client" : null,
                type == EventType.PERSONAL ? "Person" : null,
                "Description",
                type == EventType.CLIENT ? "Service" : null,
                amount,
                START.plusDays(1),
                END.plusDays(1),
                approvalEmail
        );
    }

    private record Fixture(
            User owner,
            SharedCalendar calendar,
            UsernamePasswordAuthenticationToken authentication
    ) {
    }
}
