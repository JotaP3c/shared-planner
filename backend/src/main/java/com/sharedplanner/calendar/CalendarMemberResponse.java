package com.sharedplanner.calendar;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Set;

public record CalendarMemberResponse(
        UUID id,
        UUID calendarId,
        String userEmail,
        String userFullName,
        CalendarMemberRole role,
        LocalDateTime createdAt,
        Set<CalendarMemberRole> roles
) {
    public static CalendarMemberResponse from(CalendarMember member) {
        return new CalendarMemberResponse(
                member.getId(),
                member.getCalendar().getId(),
                member.getUser().getEmail(),
                member.getUser().getFullName(),
                member.getRole(),
                member.getCreatedAt(),
                member.getRoles()
        );
    }
}
