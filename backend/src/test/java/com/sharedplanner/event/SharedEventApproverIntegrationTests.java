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
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BR-SHARED-001 / BR-SHARED-004: ao reabrir um SHARED sem informar novo aprovador,
 * o aprovador herdado precisa continuar ativo e membro atual do calendário.
 * Caso contrário o evento ficaria PENDING_APPROVAL para alguém que nunca pode decidir.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Transactional
class SharedEventApproverIntegrationTests {

    private static final LocalDateTime START = LocalDateTime.of(2026, 9, 1, 10, 0);
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
    void reopeningSharedEventRejectsInheritedApproverWhoIsNoLongerMember() {
        User owner = user("removed-approver-owner@example.com", UserRole.ADMIN);
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("removed-approver", owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        User target = user("removed-approver-target@example.com", UserRole.USER);
        CalendarMember targetMembership = memberRepository.save(
                new CalendarMember(calendar, target, CalendarMemberRole.EDITOR, owner));
        var ownerAuth = new UsernamePasswordAuthenticationToken(owner.getEmail(), null);

        EventResponse created = eventService.create(sharedCreate(calendar, target.getEmail()), ownerAuth);
        memberRepository.delete(targetMembership);
        memberRepository.flush();

        assertThatThrownBy(() -> eventService.update(created.id(), sharedUpdate(null), ownerAuth))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("approver is no longer an active calendar member");

        Event event = eventRepository.findById(created.id()).orElseThrow();
        assertThat(event.getTitle()).isEqualTo("Shared appointment");
    }

    @Test
    void reopeningSharedEventRejectsInheritedCreatorWhoIsNoLongerMember() {
        User admin = user("removed-creator-admin@example.com", UserRole.ADMIN);
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("removed-creator", admin));
        memberRepository.save(new CalendarMember(calendar, admin, CalendarMemberRole.ADMIN, admin));
        User creator = user("removed-creator-creator@example.com", UserRole.USER);
        CalendarMember creatorMembership = memberRepository.save(
                new CalendarMember(calendar, creator, CalendarMemberRole.EDITOR, admin));
        User target = user("removed-creator-target@example.com", UserRole.USER);
        memberRepository.save(new CalendarMember(calendar, target, CalendarMemberRole.EDITOR, admin));

        EventResponse created = eventService.create(
                sharedCreate(calendar, target.getEmail()),
                new UsernamePasswordAuthenticationToken(creator.getEmail(), null)
        );
        memberRepository.delete(creatorMembership);
        memberRepository.flush();

        // O alvo (EDITOR) edita sem informar e-mail: o fallback seria o criador, que saiu do calendário.
        assertThatThrownBy(() -> eventService.update(
                created.id(),
                sharedUpdate(null),
                new UsernamePasswordAuthenticationToken(target.getEmail(), null)
        )).hasMessageContaining("approver is no longer an active calendar member");
    }

    @Test
    void reopeningSharedEventKeepsInheritedApproverWhileStillActiveMember() {
        User owner = user("valid-approver-owner@example.com", UserRole.ADMIN);
        SharedCalendar calendar = calendarRepository.save(new SharedCalendar("valid-approver", owner));
        memberRepository.save(new CalendarMember(calendar, owner, CalendarMemberRole.ADMIN, owner));
        User target = user("valid-approver-target@example.com", UserRole.USER);
        memberRepository.save(new CalendarMember(calendar, target, CalendarMemberRole.VIEWER, owner));
        var ownerAuth = new UsernamePasswordAuthenticationToken(owner.getEmail(), null);

        EventResponse created = eventService.create(sharedCreate(calendar, target.getEmail()), ownerAuth);
        EventResponse updated = eventService.update(created.id(), sharedUpdate(null), ownerAuth);

        assertThat(updated.status()).isEqualTo(EventStatus.PENDING_APPROVAL);
        assertThat(updated.approvalRequestedFromEmail()).isEqualTo(target.getEmail());
    }

    private User user(String email, UserRole role) {
        return userRepository.save(new User("User " + email, email, "unused", role, null));
    }

    private CreateEventRequest sharedCreate(SharedCalendar calendar, String targetEmail) {
        return new CreateEventRequest(
                calendar.getId(),
                EventType.SHARED,
                "Shared appointment",
                null,
                null,
                "Description",
                null,
                null,
                START,
                END,
                targetEmail
        );
    }

    private UpdateEventRequest sharedUpdate(String approvalEmail) {
        return new UpdateEventRequest(
                EventType.SHARED,
                "Shared appointment edited",
                null,
                null,
                "Edited description",
                null,
                null,
                START.plusHours(2),
                END.plusHours(2),
                approvalEmail
        );
    }
}
