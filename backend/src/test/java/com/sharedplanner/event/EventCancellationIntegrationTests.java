package com.sharedplanner.event;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.calendar.SharedCalendar;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditLogRepository;
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
class EventCancellationIntegrationTests {

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

    @Test
    @Transactional
    void cancellationPreservesEventWithCancelledStatus() {
        User owner = userRepository.save(
                new User("Owner", "owner@example.com", "unused", UserRole.ADMIN, null)
        );
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("Owner calendar", owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));

        var authentication = new UsernamePasswordAuthenticationToken(owner.getEmail(), null);
        EventResponse created = eventService.create(
                new CreateEventRequest(
                        calendar.getId(),
                        EventType.CLIENT,
                        "Appointment",
                        "Client",
                        null,
                        null,
                        "Service",
                        new BigDecimal("50.00"),
                        LocalDateTime.of(2026, 8, 24, 10, 0),
                        LocalDateTime.of(2026, 8, 24, 11, 0),
                        null
                ),
                authentication
        );

        eventService.delete(created.id(), authentication);

        Event cancelled = eventRepository.findById(created.id()).orElseThrow();
        assertThat(cancelled.getStatus()).isEqualTo(EventStatus.CANCELLED);
        assertThat(auditLogRepository.findAll())
                .anySatisfy(log -> {
                    assertThat(log.getEntityId()).isEqualTo(created.id());
                    assertThat(log.getAction()).isEqualTo(AuditAction.CANCELLED);
                    assertThat(log.getNewValue()).contains("status=CANCELLED");
                });

        assertThatThrownBy(() -> eventService.update(
                created.id(),
                new UpdateEventRequest(
                        EventType.CLIENT,
                        "Changed",
                        "Client",
                        null,
                        null,
                        "Service",
                        new BigDecimal("50.00"),
                        LocalDateTime.of(2026, 8, 24, 10, 0),
                        LocalDateTime.of(2026, 8, 24, 11, 0),
                        null
                ),
                authentication
        )).hasMessageContaining("Cancelled events cannot be changed");
    }
}
