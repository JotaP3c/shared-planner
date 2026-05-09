package com.sharedplanner.calendar;

import java.util.UUID;

public record CalendarResponse(
        UUID id,
        String name,
        String ownerEmail
) {
    static CalendarResponse from(SharedCalendar calendar) {
        return new CalendarResponse(
                calendar.getId(),
                calendar.getName(),
                calendar.getOwner().getEmail()
        );
    }
}
