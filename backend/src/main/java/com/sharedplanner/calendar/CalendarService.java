package com.sharedplanner.calendar;

import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import com.sharedplanner.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class CalendarService {

    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AuthorizationService authorizationService;

    public CalendarService(
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository,
            AuthorizationService authorizationService
    ) {
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.authorizationService = authorizationService;
    }

    @Transactional
    public CalendarResponse create(CreateCalendarRequest request, Authentication authentication) {
        authorizationService.ensureCanCreateCalendar(authentication);

        User currentUser = currentUser(authentication);

        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(request.name(), currentUser));
        memberRepository.save(new CalendarMember(calendar, currentUser, CalendarMemberRole.ADMIN));

        return CalendarResponse.from(calendar);
    }


    @Transactional(readOnly = true)
    public List<CalendarResponse> list(Authentication authentication) {
        User currentUser = currentUser(authentication);

        if (currentUser.getRole() == UserRole.ADMIN) {
            return calendarRepository.findAll()
                    .stream()
                    .map(CalendarResponse::from)
                    .toList();
        }

        return memberRepository.findByUserEmailIgnoreCase(currentUser.getEmail())
                .stream()
                .map(member -> CalendarResponse.from(member.getCalendar()))
                .toList();
    }

    @Transactional
    public void addMember(UUID calendarId, AddCalendarMemberRequest request, Authentication authentication) {
        authorizationService.ensureCanManageCalendar(calendarId, authentication);

        SharedCalendar calendar = calendarRepository.findById(calendarId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found"));

        User newMember = userRepository.findByEmailIgnoreCaseAndActiveTrue(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        CalendarMemberRole role = memberRole(request.role());

        memberRepository.findByCalendarIdAndUserId(calendarId, newMember.getId())
                .ifPresentOrElse(
                        member -> member.changeRole(role),
                        () -> memberRepository.save(new CalendarMember(calendar, newMember, role))
                );
    }

    private CalendarMemberRole memberRole(CalendarMemberRole role) {
        if (role == null) {
            return CalendarMemberRole.VIEWER;
        }

        return role;
    }


    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
