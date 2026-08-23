package com.sharedplanner.config;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.calendar.CalendarMemberRole;
import com.sharedplanner.event.Event;
import com.sharedplanner.event.EventStatus;
import com.sharedplanner.event.EventType;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationServiceTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CalendarMemberRepository memberRepository;

    @Mock
    private Authentication authentication;

    @Mock
    private CalendarMember membership;

    @InjectMocks
    private AuthorizationService authorizationService;

    @Test
    void resolvesEditorFinancialAccessOnceAndEvaluatesOwnershipForEveryEvent() {
        UUID calendarId = UUID.randomUUID();
        String email = "editor@example.com";
        User editor = new User("Editor", email, "unused", UserRole.USER, null);
        User anotherCreator = new User("Another", "another@example.com", "unused", UserRole.USER, null);

        when(authentication.getName()).thenReturn(email);
        when(userRepository.findByEmailIgnoreCaseAndActiveTrue(email)).thenReturn(Optional.of(editor));
        when(memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId, email))
                .thenReturn(Optional.of(membership));
        when(membership.getRole()).thenReturn(CalendarMemberRole.EDITOR);

        AuthorizationService.EventFinancialAccess access = authorizationService
                .resolveEventFinancialAccess(calendarId, authentication);

        assertTrue(access.canView(clientEvent(editor, LocalDateTime.of(2026, 8, 24, 10, 0))));
        assertTrue(access.canView(clientEvent(editor, LocalDateTime.of(2026, 8, 24, 12, 0))));
        assertFalse(access.canView(clientEvent(anotherCreator, LocalDateTime.of(2026, 8, 24, 14, 0))));
        assertFalse(access.canView(personalEvent(editor, LocalDateTime.of(2026, 8, 24, 16, 0))));

        verify(userRepository, times(1)).findByEmailIgnoreCaseAndActiveTrue(email);
        verify(memberRepository, times(1))
                .findByCalendarIdAndUserEmailIgnoreCase(calendarId, email);
    }

    private Event clientEvent(User creator, LocalDateTime startsAt) {
        Event event = new Event(null, creator);
        event.fill(
                EventType.CLIENT,
                EventStatus.SCHEDULED,
                "Client appointment",
                "Client",
                null,
                "Description",
                "Service",
                new BigDecimal("100.00"),
                startsAt,
                startsAt.plusHours(1),
                null,
                creator
        );
        return event;
    }

    private Event personalEvent(User creator, LocalDateTime startsAt) {
        Event event = new Event(null, creator);
        event.fill(
                EventType.PERSONAL,
                EventStatus.SCHEDULED,
                "Personal event",
                null,
                "Person",
                "Description",
                null,
                null,
                startsAt,
                startsAt.plusHours(1),
                null,
                creator
        );
        return event;
    }
}
