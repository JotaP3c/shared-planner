package com.sharedplanner.calendar;

import java.util.Set;

public record UpdateCalendarMemberRequest(
        CalendarMemberRole role,
        Set<CalendarMemberRole> roles
) {
    public UpdateCalendarMemberRequest(CalendarMemberRole role) { this(role, null); }
}
