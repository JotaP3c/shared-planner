package com.sharedplanner.calendar;

import java.util.UUID;

public record CalendarResponse(
        UUID id,
        String name,
        String ownerEmail,
        CalendarMemberRole memberRole,
        boolean canCreateEvents
) {
    static CalendarResponse from(SharedCalendar calendar) {
        return from(calendar, null);
    }

    static CalendarResponse from(SharedCalendar calendar, CalendarMemberRole memberRole) {
        return new CalendarResponse(
                calendar.getId(),
                calendar.getName(),
                calendar.getOwner().getEmail(),
                memberRole,
                memberRole != null && memberRole.canCreateEvents()
        );
    }

    static CalendarResponse fromSystemAdmin(SharedCalendar calendar) {
        return from(calendar, CalendarMemberRole.ADMIN);
    }
}
