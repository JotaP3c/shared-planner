package com.sharedplanner.calendar;

import jakarta.validation.constraints.NotNull;

public record UpdateCalendarMemberRequest(
        @NotNull CalendarMemberRole role
) {}
