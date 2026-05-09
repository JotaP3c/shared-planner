package com.sharedplanner.calendar;

import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CalendarService {

    private final SharedCalendarRepository calendarRepository;
    private final CalendarMemberRepository memberRepository;
    private final UserRepository userRepository;

    public CalendarService(
            SharedCalendarRepository calendarRepository,
            CalendarMemberRepository memberRepository,
            UserRepository userRepository
    ) {
        this.calendarRepository = calendarRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public CalendarResponse create(CreateCalendarRequest request, Authentication authentication) {
        User currentUser = currentUser(authentication);

        SharedCalendar calendar = calendarRepository.save(new SharedCalendar(request.name(), currentUser));
        memberRepository.save(new CalendarMember(calendar, currentUser, CalendarMemberRole.OWNER));

        return CalendarResponse.from(calendar);
    }

    @Transactional(readOnly = true)
    public List<CalendarResponse> list(Authentication authentication) {
        return memberRepository.findByUserEmailIgnoreCase(authentication.getName())
                .stream()
                .map(member -> CalendarResponse.from(member.getCalendar()))
                .toList();
    }

    @Transactional
    public void addMember(UUID calendarId, AddCalendarMemberRequest request, Authentication authentication) {
        CalendarMember currentMember = memberRepository.findByCalendarIdAndUserEmailIgnoreCase(calendarId, authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Calendar not found"));

        if (currentMember.getRole() != CalendarMemberRole.OWNER) {
            throw new IllegalArgumentException("Only calendar owner can add members");
        }

        SharedCalendar calendar = currentMember.getCalendar();
        User newMember = userRepository.findByEmailIgnoreCaseAndActiveTrue(request.email())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!memberRepository.existsByCalendarIdAndUserId(calendarId, newMember.getId())) {
            memberRepository.save(new CalendarMember(calendar, newMember, CalendarMemberRole.MEMBER));
        }
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmailIgnoreCaseAndActiveTrue(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
