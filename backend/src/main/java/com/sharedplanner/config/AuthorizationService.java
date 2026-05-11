package com.sharedplanner.config;

import com.sharedplanner.calendar.CalendarMember;
import com.sharedplanner.calendar.CalendarMemberRepository;
import com.sharedplanner.event.Event;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class AuthorizationService {

    private final UserRepository userRepository;
    private final CalendarMemberRepository memberRepository;

    public AuthorizationService(
            UserRepository userRepository,
            CalendarMemberRepository memberRepository
    ) {
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
    }

    public void ensureCalendarVisible(UUID calendarId, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        requireMember(calendarId, authentication.getName());
    }

    public void ensureSystemAdmin(Authentication authentication) {
        if (currentUser(authentication).getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can manage users");
        }
    }

    public void ensureCanCreateCalendar(Authentication authentication) {
        User user = currentUser(authentication);

        if (user.getRole() != UserRole.ADMIN && user.getRole() != UserRole.FINANCE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot create calendars");
        }
    }

    public void ensureCanManageCalendar(UUID calendarId, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        CalendarMember member = requireMember(calendarId, authentication.getName());

        if (!member.getRole().canManageMembers()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only calendar admin can manage members");
        }
    }

    public void ensureCanCreateEvent(UUID calendarId, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        CalendarMember member = requireMember(calendarId, authentication.getName());

        if (!member.getRole().canCreateEvents()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot create events in this calendar");
        }
    }

    public void ensureCanEditEvent(Event event, Authentication authentication) {
        if (isAdmin(authentication)) {
            return;
        }

        CalendarMember member = requireMember(event.getCalendar().getId(), authentication.getName());

        if (member.getRole().canEditAllEvents()) {
            return;
        }

        if (member.getRole().canEditOwnEvents()
                && event.getCreatedBy().getEmail().equalsIgnoreCase(authentication.getName())) {
            return;
        }

        if (event.getEventType().name().equals("SHARED")
                && member.getRole().canCreateEvents()
                && event.getApprovalRequestedFrom() != null
                && event.getApprovalRequestedFrom().getEmail().equalsIgnoreCase(authentication.getName())) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot change this event");
    }


    public void ensureCanUseFinance(UUID calendarId, Authentication authentication) {
        User user = currentUser(authentication);

        if (user.getRole() == UserRole.ADMIN) {
            return;
        }

        CalendarMember member = requireMember(calendarId, authentication.getName());

        if (user.getRole() == UserRole.FINANCE || member.getRole().canUseFinance()) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access finance module");
    }

    private boolean isAdmin(Authentication authentication) {
        return currentUser(authentication).getRole() == UserRole.ADMIN;
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private CalendarMember requireMember(UUID calendarId, String email) {
        return memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId, email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));
    }
}
